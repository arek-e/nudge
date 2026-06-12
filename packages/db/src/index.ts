import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer } from "effect";
import {
  events,
  frames,
  proposals,
  reviews,
  schema,
  syntheses,
  synthesisSources,
  users,
} from "./schema";

export type DatabaseProvider = "memory" | "d1" | "planetscale" | "turso" | "postgres";

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

export interface ReviewProposalInput {
  readonly userId: string;
  readonly proposalId: string;
  readonly decision: ReviewDecision;
  readonly editedTitle?: string;
  readonly editedBody?: string;
}

export interface ReviewRecord extends ReviewProposalInput {
  readonly id: string;
  readonly createdAt: string;
}

export interface DbService {
  readonly provider: DatabaseProvider;
  readonly ensureUser: (user: DbUser) => Effect.Effect<void>;
  readonly appendEvent: (input: AppendEventInput) => Effect.Effect<EventRecord>;
  readonly appendProposal: (input: AppendProposalInput) => Effect.Effect<ProposalRecord>;
  readonly appendSynthesis: (input: AppendSynthesisInput) => Effect.Effect<SynthesisRecord>;
  readonly getCurrentFrame: (input: GetCurrentFrameInput) => Effect.Effect<FrameRecord | null>;
  readonly getLatestSynthesis: (
    input: GetLatestSynthesisInput,
  ) => Effect.Effect<SynthesisRecord | null>;
  readonly listRecentEvents: (
    input: RecentEventsInput,
  ) => Effect.Effect<ReadonlyArray<EventRecord>>;
  readonly listPendingProposals: (
    input: ListPendingProposalsInput,
  ) => Effect.Effect<ReadonlyArray<ProposalRecord>>;
  readonly reviewProposal: (input: ReviewProposalInput) => Effect.Effect<ReviewRecord>;
  readonly upsertCurrentFrame: (input: UpsertCurrentFrameInput) => Effect.Effect<FrameRecord>;
}

const nowIso = () => new Date().toISOString();
const eventId = () => crypto.randomUUID();

const byRecentEvent = (left: EventRecord, right: EventRecord) => {
  return (
    right.occurredAt.localeCompare(left.occurredAt) || right.createdAt.localeCompare(left.createdAt)
  );
};

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

export class Db extends Context.Service<Db, DbService>()("lares/db/Db") {
  static readonly layerMemory = Layer.effect(
    Db,
    Effect.sync(() => {
      const userStore = new Map<string, DbUser>();
      const eventStore = new Map<string, EventRecord>();
      const frameStore = new Map<string, FrameRecord>();
      const proposalStore = new Map<string, ProposalRecord>();
      const reviewStore = new Map<string, ReviewRecord>();
      const synthesisStore = new Map<string, SynthesisRecord>();

      return Db.of({
        provider: "memory",
        ensureUser: (user) =>
          Effect.sync(() => {
            userStore.set(user.id, user);
          }).pipe(Effect.withSpan("Db.ensureUser", { attributes: { provider: "memory" } })),
        appendEvent: (input) =>
          Effect.sync(() => {
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
        appendProposal: (input) =>
          Effect.sync(() => {
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
        reviewProposal: (input) =>
          Effect.sync(() => {
            const proposal = proposalStore.get(input.proposalId);
            if (!proposal || proposal.userId !== input.userId) {
              throw new Error("Proposal not found");
            }

            const timestamp = nowIso();
            proposalStore.set(proposal.id, {
              ...proposal,
              status: input.decision,
              updatedAt: timestamp,
              ...(input.editedTitle ? { title: input.editedTitle } : {}),
              ...(input.editedBody ? { body: input.editedBody } : {}),
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
          appendEvent: (input) =>
            Effect.promise(async () => {
              const record = {
                ...input,
                id: eventId(),
                createdAt: nowIso(),
              } satisfies EventRecord;
              await db.insert(events).values({
                id: record.id,
                userId: record.userId,
                type: record.type,
                source: record.source,
                occurredAt: record.occurredAt,
                schemaVersion: String(record.schemaVersion),
                payload: record.payload,
                createdAt: record.createdAt,
              });
              return record;
            }).pipe(
              Effect.withSpan("Db.appendEvent", {
                attributes: { provider: "d1", eventType: input.type, userId: input.userId },
              }),
            ),
          appendProposal: (input) =>
            Effect.promise(async () => {
              const timestamp = nowIso();
              const record = {
                ...input,
                id: eventId(),
                status: "pending",
                createdAt: timestamp,
                updatedAt: timestamp,
              } satisfies ProposalRecord;
              await db.insert(proposals).values(record);
              return record;
            }),
          appendSynthesis: (input) =>
            Effect.promise(async () => {
              const record = {
                ...input,
                id: eventId(),
                generatedAt: nowIso(),
                createdAt: nowIso(),
              } satisfies SynthesisRecord;
              await db.insert(syntheses).values({
                id: record.id,
                userId: record.userId,
                frameId: record.frameId,
                summary: record.summary,
                themes: record.themes,
                openQuestions: record.openQuestions,
                generatedAt: record.generatedAt,
                createdAt: record.createdAt,
              });
              if (record.sourceSignalIds.length > 0) {
                await db.insert(synthesisSources).values(
                  record.sourceSignalIds.map((signalId) => ({
                    synthesisId: record.id,
                    signalId,
                  })),
                );
              }
              return record;
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
          reviewProposal: (input) =>
            Effect.promise(async () => {
              const proposal = await db
                .select()
                .from(proposals)
                .where(and(eq(proposals.id, input.proposalId), eq(proposals.userId, input.userId)))
                .get();
              if (!proposal) throw new Error("Proposal not found");

              const timestamp = nowIso();
              await db
                .update(proposals)
                .set({
                  status: input.decision,
                  updatedAt: timestamp,
                  ...(input.editedTitle ? { title: input.editedTitle } : {}),
                  ...(input.editedBody ? { body: input.editedBody } : {}),
                })
                .where(eq(proposals.id, input.proposalId));

              const review = {
                ...input,
                id: eventId(),
                createdAt: timestamp,
              } satisfies ReviewRecord;
              await db.insert(reviews).values(review);
              return review;
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
        });
      }),
    );
}

export { events, schema, users };
