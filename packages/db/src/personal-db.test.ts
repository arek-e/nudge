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

  test("stores pending proposals and review decisions for a synthesis", async () => {
    const program = Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser({ id: "user-a", displayName: "User A" });

      const frame = yield* db.upsertCurrentFrame({
        userId: "user-a",
        key: "current_state",
        title: "What matters now?",
        prompt: "Synthesize recent signals into current context.",
      });
      const synthesis = yield* db.appendSynthesis({
        userId: "user-a",
        frameId: frame.id,
        summary: "User has one open question.",
        themes: ["current-context"],
        openQuestions: ["What needs attention next?"],
        sourceSignalIds: [],
      });

      const proposal = yield* db.appendProposal({
        userId: "user-a",
        synthesisId: synthesis.id,
        kind: "clarify",
        title: "Clarify next attention point",
        body: "Answer: What needs attention next?",
        rationale: "Created from an open question in the synthesis.",
      });
      const pendingBeforeReview = yield* db.listPendingProposals({ userId: "user-a", limit: 10 });
      const review = yield* db.reviewProposal({
        userId: "user-a",
        proposalId: proposal.id,
        decision: "accepted",
      });
      const pendingAfterReview = yield* db.listPendingProposals({ userId: "user-a", limit: 10 });

      return { pendingAfterReview, pendingBeforeReview, proposal, review };
    });

    const result = await Effect.runPromise(Effect.provide(program, Db.layerMemory));

    expect(result.pendingBeforeReview).toEqual([result.proposal]);
    expect(result.review).toEqual(
      expect.objectContaining({
        userId: "user-a",
        proposalId: result.proposal.id,
        decision: "accepted",
      }),
    );
    expect(result.pendingAfterReview).toEqual([]);
  });

  test("stores memory documents with chunks and pending index jobs", async () => {
    const program = Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser({ id: "user-a", displayName: "User A" });

      const indexed = yield* db.upsertMemoryDocument({
        userId: "user-a",
        sourceType: "journal_revision",
        sourceId: "revision-1",
        title: "June 18 journal update",
        bodyText: "need to write to michael",
        localDate: "2026-06-18",
      });
      const pending = yield* db.listPendingMemoryIndexJobs({ userId: "user-a", limit: 10 });
      const marked = yield* db.markMemoryChunkIndexed({
        userId: "user-a",
        memoryChunkId: indexed.chunks[0]!.id,
      });
      const chunk = yield* db.getMemoryChunk({
        userId: "user-a",
        memoryChunkId: indexed.chunks[0]!.id,
      });
      const retrieval = yield* db.recordMemoryRetrieval({
        userId: "user-a",
        query: "michael",
        resultChunkIds: [indexed.chunks[0]!.id],
        source: "think.retrieveMemory",
      });

      return { chunk, indexed, marked, pending, retrieval };
    });

    const result = await Effect.runPromise(Effect.provide(program, Db.layerMemory));

    expect(result.indexed.document.sourceType).toBe("journal_revision");
    expect(result.indexed.chunks).toHaveLength(1);
    expect(result.indexed.indexJobs).toHaveLength(1);
    expect(result.pending[0]?.memoryChunkId).toBe(result.indexed.chunks[0]?.id);
    expect(result.marked.indexedAt).toBeString();
    expect(result.chunk?.indexedAt).toBe(result.marked.indexedAt);
    expect(result.retrieval.resultChunkIds).toEqual([result.indexed.chunks[0]?.id]);
  });
});
