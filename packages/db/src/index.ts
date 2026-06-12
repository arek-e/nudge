import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Effect, Layer } from "effect";
import { events, frames, schema, syntheses, synthesisSources, users } from "./schema";

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

export interface DbService {
  readonly provider: DatabaseProvider;
  readonly ensureUser: (user: DbUser) => Effect.Effect<void>;
  readonly appendEvent: (input: AppendEventInput) => Effect.Effect<EventRecord>;
  readonly appendSynthesis: (input: AppendSynthesisInput) => Effect.Effect<SynthesisRecord>;
  readonly getCurrentFrame: (input: GetCurrentFrameInput) => Effect.Effect<FrameRecord | null>;
  readonly getLatestSynthesis: (
    input: GetLatestSynthesisInput,
  ) => Effect.Effect<SynthesisRecord | null>;
  readonly listRecentEvents: (
    input: RecentEventsInput,
  ) => Effect.Effect<ReadonlyArray<EventRecord>>;
  readonly upsertCurrentFrame: (input: UpsertCurrentFrameInput) => Effect.Effect<FrameRecord>;
}

const nowIso = () => new Date().toISOString();
const eventId = () => crypto.randomUUID();

const byRecentEvent = (left: EventRecord, right: EventRecord) => {
  return (
    right.occurredAt.localeCompare(left.occurredAt) || right.createdAt.localeCompare(left.createdAt)
  );
};

export class Db extends Context.Service<Db, DbService>()("lares/db/Db") {
  static readonly layerMemory = Layer.effect(
    Db,
    Effect.sync(() => {
      const userStore = new Map<string, DbUser>();
      const eventStore = new Map<string, EventRecord>();
      const frameStore = new Map<string, FrameRecord>();
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
