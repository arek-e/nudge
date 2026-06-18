import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer } from "effect";
import {
  commitments,
  events,
  outcomes,
  frames,
  journalDocuments,
  journalRevisions,
  proposals,
  reviews,
  schema,
  syntheses,
  synthesisSources,
  users,
} from "./schema";

export type DatabaseProvider = "memory" | "d1" | "planetscale" | "turso" | "postgres";

export const createD1DrizzleDatabase = (database: D1Database) => drizzle(database, { schema });

export interface DbUser {
  readonly id: string;
  readonly displayName: string;
}

export interface AppendEventInput {
  readonly userId: string;
  readonly type: string;
  readonly source: string;
  readonly occurredAt: string;
  readonly schemaVersion: number;
  readonly idempotencyKey?: string;
  readonly payload: unknown;
}

export interface RecentEventsInput {
  readonly userId: string;
  readonly limit: number;
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
}

export interface EventRecord extends AppendEventInput {
  readonly id: string;
  readonly createdAt: string;
}

export interface UpsertCurrentFrameInput {
  readonly userId: string;
  readonly key: string;
  readonly title: string;
  readonly prompt: string;
}

export interface GetCurrentFrameInput {
  readonly userId: string;
  readonly key: string;
}

export interface FrameRecord extends UpsertCurrentFrameInput {
  readonly id: string;
  readonly status: "active";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppendSynthesisInput {
  readonly userId: string;
  readonly frameId: string;
  readonly summary: string;
  readonly themes: ReadonlyArray<string>;
  readonly openQuestions: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
}

export interface GetLatestSynthesisInput {
  readonly userId: string;
  readonly frameId: string;
}

export interface SynthesisRecord extends AppendSynthesisInput {
  readonly id: string;
  readonly generatedAt: string;
  readonly createdAt: string;
}

export type ProposalKind = "clarify" | "follow_up" | "commit" | "ignore";
export type ProposalStatus = "pending" | "accepted" | "edited" | "rejected";
export type ReviewDecision = "accepted" | "edited" | "rejected";

export interface AppendProposalInput {
  readonly userId: string;
  readonly synthesisId: string;
  readonly kind: ProposalKind;
  readonly title: string;
  readonly body: string;
  readonly rationale: string;
}

export interface ProposalRecord extends AppendProposalInput {
  readonly id: string;
  readonly status: ProposalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListPendingProposalsInput {
  readonly userId: string;
  readonly limit: number;
}

export interface GetProposalInput {
  readonly userId: string;
  readonly proposalId: string;
}

export interface GetReviewForProposalInput {
  readonly userId: string;
  readonly proposalId: string;
}

export interface ReviewProposalInput {
  readonly userId: string;
  readonly proposalId: string;
  readonly decision: ReviewDecision;
  readonly editedTitle?: string;
  readonly editedBody?: string;
  readonly editedBodyDocument?: unknown;
}

export interface ReviewRecord extends ReviewProposalInput {
  readonly id: string;
  readonly createdAt: string;
}

export type CommitmentStatus = "active" | "completed" | "abandoned";

export interface AppendCommitmentInput {
  readonly userId: string;
  readonly proposalId: string;
  readonly reviewId: string;
  readonly title: string;
  readonly body: string;
  readonly bodyDocument?: unknown;
}

export interface CommitmentRecord extends AppendCommitmentInput {
  readonly id: string;
  readonly status: CommitmentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListCommitmentsInput {
  readonly userId: string;
  readonly limit: number;
  readonly status?: CommitmentStatus;
}

export type OutcomeResult = "completed" | "abandoned";

export interface RecordOutcomeInput {
  readonly userId: string;
  readonly commitmentId: string;
  readonly result: OutcomeResult;
  readonly note?: string;
}

export interface OutcomeRecord extends RecordOutcomeInput {
  readonly id: string;
  readonly recordedAt: string;
  readonly createdAt: string;
}

export interface ListOutcomesInput {
  readonly userId: string;
  readonly limit: number;
}

export interface UserDataExport {
  readonly user: DbUser;
  readonly commitments: ReadonlyArray<CommitmentRecord>;
  readonly events: ReadonlyArray<EventRecord>;
  readonly frames: ReadonlyArray<FrameRecord>;
  readonly journalDocuments: ReadonlyArray<JournalDocumentRecord>;
  readonly journalRevisions: ReadonlyArray<JournalRevisionRecord>;
  readonly outcomes: ReadonlyArray<OutcomeRecord>;
  readonly proposals: ReadonlyArray<ProposalRecord>;
  readonly reviews: ReadonlyArray<ReviewRecord>;
  readonly syntheses: ReadonlyArray<SynthesisRecord>;
}

export interface UpsertJournalDocumentInput {
  readonly userId: string;
  readonly localDate: string;
  readonly title: string;
  readonly bodyText: string;
  readonly bodyDocument?: unknown;
}

export interface JournalDocumentRecord extends UpsertJournalDocumentInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JournalRevisionRecord {
  readonly id: string;
  readonly documentId: string;
  readonly userId: string;
  readonly bodyText: string;
  readonly changedText: string;
  readonly diffSummary: string;
  readonly createdAt: string;
}

export interface UpsertJournalDocumentResult {
  readonly document: JournalDocumentRecord;
  readonly revision: JournalRevisionRecord;
}

export interface DbService {
  readonly provider: DatabaseProvider;
  readonly deleteUserData: (input: { readonly userId: string }) => Effect.Effect<void>;
  readonly ensureUser: (user: DbUser) => Effect.Effect<void>;
  readonly exportUserData: (user: DbUser) => Effect.Effect<UserDataExport>;
  readonly appendEvent: (input: AppendEventInput) => Effect.Effect<EventRecord>;
  readonly appendCommitment: (input: AppendCommitmentInput) => Effect.Effect<CommitmentRecord>;
  readonly appendProposal: (input: AppendProposalInput) => Effect.Effect<ProposalRecord>;
  readonly appendSynthesis: (input: AppendSynthesisInput) => Effect.Effect<SynthesisRecord>;
  readonly getCurrentFrame: (input: GetCurrentFrameInput) => Effect.Effect<FrameRecord | null>;
  readonly getLatestSynthesis: (
    input: GetLatestSynthesisInput,
  ) => Effect.Effect<SynthesisRecord | null>;
  readonly getJournalDocument: (input: {
    readonly userId: string;
    readonly localDate: string;
  }) => Effect.Effect<JournalDocumentRecord | null>;
  readonly getProposal: (input: GetProposalInput) => Effect.Effect<ProposalRecord | null>;
  readonly getReviewForProposal: (
    input: GetReviewForProposalInput,
  ) => Effect.Effect<ReviewRecord | null>;
  readonly listRecentEvents: (
    input: RecentEventsInput,
  ) => Effect.Effect<ReadonlyArray<EventRecord>>;
  readonly listPendingProposals: (
    input: ListPendingProposalsInput,
  ) => Effect.Effect<ReadonlyArray<ProposalRecord>>;
  readonly listCommitments: (
    input: ListCommitmentsInput,
  ) => Effect.Effect<ReadonlyArray<CommitmentRecord>>;
  readonly listOutcomes: (input: ListOutcomesInput) => Effect.Effect<ReadonlyArray<OutcomeRecord>>;
  readonly listJournalRevisions: (input: {
    readonly userId: string;
    readonly documentId: string;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<JournalRevisionRecord>>;
  readonly recordOutcome: (input: RecordOutcomeInput) => Effect.Effect<OutcomeRecord>;
  readonly reviewProposal: (input: ReviewProposalInput) => Effect.Effect<ReviewRecord>;
  readonly upsertJournalDocument: (
    input: UpsertJournalDocumentInput,
  ) => Effect.Effect<UpsertJournalDocumentResult>;
  readonly upsertCurrentFrame: (input: UpsertCurrentFrameInput) => Effect.Effect<FrameRecord>;
}

const nowIso = () => new Date().toISOString();
const eventId = () => crypto.randomUUID();

const byRecentEvent = (left: EventRecord, right: EventRecord) => {
  return (
    right.occurredAt.localeCompare(left.occurredAt) || right.createdAt.localeCompare(left.createdAt)
  );
};

const sameReadonlyArray = <A>(left: ReadonlyArray<A>, right: ReadonlyArray<A>) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const sameSynthesisInput = (synthesis: SynthesisRecord, input: AppendSynthesisInput) =>
  synthesis.userId === input.userId &&
  synthesis.frameId === input.frameId &&
  synthesis.summary === input.summary &&
  sameReadonlyArray(synthesis.themes, input.themes) &&
  sameReadonlyArray(synthesis.openQuestions, input.openQuestions) &&
  sameReadonlyArray(synthesis.sourceSignalIds, input.sourceSignalIds);

const sameProposalInput = (proposal: ProposalRecord, input: AppendProposalInput) =>
  proposal.userId === input.userId &&
  proposal.synthesisId === input.synthesisId &&
  proposal.kind === input.kind &&
  proposal.title === input.title &&
  proposal.body === input.body &&
  proposal.rationale === input.rationale;

const synthesisFingerprint = (input: AppendSynthesisInput) =>
  JSON.stringify({
    openQuestions: input.openQuestions,
    sourceSignalIds: input.sourceSignalIds,
    summary: input.summary,
    themes: input.themes,
  });

const toProposalRecord = (row: typeof proposals.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  synthesisId: row.synthesisId,
  kind: row.kind as ProposalKind,
  status: row.status as ProposalStatus,
  title: row.title,
  body: row.body,
  rationale: row.rationale,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toFrameRecord = (row: typeof frames.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  key: row.key,
  title: row.title,
  prompt: row.prompt,
  status: "active" as const,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toReviewRecord = (row: typeof reviews.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  proposalId: row.proposalId,
  decision: row.decision as ReviewDecision,
  ...(row.editedTitle !== null ? { editedTitle: row.editedTitle } : {}),
  ...(row.editedBody !== null ? { editedBody: row.editedBody } : {}),
  ...(row.editedBodyDocument !== null ? { editedBodyDocument: row.editedBodyDocument } : {}),
  createdAt: row.createdAt,
});

const toEventRecord = (row: typeof events.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  type: row.type,
  source: row.source,
  occurredAt: row.occurredAt,
  schemaVersion: Number(row.schemaVersion),
  ...(row.idempotencyKey ? { idempotencyKey: row.idempotencyKey } : {}),
  payload: row.payload,
  createdAt: row.createdAt,
});

const toCommitmentRecord = (row: typeof commitments.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  proposalId: row.proposalId,
  reviewId: row.reviewId,
  title: row.title,
  body: row.body,
  ...(row.bodyDocument !== null ? { bodyDocument: row.bodyDocument } : {}),
  status: row.status as CommitmentStatus,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toOutcomeRecord = (row: typeof outcomes.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  commitmentId: row.commitmentId,
  result: row.result as OutcomeResult,
  ...(row.note !== null ? { note: row.note } : {}),
  recordedAt: row.recordedAt,
  createdAt: row.createdAt,
});

const sameOutcomeInput = (outcome: OutcomeRecord, input: RecordOutcomeInput) =>
  outcome.result === input.result && outcome.note === input.note;

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const optionalJsonText = (value: unknown) => (value === undefined ? null : JSON.stringify(value));

const changedTextFrom = (previous: string | null, next: string) => {
  if (!previous) return next;
  if (next.startsWith(previous)) return next.slice(previous.length).trim();
  return next;
};

const diffSummaryFrom = (previous: string | null, next: string, changedText: string) => {
  if (!previous) return "Created daily journal document.";
  if (changedText.length === 0) return "Saved without text changes.";
  return "Updated daily journal document.";
};

const toJournalDocumentRecord = (row: typeof journalDocuments.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  localDate: row.localDate,
  title: row.title,
  bodyText: row.bodyText,
  ...(row.bodyDocument !== null ? { bodyDocument: row.bodyDocument } : {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toJournalRevisionRecord = (row: typeof journalRevisions.$inferSelect) => ({
  id: row.id,
  documentId: row.documentId,
  userId: row.userId,
  bodyText: row.bodyText,
  changedText: row.changedText,
  diffSummary: row.diffSummary,
  createdAt: row.createdAt,
});

export class Db extends Context.Service<Db, DbService>()("lares/db/Db") {
  static readonly layerMemory = Layer.effect(
    Db,
    Effect.sync(() => {
      const userStore = new Map<string, DbUser>();
      const commitmentStore = new Map<string, CommitmentRecord>();
      const eventStore = new Map<string, EventRecord>();
      const outcomeStore = new Map<string, OutcomeRecord>();
      const frameStore = new Map<string, FrameRecord>();
      const journalDocumentStore = new Map<string, JournalDocumentRecord>();
      const journalRevisionStore = new Map<string, JournalRevisionRecord>();
      const proposalStore = new Map<string, ProposalRecord>();
      const reviewStore = new Map<string, ReviewRecord>();
      const synthesisStore = new Map<string, SynthesisRecord>();

      return Db.of({
        provider: "memory",
        deleteUserData: (input) =>
          Effect.sync(() => {
            for (const store of [
              commitmentStore,
              eventStore,
              outcomeStore,
              frameStore,
              journalDocumentStore,
              journalRevisionStore,
              proposalStore,
              reviewStore,
              synthesisStore,
            ]) {
              for (const record of store.values()) {
                if (record.userId === input.userId) store.delete(record.id);
              }
            }
            userStore.delete(input.userId);
          }),
        ensureUser: (user) =>
          Effect.sync(() => {
            userStore.set(user.id, user);
          }).pipe(Effect.withSpan("Db.ensureUser", { attributes: { provider: "memory" } })),
        exportUserData: (user) =>
          Effect.sync(() => ({
            user,
            commitments: [...commitmentStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            events: [...eventStore.values()].filter((record) => record.userId === user.id),
            frames: [...frameStore.values()].filter((record) => record.userId === user.id),
            journalDocuments: [...journalDocumentStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            journalRevisions: [...journalRevisionStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            outcomes: [...outcomeStore.values()].filter((record) => record.userId === user.id),
            proposals: [...proposalStore.values()].filter((record) => record.userId === user.id),
            reviews: [...reviewStore.values()].filter((record) => record.userId === user.id),
            syntheses: [...synthesisStore.values()].filter((record) => record.userId === user.id),
          })),
        appendEvent: (input) =>
          Effect.sync(() => {
            if (input.idempotencyKey) {
              const existing = [...eventStore.values()].find(
                (event) =>
                  event.userId === input.userId && event.idempotencyKey === input.idempotencyKey,
              );
              if (existing) return existing;
            }

            const record = {
              ...input,
              id: eventId(),
              createdAt: nowIso(),
            } satisfies EventRecord;
            eventStore.set(record.id, record);
            return record;
          }).pipe(
            Effect.withSpan("Db.appendEvent", {
              attributes: { provider: "memory", eventType: input.type, userId: input.userId },
            }),
          ),
        appendCommitment: (input) =>
          Effect.sync(() => {
            const existing = [...commitmentStore.values()].find(
              (commitment) => commitment.proposalId === input.proposalId,
            );
            if (existing) return existing;

            const timestamp = nowIso();
            const record = {
              ...input,
              id: eventId(),
              status: "active",
              createdAt: timestamp,
              updatedAt: timestamp,
            } satisfies CommitmentRecord;
            commitmentStore.set(record.id, record);
            return record;
          }),
        appendProposal: (input) =>
          Effect.sync(() => {
            const existing = [...proposalStore.values()].find((proposal) =>
              sameProposalInput(proposal, input),
            );
            if (existing) return existing;

            const timestamp = nowIso();
            const record = {
              ...input,
              id: eventId(),
              status: "pending",
              createdAt: timestamp,
              updatedAt: timestamp,
            } satisfies ProposalRecord;
            proposalStore.set(record.id, record);
            return record;
          }),
        appendSynthesis: (input) =>
          Effect.sync(() => {
            const existing = [...synthesisStore.values()].find((synthesis) =>
              sameSynthesisInput(synthesis, input),
            );
            if (existing) return existing;

            const record = {
              ...input,
              id: eventId(),
              generatedAt: nowIso(),
              createdAt: nowIso(),
            } satisfies SynthesisRecord;
            synthesisStore.set(record.id, record);
            return record;
          }),
        getCurrentFrame: (input) =>
          Effect.sync(() => frameStore.get(`${input.userId}:${input.key}`) ?? null),
        getLatestSynthesis: (input) =>
          Effect.sync(() => {
            return (
              [...synthesisStore.values()]
                .filter(
                  (synthesis) =>
                    synthesis.userId === input.userId && synthesis.frameId === input.frameId,
                )
                .sort(
                  (left, right) =>
                    right.generatedAt.localeCompare(left.generatedAt) ||
                    right.createdAt.localeCompare(left.createdAt),
                )[0] ?? null
            );
          }),
        getJournalDocument: (input) =>
          Effect.sync(() => journalDocumentStore.get(`${input.userId}:${input.localDate}`) ?? null),
        getProposal: (input) =>
          Effect.sync(() => {
            const proposal = proposalStore.get(input.proposalId);
            return proposal?.userId === input.userId ? proposal : null;
          }),
        getReviewForProposal: (input) =>
          Effect.sync(() => {
            return (
              [...reviewStore.values()].find(
                (review) =>
                  review.proposalId === input.proposalId && review.userId === input.userId,
              ) ?? null
            );
          }),
        listRecentEvents: (input) =>
          Effect.sync(() => {
            return [...eventStore.values()]
              .filter((event) => event.userId === input.userId)
              .filter((event) => !input.occurredFrom || event.occurredAt >= input.occurredFrom)
              .filter((event) => !input.occurredTo || event.occurredAt <= input.occurredTo)
              .sort(byRecentEvent)
              .slice(0, input.limit);
          }).pipe(
            Effect.withSpan("Db.listRecentEvents", {
              attributes: { provider: "memory", userId: input.userId, limit: input.limit },
            }),
          ),
        listPendingProposals: (input) =>
          Effect.sync(() => {
            return [...proposalStore.values()]
              .filter((proposal) => proposal.userId === input.userId)
              .filter((proposal) => proposal.status === "pending")
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .slice(0, input.limit);
          }),
        listCommitments: (input) =>
          Effect.sync(() => {
            return [...commitmentStore.values()]
              .filter((commitment) => commitment.userId === input.userId)
              .filter((commitment) => !input.status || commitment.status === input.status)
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .slice(0, input.limit);
          }),
        listOutcomes: (input) =>
          Effect.sync(() => {
            return [...outcomeStore.values()]
              .filter((outcome) => outcome.userId === input.userId)
              .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
              .slice(0, input.limit);
          }),
        listJournalRevisions: (input) =>
          Effect.sync(() => {
            return [...journalRevisionStore.values()]
              .filter(
                (revision) =>
                  revision.userId === input.userId && revision.documentId === input.documentId,
              )
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .slice(0, input.limit);
          }),
        recordOutcome: (input) =>
          Effect.sync(() => {
            const existingOutcome = [...outcomeStore.values()].find(
              (outcome) => outcome.commitmentId === input.commitmentId,
            );
            if (existingOutcome) {
              if (sameOutcomeInput(existingOutcome, input)) return existingOutcome;
              throw new Error("Commitment outcome already recorded");
            }

            const commitment = commitmentStore.get(input.commitmentId);
            if (
              !commitment ||
              commitment.userId !== input.userId ||
              commitment.status !== "active"
            ) {
              throw new Error("Commitment not found");
            }

            const timestamp = nowIso();
            const outcome = {
              ...input,
              id: eventId(),
              recordedAt: timestamp,
              createdAt: timestamp,
            } satisfies OutcomeRecord;
            outcomeStore.set(outcome.id, outcome);
            commitmentStore.set(commitment.id, {
              ...commitment,
              status: input.result,
              updatedAt: timestamp,
            });
            return outcome;
          }),
        reviewProposal: (input) =>
          Effect.sync(() => {
            const existing = [...reviewStore.values()].find(
              (review) => review.proposalId === input.proposalId && review.userId === input.userId,
            );
            if (existing) {
              if (
                existing.decision === input.decision &&
                existing.editedTitle === input.editedTitle &&
                existing.editedBody === input.editedBody &&
                JSON.stringify(existing.editedBodyDocument) ===
                  JSON.stringify(input.editedBodyDocument)
              ) {
                return existing;
              }
              throw new Error("Proposal already reviewed");
            }

            const proposal = proposalStore.get(input.proposalId);
            if (!proposal || proposal.userId !== input.userId || proposal.status !== "pending") {
              throw new Error("Proposal not found");
            }

            const timestamp = nowIso();
            proposalStore.set(proposal.id, {
              ...proposal,
              status: input.decision,
              updatedAt: timestamp,
              ...(input.editedTitle !== undefined ? { title: input.editedTitle } : {}),
              ...(input.editedBody !== undefined ? { body: input.editedBody } : {}),
            });
            const review = {
              ...input,
              id: eventId(),
              createdAt: timestamp,
            } satisfies ReviewRecord;
            reviewStore.set(review.id, review);
            return review;
          }),
        upsertCurrentFrame: (input) =>
          Effect.sync(() => {
            const key = `${input.userId}:${input.key}`;
            const previous = frameStore.get(key);
            const timestamp = nowIso();
            const record = {
              ...input,
              id: previous?.id ?? eventId(),
              status: "active",
              createdAt: previous?.createdAt ?? timestamp,
              updatedAt: timestamp,
            } satisfies FrameRecord;
            frameStore.set(key, record);
            return record;
          }),
        upsertJournalDocument: (input) =>
          Effect.sync(() => {
            const key = `${input.userId}:${input.localDate}`;
            const previous = journalDocumentStore.get(key) ?? null;
            const timestamp = nowIso();
            const changedText = changedTextFrom(previous?.bodyText ?? null, input.bodyText);
            const document = {
              ...input,
              id: previous?.id ?? eventId(),
              createdAt: previous?.createdAt ?? timestamp,
              updatedAt: timestamp,
            } satisfies JournalDocumentRecord;
            const revision = {
              id: eventId(),
              documentId: document.id,
              userId: input.userId,
              bodyText: input.bodyText,
              changedText,
              diffSummary: diffSummaryFrom(previous?.bodyText ?? null, input.bodyText, changedText),
              createdAt: timestamp,
            } satisfies JournalRevisionRecord;

            journalDocumentStore.set(key, document);
            journalRevisionStore.set(revision.id, revision);
            return { document, revision };
          }),
      });
    }),
  );

  static readonly layerD1 = (database: D1Database) =>
    Layer.effect(
      Db,
      Effect.sync(() => {
        const db = drizzle(database, { schema });

        return Db.of({
          provider: "d1",
          deleteUserData: (input) =>
            Effect.promise(async () => {
              await database.batch([
                database
                  .prepare(
                    "DELETE FROM synthesis_sources WHERE synthesis_id IN (SELECT id FROM syntheses WHERE user_id = ?)",
                  )
                  .bind(input.userId),
                database.prepare("DELETE FROM outcomes WHERE user_id = ?").bind(input.userId),
                database.prepare("DELETE FROM commitments WHERE user_id = ?").bind(input.userId),
                database.prepare("DELETE FROM reviews WHERE user_id = ?").bind(input.userId),
                database.prepare("DELETE FROM proposals WHERE user_id = ?").bind(input.userId),
                database.prepare("DELETE FROM syntheses WHERE user_id = ?").bind(input.userId),
                database.prepare("DELETE FROM frames WHERE user_id = ?").bind(input.userId),
                database.prepare("DELETE FROM events WHERE user_id = ?").bind(input.userId),
                database
                  .prepare("DELETE FROM journal_revisions WHERE user_id = ?")
                  .bind(input.userId),
                database
                  .prepare("DELETE FROM journal_documents WHERE user_id = ?")
                  .bind(input.userId),
                database.prepare("DELETE FROM users WHERE id = ?").bind(input.userId),
              ]);
            }),
          ensureUser: (user) =>
            Effect.promise(async () => {
              const timestamp = nowIso();
              await db
                .insert(users)
                .values({
                  id: user.id,
                  displayName: user.displayName,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })
                .onConflictDoUpdate({
                  target: users.id,
                  set: { displayName: user.displayName, updatedAt: timestamp },
                });
            }).pipe(Effect.withSpan("Db.ensureUser", { attributes: { provider: "d1" } })),
          exportUserData: (user) =>
            Effect.promise(async () => {
              const [
                eventRows,
                frameRows,
                synthesisRows,
                proposalRows,
                reviewRows,
                commitmentRows,
                outcomeRows,
                journalDocumentRows,
                journalRevisionRows,
              ] = await Promise.all([
                db.select().from(events).where(eq(events.userId, user.id)),
                db.select().from(frames).where(eq(frames.userId, user.id)),
                db.select().from(syntheses).where(eq(syntheses.userId, user.id)),
                db.select().from(proposals).where(eq(proposals.userId, user.id)),
                db.select().from(reviews).where(eq(reviews.userId, user.id)),
                db.select().from(commitments).where(eq(commitments.userId, user.id)),
                db.select().from(outcomes).where(eq(outcomes.userId, user.id)),
                db.select().from(journalDocuments).where(eq(journalDocuments.userId, user.id)),
                db.select().from(journalRevisions).where(eq(journalRevisions.userId, user.id)),
              ]);
              const synthesisRecords = await Promise.all(
                synthesisRows.map(async (row) => {
                  const sources = await db
                    .select()
                    .from(synthesisSources)
                    .where(eq(synthesisSources.synthesisId, row.id));
                  return {
                    id: row.id,
                    userId: row.userId,
                    frameId: row.frameId,
                    summary: row.summary,
                    themes: row.themes,
                    openQuestions: row.openQuestions,
                    sourceSignalIds: sources.map((source) => source.signalId),
                    generatedAt: row.generatedAt,
                    createdAt: row.createdAt,
                  } satisfies SynthesisRecord;
                }),
              );

              return {
                user,
                commitments: commitmentRows.map(toCommitmentRecord),
                events: eventRows.map(toEventRecord),
                frames: frameRows.map(toFrameRecord),
                journalDocuments: journalDocumentRows.map(toJournalDocumentRecord),
                journalRevisions: journalRevisionRows.map(toJournalRevisionRecord),
                outcomes: outcomeRows.map(toOutcomeRecord),
                proposals: proposalRows.map(toProposalRecord),
                reviews: reviewRows.map(toReviewRecord),
                syntheses: synthesisRecords,
              } satisfies UserDataExport;
            }),
          appendEvent: (input) =>
            Effect.promise(async () => {
              if (input.idempotencyKey) {
                const existing = await db
                  .select()
                  .from(events)
                  .where(
                    and(
                      eq(events.userId, input.userId),
                      eq(events.idempotencyKey, input.idempotencyKey),
                    ),
                  )
                  .get();
                if (existing) {
                  return {
                    id: existing.id,
                    userId: existing.userId,
                    type: existing.type,
                    source: existing.source,
                    occurredAt: existing.occurredAt,
                    schemaVersion: Number(existing.schemaVersion),
                    ...(existing.idempotencyKey ? { idempotencyKey: existing.idempotencyKey } : {}),
                    payload: existing.payload,
                    createdAt: existing.createdAt,
                  } satisfies EventRecord;
                }
              }

              const record = {
                ...input,
                id: eventId(),
                createdAt: nowIso(),
              } satisfies EventRecord;
              await db
                .insert(events)
                .values({
                  id: record.id,
                  userId: record.userId,
                  type: record.type,
                  source: record.source,
                  occurredAt: record.occurredAt,
                  schemaVersion: String(record.schemaVersion),
                  idempotencyKey: record.idempotencyKey ?? null,
                  payload: record.payload,
                  createdAt: record.createdAt,
                })
                .onConflictDoNothing({ target: [events.userId, events.idempotencyKey] });

              if (record.idempotencyKey) {
                const created = await db
                  .select()
                  .from(events)
                  .where(
                    and(
                      eq(events.userId, input.userId),
                      eq(events.idempotencyKey, record.idempotencyKey),
                    ),
                  )
                  .get();
                if (created) {
                  return {
                    id: created.id,
                    userId: created.userId,
                    type: created.type,
                    source: created.source,
                    occurredAt: created.occurredAt,
                    schemaVersion: Number(created.schemaVersion),
                    ...(created.idempotencyKey ? { idempotencyKey: created.idempotencyKey } : {}),
                    payload: created.payload,
                    createdAt: created.createdAt,
                  } satisfies EventRecord;
                }
              }
              return record;
            }).pipe(
              Effect.withSpan("Db.appendEvent", {
                attributes: { provider: "d1", eventType: input.type, userId: input.userId },
              }),
            ),
          appendCommitment: (input) =>
            Effect.promise(async () => {
              const existing = await db
                .select()
                .from(commitments)
                .where(eq(commitments.proposalId, input.proposalId))
                .get();
              if (existing) return toCommitmentRecord(existing);

              const timestamp = nowIso();
              const record = {
                ...input,
                id: eventId(),
                status: "active",
                createdAt: timestamp,
                updatedAt: timestamp,
              } satisfies CommitmentRecord;
              await db.insert(commitments).values(record).onConflictDoNothing({
                target: commitments.proposalId,
              });

              const created = await db
                .select()
                .from(commitments)
                .where(eq(commitments.proposalId, input.proposalId))
                .get();
              if (!created) throw new Error("Commitment not created");
              return toCommitmentRecord(created);
            }),
          appendProposal: (input) =>
            Effect.promise(async () => {
              const existing = await db
                .select()
                .from(proposals)
                .where(
                  and(
                    eq(proposals.synthesisId, input.synthesisId),
                    eq(proposals.kind, input.kind),
                    eq(proposals.title, input.title),
                    eq(proposals.body, input.body),
                  ),
                )
                .get();
              if (existing) return toProposalRecord(existing);

              const timestamp = nowIso();
              const record = {
                ...input,
                id: eventId(),
                status: "pending",
                createdAt: timestamp,
                updatedAt: timestamp,
              } satisfies ProposalRecord;
              await db
                .insert(proposals)
                .values(record)
                .onConflictDoNothing({
                  target: [proposals.synthesisId, proposals.kind, proposals.title, proposals.body],
                });
              const created = await db
                .select()
                .from(proposals)
                .where(
                  and(
                    eq(proposals.synthesisId, input.synthesisId),
                    eq(proposals.kind, input.kind),
                    eq(proposals.title, input.title),
                    eq(proposals.body, input.body),
                  ),
                )
                .get();
              if (!created) throw new Error("Proposal not created");
              return toProposalRecord(created);
            }),
          appendSynthesis: (input) =>
            Effect.promise(async () => {
              const fingerprint = synthesisFingerprint(input);
              const existing = await db
                .select()
                .from(syntheses)
                .where(
                  and(
                    eq(syntheses.userId, input.userId),
                    eq(syntheses.frameId, input.frameId),
                    eq(syntheses.fingerprint, fingerprint),
                  ),
                )
                .orderBy(desc(syntheses.generatedAt), desc(syntheses.createdAt));

              const existingWithSources = await Promise.all(
                existing.map(async (row) => ({
                  row,
                  sources: await db
                    .select()
                    .from(synthesisSources)
                    .where(eq(synthesisSources.synthesisId, row.id)),
                })),
              );

              for (const { row, sources } of existingWithSources) {
                const candidate = {
                  id: row.id,
                  userId: row.userId,
                  frameId: row.frameId,
                  summary: row.summary,
                  themes: row.themes,
                  openQuestions: row.openQuestions,
                  sourceSignalIds: sources.map((source) => source.signalId),
                  generatedAt: row.generatedAt,
                  createdAt: row.createdAt,
                } satisfies SynthesisRecord;
                if (sameSynthesisInput(candidate, input)) return candidate;
              }

              const record = {
                ...input,
                id: eventId(),
                generatedAt: nowIso(),
                createdAt: nowIso(),
              } satisfies SynthesisRecord;
              await db
                .insert(syntheses)
                .values({
                  id: record.id,
                  userId: record.userId,
                  frameId: record.frameId,
                  summary: record.summary,
                  themes: record.themes,
                  openQuestions: record.openQuestions,
                  fingerprint,
                  generatedAt: record.generatedAt,
                  createdAt: record.createdAt,
                })
                .onConflictDoNothing({
                  target: [syntheses.userId, syntheses.frameId, syntheses.fingerprint],
                });

              const created = await db
                .select()
                .from(syntheses)
                .where(
                  and(
                    eq(syntheses.userId, input.userId),
                    eq(syntheses.frameId, input.frameId),
                    eq(syntheses.fingerprint, fingerprint),
                  ),
                )
                .get();
              if (!created) throw new Error("Synthesis not created");

              if (record.sourceSignalIds.length > 0) {
                await db
                  .insert(synthesisSources)
                  .values(
                    record.sourceSignalIds.map((signalId) => ({
                      synthesisId: created.id,
                      signalId,
                    })),
                  )
                  .onConflictDoNothing();
              }

              const sources = await db
                .select()
                .from(synthesisSources)
                .where(eq(synthesisSources.synthesisId, created.id));
              return {
                id: created.id,
                userId: created.userId,
                frameId: created.frameId,
                summary: created.summary,
                themes: created.themes,
                openQuestions: created.openQuestions,
                sourceSignalIds: sources.map((source) => source.signalId),
                generatedAt: created.generatedAt,
                createdAt: created.createdAt,
              } satisfies SynthesisRecord;
            }),
          getCurrentFrame: (input) =>
            Effect.promise(async () => {
              const row = await db
                .select()
                .from(frames)
                .where(and(eq(frames.userId, input.userId), eq(frames.key, input.key)))
                .get();

              return row
                ? {
                    id: row.id,
                    userId: row.userId,
                    key: row.key,
                    title: row.title,
                    prompt: row.prompt,
                    status: "active" as const,
                    createdAt: row.createdAt,
                    updatedAt: row.updatedAt,
                  }
                : null;
            }),
          getLatestSynthesis: (input) =>
            Effect.promise(async () => {
              const row = await db
                .select()
                .from(syntheses)
                .where(
                  and(eq(syntheses.userId, input.userId), eq(syntheses.frameId, input.frameId)),
                )
                .orderBy(desc(syntheses.generatedAt), desc(syntheses.createdAt))
                .get();

              if (!row) return null;

              const sources = await db
                .select()
                .from(synthesisSources)
                .where(eq(synthesisSources.synthesisId, row.id));

              return {
                id: row.id,
                userId: row.userId,
                frameId: row.frameId,
                summary: row.summary,
                themes: row.themes,
                openQuestions: row.openQuestions,
                sourceSignalIds: sources.map((source) => source.signalId),
                generatedAt: row.generatedAt,
                createdAt: row.createdAt,
              };
            }),
          getJournalDocument: (input) =>
            Effect.promise(async () => {
              const row = await db
                .select()
                .from(journalDocuments)
                .where(
                  and(
                    eq(journalDocuments.userId, input.userId),
                    eq(journalDocuments.localDate, input.localDate),
                  ),
                )
                .get();

              return row ? toJournalDocumentRecord(row) : null;
            }),
          getProposal: (input) =>
            Effect.promise(async () => {
              const row = await db
                .select()
                .from(proposals)
                .where(and(eq(proposals.id, input.proposalId), eq(proposals.userId, input.userId)))
                .get();

              return row ? toProposalRecord(row) : null;
            }),
          getReviewForProposal: (input) =>
            Effect.promise(async () => {
              const row = await db
                .select()
                .from(reviews)
                .where(
                  and(eq(reviews.proposalId, input.proposalId), eq(reviews.userId, input.userId)),
                )
                .get();

              return row
                ? {
                    id: row.id,
                    userId: row.userId,
                    proposalId: row.proposalId,
                    decision: row.decision as ReviewDecision,
                    ...(row.editedTitle !== null ? { editedTitle: row.editedTitle } : {}),
                    ...(row.editedBody !== null ? { editedBody: row.editedBody } : {}),
                    ...(row.editedBodyDocument !== null
                      ? { editedBodyDocument: row.editedBodyDocument }
                      : {}),
                    createdAt: row.createdAt,
                  }
                : null;
            }),
          listRecentEvents: (input) =>
            Effect.promise(async () => {
              const filters = [eq(events.userId, input.userId)];
              if (input.occurredFrom) filters.push(gte(events.occurredAt, input.occurredFrom));
              if (input.occurredTo) filters.push(lte(events.occurredAt, input.occurredTo));

              const rows = await db
                .select()
                .from(events)
                .where(and(...filters))
                .orderBy(desc(events.occurredAt), desc(events.createdAt))
                .limit(input.limit);

              return rows.map((row) => ({
                id: row.id,
                userId: row.userId,
                type: row.type,
                source: row.source,
                occurredAt: row.occurredAt,
                schemaVersion: Number(row.schemaVersion),
                ...(row.idempotencyKey ? { idempotencyKey: row.idempotencyKey } : {}),
                payload: row.payload,
                createdAt: row.createdAt,
              }));
            }).pipe(
              Effect.withSpan("Db.listRecentEvents", {
                attributes: { provider: "d1", userId: input.userId, limit: input.limit },
              }),
            ),
          listPendingProposals: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(proposals)
                .where(and(eq(proposals.userId, input.userId), eq(proposals.status, "pending")))
                .orderBy(desc(proposals.createdAt))
                .limit(input.limit);

              return rows.map(toProposalRecord);
            }),
          listCommitments: (input) =>
            Effect.promise(async () => {
              const filters = [eq(commitments.userId, input.userId)];
              if (input.status) filters.push(eq(commitments.status, input.status));

              const rows = await db
                .select()
                .from(commitments)
                .where(and(...filters))
                .orderBy(desc(commitments.createdAt))
                .limit(input.limit);

              return rows.map(toCommitmentRecord);
            }),
          listOutcomes: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(outcomes)
                .where(eq(outcomes.userId, input.userId))
                .orderBy(desc(outcomes.recordedAt), desc(outcomes.createdAt))
                .limit(input.limit);

              return rows.map(toOutcomeRecord);
            }),
          listJournalRevisions: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(journalRevisions)
                .where(
                  and(
                    eq(journalRevisions.userId, input.userId),
                    eq(journalRevisions.documentId, input.documentId),
                  ),
                )
                .orderBy(desc(journalRevisions.createdAt))
                .limit(input.limit);

              return rows.map(toJournalRevisionRecord);
            }),
          recordOutcome: (input) =>
            Effect.promise(async () => {
              const existingOutcome = await db
                .select()
                .from(outcomes)
                .where(eq(outcomes.commitmentId, input.commitmentId))
                .get();
              if (existingOutcome) {
                const outcome = toOutcomeRecord(existingOutcome);
                if (sameOutcomeInput(outcome, input)) return outcome;
                throw new Error("Commitment outcome already recorded");
              }

              const timestamp = nowIso();
              const outcome = {
                ...input,
                id: eventId(),
                recordedAt: timestamp,
                createdAt: timestamp,
              } satisfies OutcomeRecord;

              await database.batch([
                database
                  .prepare(
                    `INSERT OR IGNORE INTO outcomes (
                      id,
                      user_id,
                      commitment_id,
                      result,
                      note,
                      recorded_at,
                      created_at
                    )
                    SELECT ?, ?, ?, ?, ?, ?, ?
                    FROM commitments
                    WHERE id = ? AND user_id = ? AND status = 'active'`,
                  )
                  .bind(
                    outcome.id,
                    outcome.userId,
                    outcome.commitmentId,
                    outcome.result,
                    outcome.note ?? null,
                    outcome.recordedAt,
                    outcome.createdAt,
                    input.commitmentId,
                    input.userId,
                  ),
                database
                  .prepare(
                    `UPDATE commitments
                    SET status = ?, updated_at = ?
                    WHERE id = ? AND user_id = ? AND status = 'active'`,
                  )
                  .bind(input.result, timestamp, input.commitmentId, input.userId),
              ]);

              const recorded = await db
                .select()
                .from(outcomes)
                .where(eq(outcomes.commitmentId, input.commitmentId))
                .get();
              if (!recorded) throw new Error("Commitment not found");

              const recordedOutcome = toOutcomeRecord(recorded);
              if (sameOutcomeInput(recordedOutcome, input)) return recordedOutcome;
              throw new Error("Commitment outcome already recorded");
            }),
          reviewProposal: (input) =>
            Effect.promise(async () => {
              const existingReview = await db
                .select()
                .from(reviews)
                .where(
                  and(eq(reviews.proposalId, input.proposalId), eq(reviews.userId, input.userId)),
                )
                .get();
              if (existingReview) {
                const existing = {
                  id: existingReview.id,
                  userId: existingReview.userId,
                  proposalId: existingReview.proposalId,
                  decision: existingReview.decision as ReviewDecision,
                  ...(existingReview.editedTitle !== null
                    ? { editedTitle: existingReview.editedTitle }
                    : {}),
                  ...(existingReview.editedBody !== null
                    ? { editedBody: existingReview.editedBody }
                    : {}),
                  ...(existingReview.editedBodyDocument !== null
                    ? { editedBodyDocument: existingReview.editedBodyDocument }
                    : {}),
                  createdAt: existingReview.createdAt,
                } satisfies ReviewRecord;
                if (
                  existing.decision === input.decision &&
                  existing.editedTitle === input.editedTitle &&
                  existing.editedBody === input.editedBody &&
                  sameJson(existing.editedBodyDocument, input.editedBodyDocument)
                ) {
                  return existing;
                }
                throw new Error("Proposal already reviewed");
              }

              const timestamp = nowIso();
              const review = {
                ...input,
                id: eventId(),
                createdAt: timestamp,
              } satisfies ReviewRecord;
              await database.batch([
                database
                  .prepare(
                    `INSERT OR IGNORE INTO reviews (
                      id,
                      user_id,
                      proposal_id,
                      decision,
                      edited_title,
                      edited_body,
                      edited_body_document,
                      created_at
                    )
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?
                    FROM proposals
                    WHERE id = ? AND user_id = ? AND status = 'pending'`,
                  )
                  .bind(
                    review.id,
                    review.userId,
                    review.proposalId,
                    review.decision,
                    review.editedTitle ?? null,
                    review.editedBody ?? null,
                    optionalJsonText(review.editedBodyDocument),
                    review.createdAt,
                    input.proposalId,
                    input.userId,
                  ),
                database
                  .prepare(
                    `UPDATE proposals
                    SET
                      status = ?,
                      title = COALESCE(?, title),
                      body = COALESCE(?, body),
                      updated_at = ?
                    WHERE id = ?
                      AND user_id = ?
                      AND status = 'pending'
                      AND EXISTS (
                        SELECT 1 FROM reviews
                        WHERE proposal_id = ?
                          AND user_id = ?
                          AND decision = ?
                          AND (edited_title IS ? OR edited_title = ?)
                          AND (edited_body IS ? OR edited_body = ?)
                          AND (edited_body_document IS ? OR edited_body_document = ?)
                      )`,
                  )
                  .bind(
                    input.decision,
                    input.editedTitle ?? null,
                    input.editedBody ?? null,
                    timestamp,
                    input.proposalId,
                    input.userId,
                    input.proposalId,
                    input.userId,
                    input.decision,
                    input.editedTitle ?? null,
                    input.editedTitle ?? null,
                    input.editedBody ?? null,
                    input.editedBody ?? null,
                    optionalJsonText(input.editedBodyDocument),
                    optionalJsonText(input.editedBodyDocument),
                  ),
              ]);

              const stored = await db
                .select()
                .from(reviews)
                .where(
                  and(eq(reviews.proposalId, input.proposalId), eq(reviews.userId, input.userId)),
                )
                .get();
              if (!stored) throw new Error("Proposal not found");

              const storedReview = {
                id: stored.id,
                userId: stored.userId,
                proposalId: stored.proposalId,
                decision: stored.decision as ReviewDecision,
                ...(stored.editedTitle !== null ? { editedTitle: stored.editedTitle } : {}),
                ...(stored.editedBody !== null ? { editedBody: stored.editedBody } : {}),
                ...(stored.editedBodyDocument !== null
                  ? { editedBodyDocument: stored.editedBodyDocument }
                  : {}),
                createdAt: stored.createdAt,
              } satisfies ReviewRecord;
              if (
                storedReview.decision === input.decision &&
                storedReview.editedTitle === input.editedTitle &&
                storedReview.editedBody === input.editedBody &&
                sameJson(storedReview.editedBodyDocument, input.editedBodyDocument)
              ) {
                return storedReview;
              }
              throw new Error("Proposal already reviewed");
            }),
          upsertCurrentFrame: (input) =>
            Effect.promise(async () => {
              const previous = await db
                .select()
                .from(frames)
                .where(and(eq(frames.userId, input.userId), eq(frames.key, input.key)))
                .get();
              const timestamp = nowIso();
              const record = {
                ...input,
                id: previous?.id ?? eventId(),
                status: "active",
                createdAt: previous?.createdAt ?? timestamp,
                updatedAt: timestamp,
              } satisfies FrameRecord;

              await db
                .insert(frames)
                .values(record)
                .onConflictDoUpdate({
                  target: [frames.userId, frames.key],
                  set: {
                    title: record.title,
                    prompt: record.prompt,
                    status: record.status,
                    updatedAt: record.updatedAt,
                  },
                });

              return record;
            }),
          upsertJournalDocument: (input) =>
            Effect.promise(async () => {
              const previous = await db
                .select()
                .from(journalDocuments)
                .where(
                  and(
                    eq(journalDocuments.userId, input.userId),
                    eq(journalDocuments.localDate, input.localDate),
                  ),
                )
                .get();
              const timestamp = nowIso();
              const changedText = changedTextFrom(previous?.bodyText ?? null, input.bodyText);
              const document = {
                ...input,
                id: previous?.id ?? eventId(),
                createdAt: previous?.createdAt ?? timestamp,
                updatedAt: timestamp,
              } satisfies JournalDocumentRecord;
              const revision = {
                id: eventId(),
                documentId: document.id,
                userId: input.userId,
                bodyText: input.bodyText,
                changedText,
                diffSummary: diffSummaryFrom(
                  previous?.bodyText ?? null,
                  input.bodyText,
                  changedText,
                ),
                createdAt: timestamp,
              } satisfies JournalRevisionRecord;

              await db
                .insert(journalDocuments)
                .values({
                  id: document.id,
                  userId: document.userId,
                  localDate: document.localDate,
                  title: document.title,
                  bodyText: document.bodyText,
                  bodyDocument: document.bodyDocument ?? null,
                  createdAt: document.createdAt,
                  updatedAt: document.updatedAt,
                })
                .onConflictDoUpdate({
                  target: [journalDocuments.userId, journalDocuments.localDate],
                  set: {
                    title: document.title,
                    bodyText: document.bodyText,
                    bodyDocument: document.bodyDocument ?? null,
                    updatedAt: document.updatedAt,
                  },
                });
              await db.insert(journalRevisions).values(revision);

              return { document, revision };
            }),
        });
      }),
    );
}

export { events, schema, users };
