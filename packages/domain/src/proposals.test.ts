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
      title: "Follow up with Maya on the travel plan before lunch",
    });
    expect(proposal?.body).toContain("Maya");
    expect(proposal?.body).toContain("the travel plan");
    expect(proposal?.body).toContain("before lunch");
    expect(proposal?.rationale).toContain("Grounded in captured user note");
  });

  test("turns low-energy uncertainty into a grounded clarify proposal", () => {
    const synthesis = buildDeterministicSynthesis({
      frameId: "frame-current",
      userId: "user-1",
      signals: [
        {
          id: "signal-1",
          type: "manual_check_in_submitted",
          payload: {
            note: "Energy is low and I need to think before committing to anything new.",
          },
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
      body: "Energy is low, and you are not ready to commit to anything new yet. What context do you need to think through before taking on anything new?",
      kind: "clarify",
      rationale:
        "Grounded in captured user note: energy is low and the user needs to think before committing to anything new.",
      title: "Clarify next attention point",
    });
  });
});
