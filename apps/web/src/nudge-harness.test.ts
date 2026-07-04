import { describe, expect, test } from "bun:test";
import { assembleNudgeHarnessTurn, nudgeHarnessRegistry } from "./nudge-harness";

const ids = (capabilities: ReadonlyArray<{ readonly id: string }>) =>
  capabilities.map((capability) => capability.id);

describe("NudgeHarness", () => {
  test("describes one user-facing Nudge Agent with modular capability categories", () => {
    expect(nudgeHarnessRegistry.identity).toEqual({
      agentName: "Nudge Agent",
      durableFrontDoor: "UserAgentSession",
    });
    expect(ids(nudgeHarnessRegistry.capabilities.read)).toEqual([
      "listRecentSignals",
      "retrieveMemory",
      "searchOkf",
      "readOkf",
    ]);
    expect(ids(nudgeHarnessRegistry.capabilities.draft)).toEqual([
      "draftLoopIntake",
      "createSynthesis",
      "generateProposals",
    ]);
    expect(ids(nudgeHarnessRegistry.capabilities.reviewGated)).toEqual([
      "acceptProposal",
      "editProposal",
      "rejectProposal",
      "createCommitment",
      "sendExternalAction",
    ]);
    expect(ids(nudgeHarnessRegistry.capabilities.workflow)).toEqual([
      "dailyNoteAnalysis",
      "dailyDigest",
      "memoryIndexing",
      "longRunningJob",
    ]);
    expect(ids(nudgeHarnessRegistry.capabilities.subagent)).toEqual([
      "loopIntakeThink",
      "journalAnalyst",
      "relationshipPrep",
      "memoryCurator",
      "reviewPlanner",
    ]);
  });

  test("assembles a focused loop-intake turn without enabling every capability", () => {
    const turn = assembleNudgeHarnessTurn({
      intent: "loopIntake",
      memoryRetrievalAvailable: true,
    });

    expect(ids(turn.activeCapabilities.read)).toEqual(["retrieveMemory"]);
    expect(ids(turn.activeCapabilities.draft)).toEqual(["draftLoopIntake"]);
    expect(ids(turn.activeCapabilities.reviewGated)).toEqual([]);
    expect(ids(turn.activeCapabilities.workflow)).toEqual([]);
    expect(ids(turn.activeCapabilities.subagent)).toEqual(["loopIntakeThink"]);
    expect(turn.activeCapabilityIds).toEqual([
      "retrieveMemory",
      "draftLoopIntake",
      "loopIntakeThink",
    ]);
  });
});
