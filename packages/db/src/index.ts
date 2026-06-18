import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer } from "effect";
import {
  agentRunOutputs,
  agentRuns,
  commitments,
  dailyNotes,
  events,
  extractedItems,
  outcomes,
  frames,
  itemEvents,
  journalDocuments,
  journalRevisions,
  memoryChunks,
  memoryDocuments,
  memoryIndexJobs,
  memoryRetrievalEvents,
  noteRevisions,
  proposals,
  reviews,
  schema,
  summaryDocuments,
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

const toDailyNoteRecord = (row: typeof dailyNotes.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  localDate: row.localDate,
  title: row.title,
  bodyText: row.bodyText,
  ...(row.bodyDocument !== null ? { bodyDocument: row.bodyDocument } : {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toNoteRevisionRecord = (row: typeof noteRevisions.$inferSelect) => ({
  id: row.id,
  noteId: row.noteId,
  userId: row.userId,
  revisionNumber: row.revisionNumber,
  bodyText: row.bodyText,
  changedText: row.changedText,
  changeHash: row.changeHash,
  createdAt: row.createdAt,
  ...(row.processedAt !== null ? { processedAt: row.processedAt } : {}),
});

const toExtractedItemRecord = (row: typeof extractedItems.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  sourceRevisionId: row.sourceRevisionId,
  sourceNoteId: row.sourceNoteId,
  kind: row.kind as ExtractedItemKind,
  title: row.title,
  body: row.body,
  status: row.status as ExtractedItemStatus,
  ...(row.dueAt !== null ? { dueAt: row.dueAt } : {}),
  ...(row.remindAt !== null ? { remindAt: row.remindAt } : {}),
  ...(row.eventStartsAt !== null ? { eventStartsAt: row.eventStartsAt } : {}),
  ...(row.eventEndsAt !== null ? { eventEndsAt: row.eventEndsAt } : {}),
  confidence: row.confidence,
  dedupeKey: row.dedupeKey,
  metadata: row.metadata,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toItemEventRecord = (row: typeof itemEvents.$inferSelect) => ({
  id: row.id,
  itemId: row.itemId,
  userId: row.userId,
  eventType: row.eventType as ItemEventType,
  payload: row.payload,
  createdAt: row.createdAt,
});

const toSummaryDocumentRecord = (row: typeof summaryDocuments.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  periodType: row.periodType as SummaryPeriodType,
  periodStart: row.periodStart,
  periodEnd: row.periodEnd,
  title: row.title,
  body: row.body,
  status: row.status as SummaryStatus,
  generatedAt: row.generatedAt,
  sourceNoteIds: row.sourceNoteIds,
  sourceItemIds: row.sourceItemIds,
  metadata: row.metadata,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toAgentRunRecord = (row: typeof agentRuns.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  triggerType: row.triggerType as StartAgentRunInput["triggerType"],
  sourceType: row.sourceType,
  sourceId: row.sourceId,
  status: row.status as AgentRunStatus,
  ...(row.model !== null ? { model: row.model } : {}),
  startedAt: row.startedAt,
  ...(row.completedAt !== null ? { completedAt: row.completedAt } : {}),
  ...(row.errorCode !== null ? { errorCode: row.errorCode } : {}),
  metadata: row.metadata,
});

const toAgentRunOutputRecord = (row: typeof agentRunOutputs.$inferSelect) => ({
  id: row.id,
  runId: row.runId,
  outputType: row.outputType as AgentRunOutputRecord["outputType"],
  outputId: row.outputId,
  createdAt: row.createdAt,
});

const toMemoryDocumentRecord = (row: typeof memoryDocuments.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  sourceType: row.sourceType as MemorySourceType,
  sourceId: row.sourceId,
  title: row.title,
  bodyText: row.bodyText,
  ...(row.localDate !== null ? { localDate: row.localDate } : {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toMemoryChunkRecord = (row: typeof memoryChunks.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  memoryDocumentId: row.memoryDocumentId,
  sourceType: row.sourceType as MemorySourceType,
  sourceId: row.sourceId,
  chunkText: row.chunkText,
  chunkHash: row.chunkHash,
  chunkIndex: row.chunkIndex,
  ...(row.indexedAt !== null ? { indexedAt: row.indexedAt } : {}),
  createdAt: row.createdAt,
});

const toMemoryIndexJobRecord = (row: typeof memoryIndexJobs.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  memoryChunkId: row.memoryChunkId,
  sourceType: row.sourceType as MemorySourceType,
  sourceId: row.sourceId,
  status: row.status as MemoryIndexJobStatus,
  ...(row.errorMessage !== null ? { errorMessage: row.errorMessage } : {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toMemoryRetrievalEventRecord = (row: typeof memoryRetrievalEvents.$inferSelect) => ({
  id: row.id,
  userId: row.userId,
  query: row.query,
  resultChunkIds: row.resultChunkIds,
  source: row.source,
  createdAt: row.createdAt,
});

export class Db extends Context.Service<Db, DbService>()("lares/db/Db") {
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
            for (const chunk of [...memoryChunkStore.values()].filter(
              (candidate) => candidate.memoryDocumentId === document.id,
            )) {
              memoryChunkStore.delete(chunk.id);
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
                status: "pending" as const,
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
                    "DELETE FROM daily_agent_run_outputs WHERE run_id IN (SELECT id FROM daily_agent_runs WHERE user_id = ?)",
                  )
                  .bind(input.userId),
                database
                  .prepare("DELETE FROM daily_agent_runs WHERE user_id = ?")
                  .bind(input.userId),
                database
                  .prepare("DELETE FROM summary_documents WHERE user_id = ?")
                  .bind(input.userId),
                database.prepare("DELETE FROM item_events WHERE user_id = ?").bind(input.userId),
                database
                  .prepare("DELETE FROM extracted_items WHERE user_id = ?")
                  .bind(input.userId),
                database.prepare("DELETE FROM note_revisions WHERE user_id = ?").bind(input.userId),
                database.prepare("DELETE FROM daily_notes WHERE user_id = ?").bind(input.userId),
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
                  .prepare("DELETE FROM memory_retrieval_events WHERE user_id = ?")
                  .bind(input.userId),
                database
                  .prepare("DELETE FROM memory_index_jobs WHERE user_id = ?")
                  .bind(input.userId),
                database.prepare("DELETE FROM memory_chunks WHERE user_id = ?").bind(input.userId),
                database
                  .prepare("DELETE FROM memory_documents WHERE user_id = ?")
                  .bind(input.userId),
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
                dailyNoteRows,
                noteRevisionRows,
                extractedItemRows,
                itemEventRows,
                summaryDocumentRows,
                agentRunRows,
                agentRunOutputRows,
                journalDocumentRows,
                journalRevisionRows,
                memoryDocumentRows,
                memoryChunkRows,
                memoryIndexJobRows,
                memoryRetrievalEventRows,
              ] = await Promise.all([
                db.select().from(events).where(eq(events.userId, user.id)),
                db.select().from(frames).where(eq(frames.userId, user.id)),
                db.select().from(syntheses).where(eq(syntheses.userId, user.id)),
                db.select().from(proposals).where(eq(proposals.userId, user.id)),
                db.select().from(reviews).where(eq(reviews.userId, user.id)),
                db.select().from(commitments).where(eq(commitments.userId, user.id)),
                db.select().from(outcomes).where(eq(outcomes.userId, user.id)),
                db.select().from(dailyNotes).where(eq(dailyNotes.userId, user.id)),
                db.select().from(noteRevisions).where(eq(noteRevisions.userId, user.id)),
                db.select().from(extractedItems).where(eq(extractedItems.userId, user.id)),
                db.select().from(itemEvents).where(eq(itemEvents.userId, user.id)),
                db.select().from(summaryDocuments).where(eq(summaryDocuments.userId, user.id)),
                db.select().from(agentRuns).where(eq(agentRuns.userId, user.id)),
                database
                  .prepare(
                    "SELECT daily_agent_run_outputs.* FROM daily_agent_run_outputs JOIN daily_agent_runs ON daily_agent_run_outputs.run_id = daily_agent_runs.id WHERE daily_agent_runs.user_id = ?",
                  )
                  .bind(user.id)
                  .all<typeof agentRunOutputs.$inferSelect>()
                  .then((result) => result.results),
                db.select().from(journalDocuments).where(eq(journalDocuments.userId, user.id)),
                db.select().from(journalRevisions).where(eq(journalRevisions.userId, user.id)),
                db.select().from(memoryDocuments).where(eq(memoryDocuments.userId, user.id)),
                db.select().from(memoryChunks).where(eq(memoryChunks.userId, user.id)),
                db.select().from(memoryIndexJobs).where(eq(memoryIndexJobs.userId, user.id)),
                db
                  .select()
                  .from(memoryRetrievalEvents)
                  .where(eq(memoryRetrievalEvents.userId, user.id)),
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
                agentRunOutputs: agentRunOutputRows.map(toAgentRunOutputRecord),
                agentRuns: agentRunRows.map(toAgentRunRecord),
                user,
                commitments: commitmentRows.map(toCommitmentRecord),
                dailyNotes: dailyNoteRows.map(toDailyNoteRecord),
                events: eventRows.map(toEventRecord),
                extractedItems: extractedItemRows.map(toExtractedItemRecord),
                frames: frameRows.map(toFrameRecord),
                itemEvents: itemEventRows.map(toItemEventRecord),
                journalDocuments: journalDocumentRows.map(toJournalDocumentRecord),
                journalRevisions: journalRevisionRows.map(toJournalRevisionRecord),
                memoryChunks: memoryChunkRows.map(toMemoryChunkRecord),
                memoryDocuments: memoryDocumentRows.map(toMemoryDocumentRecord),
                memoryIndexJobs: memoryIndexJobRows.map(toMemoryIndexJobRecord),
                memoryRetrievalEvents: memoryRetrievalEventRows.map(toMemoryRetrievalEventRecord),
                noteRevisions: noteRevisionRows.map(toNoteRevisionRecord),
                outcomes: outcomeRows.map(toOutcomeRecord),
                proposals: proposalRows.map(toProposalRecord),
                reviews: reviewRows.map(toReviewRecord),
                summaryDocuments: summaryDocumentRows.map(toSummaryDocumentRecord),
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
          getDailyNote: (input) =>
            Effect.promise(async () => {
              const row = await db
                .select()
                .from(dailyNotes)
                .where(
                  and(
                    eq(dailyNotes.userId, input.userId),
                    eq(dailyNotes.localDate, input.localDate),
                  ),
                )
                .get();
              return row ? toDailyNoteRecord(row) : null;
            }),
          listExtractedItems: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(extractedItems)
                .where(
                  input.status
                    ? and(
                        eq(extractedItems.userId, input.userId),
                        eq(extractedItems.status, input.status),
                      )
                    : eq(extractedItems.userId, input.userId),
                )
                .orderBy(desc(extractedItems.updatedAt))
                .limit(input.limit);
              return rows.map(toExtractedItemRecord);
            }),
          listSummaryDocuments: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(summaryDocuments)
                .where(
                  input.periodType
                    ? and(
                        eq(summaryDocuments.userId, input.userId),
                        eq(summaryDocuments.periodType, input.periodType),
                      )
                    : eq(summaryDocuments.userId, input.userId),
                )
                .orderBy(desc(summaryDocuments.generatedAt))
                .limit(input.limit);
              return rows.map(toSummaryDocumentRecord);
            }),
          listNoteRevisions: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(noteRevisions)
                .where(
                  and(
                    eq(noteRevisions.userId, input.userId),
                    eq(noteRevisions.noteId, input.noteId),
                  ),
                )
                .orderBy(desc(noteRevisions.createdAt))
                .limit(input.limit);
              return rows.map(toNoteRevisionRecord);
            }),
          recordItemEvent: (input) =>
            Effect.promise(async () => {
              const record = {
                id: eventId(),
                createdAt: nowIso(),
                ...input,
              } satisfies ItemEventRecord;
              await db.insert(itemEvents).values(record);
              return record;
            }),
          startAgentRun: (input) =>
            Effect.promise(async () => {
              const record = {
                ...input,
                id: eventId(),
                status: input.status ?? "queued",
                startedAt: nowIso(),
              } satisfies AgentRunRecord;
              await db.insert(agentRuns).values({
                id: record.id,
                userId: record.userId,
                triggerType: record.triggerType,
                sourceType: record.sourceType,
                sourceId: record.sourceId,
                status: record.status,
                model: record.model ?? null,
                startedAt: record.startedAt,
                completedAt: null,
                errorCode: null,
                metadata: record.metadata,
              });
              return record;
            }),
          completeAgentRun: (input) =>
            Effect.promise(async () => {
              const timestamp = nowIso();
              await db
                .update(agentRuns)
                .set({
                  status: input.status,
                  completedAt: timestamp,
                  errorCode: input.errorCode ?? null,
                })
                .where(and(eq(agentRuns.id, input.runId), eq(agentRuns.userId, input.userId)));
              await Promise.all(
                (input.outputs ?? []).map((output) =>
                  db.insert(agentRunOutputs).values({
                    id: eventId(),
                    runId: input.runId,
                    outputType: output.outputType,
                    outputId: output.outputId,
                    createdAt: timestamp,
                  }),
                ),
              );
              const row = await db
                .select()
                .from(agentRuns)
                .where(eq(agentRuns.id, input.runId))
                .get();
              if (!row) throw new Error("Agent run not found");
              return toAgentRunRecord(row);
            }),
          upsertDailyNote: (input) =>
            Effect.promise(async () => {
              const previous = await db
                .select()
                .from(dailyNotes)
                .where(
                  and(
                    eq(dailyNotes.userId, input.userId),
                    eq(dailyNotes.localDate, input.localDate),
                  ),
                )
                .get();
              const timestamp = nowIso();
              const changedText = changedTextFrom(previous?.bodyText ?? null, input.bodyText);
              const note = {
                ...input,
                id: previous?.id ?? eventId(),
                createdAt: previous?.createdAt ?? timestamp,
                updatedAt: timestamp,
              } satisfies DailyNoteRecord;
              await db
                .insert(dailyNotes)
                .values({
                  id: note.id,
                  userId: note.userId,
                  localDate: note.localDate,
                  title: note.title,
                  bodyText: note.bodyText,
                  bodyDocument: note.bodyDocument ?? null,
                  createdAt: note.createdAt,
                  updatedAt: note.updatedAt,
                })
                .onConflictDoUpdate({
                  target: [dailyNotes.userId, dailyNotes.localDate],
                  set: {
                    title: note.title,
                    bodyText: note.bodyText,
                    bodyDocument: note.bodyDocument ?? null,
                    updatedAt: note.updatedAt,
                  },
                });
              const revisions = await db
                .select()
                .from(noteRevisions)
                .where(eq(noteRevisions.noteId, note.id));
              const revisionNumber = revisions.length + 1;
              const revision = {
                id: eventId(),
                noteId: note.id,
                userId: input.userId,
                revisionNumber,
                bodyText: input.bodyText,
                changedText,
                changeHash: simpleHash(
                  `${input.userId}:${note.id}:${revisionNumber}:${changedText}`,
                ),
                createdAt: timestamp,
              } satisfies NoteRevisionRecord;
              await db.insert(noteRevisions).values(revision);
              return { note, revision };
            }),
          upsertExtractedItem: (input) =>
            Effect.promise(async () => {
              const previous = await db
                .select()
                .from(extractedItems)
                .where(
                  and(
                    eq(extractedItems.userId, input.userId),
                    eq(extractedItems.dedupeKey, input.dedupeKey),
                  ),
                )
                .get();
              const timestamp = nowIso();
              const record = {
                ...input,
                id: previous?.id ?? eventId(),
                status:
                  input.status ??
                  (previous?.status as ExtractedItemStatus | undefined) ??
                  "proposed",
                createdAt: previous?.createdAt ?? timestamp,
                updatedAt: timestamp,
              } satisfies ExtractedItemRecord;
              await db
                .insert(extractedItems)
                .values({
                  ...record,
                  dueAt: record.dueAt ?? null,
                  remindAt: record.remindAt ?? null,
                  eventStartsAt: record.eventStartsAt ?? null,
                  eventEndsAt: record.eventEndsAt ?? null,
                })
                .onConflictDoUpdate({
                  target: [extractedItems.userId, extractedItems.dedupeKey],
                  set: {
                    title: record.title,
                    body: record.body,
                    status: record.status,
                    dueAt: record.dueAt ?? null,
                    remindAt: record.remindAt ?? null,
                    eventStartsAt: record.eventStartsAt ?? null,
                    eventEndsAt: record.eventEndsAt ?? null,
                    confidence: record.confidence,
                    metadata: record.metadata,
                    updatedAt: record.updatedAt,
                  },
                });
              const row = await db
                .select()
                .from(extractedItems)
                .where(
                  and(
                    eq(extractedItems.userId, input.userId),
                    eq(extractedItems.dedupeKey, input.dedupeKey),
                  ),
                )
                .get();
              if (!row) throw new Error("Extracted item not created");
              return toExtractedItemRecord(row);
            }),
          updateExtractedItemStatus: (input) =>
            Effect.promise(async () => {
              await db
                .update(extractedItems)
                .set({ status: input.status, updatedAt: nowIso() })
                .where(
                  and(eq(extractedItems.id, input.itemId), eq(extractedItems.userId, input.userId)),
                );
              const row = await db
                .select()
                .from(extractedItems)
                .where(eq(extractedItems.id, input.itemId))
                .get();
              if (!row) throw new Error("Extracted item not found");
              return toExtractedItemRecord(row);
            }),
          upsertSummaryDocument: (input) =>
            Effect.promise(async () => {
              const previous = await db
                .select()
                .from(summaryDocuments)
                .where(
                  and(
                    eq(summaryDocuments.userId, input.userId),
                    eq(summaryDocuments.periodType, input.periodType),
                    eq(summaryDocuments.periodStart, input.periodStart),
                    eq(summaryDocuments.periodEnd, input.periodEnd),
                    eq(summaryDocuments.status, input.status),
                  ),
                )
                .get();
              const timestamp = nowIso();
              const record = {
                ...input,
                id: previous?.id ?? eventId(),
                generatedAt: timestamp,
                createdAt: previous?.createdAt ?? timestamp,
                updatedAt: timestamp,
              } satisfies SummaryDocumentRecord;
              await db.insert(summaryDocuments).values(record).onConflictDoNothing();
              return record;
            }),
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
          getMemoryChunk: (input) =>
            Effect.promise(async () => {
              const row = await db
                .select()
                .from(memoryChunks)
                .where(
                  and(
                    eq(memoryChunks.id, input.memoryChunkId),
                    eq(memoryChunks.userId, input.userId),
                  ),
                )
                .get();

              return row ? toMemoryChunkRecord(row) : null;
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
          listMemoryChunks: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(memoryChunks)
                .where(
                  and(
                    eq(memoryChunks.userId, input.userId),
                    eq(memoryChunks.memoryDocumentId, input.memoryDocumentId),
                  ),
                )
                .orderBy(memoryChunks.chunkIndex);

              return rows.map(toMemoryChunkRecord);
            }),
          listPendingMemoryIndexJobs: (input) =>
            Effect.promise(async () => {
              const rows = await db
                .select()
                .from(memoryIndexJobs)
                .where(
                  and(
                    eq(memoryIndexJobs.userId, input.userId),
                    eq(memoryIndexJobs.status, "pending"),
                  ),
                )
                .orderBy(memoryIndexJobs.createdAt)
                .limit(input.limit);

              return rows.map(toMemoryIndexJobRecord);
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
          markMemoryChunkIndexed: (input) =>
            Effect.promise(async () => {
              const timestamp = nowIso();
              await database.batch([
                database
                  .prepare("UPDATE memory_chunks SET indexed_at = ? WHERE id = ? AND user_id = ?")
                  .bind(timestamp, input.memoryChunkId, input.userId),
                database
                  .prepare(
                    "UPDATE memory_index_jobs SET status = ?, updated_at = ? WHERE memory_chunk_id = ? AND user_id = ?",
                  )
                  .bind("indexed", timestamp, input.memoryChunkId, input.userId),
              ]);
              const row = await db
                .select()
                .from(memoryChunks)
                .where(
                  and(
                    eq(memoryChunks.id, input.memoryChunkId),
                    eq(memoryChunks.userId, input.userId),
                  ),
                )
                .get();
              if (!row) throw new Error("Memory chunk not found");
              return toMemoryChunkRecord(row);
            }),
          recordMemoryRetrieval: (input) =>
            Effect.promise(async () => {
              const record = {
                id: eventId(),
                createdAt: nowIso(),
                ...input,
              } satisfies MemoryRetrievalEventRecord;
              await db.insert(memoryRetrievalEvents).values(record);
              return record;
            }),
          upsertMemoryDocument: (input) =>
            Effect.promise(async () => {
              const previous = await db
                .select()
                .from(memoryDocuments)
                .where(
                  and(
                    eq(memoryDocuments.userId, input.userId),
                    eq(memoryDocuments.sourceType, input.sourceType),
                    eq(memoryDocuments.sourceId, input.sourceId),
                  ),
                )
                .get();
              const timestamp = nowIso();
              const document = {
                ...input,
                id: previous?.id ?? eventId(),
                createdAt: previous?.createdAt ?? timestamp,
                updatedAt: timestamp,
              } satisfies MemoryDocumentRecord;

              await db
                .insert(memoryDocuments)
                .values({
                  id: document.id,
                  userId: document.userId,
                  sourceType: document.sourceType,
                  sourceId: document.sourceId,
                  title: document.title,
                  bodyText: document.bodyText,
                  localDate: document.localDate ?? null,
                  createdAt: document.createdAt,
                  updatedAt: document.updatedAt,
                })
                .onConflictDoUpdate({
                  target: [
                    memoryDocuments.userId,
                    memoryDocuments.sourceType,
                    memoryDocuments.sourceId,
                  ],
                  set: {
                    title: document.title,
                    bodyText: document.bodyText,
                    localDate: document.localDate ?? null,
                    updatedAt: document.updatedAt,
                  },
                });

              await db.delete(memoryChunks).where(eq(memoryChunks.memoryDocumentId, document.id));
              const chunks = memoryChunksFrom(input).map((chunkText, chunkIndex) => {
                return {
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
              });
              await db.insert(memoryChunks).values(
                chunks.map((chunk) => ({
                  id: chunk.id,
                  userId: chunk.userId,
                  memoryDocumentId: chunk.memoryDocumentId,
                  sourceType: chunk.sourceType,
                  sourceId: chunk.sourceId,
                  chunkText: chunk.chunkText,
                  chunkHash: chunk.chunkHash,
                  chunkIndex: chunk.chunkIndex,
                  indexedAt: null,
                  createdAt: chunk.createdAt,
                })),
              );
              const indexJobs = chunks.map((chunk) => {
                return {
                  id: eventId(),
                  userId: input.userId,
                  memoryChunkId: chunk.id,
                  sourceType: input.sourceType,
                  sourceId: input.sourceId,
                  status: "pending" as const,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                } satisfies MemoryIndexJobRecord;
              });
              await db.insert(memoryIndexJobs).values(indexJobs);

              return { document, chunks, indexJobs };
            }),
        });
      }),
    );
}

export { events, schema, users };
