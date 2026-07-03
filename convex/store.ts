import { v } from "convex/values";
import type { Doc, TableNames } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  changedTextFrom,
  diffSummaryFrom,
  memoryChunkHash,
  memoryChunksFrom,
  sameJson,
  simpleHash,
} from "./storePolicy";

declare const process: {
  readonly env: {
    readonly CONVEX_RUNTIME_SECRET?: string;
  };
};

type StoreCtx = QueryCtx | MutationCtx;

const runtimeTraceArg = v.object({
  environment: v.string(),
  flags: v.string(),
  operation: v.string(),
  parentSpanId: v.union(v.string(), v.null()),
  requestId: v.optional(v.union(v.string(), v.null())),
  routeName: v.optional(v.union(v.string(), v.null())),
  service: v.string(),
  spanId: v.string(),
  traceId: v.string(),
  traceparent: v.string(),
  version: v.string(),
});

const userArg = v.object({
  displayName: v.string(),
  id: v.string(),
  runtimeSecret: v.string(),
  trace: v.optional(runtimeTraceArg),
});

interface RuntimeTraceArg {
  readonly environment: string;
  readonly flags: string;
  readonly operation: string;
  readonly parentSpanId: string | null;
  readonly requestId?: string | null;
  readonly routeName?: string | null;
  readonly service: string;
  readonly spanId: string;
  readonly traceId: string;
  readonly traceparent: string;
  readonly version: string;
}

interface RuntimeUserArg {
  readonly displayName: string;
  readonly id: string;
  readonly runtimeSecret: string;
  readonly trace?: RuntimeTraceArg;
}

const extractedItemKind = v.union(
  v.literal("task"),
  v.literal("reminder"),
  v.literal("follow_up"),
  v.literal("event"),
  v.literal("memory"),
  v.literal("question"),
  v.literal("idea"),
);
const extractedItemStatus = v.union(
  v.literal("proposed"),
  v.literal("accepted"),
  v.literal("dismissed"),
  v.literal("completed"),
  v.literal("archived"),
);
const itemEventType = v.union(
  v.literal("created"),
  v.literal("accepted"),
  v.literal("edited"),
  v.literal("dismissed"),
  v.literal("completed"),
  v.literal("snoozed"),
  v.literal("archived"),
);
const proposalKind = v.union(
  v.literal("clarify"),
  v.literal("follow_up"),
  v.literal("commit"),
  v.literal("ignore"),
);
const reviewDecision = v.union(v.literal("accepted"), v.literal("edited"), v.literal("rejected"));
const outcomeResult = v.union(v.literal("completed"), v.literal("abandoned"));
const summaryPeriodType = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
  v.literal("quarter"),
  v.literal("year"),
  v.literal("custom"),
);
const summaryStatus = v.union(v.literal("draft"), v.literal("ready"), v.literal("superseded"));
const agentRunTriggerType = v.union(
  v.literal("note_inactivity"),
  v.literal("manual"),
  v.literal("end_of_day"),
  v.literal("end_of_week"),
  v.literal("backfill"),
);
const agentRunStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);
const agentRunOutputType = v.union(
  v.literal("extracted_item"),
  v.literal("summary"),
  v.literal("memory_document"),
);
const memorySourceType = v.union(
  v.literal("daily_note"),
  v.literal("note_revision"),
  v.literal("extracted_item"),
  v.literal("summary"),
  v.literal("journal_document"),
  v.literal("journal_revision"),
  v.literal("signal"),
  v.literal("proposal"),
  v.literal("commitment"),
);

const nowIso = () => new Date().toISOString();
const byUpdatedDesc = <A extends { readonly updatedAt: string }>(left: A, right: A) =>
  right.updatedAt.localeCompare(left.updatedAt);
const byCreatedDesc = <A extends { readonly createdAt: string }>(left: A, right: A) =>
  right.createdAt.localeCompare(left.createdAt);
const byStartedDesc = <A extends { readonly startedAt: string }>(left: A, right: A) =>
  right.startedAt.localeCompare(left.startedAt);

function requireRuntimeSecret(secret: string) {
  const expected = process.env.CONVEX_RUNTIME_SECRET;
  if (!expected || secret !== expected) throw new Error("Convex runtime access denied");
}

function logRuntimeTrace(user: RuntimeUserArg) {
  const trace = user.trace;
  if (!trace) return;
  console.info(
    JSON.stringify({
      event: "convex_runtime_store_call",
      environment: trace.environment,
      flags: trace.flags,
      logKind: "span_link",
      operation: trace.operation,
      parentSpanId: trace.parentSpanId,
      requestId: trace.requestId ?? null,
      routeName: trace.routeName ?? null,
      service: trace.service,
      spanId: trace.spanId,
      traceId: trace.traceId,
      traceparent: trace.traceparent,
      userId: user.id,
      version: trace.version,
    }),
  );
}

function requireStoredId<TableName extends TableNames>(
  ctx: StoreCtx,
  tableName: TableName,
  id: string,
) {
  const normalized = ctx.db.normalizeId(tableName, id);
  if (!normalized) throw new Error(`Invalid ${tableName} id`);
  return normalized;
}

async function findUserByExternalId(ctx: StoreCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_external_id", (index) => index.eq("externalId", externalId))
    .first();
}

async function ensureRuntimeUser(ctx: MutationCtx, user: RuntimeUserArg) {
  requireRuntimeSecret(user.runtimeSecret);
  logRuntimeTrace(user);
  const timestamp = nowIso();
  const existing = await findUserByExternalId(ctx, user.id);
  if (existing) {
    await ctx.db.patch(existing._id, {
      displayName: user.displayName,
      name: user.displayName,
      updatedAt: timestamp,
    });
    const stored = await ctx.db.get(existing._id);
    if (!stored) throw new Error("User disappeared during update");
    return stored;
  }

  const userId = await ctx.db.insert("users", {
    createdAt: timestamp,
    displayName: user.displayName,
    externalId: user.id,
    name: user.displayName,
    updatedAt: timestamp,
  });
  const stored = await ctx.db.get(userId);
  if (!stored) throw new Error("User disappeared during insert");
  return stored;
}

async function requireRuntimeUser(ctx: StoreCtx, user: RuntimeUserArg) {
  requireRuntimeSecret(user.runtimeSecret);
  logRuntimeTrace(user);
  const existing = await findUserByExternalId(ctx, user.id);
  if (!existing) throw new Error("User not found");
  return existing;
}

const userRecord = (user: Doc<"users">) => ({
  id: user.externalId,
  displayName: user.displayName ?? user.name ?? user.email ?? user.externalId,
});

const eventRecord = (user: Doc<"users">, event: Doc<"events">) => ({
  id: event._id,
  userId: user.externalId,
  type: event.type,
  source: event.source,
  occurredAt: event.occurredAt,
  schemaVersion: event.schemaVersion,
  ...(event.idempotencyKey ? { idempotencyKey: event.idempotencyKey } : {}),
  payload: event.payload,
  createdAt: event.createdAt,
});

const frameRecord = (user: Doc<"users">, frame: Doc<"frames">) => ({
  id: frame._id,
  userId: user.externalId,
  key: frame.key,
  title: frame.title,
  prompt: frame.prompt,
  status: frame.status,
  createdAt: frame.createdAt,
  updatedAt: frame.updatedAt,
});

const synthesisRecord = (user: Doc<"users">, synthesis: Doc<"syntheses">) => ({
  id: synthesis._id,
  userId: user.externalId,
  frameId: synthesis.frameId,
  summary: synthesis.summary,
  themes: synthesis.themes,
  openQuestions: synthesis.openQuestions,
  sourceSignalIds: synthesis.sourceSignalIds,
  generatedAt: synthesis.generatedAt,
  createdAt: synthesis.createdAt,
});

const proposalRecord = (user: Doc<"users">, proposal: Doc<"proposals">) => ({
  id: proposal._id,
  userId: user.externalId,
  synthesisId: proposal.synthesisId,
  kind: proposal.kind,
  status: proposal.status,
  title: proposal.title,
  body: proposal.body,
  rationale: proposal.rationale,
  createdAt: proposal.createdAt,
  updatedAt: proposal.updatedAt,
});

const reviewRecord = (user: Doc<"users">, review: Doc<"reviews">) => ({
  id: review._id,
  userId: user.externalId,
  proposalId: review.proposalId,
  decision: review.decision,
  ...(review.editedTitle !== undefined ? { editedTitle: review.editedTitle } : {}),
  ...(review.editedBody !== undefined ? { editedBody: review.editedBody } : {}),
  ...(review.editedBodyDocument !== undefined
    ? { editedBodyDocument: review.editedBodyDocument }
    : {}),
  createdAt: review.createdAt,
});

const commitmentRecord = (user: Doc<"users">, commitment: Doc<"commitments">) => ({
  id: commitment._id,
  userId: user.externalId,
  proposalId: commitment.proposalId,
  reviewId: commitment.reviewId,
  title: commitment.title,
  body: commitment.body,
  ...(commitment.bodyDocument !== undefined ? { bodyDocument: commitment.bodyDocument } : {}),
  status: commitment.status,
  createdAt: commitment.createdAt,
  updatedAt: commitment.updatedAt,
});

const outcomeRecord = (user: Doc<"users">, outcome: Doc<"outcomes">) => ({
  id: outcome._id,
  userId: user.externalId,
  commitmentId: outcome.commitmentId,
  result: outcome.result,
  ...(outcome.note !== undefined ? { note: outcome.note } : {}),
  recordedAt: outcome.recordedAt,
  createdAt: outcome.createdAt,
});

const dailyNoteRecord = (user: Doc<"users">, note: Doc<"dailyNotes">) => ({
  id: note._id,
  userId: user.externalId,
  localDate: note.localDate,
  title: note.title,
  bodyText: note.bodyText,
  ...(note.bodyDocument !== undefined ? { bodyDocument: note.bodyDocument } : {}),
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});

const noteRevisionRecord = (user: Doc<"users">, revision: Doc<"noteRevisions">) => ({
  id: revision._id,
  noteId: revision.noteId,
  userId: user.externalId,
  revisionNumber: revision.revisionNumber,
  bodyText: revision.bodyText,
  changedText: revision.changedText,
  changeHash: revision.changeHash,
  createdAt: revision.createdAt,
  ...(revision.processedAt !== undefined ? { processedAt: revision.processedAt } : {}),
});

const extractedItemRecord = (user: Doc<"users">, item: Doc<"extractedItems">) => ({
  id: item._id,
  userId: user.externalId,
  sourceRevisionId: item.sourceRevisionId,
  sourceNoteId: item.sourceNoteId,
  kind: item.kind,
  title: item.title,
  body: item.body,
  status: item.status,
  ...(item.dueAt !== undefined ? { dueAt: item.dueAt } : {}),
  ...(item.remindAt !== undefined ? { remindAt: item.remindAt } : {}),
  ...(item.eventStartsAt !== undefined ? { eventStartsAt: item.eventStartsAt } : {}),
  ...(item.eventEndsAt !== undefined ? { eventEndsAt: item.eventEndsAt } : {}),
  confidence: item.confidence,
  dedupeKey: item.dedupeKey,
  metadata: item.metadata,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const itemEventRecord = (user: Doc<"users">, event: Doc<"itemEvents">) => ({
  id: event._id,
  itemId: event.itemId,
  userId: user.externalId,
  eventType: event.eventType,
  payload: event.payload,
  createdAt: event.createdAt,
});

const summaryDocumentRecord = (user: Doc<"users">, summary: Doc<"summaryDocuments">) => ({
  id: summary._id,
  userId: user.externalId,
  periodType: summary.periodType,
  periodStart: summary.periodStart,
  periodEnd: summary.periodEnd,
  title: summary.title,
  body: summary.body,
  status: summary.status,
  sourceNoteIds: summary.sourceNoteIds,
  sourceItemIds: summary.sourceItemIds,
  metadata: summary.metadata,
  generatedAt: summary.generatedAt,
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt,
});

const agentRunRecord = (user: Doc<"users">, run: Doc<"agentRuns">) => ({
  id: run._id,
  userId: user.externalId,
  triggerType: run.triggerType,
  sourceType: run.sourceType,
  sourceId: run.sourceId,
  status: run.status,
  ...(run.model !== undefined ? { model: run.model } : {}),
  metadata: run.metadata,
  startedAt: run.startedAt,
  ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
  ...(run.errorCode !== undefined ? { errorCode: run.errorCode } : {}),
});

const agentRunOutputRecord = (output: Doc<"agentRunOutputs">) => ({
  id: output._id,
  runId: output.runId,
  outputType: output.outputType,
  outputId: output.outputId,
  createdAt: output.createdAt,
});

const journalDocumentRecord = (user: Doc<"users">, document: Doc<"journalDocuments">) => ({
  id: document._id,
  userId: user.externalId,
  localDate: document.localDate,
  title: document.title,
  bodyText: document.bodyText,
  ...(document.bodyDocument !== undefined ? { bodyDocument: document.bodyDocument } : {}),
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

const journalRevisionRecord = (user: Doc<"users">, revision: Doc<"journalRevisions">) => ({
  id: revision._id,
  documentId: revision.documentId,
  userId: user.externalId,
  bodyText: revision.bodyText,
  changedText: revision.changedText,
  diffSummary: revision.diffSummary,
  createdAt: revision.createdAt,
});

const memoryDocumentRecord = (user: Doc<"users">, document: Doc<"memoryDocuments">) => ({
  id: document._id,
  userId: user.externalId,
  sourceType: document.sourceType,
  sourceId: document.sourceId,
  title: document.title,
  bodyText: document.bodyText,
  ...(document.localDate !== undefined ? { localDate: document.localDate } : {}),
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

const memoryChunkRecord = (user: Doc<"users">, chunk: Doc<"memoryChunks">) => ({
  id: chunk._id,
  userId: user.externalId,
  memoryDocumentId: chunk.memoryDocumentId,
  sourceType: chunk.sourceType,
  sourceId: chunk.sourceId,
  chunkText: chunk.chunkText,
  chunkHash: chunk.chunkHash,
  chunkIndex: chunk.chunkIndex,
  ...(chunk.indexedAt !== undefined ? { indexedAt: chunk.indexedAt } : {}),
  createdAt: chunk.createdAt,
});

const memoryIndexJobRecord = (user: Doc<"users">, job: Doc<"memoryIndexJobs">) => ({
  id: job._id,
  userId: user.externalId,
  memoryChunkId: job.memoryChunkId,
  sourceType: job.sourceType,
  sourceId: job.sourceId,
  status: job.status,
  ...(job.errorMessage !== undefined ? { errorMessage: job.errorMessage } : {}),
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});

const memoryRetrievalEventRecord = (user: Doc<"users">, event: Doc<"memoryRetrievalEvents">) => ({
  id: event._id,
  userId: user.externalId,
  query: event.query,
  resultChunkIds: event.resultChunkIds,
  source: event.source,
  createdAt: event.createdAt,
});

export const ensureUser = mutation({
  args: { user: userArg },
  handler: async (ctx, args) => {
    return userRecord(await ensureRuntimeUser(ctx, args.user));
  },
});

export const deleteUserData = mutation({
  args: { user: userArg },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const ownerId = user._id;
    const [
      agentRuns,
      commitments,
      dailyNotes,
      events,
      extractedItems,
      frames,
      itemEvents,
      journalDocuments,
      memoryChunks,
      memoryDocuments,
      noteRevisions,
      outcomes,
      proposals,
      reviews,
      summaries,
      syntheses,
      agentRunOutputs,
      journalRevisions,
      memoryIndexJobs,
      memoryRetrievalEvents,
    ] = await Promise.all([
      ctx.db
        .query("agentRuns")
        .withIndex("by_owner_started", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("commitments")
        .withIndex("by_owner_status_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("dailyNotes")
        .withIndex("by_owner_local_date", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("events")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("extractedItems")
        .withIndex("by_owner_status_updated", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("frames")
        .withIndex("by_owner_status", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("itemEvents")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("journalDocuments")
        .withIndex("by_owner_local_date", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryChunks")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryDocuments")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("noteRevisions")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("outcomes")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("proposals")
        .withIndex("by_owner_status_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("reviews")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("summaryDocuments")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("syntheses")
        .withIndex("by_owner_frame_generated", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("agentRunOutputs")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("journalRevisions")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryIndexJobs")
        .withIndex("by_owner_status_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryRetrievalEvents")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
    ]);

    await Promise.all(
      [
        ...agentRunOutputs,
        ...memoryRetrievalEvents,
        ...memoryIndexJobs,
        ...memoryChunks,
        ...memoryDocuments,
        ...journalRevisions,
        ...journalDocuments,
        ...noteRevisions,
        ...dailyNotes,
        ...itemEvents,
        ...extractedItems,
        ...summaries,
        ...outcomes,
        ...commitments,
        ...reviews,
        ...proposals,
        ...syntheses,
        ...frames,
        ...events,
        ...agentRuns,
      ].map((doc) => ctx.db.delete(doc._id)),
    );
    await ctx.db.delete(ownerId);
  },
});

export const exportUserData = query({
  args: { user: userArg },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const ownerId = user._id;
    const [
      agentRuns,
      agentRunOutputs,
      commitments,
      dailyNotes,
      events,
      extractedItems,
      frames,
      itemEvents,
      journalDocuments,
      journalRevisions,
      memoryChunks,
      memoryDocuments,
      memoryIndexJobs,
      memoryRetrievalEvents,
      noteRevisions,
      outcomes,
      proposals,
      reviews,
      summaries,
      syntheses,
    ] = await Promise.all([
      ctx.db
        .query("agentRuns")
        .withIndex("by_owner_started", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("agentRunOutputs")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("commitments")
        .withIndex("by_owner_status_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("dailyNotes")
        .withIndex("by_owner_local_date", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("events")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("extractedItems")
        .withIndex("by_owner_status_updated", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("frames")
        .withIndex("by_owner_status", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("itemEvents")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("journalDocuments")
        .withIndex("by_owner_local_date", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("journalRevisions")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryChunks")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryDocuments")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryIndexJobs")
        .withIndex("by_owner_status_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("memoryRetrievalEvents")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("noteRevisions")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("outcomes")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("proposals")
        .withIndex("by_owner_status_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("reviews")
        .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("summaryDocuments")
        .withIndex("by_owner_updated", (q) => q.eq("ownerId", ownerId))
        .collect(),
      ctx.db
        .query("syntheses")
        .withIndex("by_owner_frame_generated", (q) => q.eq("ownerId", ownerId))
        .collect(),
    ]);

    return {
      user: userRecord(user),
      agentRunOutputs: agentRunOutputs.map(agentRunOutputRecord).sort(byCreatedDesc),
      agentRuns: agentRuns.map((run) => agentRunRecord(user, run)).sort(byStartedDesc),
      commitments: commitments
        .map((commitment) => commitmentRecord(user, commitment))
        .sort(byCreatedDesc),
      dailyNotes: dailyNotes.map((note) => dailyNoteRecord(user, note)).sort(byUpdatedDesc),
      events: events.map((event) => eventRecord(user, event)).sort(byCreatedDesc),
      extractedItems: extractedItems
        .map((item) => extractedItemRecord(user, item))
        .sort(byUpdatedDesc),
      frames: frames.map((frame) => frameRecord(user, frame)).sort(byUpdatedDesc),
      itemEvents: itemEvents.map((event) => itemEventRecord(user, event)).sort(byCreatedDesc),
      journalDocuments: journalDocuments
        .map((document) => journalDocumentRecord(user, document))
        .sort(byUpdatedDesc),
      journalRevisions: journalRevisions
        .map((revision) => journalRevisionRecord(user, revision))
        .sort(byCreatedDesc),
      memoryChunks: memoryChunks.map((chunk) => memoryChunkRecord(user, chunk)),
      memoryDocuments: memoryDocuments
        .map((document) => memoryDocumentRecord(user, document))
        .sort(byUpdatedDesc),
      memoryIndexJobs: memoryIndexJobs
        .map((job) => memoryIndexJobRecord(user, job))
        .sort(byCreatedDesc),
      memoryRetrievalEvents: memoryRetrievalEvents
        .map((event) => memoryRetrievalEventRecord(user, event))
        .sort(byCreatedDesc),
      noteRevisions: noteRevisions
        .map((revision) => noteRevisionRecord(user, revision))
        .sort(byCreatedDesc),
      outcomes: outcomes.map((outcome) => outcomeRecord(user, outcome)).sort(byCreatedDesc),
      proposals: proposals.map((proposal) => proposalRecord(user, proposal)).sort(byCreatedDesc),
      reviews: reviews.map((review) => reviewRecord(user, review)).sort(byCreatedDesc),
      summaryDocuments: summaries
        .map((summary) => summaryDocumentRecord(user, summary))
        .sort(byUpdatedDesc),
      syntheses: syntheses.map((synthesis) => synthesisRecord(user, synthesis)).sort(byCreatedDesc),
    };
  },
});

export const appendEvent = mutation({
  args: {
    user: userArg,
    type: v.string(),
    source: v.string(),
    occurredAt: v.string(),
    schemaVersion: v.number(),
    idempotencyKey: v.optional(v.string()),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("events")
        .withIndex("by_owner_idempotency_key", (index) =>
          index.eq("ownerId", user._id).eq("idempotencyKey", args.idempotencyKey),
        )
        .first();
      if (existing) return eventRecord(user, existing);
    }

    const eventId = await ctx.db.insert("events", {
      ownerId: user._id,
      type: args.type,
      source: args.source,
      occurredAt: args.occurredAt,
      schemaVersion: args.schemaVersion,
      ...(args.idempotencyKey !== undefined ? { idempotencyKey: args.idempotencyKey } : {}),
      payload: args.payload,
      createdAt: nowIso(),
    });
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event disappeared during insert");
    return eventRecord(user, event);
  },
});

export const listRecentEvents = query({
  args: {
    user: userArg,
    limit: v.number(),
    occurredFrom: v.optional(v.string()),
    occurredTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const events = await ctx.db
      .query("events")
      .withIndex("by_owner_occurred", (index) => index.eq("ownerId", user._id))
      .order("desc")
      .collect();
    return events
      .filter((event) => args.occurredFrom === undefined || event.occurredAt >= args.occurredFrom)
      .filter((event) => args.occurredTo === undefined || event.occurredAt <= args.occurredTo)
      .slice(0, args.limit)
      .map((event) => eventRecord(user, event));
  },
});

export const upsertCurrentFrame = mutation({
  args: { user: userArg, key: v.string(), title: v.string(), prompt: v.string() },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const previous = await ctx.db
      .query("frames")
      .withIndex("by_owner_key", (index) => index.eq("ownerId", user._id).eq("key", args.key))
      .first();
    const timestamp = nowIso();
    if (previous) {
      await ctx.db.patch(previous._id, {
        prompt: args.prompt,
        title: args.title,
        updatedAt: timestamp,
      });
      const frame = await ctx.db.get(previous._id);
      if (!frame) throw new Error("Frame disappeared during update");
      return frameRecord(user, frame);
    }
    const frameId = await ctx.db.insert("frames", {
      ownerId: user._id,
      key: args.key,
      title: args.title,
      prompt: args.prompt,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const frame = await ctx.db.get(frameId);
    if (!frame) throw new Error("Frame disappeared during insert");
    return frameRecord(user, frame);
  },
});

export const getCurrentFrame = query({
  args: { user: userArg, key: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const frame = await ctx.db
      .query("frames")
      .withIndex("by_owner_key", (index) => index.eq("ownerId", user._id).eq("key", args.key))
      .first();
    return frame ? frameRecord(user, frame) : null;
  },
});

export const appendSynthesis = mutation({
  args: {
    user: userArg,
    frameId: v.string(),
    summary: v.string(),
    themes: v.array(v.string()),
    openQuestions: v.array(v.string()),
    sourceSignalIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const frameId = requireStoredId(ctx, "frames", args.frameId);
    const sourceSignalIds = args.sourceSignalIds.map((sourceSignalId) =>
      requireStoredId(ctx, "events", sourceSignalId),
    );
    const fingerprint = JSON.stringify({
      openQuestions: args.openQuestions,
      sourceSignalIds,
      summary: args.summary,
      themes: args.themes,
    });
    const existing = await ctx.db
      .query("syntheses")
      .withIndex("by_owner_frame_fingerprint", (index) =>
        index.eq("ownerId", user._id).eq("frameId", frameId).eq("fingerprint", fingerprint),
      )
      .first();
    if (existing) return synthesisRecord(user, existing);

    const timestamp = nowIso();
    const synthesisId = await ctx.db.insert("syntheses", {
      ownerId: user._id,
      frameId,
      summary: args.summary,
      themes: args.themes,
      openQuestions: args.openQuestions,
      sourceSignalIds,
      fingerprint,
      generatedAt: timestamp,
      createdAt: timestamp,
    });
    const synthesis = await ctx.db.get(synthesisId);
    if (!synthesis) throw new Error("Synthesis disappeared during insert");
    return synthesisRecord(user, synthesis);
  },
});

export const getLatestSynthesis = query({
  args: { user: userArg, frameId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const frameId = requireStoredId(ctx, "frames", args.frameId);
    const synthesis = await ctx.db
      .query("syntheses")
      .withIndex("by_owner_frame_generated", (index) =>
        index.eq("ownerId", user._id).eq("frameId", frameId),
      )
      .order("desc")
      .first();
    return synthesis ? synthesisRecord(user, synthesis) : null;
  },
});

export const appendProposal = mutation({
  args: {
    user: userArg,
    synthesisId: v.string(),
    kind: proposalKind,
    title: v.string(),
    body: v.string(),
    rationale: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const synthesisId = requireStoredId(ctx, "syntheses", args.synthesisId);
    const existing = await ctx.db
      .query("proposals")
      .withIndex("by_synthesis", (index) => index.eq("synthesisId", synthesisId))
      .collect();
    const duplicate = existing.find(
      (proposal) =>
        proposal.kind === args.kind &&
        proposal.title === args.title &&
        proposal.body === args.body &&
        proposal.ownerId === user._id,
    );
    if (duplicate) return proposalRecord(user, duplicate);
    const timestamp = nowIso();
    const proposalId = await ctx.db.insert("proposals", {
      ownerId: user._id,
      synthesisId,
      kind: args.kind,
      status: "pending",
      title: args.title,
      body: args.body,
      rationale: args.rationale,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) throw new Error("Proposal disappeared during insert");
    return proposalRecord(user, proposal);
  },
});

export const listPendingProposals = query({
  args: { user: userArg, limit: v.number() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_owner_status_created", (index) =>
        index.eq("ownerId", user._id).eq("status", "pending"),
      )
      .order("desc")
      .take(args.limit);
    return proposals.map((proposal) => proposalRecord(user, proposal));
  },
});

export const getProposal = query({
  args: { user: userArg, proposalId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const proposalId = requireStoredId(ctx, "proposals", args.proposalId);
    const proposal = await ctx.db.get(proposalId);
    return proposal && proposal.ownerId === user._id ? proposalRecord(user, proposal) : null;
  },
});

export const getReviewForProposal = query({
  args: { user: userArg, proposalId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const proposalId = requireStoredId(ctx, "proposals", args.proposalId);
    const review = await ctx.db
      .query("reviews")
      .withIndex("by_proposal", (index) => index.eq("proposalId", proposalId))
      .first();
    return review && review.ownerId === user._id ? reviewRecord(user, review) : null;
  },
});

export const reviewProposal = mutation({
  args: {
    user: userArg,
    proposalId: v.string(),
    decision: reviewDecision,
    editedTitle: v.optional(v.string()),
    editedBody: v.optional(v.string()),
    editedBodyDocument: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const proposalId = requireStoredId(ctx, "proposals", args.proposalId);
    const proposal = await ctx.db.get(proposalId);
    if (!proposal || proposal.ownerId !== user._id) throw new Error("Proposal not found");

    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_proposal", (index) => index.eq("proposalId", proposalId))
      .first();
    if (existingReview) {
      if (
        existingReview.decision === args.decision &&
        existingReview.editedTitle === args.editedTitle &&
        existingReview.editedBody === args.editedBody &&
        sameJson(existingReview.editedBodyDocument, args.editedBodyDocument)
      ) {
        return reviewRecord(user, existingReview);
      }
      throw new Error("Proposal already reviewed");
    }

    if (proposal.status !== "pending") throw new Error("Proposal already reviewed");
    const timestamp = nowIso();
    const reviewId = await ctx.db.insert("reviews", {
      ownerId: user._id,
      proposalId,
      decision: args.decision,
      ...(args.editedTitle !== undefined ? { editedTitle: args.editedTitle } : {}),
      ...(args.editedBody !== undefined ? { editedBody: args.editedBody } : {}),
      ...(args.editedBodyDocument !== undefined
        ? { editedBodyDocument: args.editedBodyDocument }
        : {}),
      createdAt: timestamp,
    });
    await ctx.db.patch(proposalId, {
      status: args.decision,
      ...(args.editedTitle !== undefined ? { title: args.editedTitle } : {}),
      ...(args.editedBody !== undefined ? { body: args.editedBody } : {}),
      updatedAt: timestamp,
    });
    const review = await ctx.db.get(reviewId);
    if (!review) throw new Error("Review disappeared during insert");
    return reviewRecord(user, review);
  },
});

export const appendCommitment = mutation({
  args: {
    user: userArg,
    proposalId: v.string(),
    reviewId: v.string(),
    title: v.string(),
    body: v.string(),
    bodyDocument: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const proposalId = requireStoredId(ctx, "proposals", args.proposalId);
    const reviewId = requireStoredId(ctx, "reviews", args.reviewId);
    const existing = await ctx.db
      .query("commitments")
      .withIndex("by_proposal", (index) => index.eq("proposalId", proposalId))
      .first();
    if (existing) return commitmentRecord(user, existing);
    const timestamp = nowIso();
    const commitmentId = await ctx.db.insert("commitments", {
      ownerId: user._id,
      proposalId,
      reviewId,
      title: args.title,
      body: args.body,
      ...(args.bodyDocument !== undefined ? { bodyDocument: args.bodyDocument } : {}),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const commitment = await ctx.db.get(commitmentId);
    if (!commitment) throw new Error("Commitment disappeared during insert");
    return commitmentRecord(user, commitment);
  },
});

export const listCommitments = query({
  args: {
    user: userArg,
    limit: v.number(),
    status: v.optional(
      v.union(v.literal("active"), v.literal("completed"), v.literal("abandoned")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const status = args.status;
    const commitments = status
      ? await ctx.db
          .query("commitments")
          .withIndex("by_owner_status_created", (index) =>
            index.eq("ownerId", user._id).eq("status", status),
          )
          .order("desc")
          .take(args.limit)
      : (
          await ctx.db
            .query("commitments")
            .withIndex("by_owner_status_created", (index) => index.eq("ownerId", user._id))
            .collect()
        )
          .sort(byCreatedDesc)
          .slice(0, args.limit);
    return commitments.map((commitment) => commitmentRecord(user, commitment));
  },
});

export const recordOutcome = mutation({
  args: {
    user: userArg,
    commitmentId: v.string(),
    result: outcomeResult,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const commitmentId = requireStoredId(ctx, "commitments", args.commitmentId);
    const commitment = await ctx.db.get(commitmentId);
    if (!commitment || commitment.ownerId !== user._id) throw new Error("Commitment not found");
    const existing = await ctx.db
      .query("outcomes")
      .withIndex("by_commitment", (index) => index.eq("commitmentId", commitmentId))
      .first();
    if (existing) {
      if (existing.result === args.result && existing.note === args.note) {
        return outcomeRecord(user, existing);
      }
      throw new Error("Commitment outcome already recorded");
    }

    const timestamp = nowIso();
    const outcomeId = await ctx.db.insert("outcomes", {
      ownerId: user._id,
      commitmentId,
      result: args.result,
      ...(args.note !== undefined ? { note: args.note } : {}),
      recordedAt: timestamp,
      createdAt: timestamp,
    });
    await ctx.db.patch(commitmentId, { status: args.result, updatedAt: timestamp });
    const outcome = await ctx.db.get(outcomeId);
    if (!outcome) throw new Error("Outcome disappeared during insert");
    return outcomeRecord(user, outcome);
  },
});

export const listOutcomes = query({
  args: { user: userArg, limit: v.number() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const outcomes = await ctx.db
      .query("outcomes")
      .withIndex("by_owner_created", (index) => index.eq("ownerId", user._id))
      .order("desc")
      .take(args.limit);
    return outcomes.map((outcome) => outcomeRecord(user, outcome));
  },
});

export const upsertDailyNote = mutation({
  args: {
    user: userArg,
    localDate: v.string(),
    title: v.string(),
    bodyText: v.string(),
    bodyDocument: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const previous = await ctx.db
      .query("dailyNotes")
      .withIndex("by_owner_local_date", (index) =>
        index.eq("ownerId", user._id).eq("localDate", args.localDate),
      )
      .first();
    const timestamp = nowIso();
    const changedText = changedTextFrom(previous?.bodyText ?? null, args.bodyText);
    const noteId = previous
      ? previous._id
      : await ctx.db.insert("dailyNotes", {
          ownerId: user._id,
          localDate: args.localDate,
          title: args.title,
          bodyText: args.bodyText,
          ...(args.bodyDocument !== undefined ? { bodyDocument: args.bodyDocument } : {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        });

    if (previous) {
      await ctx.db.patch(previous._id, {
        title: args.title,
        bodyText: args.bodyText,
        ...(args.bodyDocument !== undefined ? { bodyDocument: args.bodyDocument } : {}),
        updatedAt: timestamp,
      });
    }

    const revisions = await ctx.db
      .query("noteRevisions")
      .withIndex("by_note_revision", (index) => index.eq("noteId", noteId))
      .collect();
    const revisionNumber = revisions.length + 1;
    const revisionId = await ctx.db.insert("noteRevisions", {
      ownerId: user._id,
      noteId,
      revisionNumber,
      bodyText: args.bodyText,
      changedText,
      changeHash: simpleHash(`${user.externalId}:${noteId}:${revisionNumber}:${changedText}`),
      createdAt: timestamp,
    });
    const note = await ctx.db.get(noteId);
    const revision = await ctx.db.get(revisionId);
    if (!note || !revision) throw new Error("Daily note write failed");
    return { note: dailyNoteRecord(user, note), revision: noteRevisionRecord(user, revision) };
  },
});

export const getDailyNote = query({
  args: { user: userArg, localDate: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const note = await ctx.db
      .query("dailyNotes")
      .withIndex("by_owner_local_date", (index) =>
        index.eq("ownerId", user._id).eq("localDate", args.localDate),
      )
      .first();
    return note ? dailyNoteRecord(user, note) : null;
  },
});

export const listNoteRevisions = query({
  args: { user: userArg, noteId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const noteId = requireStoredId(ctx, "dailyNotes", args.noteId);
    const revisions = await ctx.db
      .query("noteRevisions")
      .withIndex("by_note_revision", (index) => index.eq("noteId", noteId))
      .order("desc")
      .take(args.limit);
    return revisions
      .filter((revision) => revision.ownerId === user._id)
      .map((revision) => noteRevisionRecord(user, revision));
  },
});

export const upsertExtractedItem = mutation({
  args: {
    user: userArg,
    sourceRevisionId: v.string(),
    sourceNoteId: v.string(),
    kind: extractedItemKind,
    title: v.string(),
    body: v.string(),
    status: v.optional(extractedItemStatus),
    dueAt: v.optional(v.string()),
    remindAt: v.optional(v.string()),
    eventStartsAt: v.optional(v.string()),
    eventEndsAt: v.optional(v.string()),
    confidence: v.number(),
    dedupeKey: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const previous = await ctx.db
      .query("extractedItems")
      .withIndex("by_owner_dedupe_key", (index) =>
        index.eq("ownerId", user._id).eq("dedupeKey", args.dedupeKey),
      )
      .first();
    const timestamp = nowIso();
    if (previous) {
      await ctx.db.patch(previous._id, {
        sourceRevisionId: args.sourceRevisionId,
        sourceNoteId: args.sourceNoteId,
        kind: args.kind,
        title: args.title,
        body: args.body,
        status: args.status ?? previous.status,
        ...(args.dueAt !== undefined ? { dueAt: args.dueAt } : {}),
        ...(args.remindAt !== undefined ? { remindAt: args.remindAt } : {}),
        ...(args.eventStartsAt !== undefined ? { eventStartsAt: args.eventStartsAt } : {}),
        ...(args.eventEndsAt !== undefined ? { eventEndsAt: args.eventEndsAt } : {}),
        confidence: args.confidence,
        metadata: args.metadata,
        updatedAt: timestamp,
      });
      const item = await ctx.db.get(previous._id);
      if (!item) throw new Error("Extracted item disappeared during update");
      return extractedItemRecord(user, item);
    }
    const itemId = await ctx.db.insert("extractedItems", {
      ownerId: user._id,
      sourceRevisionId: args.sourceRevisionId,
      sourceNoteId: args.sourceNoteId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      status: args.status ?? "proposed",
      ...(args.dueAt !== undefined ? { dueAt: args.dueAt } : {}),
      ...(args.remindAt !== undefined ? { remindAt: args.remindAt } : {}),
      ...(args.eventStartsAt !== undefined ? { eventStartsAt: args.eventStartsAt } : {}),
      ...(args.eventEndsAt !== undefined ? { eventEndsAt: args.eventEndsAt } : {}),
      confidence: args.confidence,
      dedupeKey: args.dedupeKey,
      metadata: args.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Extracted item disappeared during insert");
    return extractedItemRecord(user, item);
  },
});

export const updateExtractedItemStatus = mutation({
  args: { user: userArg, itemId: v.string(), status: extractedItemStatus },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const itemId = requireStoredId(ctx, "extractedItems", args.itemId);
    const item = await ctx.db.get(itemId);
    if (!item || item.ownerId !== user._id) throw new Error("Extracted item not found");
    await ctx.db.patch(itemId, { status: args.status, updatedAt: nowIso() });
    const updated = await ctx.db.get(itemId);
    if (!updated) throw new Error("Extracted item disappeared during update");
    return extractedItemRecord(user, updated);
  },
});

export const listExtractedItems = query({
  args: { user: userArg, limit: v.number(), status: v.optional(extractedItemStatus) },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const status = args.status;
    const items = status
      ? await ctx.db
          .query("extractedItems")
          .withIndex("by_owner_status_updated", (index) =>
            index.eq("ownerId", user._id).eq("status", status),
          )
          .order("desc")
          .take(args.limit)
      : (
          await ctx.db
            .query("extractedItems")
            .withIndex("by_owner_status_updated", (index) => index.eq("ownerId", user._id))
            .collect()
        )
          .sort(byUpdatedDesc)
          .slice(0, args.limit);
    return items.map((item) => extractedItemRecord(user, item));
  },
});

export const recordItemEvent = mutation({
  args: { user: userArg, itemId: v.string(), eventType: itemEventType, payload: v.any() },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const itemId = requireStoredId(ctx, "extractedItems", args.itemId);
    const item = await ctx.db.get(itemId);
    if (!item || item.ownerId !== user._id) throw new Error("Extracted item not found");
    const eventId = await ctx.db.insert("itemEvents", {
      ownerId: user._id,
      itemId,
      eventType: args.eventType,
      payload: args.payload,
      createdAt: nowIso(),
    });
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Item event disappeared during insert");
    return itemEventRecord(user, event);
  },
});

export const upsertSummaryDocument = mutation({
  args: {
    user: userArg,
    periodType: summaryPeriodType,
    periodStart: v.string(),
    periodEnd: v.string(),
    title: v.string(),
    body: v.string(),
    status: summaryStatus,
    sourceNoteIds: v.array(v.string()),
    sourceItemIds: v.array(v.string()),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const existing = (
      await ctx.db
        .query("summaryDocuments")
        .withIndex("by_owner_period_start", (index) =>
          index
            .eq("ownerId", user._id)
            .eq("periodType", args.periodType)
            .eq("periodStart", args.periodStart),
        )
        .collect()
    ).find((summary) => summary.periodEnd === args.periodEnd);
    const timestamp = nowIso();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        body: args.body,
        status: args.status,
        sourceNoteIds: args.sourceNoteIds,
        sourceItemIds: args.sourceItemIds,
        metadata: args.metadata,
        updatedAt: timestamp,
      });
      const summary = await ctx.db.get(existing._id);
      if (!summary) throw new Error("Summary disappeared during update");
      return summaryDocumentRecord(user, summary);
    }
    const summaryId = await ctx.db.insert("summaryDocuments", {
      ownerId: user._id,
      periodType: args.periodType,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      title: args.title,
      body: args.body,
      status: args.status,
      sourceNoteIds: args.sourceNoteIds,
      sourceItemIds: args.sourceItemIds,
      metadata: args.metadata,
      generatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const summary = await ctx.db.get(summaryId);
    if (!summary) throw new Error("Summary disappeared during insert");
    return summaryDocumentRecord(user, summary);
  },
});

export const listSummaryDocuments = query({
  args: { user: userArg, limit: v.number(), periodType: v.optional(summaryPeriodType) },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const periodType = args.periodType;
    const summaries = periodType
      ? await ctx.db
          .query("summaryDocuments")
          .withIndex("by_owner_period_start", (index) =>
            index.eq("ownerId", user._id).eq("periodType", periodType),
          )
          .collect()
      : await ctx.db
          .query("summaryDocuments")
          .withIndex("by_owner_updated", (index) => index.eq("ownerId", user._id))
          .collect();
    return summaries
      .sort(byUpdatedDesc)
      .slice(0, args.limit)
      .map((summary) => summaryDocumentRecord(user, summary));
  },
});

export const startAgentRun = mutation({
  args: {
    user: userArg,
    triggerType: agentRunTriggerType,
    sourceType: v.string(),
    sourceId: v.string(),
    status: v.optional(agentRunStatus),
    model: v.optional(v.string()),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const runId = await ctx.db.insert("agentRuns", {
      ownerId: user._id,
      triggerType: args.triggerType,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      status: args.status ?? "queued",
      ...(args.model !== undefined ? { model: args.model } : {}),
      metadata: args.metadata,
      startedAt: nowIso(),
    });
    const run = await ctx.db.get(runId);
    if (!run) throw new Error("Agent run disappeared during insert");
    return agentRunRecord(user, run);
  },
});

export const getAgentRun = query({
  args: { user: userArg, runId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const runId = requireStoredId(ctx, "agentRuns", args.runId);
    const run = await ctx.db.get(runId);
    return run && run.ownerId === user._id ? agentRunRecord(user, run) : null;
  },
});

export const listAgentRuns = query({
  args: { user: userArg, limit: v.number(), sourceType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_started", (index) => index.eq("ownerId", user._id))
      .order("desc")
      .collect();
    return runs
      .filter((run) => args.sourceType === undefined || run.sourceType === args.sourceType)
      .slice(0, args.limit)
      .map((run) => agentRunRecord(user, run));
  },
});

export const markAgentRunRunning = mutation({
  args: { user: userArg, runId: v.string() },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const runId = requireStoredId(ctx, "agentRuns", args.runId);
    const run = await ctx.db.get(runId);
    if (!run || run.ownerId !== user._id) throw new Error("Agent run not found");
    if (run.status !== "running") await ctx.db.patch(runId, { status: "running" });
    const updated = await ctx.db.get(runId);
    if (!updated) throw new Error("Agent run disappeared during update");
    return agentRunRecord(user, updated);
  },
});

export const completeAgentRun = mutation({
  args: {
    user: userArg,
    runId: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    errorCode: v.optional(v.string()),
    outputs: v.optional(
      v.array(v.object({ outputType: agentRunOutputType, outputId: v.string() })),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const runId = requireStoredId(ctx, "agentRuns", args.runId);
    const run = await ctx.db.get(runId);
    if (!run || run.ownerId !== user._id) throw new Error("Agent run not found");
    const timestamp = nowIso();
    await ctx.db.patch(runId, {
      status: args.status,
      completedAt: timestamp,
      ...(args.errorCode !== undefined ? { errorCode: args.errorCode } : {}),
    });
    await Promise.all(
      (args.outputs ?? []).map((output) =>
        ctx.db.insert("agentRunOutputs", {
          ownerId: user._id,
          runId,
          outputId: output.outputId,
          outputType: output.outputType,
          createdAt: timestamp,
        }),
      ),
    );
    const updated = await ctx.db.get(runId);
    if (!updated) throw new Error("Agent run disappeared during update");
    return agentRunRecord(user, updated);
  },
});

export const upsertJournalDocument = mutation({
  args: {
    user: userArg,
    localDate: v.string(),
    title: v.string(),
    bodyText: v.string(),
    bodyDocument: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const previous = await ctx.db
      .query("journalDocuments")
      .withIndex("by_owner_local_date", (index) =>
        index.eq("ownerId", user._id).eq("localDate", args.localDate),
      )
      .first();
    const timestamp = nowIso();
    const changedText = changedTextFrom(previous?.bodyText ?? null, args.bodyText);
    const documentId = previous
      ? previous._id
      : await ctx.db.insert("journalDocuments", {
          ownerId: user._id,
          localDate: args.localDate,
          title: args.title,
          bodyText: args.bodyText,
          ...(args.bodyDocument !== undefined ? { bodyDocument: args.bodyDocument } : {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    if (previous) {
      await ctx.db.patch(previous._id, {
        title: args.title,
        bodyText: args.bodyText,
        ...(args.bodyDocument !== undefined ? { bodyDocument: args.bodyDocument } : {}),
        updatedAt: timestamp,
      });
    }
    const revisionId = await ctx.db.insert("journalRevisions", {
      ownerId: user._id,
      documentId,
      bodyText: args.bodyText,
      changedText,
      diffSummary: diffSummaryFrom(previous?.bodyText ?? null, changedText),
      createdAt: timestamp,
    });
    const document = await ctx.db.get(documentId);
    const revision = await ctx.db.get(revisionId);
    if (!document || !revision) throw new Error("Journal document write failed");
    return {
      document: journalDocumentRecord(user, document),
      revision: journalRevisionRecord(user, revision),
    };
  },
});

export const getJournalDocument = query({
  args: { user: userArg, localDate: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const document = await ctx.db
      .query("journalDocuments")
      .withIndex("by_owner_local_date", (index) =>
        index.eq("ownerId", user._id).eq("localDate", args.localDate),
      )
      .first();
    return document ? journalDocumentRecord(user, document) : null;
  },
});

export const listJournalDocuments = query({
  args: { user: userArg },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const documents = await ctx.db
      .query("journalDocuments")
      .withIndex("by_owner_local_date", (index) => index.eq("ownerId", user._id))
      .collect();
    return documents.sort(byUpdatedDesc).map((document) => journalDocumentRecord(user, document));
  },
});

export const listJournalRevisions = query({
  args: { user: userArg, documentId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const documentId = requireStoredId(ctx, "journalDocuments", args.documentId);
    const revisions = await ctx.db
      .query("journalRevisions")
      .withIndex("by_document_created", (index) => index.eq("documentId", documentId))
      .order("desc")
      .take(args.limit);
    return revisions
      .filter((revision) => revision.ownerId === user._id)
      .map((revision) => journalRevisionRecord(user, revision));
  },
});

export const upsertMemoryDocument = mutation({
  args: {
    user: userArg,
    sourceType: memorySourceType,
    sourceId: v.string(),
    title: v.string(),
    bodyText: v.string(),
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const previous = await ctx.db
      .query("memoryDocuments")
      .withIndex("by_owner_source", (index) =>
        index
          .eq("ownerId", user._id)
          .eq("sourceType", args.sourceType)
          .eq("sourceId", args.sourceId),
      )
      .first();
    const timestamp = nowIso();
    const documentId = previous
      ? previous._id
      : await ctx.db.insert("memoryDocuments", {
          ownerId: user._id,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          title: args.title,
          bodyText: args.bodyText,
          ...(args.localDate !== undefined ? { localDate: args.localDate } : {}),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    if (previous) {
      await ctx.db.patch(previous._id, {
        title: args.title,
        bodyText: args.bodyText,
        ...(args.localDate !== undefined ? { localDate: args.localDate } : {}),
        updatedAt: timestamp,
      });
      const oldChunks = await ctx.db
        .query("memoryChunks")
        .withIndex("by_document_index", (index) => index.eq("memoryDocumentId", previous._id))
        .collect();
      await Promise.all(
        oldChunks.map(async (chunk) => {
          const jobs = await ctx.db
            .query("memoryIndexJobs")
            .withIndex("by_chunk", (index) => index.eq("memoryChunkId", chunk._id))
            .collect();
          await Promise.all(jobs.map((job) => ctx.db.delete(job._id)));
          await ctx.db.delete(chunk._id);
        }),
      );
    }

    const chunkWrites = await Promise.all(
      memoryChunksFrom(args.bodyText).map(async (chunkText, chunkIndex) => {
        const chunkId = await ctx.db.insert("memoryChunks", {
          ownerId: user._id,
          memoryDocumentId: documentId,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          chunkText,
          chunkHash: memoryChunkHash({
            userId: user.externalId,
            sourceType: args.sourceType,
            sourceId: args.sourceId,
            chunkIndex,
            chunkText,
          }),
          chunkIndex,
          createdAt: timestamp,
        });
        const chunk = await ctx.db.get(chunkId);
        if (!chunk) throw new Error("Memory chunk disappeared during insert");
        const jobId = await ctx.db.insert("memoryIndexJobs", {
          ownerId: user._id,
          memoryChunkId: chunkId,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          status: "pending",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        const job = await ctx.db.get(jobId);
        if (!job) throw new Error("Memory index job disappeared during insert");
        return { chunk, job };
      }),
    );
    const chunks = chunkWrites.map((write) => write.chunk);
    const indexJobs = chunkWrites.map((write) => write.job);
    const document = await ctx.db.get(documentId);
    if (!document) throw new Error("Memory document disappeared during write");
    return {
      document: memoryDocumentRecord(user, document),
      chunks: chunks.map((chunk) => memoryChunkRecord(user, chunk)),
      indexJobs: indexJobs.map((job) => memoryIndexJobRecord(user, job)),
    };
  },
});

export const getMemoryChunk = query({
  args: { user: userArg, memoryChunkId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const memoryChunkId = requireStoredId(ctx, "memoryChunks", args.memoryChunkId);
    const chunk = await ctx.db.get(memoryChunkId);
    return chunk && chunk.ownerId === user._id ? memoryChunkRecord(user, chunk) : null;
  },
});

export const listMemoryChunks = query({
  args: { user: userArg, memoryDocumentId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const memoryDocumentId = requireStoredId(ctx, "memoryDocuments", args.memoryDocumentId);
    const chunks = await ctx.db
      .query("memoryChunks")
      .withIndex("by_document_index", (index) => index.eq("memoryDocumentId", memoryDocumentId))
      .collect();
    return chunks
      .filter((chunk) => chunk.ownerId === user._id)
      .sort((left, right) => left.chunkIndex - right.chunkIndex)
      .map((chunk) => memoryChunkRecord(user, chunk));
  },
});

export const listPendingMemoryIndexJobs = query({
  args: { user: userArg, limit: v.number() },
  handler: async (ctx, args) => {
    const user = await requireRuntimeUser(ctx, args.user);
    const jobs = await ctx.db
      .query("memoryIndexJobs")
      .withIndex("by_owner_status_created", (index) =>
        index.eq("ownerId", user._id).eq("status", "pending"),
      )
      .order("asc")
      .take(args.limit);
    return jobs.map((job) => memoryIndexJobRecord(user, job));
  },
});

export const markMemoryChunkIndexed = mutation({
  args: { user: userArg, memoryChunkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const memoryChunkId = requireStoredId(ctx, "memoryChunks", args.memoryChunkId);
    const chunk = await ctx.db.get(memoryChunkId);
    if (!chunk || chunk.ownerId !== user._id) throw new Error("Memory chunk not found");
    const timestamp = nowIso();
    await ctx.db.patch(memoryChunkId, { indexedAt: timestamp });
    const jobs = await ctx.db
      .query("memoryIndexJobs")
      .withIndex("by_chunk", (index) => index.eq("memoryChunkId", memoryChunkId))
      .collect();
    await Promise.all(
      jobs
        .filter((job) => job.ownerId === user._id)
        .map((job) => ctx.db.patch(job._id, { status: "indexed", updatedAt: timestamp })),
    );
    const updated = await ctx.db.get(memoryChunkId);
    if (!updated) throw new Error("Memory chunk disappeared during update");
    return memoryChunkRecord(user, updated);
  },
});

export const recordMemoryRetrieval = mutation({
  args: {
    user: userArg,
    query: v.string(),
    resultChunkIds: v.array(v.string()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureRuntimeUser(ctx, args.user);
    const resultChunkIds = args.resultChunkIds.map((memoryChunkId) =>
      requireStoredId(ctx, "memoryChunks", memoryChunkId),
    );
    const eventId = await ctx.db.insert("memoryRetrievalEvents", {
      ownerId: user._id,
      query: args.query,
      resultChunkIds,
      source: args.source,
      createdAt: nowIso(),
    });
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Memory retrieval event disappeared during insert");
    return memoryRetrievalEventRecord(user, event);
  },
});
