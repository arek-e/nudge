import { describe, expect, test } from "bun:test";
import { buildDeterministicProposals, buildDeterministicSynthesis } from ".";

describe("deterministic proposal generation", () => {
  test("turns captured follow-up signal text into a concrete proposal", () => {
    const synthesis = buildDeterministicSynthesis({
      frameId: "frame-current",
      userId: "user-1",
      signals: [
        {
          id: "signal-1",
          type: "manual_check_in_submitted",
          payload: { note: "Follow up with Maya about the travel plan before lunch." },
        },
      ],
    });

    const [proposal] = buildDeterministicProposals({
      openQuestions: synthesis.openQuestions,
      synthesisId: "synthesis-1",
      themes: synthesis.themes,
      userId: "user-1",
    });

    expect(proposal).toMatchObject({
      kind: "follow_up",
      title: "Follow up on travel plan",
    });
    expect(proposal?.body).toContain("Maya");
  });
});
