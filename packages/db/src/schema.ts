import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authUsers = sqliteTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const authSessions = sqliteTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("auth_session_user_idx").on(table.userId)],
);

export const authAccounts = sqliteTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("auth_account_user_idx").on(table.userId)],
);

export const authVerifications = sqliteTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    source: text("source").notNull(),
    occurredAt: text("occurred_at").notNull(),
    schemaVersion: text("schema_version").notNull(),
    idempotencyKey: text("idempotency_key"),
    payload: text("payload", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("events_user_occurred_at_idx").on(table.userId, table.occurredAt),
    index("events_user_created_at_idx").on(table.userId, table.createdAt),
    uniqueIndex("events_user_idempotency_key_idx").on(table.userId, table.idempotencyKey),
  ],
);

export const frames = sqliteTable(
  "frames",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    key: text("key").notNull(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("frames_user_key_idx").on(table.userId, table.key),
    index("frames_user_status_idx").on(table.userId, table.status),
  ],
);

export const syntheses = sqliteTable(
  "syntheses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    frameId: text("frame_id")
      .notNull()
      .references(() => frames.id),
    summary: text("summary").notNull(),
    themes: text("themes", { mode: "json" }).$type<ReadonlyArray<string>>().notNull(),
    openQuestions: text("open_questions", { mode: "json" })
      .$type<ReadonlyArray<string>>()
      .notNull(),
    fingerprint: text("fingerprint"),
    generatedAt: text("generated_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("syntheses_user_frame_generated_idx").on(table.userId, table.frameId, table.generatedAt),
    uniqueIndex("syntheses_user_frame_fingerprint_idx").on(
      table.userId,
      table.frameId,
      table.fingerprint,
    ),
  ],
);

export const synthesisSources = sqliteTable(
  "synthesis_sources",
  {
    synthesisId: text("synthesis_id")
      .notNull()
      .references(() => syntheses.id, { onDelete: "cascade" }),
    signalId: text("signal_id")
      .notNull()
      .references(() => events.id),
  },
  (table) => [
    primaryKey({ columns: [table.synthesisId, table.signalId] }),
    index("synthesis_sources_signal_idx").on(table.signalId),
  ],
);

export const proposals = sqliteTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    synthesisId: text("synthesis_id")
      .notNull()
      .references(() => syntheses.id),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    rationale: text("rationale").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("proposals_user_status_created_idx").on(table.userId, table.status, table.createdAt),
    index("proposals_synthesis_idx").on(table.synthesisId),
    uniqueIndex("proposals_synthesis_kind_title_body_idx").on(
      table.synthesisId,
      table.kind,
      table.title,
      table.body,
    ),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    editedTitle: text("edited_title"),
    editedBody: text("edited_body"),
    editedBodyDocument: text("edited_body_document", { mode: "json" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("reviews_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("reviews_proposal_idx").on(table.proposalId),
  ],
);

export const commitments = sqliteTable(
  "commitments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    bodyDocument: text("body_document", { mode: "json" }),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("commitments_user_status_created_idx").on(table.userId, table.status, table.createdAt),
    uniqueIndex("commitments_proposal_idx").on(table.proposalId),
    uniqueIndex("commitments_review_idx").on(table.reviewId),
  ],
);

export const outcomes = sqliteTable(
  "outcomes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    commitmentId: text("commitment_id")
      .notNull()
      .references(() => commitments.id, { onDelete: "cascade" }),
    result: text("result").notNull(),
    note: text("note"),
    recordedAt: text("recorded_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("outcomes_user_recorded_idx").on(table.userId, table.recordedAt),
    uniqueIndex("outcomes_commitment_idx").on(table.commitmentId),
  ],
);

export const journalDocuments = sqliteTable(
  "journal_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    localDate: text("local_date").notNull(),
    title: text("title").notNull(),
    bodyText: text("body_text").notNull(),
    bodyDocument: text("body_document", { mode: "json" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("journal_documents_user_date_idx").on(table.userId, table.localDate),
    index("journal_documents_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const journalRevisions = sqliteTable(
  "journal_revisions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => journalDocuments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    bodyText: text("body_text").notNull(),
    changedText: text("changed_text").notNull(),
    diffSummary: text("diff_summary").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("journal_revisions_document_created_idx").on(table.documentId, table.createdAt),
    index("journal_revisions_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const dailyNotes = sqliteTable(
  "daily_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    localDate: text("local_date").notNull(),
    title: text("title").notNull(),
    bodyText: text("body_text").notNull(),
    bodyDocument: text("body_document", { mode: "json" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("daily_notes_user_date_idx").on(table.userId, table.localDate),
    index("daily_notes_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const noteRevisions = sqliteTable(
  "note_revisions",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => dailyNotes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    revisionNumber: integer("revision_number").notNull(),
    bodyText: text("body_text").notNull(),
    changedText: text("changed_text").notNull(),
    changeHash: text("change_hash").notNull(),
    createdAt: text("created_at").notNull(),
    processedAt: text("processed_at"),
  },
  (table) => [
    uniqueIndex("note_revisions_note_number_idx").on(table.noteId, table.revisionNumber),
    uniqueIndex("note_revisions_user_change_hash_idx").on(table.userId, table.changeHash),
    index("note_revisions_user_created_idx").on(table.userId, table.createdAt),
    index("note_revisions_user_processed_idx").on(table.userId, table.processedAt),
  ],
);

export const extractedItems = sqliteTable(
  "extracted_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sourceRevisionId: text("source_revision_id")
      .notNull()
      .references(() => noteRevisions.id, { onDelete: "cascade" }),
    sourceNoteId: text("source_note_id")
      .notNull()
      .references(() => dailyNotes.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(),
    dueAt: text("due_at"),
    remindAt: text("remind_at"),
    eventStartsAt: text("event_starts_at"),
    eventEndsAt: text("event_ends_at"),
    confidence: real("confidence").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    metadata: text("metadata", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("extracted_items_user_dedupe_idx").on(table.userId, table.dedupeKey),
    index("extracted_items_user_status_updated_idx").on(
      table.userId,
      table.status,
      table.updatedAt,
    ),
    index("extracted_items_user_kind_status_idx").on(table.userId, table.kind, table.status),
    index("extracted_items_source_revision_idx").on(table.sourceRevisionId),
  ],
);

export const itemEvents = sqliteTable(
  "item_events",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => extractedItems.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    eventType: text("event_type").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("item_events_item_created_idx").on(table.itemId, table.createdAt),
    index("item_events_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const summaryDocuments = sqliteTable(
  "summary_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    periodType: text("period_type").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(),
    generatedAt: text("generated_at").notNull(),
    sourceNoteIds: text("source_note_ids", { mode: "json" })
      .$type<ReadonlyArray<string>>()
      .notNull(),
    sourceItemIds: text("source_item_ids", { mode: "json" })
      .$type<ReadonlyArray<string>>()
      .notNull(),
    metadata: text("metadata", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("summary_documents_user_period_idx").on(
      table.userId,
      table.periodType,
      table.periodStart,
    ),
    index("summary_documents_user_status_idx").on(table.userId, table.status, table.generatedAt),
  ],
);

export const agentRuns = sqliteTable(
  "daily_agent_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    triggerType: text("trigger_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull(),
    model: text("model"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    errorCode: text("error_code"),
    metadata: text("metadata", { mode: "json" }).notNull(),
  },
  (table) => [
    index("daily_agent_runs_user_status_started_idx").on(
      table.userId,
      table.status,
      table.startedAt,
    ),
    index("daily_agent_runs_user_source_idx").on(table.userId, table.sourceType, table.sourceId),
  ],
);

export const agentRunOutputs = sqliteTable(
  "daily_agent_run_outputs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    outputType: text("output_type").notNull(),
    outputId: text("output_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("daily_agent_run_outputs_run_idx").on(table.runId),
    index("daily_agent_run_outputs_output_idx").on(table.outputType, table.outputId),
  ],
);

export const memoryDocuments = sqliteTable(
  "memory_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    title: text("title").notNull(),
    bodyText: text("body_text").notNull(),
    localDate: text("local_date"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("memory_documents_source_idx").on(table.userId, table.sourceType, table.sourceId),
    index("memory_documents_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const memoryChunks = sqliteTable(
  "memory_chunks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    memoryDocumentId: text("memory_document_id")
      .notNull()
      .references(() => memoryDocuments.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    chunkText: text("chunk_text").notNull(),
    chunkHash: text("chunk_hash").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    indexedAt: text("indexed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("memory_chunks_document_index_idx").on(table.memoryDocumentId, table.chunkIndex),
    uniqueIndex("memory_chunks_hash_idx").on(table.userId, table.chunkHash),
    index("memory_chunks_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const memoryIndexJobs = sqliteTable(
  "memory_index_jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    memoryChunkId: text("memory_chunk_id")
      .notNull()
      .references(() => memoryChunks.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("memory_index_jobs_chunk_idx").on(table.memoryChunkId),
    index("memory_index_jobs_user_status_idx").on(table.userId, table.status, table.createdAt),
  ],
);

export const memoryRetrievalEvents = sqliteTable(
  "memory_retrieval_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    query: text("query").notNull(),
    resultChunkIds: text("result_chunk_ids", { mode: "json" })
      .$type<ReadonlyArray<string>>()
      .notNull(),
    source: text("source").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("memory_retrieval_events_user_created_idx").on(table.userId, table.createdAt)],
);

export const traceSpans = sqliteTable(
  "trace_spans",
  {
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").primaryKey(),
    parentSpanId: text("parent_span_id"),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    durationMs: real("duration_ms"),
    service: text("service").notNull(),
    environment: text("environment").notNull(),
    version: text("version").notNull(),
    requestId: text("request_id"),
    routeName: text("route_name"),
    method: text("method"),
    path: text("path"),
    httpStatus: integer("http_status"),
    outcome: text("outcome"),
    attributes: text("attributes").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("trace_spans_trace_started_idx").on(table.traceId, table.startedAt),
    index("trace_spans_parent_idx").on(table.parentSpanId),
    index("trace_spans_route_started_idx").on(table.routeName, table.startedAt),
    index("trace_spans_status_started_idx").on(table.status, table.startedAt),
  ],
);

export const schema = {
  agentRunOutputs,
  agentRuns,
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  commitments,
  dailyNotes,
  events,
  extractedItems,
  journalDocuments,
  journalRevisions,
  itemEvents,
  memoryChunks,
  memoryDocuments,
  memoryIndexJobs,
  memoryRetrievalEvents,
  noteRevisions,
  outcomes,
  frames,
  proposals,
  reviews,
  summaryDocuments,
  syntheses,
  synthesisSources,
  traceSpans,
  users,
};
