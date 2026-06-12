import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Db } from "./index";

describe("Db", () => {
  test("appends and lists recent events scoped to a user", async () => {
    const program = Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser({ id: "user-a", displayName: "User A" });
      yield* db.ensureUser({ id: "user-b", displayName: "User B" });

      const first = yield* db.appendEvent({
        userId: "user-a",
        type: "manual_check_in_submitted",
        source: "manual",
        occurredAt: "2026-06-12T09:00:00.000Z",
        schemaVersion: 1,
        payload: { note: "first" },
      });
      const second = yield* db.appendEvent({
        userId: "user-a",
        type: "daily_digest_requested",
        source: "api",
        occurredAt: "2026-06-12T10:00:00.000Z",
        schemaVersion: 1,
        payload: { reason: "test" },
      });
      yield* db.appendEvent({
        userId: "user-b",
        type: "manual_check_in_submitted",
        source: "manual",
        occurredAt: "2026-06-12T11:00:00.000Z",
        schemaVersion: 1,
        payload: { note: "private" },
      });

      const recent = yield* db.listRecentEvents({ userId: "user-a", limit: 10 });

      return { first, second, recent };
    });

    const result = await Effect.runPromise(Effect.provide(program, Db.layerMemory));

    expect(result.first.id).not.toBe(result.second.id);
    expect(result.recent).toEqual([
      expect.objectContaining({
        id: result.second.id,
        userId: "user-a",
        type: "daily_digest_requested",
        payload: { reason: "test" },
      }),
      expect.objectContaining({
        id: result.first.id,
        userId: "user-a",
        type: "manual_check_in_submitted",
        payload: { note: "first" },
      }),
    ]);
  });

  test("lists events in an occurred-at time range", async () => {
    const program = Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser({ id: "user-a", displayName: "User A" });

      yield* db.appendEvent({
        userId: "user-a",
        type: "outside_before",
        source: "test",
        occurredAt: "2026-06-01T09:00:00.000Z",
        schemaVersion: 1,
        payload: {},
      });
      yield* db.appendEvent({
        userId: "user-a",
        type: "inside_range",
        source: "test",
        occurredAt: "2026-06-08T09:00:00.000Z",
        schemaVersion: 1,
        payload: {},
      });
      yield* db.appendEvent({
        userId: "user-a",
        type: "outside_after",
        source: "test",
        occurredAt: "2026-06-15T09:00:00.000Z",
        schemaVersion: 1,
        payload: {},
      });

      return yield* db.listRecentEvents({
        userId: "user-a",
        limit: 10,
        occurredFrom: "2026-06-07T00:00:00.000Z",
        occurredTo: "2026-06-14T23:59:59.999Z",
      });
    });

    const events = await Effect.runPromise(Effect.provide(program, Db.layerMemory));

    expect(events.map((event) => event.type)).toEqual(["inside_range"]);
  });

  test("stores the current frame and source-linked synthesis for a user", async () => {
    const program = Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser({ id: "user-a", displayName: "User A" });

      const frame = yield* db.upsertCurrentFrame({
        userId: "user-a",
        key: "current_state",
        title: "What matters now?",
        prompt: "Synthesize recent signals into current context.",
      });
      const signal = yield* db.appendEvent({
        userId: "user-a",
        type: "user_context_captured",
        source: "test",
        occurredAt: "2026-06-12T09:00:00.000Z",
        schemaVersion: 1,
        payload: { note: "Traveling today" },
      });
      const synthesis = yield* db.appendSynthesis({
        userId: "user-a",
        frameId: frame.id,
        summary: "User is traveling today.",
        themes: ["travel"],
        openQuestions: ["What needs attention while traveling?"],
        sourceSignalIds: [signal.id],
      });

      const currentFrame = yield* db.getCurrentFrame({ userId: "user-a", key: "current_state" });
      const latestSynthesis = yield* db.getLatestSynthesis({ userId: "user-a", frameId: frame.id });

      return { currentFrame, frame, latestSynthesis, signal, synthesis };
    });

    const result = await Effect.runPromise(Effect.provide(program, Db.layerMemory));

    expect(result.currentFrame).toEqual(result.frame);
    expect(result.latestSynthesis).toEqual({
      ...result.synthesis,
      sourceSignalIds: [result.signal.id],
    });
  });
});
