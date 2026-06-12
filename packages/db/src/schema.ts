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
    payload: text("payload", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("events_user_occurred_at_idx").on(table.userId, table.occurredAt),
    index("events_user_created_at_idx").on(table.userId, table.createdAt),
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
    generatedAt: text("generated_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("syntheses_user_frame_generated_idx").on(table.userId, table.frameId, table.generatedAt),
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
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("reviews_user_created_idx").on(table.userId, table.createdAt),
    index("reviews_proposal_idx").on(table.proposalId),
  ],
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
  events,
  frames,
  proposals,
  reviews,
  syntheses,
  synthesisSources,
  traceSpans,
  users,
};
