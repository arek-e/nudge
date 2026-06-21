import { describe, expect, test } from "bun:test";
import { deriveTodayNextAction } from ".";

describe("deriveTodayNextAction", () => {
  test("chooses the next user-visible loop action from primitive state", () => {
    expect(
      deriveTodayNextAction({
        activeCommitmentCount: 0,
        hasSynthesis: false,
        pendingProposalCount: 0,
        signalCount: 0,
      }),
    ).toMatchObject({ label: "Capture current state", stage: "Capture" });

    expect(
      deriveTodayNextAction({
        activeCommitmentCount: 0,
        hasSynthesis: false,
        pendingProposalCount: 0,
        signalCount: 1,
      }),
    ).toMatchObject({ label: "Synthesize signals", stage: "Synthesis" });

    expect(
      deriveTodayNextAction({
        activeCommitmentCount: 1,
        hasSynthesis: true,
        pendingProposalCount: 1,
        signalCount: 3,
      }),
    ).toMatchObject({ label: "Review proposal", stage: "Review" });

    expect(
      deriveTodayNextAction({
        activeCommitmentCount: 1,
        hasSynthesis: true,
        pendingProposalCount: 0,
        signalCount: 3,
      }),
    ).toMatchObject({ label: "Close commitment", stage: "Outcome" });
  });
});
