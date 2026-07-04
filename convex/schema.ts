import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const agentStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("failed"),
);

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

const proposalStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("edited"),
  v.literal("rejected"),
);

const reviewDecision = v.union(v.literal("accepted"), v.literal("edited"), v.literal("rejected"));
const commitmentStatus = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("abandoned"),
);
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
const stickyNoteStatus = v.union(v.literal("active"), v.literal("archived"));
const cloudflareAgentRunStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);
const agentRunTriggerType = v.union(
  v.literal("note_inactivity"),
  v.literal("manual"),
  v.literal("end_of_day"),
  v.literal("end_of_week"),
  v.literal("backfill"),
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
const memoryIndexJobStatus = v.union(
  v.literal("pending"),
  v.literal("indexed"),
  v.literal("failed"),
);

export default defineSchema({
  agentStatuses: defineTable({
    documentId: v.id("documents"),
    errorCode: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    status: agentStatus,
    updatedAt: v.string(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_idempotency_key", ["documentId", "idempotencyKey"]),
  documentMutations: defineTable({
    createdAt: v.string(),
    documentId: v.id("documents"),
    idempotencyKey: v.string(),
    ownerId: v.id("users"),
    payloadHash: v.string(),
    status: v.literal("accepted"),
  }).index("by_owner_idempotency_key", ["ownerId", "idempotencyKey"]),
  documents: defineTable({
    bodyDocument: v.optional(v.any()),
    bodyText: v.string(),
    localDate: v.string(),
    ownerId: v.id("users"),
    serverRevision: v.string(),
    title: v.string(),
    updatedAt: v.string(),
  }).index("by_owner_local_date", ["ownerId", "localDate"]),
  stickyNoteAgentStatuses: defineTable({
    errorCode: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    noteId: v.id("stickyNotes"),
    status: agentStatus,
    updatedAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_note_idempotency_key", ["noteId", "idempotencyKey"]),
  stickyNoteMutations: defineTable({
    createdAt: v.string(),
    idempotencyKey: v.string(),
    noteId: v.id("stickyNotes"),
    ownerId: v.id("users"),
    payloadHash: v.string(),
    status: v.literal("accepted"),
  })
    .index("by_note", ["noteId"])
    .index("by_owner_idempotency_key", ["ownerId", "idempotencyKey"]),
  stickyNotes: defineTable({
    bodyDocument: v.optional(v.any()),
    bodyText: v.string(),
    color: v.string(),
    createdAt: v.string(),
    ownerId: v.id("users"),
    pinned: v.boolean(),
    serverRevision: v.string(),
    sortOrder: v.number(),
    status: stickyNoteStatus,
    title: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_status_updated", ["ownerId", "status", "updatedAt"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),
  users: defineTable({
    createdAt: v.string(),
    email: v.optional(v.string()),
    externalId: v.string(),
    imageUrl: v.optional(v.string()),
    name: v.optional(v.string()),
    updatedAt: v.string(),
    displayName: v.optional(v.string()),
  }).index("by_external_id", ["externalId"]),
  agentRunOutputs: defineTable({
    ownerId: v.id("users"),
    runId: v.id("agentRuns"),
    outputId: v.string(),
    outputType: agentRunOutputType,
    createdAt: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_run", ["runId"]),
  agentRuns: defineTable({
    ownerId: v.id("users"),
    triggerType: agentRunTriggerType,
    sourceType: v.string(),
    sourceId: v.string(),
    status: cloudflareAgentRunStatus,
    model: v.optional(v.string()),
    metadata: v.any(),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    errorCode: v.optional(v.string()),
  })
    .index("by_owner_started", ["ownerId", "startedAt"])
    .index("by_owner_source", ["ownerId", "sourceType", "sourceId"]),
  commitments: defineTable({
    ownerId: v.id("users"),
    proposalId: v.id("proposals"),
    reviewId: v.id("reviews"),
    title: v.string(),
    body: v.string(),
    bodyDocument: v.optional(v.any()),
    status: commitmentStatus,
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_status_created", ["ownerId", "status", "createdAt"])
    .index("by_proposal", ["proposalId"])
    .index("by_review", ["reviewId"]),
  dailyNotes: defineTable({
    ownerId: v.id("users"),
    localDate: v.string(),
    title: v.string(),
    bodyText: v.string(),
    bodyDocument: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_owner_local_date", ["ownerId", "localDate"]),
  events: defineTable({
    ownerId: v.id("users"),
    type: v.string(),
    source: v.string(),
    occurredAt: v.string(),
    schemaVersion: v.number(),
    idempotencyKey: v.optional(v.string()),
    payload: v.any(),
    createdAt: v.string(),
  })
    .index("by_owner_occurred", ["ownerId", "occurredAt"])
    .index("by_owner_created", ["ownerId", "createdAt"])
    .index("by_owner_idempotency_key", ["ownerId", "idempotencyKey"]),
  extractedItems: defineTable({
    ownerId: v.id("users"),
    sourceRevisionId: v.string(),
    sourceNoteId: v.string(),
    kind: extractedItemKind,
    title: v.string(),
    body: v.string(),
    status: extractedItemStatus,
    dueAt: v.optional(v.string()),
    remindAt: v.optional(v.string()),
    eventStartsAt: v.optional(v.string()),
    eventEndsAt: v.optional(v.string()),
    confidence: v.number(),
    dedupeKey: v.string(),
    metadata: v.any(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_status_updated", ["ownerId", "status", "updatedAt"])
    .index("by_owner_dedupe_key", ["ownerId", "dedupeKey"]),
  frames: defineTable({
    ownerId: v.id("users"),
    key: v.string(),
    title: v.string(),
    prompt: v.string(),
    status: v.literal("active"),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_key", ["ownerId", "key"])
    .index("by_owner_status", ["ownerId", "status"]),
  itemEvents: defineTable({
    ownerId: v.id("users"),
    itemId: v.id("extractedItems"),
    eventType: itemEventType,
    payload: v.any(),
    createdAt: v.string(),
  })
    .index("by_owner_created", ["ownerId", "createdAt"])
    .index("by_item", ["itemId"]),
  journalDocuments: defineTable({
    ownerId: v.id("users"),
    localDate: v.string(),
    title: v.string(),
    bodyText: v.string(),
    bodyDocument: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_owner_local_date", ["ownerId", "localDate"]),
  journalRevisions: defineTable({
    ownerId: v.id("users"),
    documentId: v.id("journalDocuments"),
    bodyText: v.string(),
    changedText: v.string(),
    diffSummary: v.string(),
    createdAt: v.string(),
  })
    .index("by_owner_created", ["ownerId", "createdAt"])
    .index("by_document_created", ["documentId", "createdAt"]),
  memoryChunks: defineTable({
    ownerId: v.id("users"),
    memoryDocumentId: v.id("memoryDocuments"),
    sourceType: memorySourceType,
    sourceId: v.string(),
    chunkText: v.string(),
    chunkHash: v.string(),
    chunkIndex: v.number(),
    indexedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_document_index", ["memoryDocumentId", "chunkIndex"]),
  memoryDocuments: defineTable({
    ownerId: v.id("users"),
    sourceType: memorySourceType,
    sourceId: v.string(),
    title: v.string(),
    bodyText: v.string(),
    localDate: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_source", ["ownerId", "sourceType", "sourceId"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),
  memoryIndexJobs: defineTable({
    ownerId: v.id("users"),
    memoryChunkId: v.id("memoryChunks"),
    sourceType: memorySourceType,
    sourceId: v.string(),
    status: memoryIndexJobStatus,
    errorMessage: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_status_created", ["ownerId", "status", "createdAt"])
    .index("by_chunk", ["memoryChunkId"]),
  memoryRetrievalEvents: defineTable({
    ownerId: v.id("users"),
    query: v.string(),
    resultChunkIds: v.array(v.id("memoryChunks")),
    source: v.string(),
    createdAt: v.string(),
  }).index("by_owner_created", ["ownerId", "createdAt"]),
  noteRevisions: defineTable({
    ownerId: v.id("users"),
    noteId: v.id("dailyNotes"),
    revisionNumber: v.number(),
    bodyText: v.string(),
    changedText: v.string(),
    changeHash: v.string(),
    createdAt: v.string(),
    processedAt: v.optional(v.string()),
  })
    .index("by_owner_created", ["ownerId", "createdAt"])
    .index("by_note_revision", ["noteId", "revisionNumber"]),
  outcomes: defineTable({
    ownerId: v.id("users"),
    commitmentId: v.id("commitments"),
    result: outcomeResult,
    note: v.optional(v.string()),
    recordedAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_owner_created", ["ownerId", "createdAt"])
    .index("by_commitment", ["commitmentId"]),
  proposals: defineTable({
    ownerId: v.id("users"),
    synthesisId: v.id("syntheses"),
    kind: proposalKind,
    status: proposalStatus,
    title: v.string(),
    body: v.string(),
    rationale: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_status_created", ["ownerId", "status", "createdAt"])
    .index("by_synthesis", ["synthesisId"]),
  reviews: defineTable({
    ownerId: v.id("users"),
    proposalId: v.id("proposals"),
    decision: reviewDecision,
    editedTitle: v.optional(v.string()),
    editedBody: v.optional(v.string()),
    editedBodyDocument: v.optional(v.any()),
    createdAt: v.string(),
  })
    .index("by_owner_created", ["ownerId", "createdAt"])
    .index("by_proposal", ["proposalId"]),
  summaryDocuments: defineTable({
    ownerId: v.id("users"),
    periodType: summaryPeriodType,
    periodStart: v.string(),
    periodEnd: v.string(),
    title: v.string(),
    body: v.string(),
    status: summaryStatus,
    sourceNoteIds: v.array(v.string()),
    sourceItemIds: v.array(v.string()),
    metadata: v.any(),
    generatedAt: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner_period_start", ["ownerId", "periodType", "periodStart"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),
  syntheses: defineTable({
    ownerId: v.id("users"),
    frameId: v.id("frames"),
    summary: v.string(),
    themes: v.array(v.string()),
    openQuestions: v.array(v.string()),
    sourceSignalIds: v.array(v.id("events")),
    fingerprint: v.optional(v.string()),
    generatedAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_owner_frame_generated", ["ownerId", "frameId", "generatedAt"])
    .index("by_owner_frame_fingerprint", ["ownerId", "frameId", "fingerprint"]),
});
