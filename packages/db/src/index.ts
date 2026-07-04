import { Context, Effect, Layer } from "effect";

export type DatabaseProvider = "memory" | "convex" | "planetscale" | "turso" | "postgres";

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
  readonly agentRunOutputs: ReadonlyArray<AgentRunOutputRecord>;
  readonly agentRuns: ReadonlyArray<AgentRunRecord>;
  readonly user: DbUser;
  readonly commitments: ReadonlyArray<CommitmentRecord>;
  readonly dailyNotes: ReadonlyArray<DailyNoteRecord>;
  readonly events: ReadonlyArray<EventRecord>;
  readonly extractedItems: ReadonlyArray<ExtractedItemRecord>;
  readonly frames: ReadonlyArray<FrameRecord>;
  readonly journalDocuments: ReadonlyArray<JournalDocumentRecord>;
  readonly journalRevisions: ReadonlyArray<JournalRevisionRecord>;
  readonly memoryChunks: ReadonlyArray<MemoryChunkRecord>;
  readonly memoryDocuments: ReadonlyArray<MemoryDocumentRecord>;
  readonly memoryIndexJobs: ReadonlyArray<MemoryIndexJobRecord>;
  readonly memoryRetrievalEvents: ReadonlyArray<MemoryRetrievalEventRecord>;
  readonly outcomes: ReadonlyArray<OutcomeRecord>;
  readonly proposals: ReadonlyArray<ProposalRecord>;
  readonly reviews: ReadonlyArray<ReviewRecord>;
  readonly itemEvents: ReadonlyArray<ItemEventRecord>;
  readonly noteRevisions: ReadonlyArray<NoteRevisionRecord>;
  readonly summaryDocuments: ReadonlyArray<SummaryDocumentRecord>;
  readonly syntheses: ReadonlyArray<SynthesisRecord>;
}

export type ExtractedItemKind =
  | "task"
  | "reminder"
  | "follow_up"
  | "event"
  | "memory"
  | "question"
  | "idea";
export type ExtractedItemStatus = "proposed" | "accepted" | "dismissed" | "completed" | "archived";
export type ItemEventType =
  | "created"
  | "accepted"
  | "edited"
  | "dismissed"
  | "completed"
  | "snoozed"
  | "archived";
export type SummaryPeriodType = "day" | "week" | "month" | "quarter" | "year" | "custom";
export type SummaryStatus = "draft" | "ready" | "superseded";
export type AgentRunStatus = "queued" | "running" | "completed" | "failed";

export interface UpsertDailyNoteInput {
  readonly userId: string;
  readonly localDate: string;
  readonly title: string;
  readonly bodyText: string;
  readonly bodyDocument?: unknown;
}

export interface DailyNoteRecord extends UpsertDailyNoteInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NoteRevisionRecord {
  readonly id: string;
  readonly noteId: string;
  readonly userId: string;
  readonly revisionNumber: number;
  readonly bodyText: string;
  readonly changedText: string;
  readonly changeHash: string;
  readonly createdAt: string;
  readonly processedAt?: string;
}

export interface UpsertDailyNoteResult {
  readonly note: DailyNoteRecord;
  readonly revision: NoteRevisionRecord;
}

export interface UpsertExtractedItemInput {
  readonly userId: string;
  readonly sourceRevisionId: string;
  readonly sourceNoteId: string;
  readonly kind: ExtractedItemKind;
  readonly title: string;
  readonly body: string;
  readonly status?: ExtractedItemStatus;
  readonly dueAt?: string;
  readonly remindAt?: string;
  readonly eventStartsAt?: string;
  readonly eventEndsAt?: string;
  readonly confidence: number;
  readonly dedupeKey: string;
  readonly metadata: unknown;
}

export interface ExtractedItemRecord extends Omit<UpsertExtractedItemInput, "status"> {
  readonly id: string;
  readonly status: ExtractedItemStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ItemEventRecord {
  readonly id: string;
  readonly itemId: string;
  readonly userId: string;
  readonly eventType: ItemEventType;
  readonly payload: unknown;
  readonly createdAt: string;
}

export interface UpsertSummaryDocumentInput {
  readonly userId: string;
  readonly periodType: SummaryPeriodType;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly title: string;
  readonly body: string;
  readonly status: SummaryStatus;
  readonly sourceNoteIds: ReadonlyArray<string>;
  readonly sourceItemIds: ReadonlyArray<string>;
  readonly metadata: unknown;
}

export interface SummaryDocumentRecord extends UpsertSummaryDocumentInput {
  readonly id: string;
  readonly generatedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StartAgentRunInput {
  readonly userId: string;
  readonly triggerType: "note_inactivity" | "manual" | "end_of_day" | "end_of_week" | "backfill";
  readonly sourceType: string;
  readonly sourceId: string;
  readonly status?: AgentRunStatus;
  readonly model?: string;
  readonly metadata: unknown;
}

export interface AgentRunRecord extends StartAgentRunInput {
  readonly id: string;
  readonly status: AgentRunStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly errorCode?: string;
}

export interface AgentRunOutputRecord {
  readonly id: string;
  readonly runId: string;
  readonly outputType: "extracted_item" | "summary" | "memory_document";
  readonly outputId: string;
  readonly createdAt: string;
}

export type MemorySourceType =
  | "daily_note"
  | "note_revision"
  | "extracted_item"
  | "summary"
  | "journal_document"
  | "journal_revision"
  | "signal"
  | "proposal"
  | "commitment";
export type MemoryIndexJobStatus = "pending" | "indexed" | "failed";

export interface UpsertMemoryDocumentInput {
  readonly userId: string;
  readonly sourceType: MemorySourceType;
  readonly sourceId: string;
  readonly title: string;
  readonly bodyText: string;
  readonly localDate?: string;
}

export interface MemoryDocumentRecord extends UpsertMemoryDocumentInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemoryChunkRecord {
  readonly id: string;
  readonly userId: string;
  readonly memoryDocumentId: string;
  readonly sourceType: MemorySourceType;
  readonly sourceId: string;
  readonly chunkText: string;
  readonly chunkHash: string;
  readonly chunkIndex: number;
  readonly indexedAt?: string;
  readonly createdAt: string;
}

export interface MemoryIndexJobRecord {
  readonly id: string;
  readonly userId: string;
  readonly memoryChunkId: string;
  readonly sourceType: MemorySourceType;
  readonly sourceId: string;
  readonly status: MemoryIndexJobStatus;
  readonly errorMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemoryRetrievalEventRecord {
  readonly id: string;
  readonly userId: string;
  readonly query: string;
  readonly resultChunkIds: ReadonlyArray<string>;
  readonly source: string;
  readonly createdAt: string;
}

export interface UpsertMemoryDocumentResult {
  readonly document: MemoryDocumentRecord;
  readonly chunks: ReadonlyArray<MemoryChunkRecord>;
  readonly indexJobs: ReadonlyArray<MemoryIndexJobRecord>;
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
  readonly listJournalDocuments: (input: {
    readonly userId: string;
  }) => Effect.Effect<ReadonlyArray<JournalDocumentRecord>>;
  readonly getDailyNote: (input: {
    readonly userId: string;
    readonly localDate: string;
  }) => Effect.Effect<DailyNoteRecord | null>;
  readonly getMemoryChunk: (input: {
    readonly userId: string;
    readonly memoryChunkId: string;
  }) => Effect.Effect<MemoryChunkRecord | null>;
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
  readonly listExtractedItems: (input: {
    readonly userId: string;
    readonly limit: number;
    readonly status?: ExtractedItemStatus;
  }) => Effect.Effect<ReadonlyArray<ExtractedItemRecord>>;
  readonly listSummaryDocuments: (input: {
    readonly userId: string;
    readonly limit: number;
    readonly periodType?: SummaryPeriodType;
  }) => Effect.Effect<ReadonlyArray<SummaryDocumentRecord>>;
  readonly listNoteRevisions: (input: {
    readonly userId: string;
    readonly noteId: string;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<NoteRevisionRecord>>;
  readonly listJournalRevisions: (input: {
    readonly userId: string;
    readonly documentId: string;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<JournalRevisionRecord>>;
  readonly listMemoryChunks: (input: {
    readonly userId: string;
    readonly memoryDocumentId: string;
  }) => Effect.Effect<ReadonlyArray<MemoryChunkRecord>>;
  readonly listPendingMemoryIndexJobs: (input: {
    readonly userId: string;
    readonly limit: number;
  }) => Effect.Effect<ReadonlyArray<MemoryIndexJobRecord>>;
  readonly recordMemoryRetrieval: (input: {
    readonly userId: string;
    readonly query: string;
    readonly resultChunkIds: ReadonlyArray<string>;
    readonly source: string;
  }) => Effect.Effect<MemoryRetrievalEventRecord>;
  readonly recordItemEvent: (input: {
    readonly userId: string;
    readonly itemId: string;
    readonly eventType: ItemEventType;
    readonly payload: unknown;
  }) => Effect.Effect<ItemEventRecord>;
  readonly listAgentRuns: (input: {
    readonly userId: string;
    readonly limit: number;
    readonly sourceType?: string;
  }) => Effect.Effect<ReadonlyArray<AgentRunRecord>>;
  readonly getAgentRun: (input: {
    readonly userId: string;
    readonly runId: string;
  }) => Effect.Effect<AgentRunRecord | null>;
  readonly markAgentRunRunning: (input: {
    readonly userId: string;
    readonly runId: string;
  }) => Effect.Effect<AgentRunRecord>;
  readonly startAgentRun: (input: StartAgentRunInput) => Effect.Effect<AgentRunRecord>;
  readonly completeAgentRun: (input: {
    readonly userId: string;
    readonly runId: string;
    readonly status: "completed" | "failed";
    readonly errorCode?: string;
    readonly outputs?: ReadonlyArray<{
      readonly outputType: AgentRunOutputRecord["outputType"];
      readonly outputId: string;
    }>;
  }) => Effect.Effect<AgentRunRecord>;
  readonly markMemoryChunkIndexed: (input: {
    readonly userId: string;
    readonly memoryChunkId: string;
  }) => Effect.Effect<MemoryChunkRecord>;
  readonly recordOutcome: (input: RecordOutcomeInput) => Effect.Effect<OutcomeRecord>;
  readonly reviewProposal: (input: ReviewProposalInput) => Effect.Effect<ReviewRecord>;
  readonly upsertJournalDocument: (
    input: UpsertJournalDocumentInput,
  ) => Effect.Effect<UpsertJournalDocumentResult>;
  readonly upsertDailyNote: (input: UpsertDailyNoteInput) => Effect.Effect<UpsertDailyNoteResult>;
  readonly upsertExtractedItem: (
    input: UpsertExtractedItemInput,
  ) => Effect.Effect<ExtractedItemRecord>;
  readonly updateExtractedItemStatus: (input: {
    readonly userId: string;
    readonly itemId: string;
    readonly status: ExtractedItemStatus;
  }) => Effect.Effect<ExtractedItemRecord>;
  readonly upsertSummaryDocument: (
    input: UpsertSummaryDocumentInput,
  ) => Effect.Effect<SummaryDocumentRecord>;
  readonly upsertMemoryDocument: (
    input: UpsertMemoryDocumentInput,
  ) => Effect.Effect<UpsertMemoryDocumentResult>;
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

const sameOutcomeInput = (outcome: OutcomeRecord, input: RecordOutcomeInput) =>
  outcome.result === input.result && outcome.note === input.note;

const changedTextFrom = (previous: string | null, next: string) => {
  if (previous === null) return next;
  if (previous === next) return "";
  if (next.startsWith(previous)) return next.slice(previous.length).trim();
  if (previous.startsWith(next)) {
    const deletedText = previous.slice(next.length).trim();
    return deletedText.length > 0 ? `[deleted] ${deletedText}` : "[deleted text]";
  }
  if (next.length === 0) return "[deleted text]";
  return next;
};

const diffSummaryFrom = (previous: string | null, next: string, changedText: string) => {
  if (!previous) return "Created daily journal document.";
  if (changedText.length === 0) return "Saved without text changes.";
  return "Updated daily journal document.";
};

const simpleHash = (value: string) => `${value.length}:${value}`;

const memoryChunkHash = (input: {
  readonly userId: string;
  readonly sourceType: MemorySourceType;
  readonly sourceId: string;
  readonly chunkIndex: number;
  readonly chunkText: string;
}) =>
  `${input.userId}:${input.sourceType}:${input.sourceId}:${input.chunkIndex}:${input.chunkText}`;

const memoryChunksFrom = (input: UpsertMemoryDocumentInput) => {
  const trimmed = input.bodyText.trim();
  if (trimmed.length === 0) return [];
  return [trimmed];
};

export class Db extends Context.Service<Db, DbService>()("nudge/db/Db") {
  static readonly layerMemory = Layer.effect(
    Db,
    Effect.sync(() => {
      const userStore = new Map<string, DbUser>();
      const agentRunOutputStore = new Map<string, AgentRunOutputRecord>();
      const agentRunStore = new Map<string, AgentRunRecord>();
      const commitmentStore = new Map<string, CommitmentRecord>();
      const dailyNoteStore = new Map<string, DailyNoteRecord>();
      const eventStore = new Map<string, EventRecord>();
      const extractedItemStore = new Map<string, ExtractedItemRecord>();
      const outcomeStore = new Map<string, OutcomeRecord>();
      const frameStore = new Map<string, FrameRecord>();
      const itemEventStore = new Map<string, ItemEventRecord>();
      const journalDocumentStore = new Map<string, JournalDocumentRecord>();
      const journalRevisionStore = new Map<string, JournalRevisionRecord>();
      const memoryChunkStore = new Map<string, MemoryChunkRecord>();
      const memoryDocumentStore = new Map<string, MemoryDocumentRecord>();
      const memoryIndexJobStore = new Map<string, MemoryIndexJobRecord>();
      const memoryRetrievalEventStore = new Map<string, MemoryRetrievalEventRecord>();
      const noteRevisionStore = new Map<string, NoteRevisionRecord>();
      const proposalStore = new Map<string, ProposalRecord>();
      const reviewStore = new Map<string, ReviewRecord>();
      const summaryDocumentStore = new Map<string, SummaryDocumentRecord>();
      const synthesisStore = new Map<string, SynthesisRecord>();

      return Db.of({
        provider: "memory",
        deleteUserData: (input) =>
          Effect.sync(() => {
            for (const store of [
              agentRunStore,
              commitmentStore,
              dailyNoteStore,
              eventStore,
              extractedItemStore,
              outcomeStore,
              frameStore,
              itemEventStore,
              journalDocumentStore,
              journalRevisionStore,
              memoryChunkStore,
              memoryDocumentStore,
              memoryIndexJobStore,
              memoryRetrievalEventStore,
              noteRevisionStore,
              proposalStore,
              reviewStore,
              summaryDocumentStore,
              synthesisStore,
            ]) {
              for (const record of store.values()) {
                if (record.userId === input.userId) store.delete(record.id);
              }
            }
            for (const record of agentRunOutputStore.values()) {
              if (!agentRunStore.has(record.runId)) agentRunOutputStore.delete(record.id);
            }
            userStore.delete(input.userId);
          }),
        ensureUser: (user) =>
          Effect.sync(() => {
            userStore.set(user.id, user);
          }).pipe(Effect.withSpan("Db.ensureUser", { attributes: { provider: "memory" } })),
        exportUserData: (user) =>
          Effect.sync(() => ({
            agentRunOutputs: [...agentRunOutputStore.values()].filter((record) => {
              const run = agentRunStore.get(record.runId);
              return run?.userId === user.id;
            }),
            agentRuns: [...agentRunStore.values()].filter((record) => record.userId === user.id),
            user,
            commitments: [...commitmentStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            dailyNotes: [...dailyNoteStore.values()].filter((record) => record.userId === user.id),
            events: [...eventStore.values()].filter((record) => record.userId === user.id),
            extractedItems: [...extractedItemStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            frames: [...frameStore.values()].filter((record) => record.userId === user.id),
            itemEvents: [...itemEventStore.values()].filter((record) => record.userId === user.id),
            journalDocuments: [...journalDocumentStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            journalRevisions: [...journalRevisionStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            memoryChunks: [...memoryChunkStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            memoryDocuments: [...memoryDocumentStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            memoryIndexJobs: [...memoryIndexJobStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            memoryRetrievalEvents: [...memoryRetrievalEventStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            noteRevisions: [...noteRevisionStore.values()].filter(
              (record) => record.userId === user.id,
            ),
            outcomes: [...outcomeStore.values()].filter((record) => record.userId === user.id),
            proposals: [...proposalStore.values()].filter((record) => record.userId === user.id),
            reviews: [...reviewStore.values()].filter((record) => record.userId === user.id),
            summaryDocuments: [...summaryDocumentStore.values()].filter(
              (record) => record.userId === user.id,
            ),
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
        getDailyNote: (input) =>
          Effect.sync(
            () =>
              [...dailyNoteStore.values()].find(
                (note) => note.userId === input.userId && note.localDate === input.localDate,
              ) ?? null,
          ),
        listExtractedItems: (input) =>
          Effect.sync(() =>
            [...extractedItemStore.values()]
              .filter(
                (item) =>
                  item.userId === input.userId &&
                  (input.status === undefined || item.status === input.status),
              )
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
              .slice(0, input.limit),
          ),
        listSummaryDocuments: (input) =>
          Effect.sync(() =>
            [...summaryDocumentStore.values()]
              .filter(
                (summary) =>
                  summary.userId === input.userId &&
                  (input.periodType === undefined || summary.periodType === input.periodType),
              )
              .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
              .slice(0, input.limit),
          ),
        listNoteRevisions: (input) =>
          Effect.sync(() =>
            [...noteRevisionStore.values()]
              .filter(
                (revision) => revision.userId === input.userId && revision.noteId === input.noteId,
              )
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .slice(0, input.limit),
          ),
        recordItemEvent: (input) =>
          Effect.sync(() => {
            const record = {
              id: eventId(),
              createdAt: nowIso(),
              ...input,
            } satisfies ItemEventRecord;
            itemEventStore.set(record.id, record);
            return record;
          }),
        listAgentRuns: (input) =>
          Effect.sync(() =>
            [...agentRunStore.values()]
              .filter(
                (run) =>
                  run.userId === input.userId &&
                  (input.sourceType === undefined || run.sourceType === input.sourceType),
              )
              .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
              .slice(0, input.limit),
          ),
        getAgentRun: (input) =>
          Effect.sync(() => {
            const run = agentRunStore.get(input.runId);
            return run?.userId === input.userId ? run : null;
          }),
        markAgentRunRunning: (input) =>
          Effect.sync(() => {
            const existing = agentRunStore.get(input.runId);
            if (!existing || existing.userId !== input.userId)
              throw new Error("Agent run not found");
            const updated = { ...existing, status: "running" } satisfies AgentRunRecord;
            agentRunStore.set(updated.id, updated);
            return updated;
          }),
        startAgentRun: (input) =>
          Effect.sync(() => {
            const record = {
              ...input,
              id: eventId(),
              status: input.status ?? "queued",
              startedAt: nowIso(),
            } satisfies AgentRunRecord;
            agentRunStore.set(record.id, record);
            return record;
          }),
        completeAgentRun: (input) =>
          Effect.sync(() => {
            const existing = agentRunStore.get(input.runId);
            if (!existing || existing.userId !== input.userId)
              throw new Error("Agent run not found");
            const updated = {
              ...existing,
              status: input.status,
              completedAt: nowIso(),
              ...(input.errorCode ? { errorCode: input.errorCode } : {}),
            } satisfies AgentRunRecord;
            agentRunStore.set(updated.id, updated);
            for (const output of input.outputs ?? []) {
              const record = {
                id: eventId(),
                runId: updated.id,
                outputType: output.outputType,
                outputId: output.outputId,
                createdAt: nowIso(),
              } satisfies AgentRunOutputRecord;
              agentRunOutputStore.set(record.id, record);
            }
            return updated;
          }),
        upsertDailyNote: (input) =>
          Effect.sync(() => {
            const previous = [...dailyNoteStore.values()].find(
              (note) => note.userId === input.userId && note.localDate === input.localDate,
            );
            const timestamp = nowIso();
            const existingRevisions = previous
              ? [...noteRevisionStore.values()].filter(
                  (revision) => revision.noteId === previous.id,
                )
              : [];
            const changedText = changedTextFrom(previous?.bodyText ?? null, input.bodyText);
            const note = {
              ...input,
              id: previous?.id ?? eventId(),
              createdAt: previous?.createdAt ?? timestamp,
              updatedAt: timestamp,
            } satisfies DailyNoteRecord;
            dailyNoteStore.set(note.id, note);
            const revisionNumber = existingRevisions.length + 1;
            const revision = {
              id: eventId(),
              noteId: note.id,
              userId: input.userId,
              revisionNumber,
              bodyText: input.bodyText,
              changedText,
              changeHash: simpleHash(`${input.userId}:${note.id}:${revisionNumber}:${changedText}`),
              createdAt: timestamp,
            } satisfies NoteRevisionRecord;
            noteRevisionStore.set(revision.id, revision);
            return { note, revision };
          }),
        upsertExtractedItem: (input) =>
          Effect.sync(() => {
            const previous = [...extractedItemStore.values()].find(
              (item) => item.userId === input.userId && item.dedupeKey === input.dedupeKey,
            );
            const timestamp = nowIso();
            const record = {
              ...input,
              id: previous?.id ?? eventId(),
              status: input.status ?? previous?.status ?? "proposed",
              createdAt: previous?.createdAt ?? timestamp,
              updatedAt: timestamp,
            } satisfies ExtractedItemRecord;
            extractedItemStore.set(record.id, record);
            return record;
          }),
        updateExtractedItemStatus: (input) =>
          Effect.sync(() => {
            const existing = extractedItemStore.get(input.itemId);
            if (!existing || existing.userId !== input.userId)
              throw new Error("Extracted item not found");
            const updated = {
              ...existing,
              status: input.status,
              updatedAt: nowIso(),
            } satisfies ExtractedItemRecord;
            extractedItemStore.set(updated.id, updated);
            return updated;
          }),
        upsertSummaryDocument: (input) =>
          Effect.sync(() => {
            const previous = [...summaryDocumentStore.values()].find(
              (summary) =>
                summary.userId === input.userId &&
                summary.periodType === input.periodType &&
                summary.periodStart === input.periodStart &&
                summary.periodEnd === input.periodEnd &&
                summary.status !== "superseded",
            );
            const timestamp = nowIso();
            const record = {
              ...input,
              id: previous?.id ?? eventId(),
              generatedAt: timestamp,
              createdAt: previous?.createdAt ?? timestamp,
              updatedAt: timestamp,
            } satisfies SummaryDocumentRecord;
            summaryDocumentStore.set(record.id, record);
            return record;
          }),
        appendCommitment: (input) =>
          Effect.sync(() => {
            const proposal = proposalStore.get(input.proposalId);
            const review = reviewStore.get(input.reviewId);
            if (!proposal || proposal.userId !== input.userId) {
              throw new Error("Proposal not found");
            }
            if (
              !review ||
              review.userId !== input.userId ||
              review.proposalId !== input.proposalId
            ) {
              throw new Error("Review not found");
            }
            const existing = [...commitmentStore.values()].find(
              (commitment) =>
                commitment.proposalId === input.proposalId && commitment.userId === input.userId,
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
            const synthesis = synthesisStore.get(input.synthesisId);
            if (!synthesis || synthesis.userId !== input.userId) {
              throw new Error("Synthesis not found");
            }
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
            const frame = [...frameStore.values()].find(
              (candidate) => candidate.id === input.frameId && candidate.userId === input.userId,
            );
            if (!frame) throw new Error("Frame not found");
            for (const signalId of input.sourceSignalIds) {
              const signal = eventStore.get(signalId);
              if (!signal || signal.userId !== input.userId) {
                throw new Error("Signal not found");
              }
            }
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
        listJournalDocuments: (input) =>
          Effect.sync(() =>
            [...journalDocumentStore.values()]
              .filter((document) => document.userId === input.userId)
              .sort((left, right) => right.localDate.localeCompare(left.localDate)),
          ),
        getMemoryChunk: (input) =>
          Effect.sync(() => {
            const chunk = memoryChunkStore.get(input.memoryChunkId) ?? null;
            return chunk?.userId === input.userId ? chunk : null;
          }),
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
        listMemoryChunks: (input) =>
          Effect.sync(() => {
            return [...memoryChunkStore.values()]
              .filter(
                (chunk) =>
                  chunk.userId === input.userId &&
                  chunk.memoryDocumentId === input.memoryDocumentId,
              )
              .sort((left, right) => left.chunkIndex - right.chunkIndex);
          }),
        listPendingMemoryIndexJobs: (input) =>
          Effect.sync(() => {
            return [...memoryIndexJobStore.values()]
              .filter((job) => job.userId === input.userId && job.status === "pending")
              .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
              .slice(0, input.limit);
          }),
        markMemoryChunkIndexed: (input) =>
          Effect.sync(() => {
            const chunk = memoryChunkStore.get(input.memoryChunkId);
            if (!chunk || chunk.userId !== input.userId) throw new Error("Memory chunk not found");
            const indexedAt = nowIso();
            const updatedChunk = { ...chunk, indexedAt } satisfies MemoryChunkRecord;
            memoryChunkStore.set(updatedChunk.id, updatedChunk);
            const job = [...memoryIndexJobStore.values()].find(
              (candidate) => candidate.memoryChunkId === input.memoryChunkId,
            );
            if (job) {
              memoryIndexJobStore.set(job.id, {
                ...job,
                status: "indexed",
                updatedAt: indexedAt,
              });
            }
            return updatedChunk;
          }),
        recordOutcome: (input) =>
          Effect.sync(() => {
            const commitment = commitmentStore.get(input.commitmentId);
            if (!commitment || commitment.userId !== input.userId) {
              throw new Error("Commitment not found");
            }
            const existingOutcome = [...outcomeStore.values()].find(
              (outcome) =>
                outcome.commitmentId === input.commitmentId && outcome.userId === input.userId,
            );
            if (existingOutcome) {
              if (sameOutcomeInput(existingOutcome, input)) return existingOutcome;
              throw new Error("Commitment outcome already recorded");
            }

            if (commitment.status !== "active") {
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
        recordMemoryRetrieval: (input) =>
          Effect.sync(() => {
            const record = {
              id: eventId(),
              createdAt: nowIso(),
              ...input,
            } satisfies MemoryRetrievalEventRecord;
            memoryRetrievalEventStore.set(record.id, record);
            return record;
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
        upsertMemoryDocument: (input) =>
          Effect.sync(() => {
            const key = `${input.userId}:${input.sourceType}:${input.sourceId}`;
            const previous = memoryDocumentStore.get(key) ?? null;
            const timestamp = nowIso();
            const document = {
              ...input,
              id: previous?.id ?? eventId(),
              createdAt: previous?.createdAt ?? timestamp,
              updatedAt: timestamp,
            } satisfies MemoryDocumentRecord;

            memoryDocumentStore.set(key, document);
            const replacedChunkIds = new Set<string>();
            for (const chunk of [...memoryChunkStore.values()].filter(
              (candidate) => candidate.memoryDocumentId === document.id,
            )) {
              replacedChunkIds.add(chunk.id);
              memoryChunkStore.delete(chunk.id);
            }
            for (const job of [...memoryIndexJobStore.values()]) {
              if (replacedChunkIds.has(job.memoryChunkId)) memoryIndexJobStore.delete(job.id);
            }

            const chunks = memoryChunksFrom(input).map((chunkText, chunkIndex) => {
              const chunk = {
                id: eventId(),
                userId: input.userId,
                memoryDocumentId: document.id,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
                chunkText,
                chunkHash: memoryChunkHash({
                  userId: input.userId,
                  sourceType: input.sourceType,
                  sourceId: input.sourceId,
                  chunkIndex,
                  chunkText,
                }),
                chunkIndex,
                createdAt: timestamp,
              } satisfies MemoryChunkRecord;
              memoryChunkStore.set(chunk.id, chunk);
              return chunk;
            });
            const indexJobs = chunks.map((chunk) => {
              const job = {
                id: eventId(),
                userId: input.userId,
                memoryChunkId: chunk.id,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
                status: "pending",
                createdAt: timestamp,
                updatedAt: timestamp,
              } satisfies MemoryIndexJobRecord;
              memoryIndexJobStore.set(job.id, job);
              return job;
            });

            return { document, chunks, indexJobs };
          }),
      });
    }),
  );
}
