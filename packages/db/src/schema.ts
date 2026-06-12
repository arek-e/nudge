import { index, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const schema = {
  events,
  frames,
  syntheses,
  synthesisSources,
  users,
};
