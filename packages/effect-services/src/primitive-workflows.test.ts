import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Db } from "@vesta/db";
import {
  currentWorkflowVersion,
  durableWorkflowStepConfig,
  PrimitiveWorkflows,
  workflowStepName,
} from "./index";

const user = { id: "workflow-user", displayName: "Workflow User" };

const runWithMemoryDb = <A, E>(workflow: Effect.Effect<A, E, Db>) => {
  return Effect.runPromise(Effect.provide(workflow, Db.layerMemory));
};

describe("PrimitiveWorkflows", () => {
  test("defines a bounded exponential retry policy for durable workflow steps", () => {
    expect(durableWorkflowStepConfig).toEqual({
      retries: {
        limit: 5,
        delay: 1_000,
        backoff: "exponential",
      },
      timeout: "10 minutes",
    });
  });

  test("names durable workflow steps with an explicit workflow version", () => {
    expect(currentWorkflowVersion).toBe(1);
    expect(workflowStepName(1, "daily-digest-health-check")).toBe("v1.daily-digest-health-check");
  });

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

  test("appending a signal is idempotent with an idempotency key", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        const first = yield* PrimitiveWorkflows.appendSignal({
          user,
          type: "capture.note",
          source: "test",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          idempotencyKey: "capture-retry-1",
          payload: { note: "Follow up on travel plans" },
        });
        const retried = yield* PrimitiveWorkflows.appendSignal({
          user,
          type: "capture.note",
          source: "test",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          idempotencyKey: "capture-retry-1",
          payload: { note: "Follow up on travel plans" },
        });
        const signals = yield* PrimitiveWorkflows.listSignals({ user, limit: 10 });

        return { first, retried, signals };
      }),
    );

    expect(result.retried.id).toBe(result.first.id);
    expect(result.signals).toHaveLength(1);
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

  test("synthesis and proposal generation are idempotent across retries", async () => {
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

        const firstSynthesis = yield* PrimitiveWorkflows.createSynthesis({
          user,
          frameKey: "current_state",
        });
        const retriedSynthesis = yield* PrimitiveWorkflows.createSynthesis({
          user,
          frameKey: "current_state",
        });
        const firstProposals = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        const retriedProposals = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        const pending = yield* PrimitiveWorkflows.listPendingProposals({ user, limit: 10 });

        return { firstProposals, firstSynthesis, pending, retriedProposals, retriedSynthesis };
      }),
    );

    expect(result.retriedSynthesis.synthesis.id).toBe(result.firstSynthesis.synthesis.id);
    expect(result.retriedProposals.map((proposal) => proposal.id)).toEqual(
      result.firstProposals.map((proposal) => proposal.id),
    );
    expect(result.pending).toHaveLength(1);
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

  test("accepting a proposal creates an active commitment", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.createSynthesis({ user, frameKey: "current_state" });
        const [proposal] = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        if (!proposal) throw new Error("Expected proposal");

        yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "accepted",
        });

        return yield* PrimitiveWorkflows.listCommitments({ user, limit: 10 });
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("active");
    expect(result[0]?.title).toBe("Clarify next attention point");
    expect(result[0]?.body).toBe("The next commitment is uncertain. What needs attention next?");
  });

  test("accepting a proposal is idempotent across retries", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.createSynthesis({ user, frameKey: "current_state" });
        const [proposal] = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        if (!proposal) throw new Error("Expected proposal");

        const firstReview = yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "accepted",
        });
        const retriedReview = yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "accepted",
        });
        const commitments = yield* PrimitiveWorkflows.listCommitments({ user, limit: 10 });

        return { commitments, firstReview, retriedReview };
      }),
    );

    expect(result.retriedReview.id).toBe(result.firstReview.id);
    expect(result.commitments).toHaveLength(1);
  });

  test("edited proposals preserve rich commitment body documents", async () => {
    const document = [{ type: "p", children: [{ text: "Send the travel follow-up." }] }];
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.createSynthesis({ user, frameKey: "current_state" });
        const [proposal] = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        if (!proposal) throw new Error("Expected proposal");

        yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "edited",
          editedTitle: "Confirm travel follow-up",
          editedBody: "Send the travel follow-up.",
          editedBodyDocument: document,
        });

        return yield* PrimitiveWorkflows.listCommitments({ user, limit: 10 });
      }),
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        title: "Confirm travel follow-up",
        body: "Send the travel follow-up.",
        bodyDocument: document,
      }),
    );
  });

  test("records an outcome against a commitment", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.createSynthesis({ user, frameKey: "current_state" });
        const [proposal] = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        if (!proposal) throw new Error("Expected proposal");

        yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "accepted",
        });
        const [commitment] = yield* PrimitiveWorkflows.listCommitments({ user, limit: 10 });
        if (!commitment) throw new Error("Expected commitment");

        const outcome = yield* PrimitiveWorkflows.recordOutcome({
          user,
          commitmentId: commitment.id,
          result: "completed",
          note: "Answered during planning.",
        });
        const commitments = yield* PrimitiveWorkflows.listCommitments({ user, limit: 10 });

        return { commitments, outcome };
      }),
    );

    expect(result.outcome.result).toBe("completed");
    expect(result.outcome.note).toBe("Answered during planning.");
    expect(result.commitments).toHaveLength(0);
  });

  test("recording an outcome is idempotent across retries", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.createSynthesis({ user, frameKey: "current_state" });
        const [proposal] = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        if (!proposal) throw new Error("Expected proposal");

        yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "accepted",
        });
        const [commitment] = yield* PrimitiveWorkflows.listCommitments({ user, limit: 10 });
        if (!commitment) throw new Error("Expected commitment");

        const firstOutcome = yield* PrimitiveWorkflows.recordOutcome({
          user,
          commitmentId: commitment.id,
          result: "completed",
          note: "Answered during planning.",
        });
        const retriedOutcome = yield* PrimitiveWorkflows.recordOutcome({
          user,
          commitmentId: commitment.id,
          result: "completed",
          note: "Answered during planning.",
        });

        return { firstOutcome, retriedOutcome };
      }),
    );

    expect(result.retriedOutcome.id).toBe(result.firstOutcome.id);
  });

  test("lists recent outcomes for closed-loop review", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* PrimitiveWorkflows.createSynthesis({ user, frameKey: "current_state" });
        const [proposal] = yield* PrimitiveWorkflows.generateProposals({
          user,
          frameKey: "current_state",
        });
        if (!proposal) throw new Error("Expected proposal");

        yield* PrimitiveWorkflows.reviewProposal({
          user,
          proposalId: proposal.id,
          decision: "accepted",
        });
        const [commitment] = yield* PrimitiveWorkflows.listCommitments({ user, limit: 10 });
        if (!commitment) throw new Error("Expected commitment");

        const outcome = yield* PrimitiveWorkflows.recordOutcome({
          user,
          commitmentId: commitment.id,
          result: "completed",
          note: "Answered during planning.",
        });

        return {
          outcome,
          outcomes: yield* PrimitiveWorkflows.listOutcomes({ user, limit: 10 }),
        };
      }),
    );

    expect(result.outcomes).toEqual([result.outcome]);
  });
});
