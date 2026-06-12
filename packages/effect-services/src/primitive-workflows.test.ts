import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Db } from "@lares/db";
import { PrimitiveWorkflows } from "./index";

const user = { id: "workflow-user", displayName: "Workflow User" };

const runWithMemoryDb = <A, E>(workflow: Effect.Effect<A, E, Db>) => {
  return Effect.runPromise(Effect.provide(workflow, Db.layerMemory));
};

describe("PrimitiveWorkflows", () => {
  test("appends and lists source-linked signals for a user", async () => {
    const signal = await runWithMemoryDb(
      PrimitiveWorkflows.appendSignal({
        user,
        type: "capture.note",
        source: "test",
        occurredAt: "2026-06-12T10:00:00.000Z",
        schemaVersion: 1,
        payload: { note: "Follow up on travel plans" },
      }),
    );

    const signals = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.appendSignal({
          user,
          type: "capture.note",
          source: "test",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { note: "Follow up on travel plans" },
        });
        return yield* PrimitiveWorkflows.listSignals({ user, limit: 10 });
      }),
    );

    expect(signal.userId).toBe(user.id);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.payload).toEqual({ note: "Follow up on travel plans" });
  });

  test("creates synthesis and proposals from recent signals", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.appendSignal({
          user,
          type: "capture.note",
          source: "test",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { note: "Travel this week and follow up with work" },
        });
        const synthesis = yield* PrimitiveWorkflows.createSynthesis({
          user,
          frameKey: "current_state",
        });
        const proposals = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        return { proposals, synthesis };
      }),
    );

    expect(result.synthesis.frame.title).toBe("What matters now?");
    expect(result.synthesis.synthesis.summary).toContain("1 signal captured");
    expect(result.synthesis.synthesis.themes).toContain("travel");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.title).toBe("Clarify next attention point");
  });

  test("reviews pending proposals", async () => {
    const review = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.createSynthesis({ user, frameKey: "current_state" });
        const [proposal] = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        if (!proposal) throw new Error("Expected proposal");
        return yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "accepted",
        });
      }),
    );

    expect(review.userId).toBe(user.id);
    expect(review.decision).toBe("accepted");
  });
});
