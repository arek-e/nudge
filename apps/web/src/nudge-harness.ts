export type NudgeHarnessCapabilityKind = "read" | "draft" | "reviewGated" | "workflow" | "subagent";

export type NudgeHarnessCapabilityStatus = "active" | "planned";

export interface NudgeHarnessCapability {
  readonly id: string;
  readonly kind: NudgeHarnessCapabilityKind;
  readonly label: string;
  readonly status: NudgeHarnessCapabilityStatus;
}

export interface NudgeHarnessCapabilityGroups {
  readonly read: ReadonlyArray<NudgeHarnessCapability>;
  readonly draft: ReadonlyArray<NudgeHarnessCapability>;
  readonly reviewGated: ReadonlyArray<NudgeHarnessCapability>;
  readonly workflow: ReadonlyArray<NudgeHarnessCapability>;
  readonly subagent: ReadonlyArray<NudgeHarnessCapability>;
}

export interface NudgeHarnessRegistry {
  readonly identity: {
    readonly agentName: "Nudge Agent";
    readonly durableFrontDoor: "UserAgentSession";
  };
  readonly capabilities: NudgeHarnessCapabilityGroups;
}

export type NudgeHarnessIntent = "loopIntake";

export interface NudgeHarnessTurnInput {
  readonly intent: NudgeHarnessIntent;
  readonly memoryRetrievalAvailable: boolean;
}

export interface NudgeHarnessTurn {
  readonly activeCapabilities: NudgeHarnessCapabilityGroups;
  readonly activeCapabilityIds: ReadonlyArray<string>;
  readonly intent: NudgeHarnessIntent;
}

const capability = (
  kind: NudgeHarnessCapabilityKind,
  id: string,
  label: string,
  status: NudgeHarnessCapabilityStatus,
): NudgeHarnessCapability => ({ id, kind, label, status });

export const nudgeHarnessRegistry: NudgeHarnessRegistry = {
  identity: {
    agentName: "Nudge Agent",
    durableFrontDoor: "UserAgentSession",
  },
  capabilities: {
    read: [
      capability("read", "listRecentSignals", "List recent Signals", "active"),
      capability("read", "retrieveMemory", "Retrieve Relationship and workspace memory", "active"),
      capability("read", "searchOkf", "Search the OKF workspace projection", "active"),
      capability("read", "readOkf", "Read files from the OKF workspace projection", "active"),
    ],
    draft: [
      capability("draft", "draftLoopIntake", "Draft loop intake from a Capture", "active"),
      capability("draft", "createSynthesis", "Create a source-linked Synthesis", "active"),
      capability("draft", "generateProposals", "Generate reviewable Proposals", "active"),
    ],
    reviewGated: [
      capability("reviewGated", "acceptProposal", "Accept a Proposal", "active"),
      capability("reviewGated", "editProposal", "Edit a Proposal", "active"),
      capability("reviewGated", "rejectProposal", "Reject a Proposal", "active"),
      capability("reviewGated", "createCommitment", "Create a Commitment after Review", "active"),
      capability("reviewGated", "sendExternalAction", "Send an external action", "planned"),
    ],
    workflow: [
      capability("workflow", "dailyNoteAnalysis", "Analyze daily note revisions", "active"),
      capability("workflow", "dailyDigest", "Generate a Daily Operating Loop Digest", "active"),
      capability("workflow", "memoryIndexing", "Index memory for retrieval", "active"),
      capability("workflow", "longRunningJob", "Run durable long-running jobs", "planned"),
    ],
    subagent: [
      capability("subagent", "loopIntakeThink", "Interpret loop intake and reply", "active"),
      capability("subagent", "journalAnalyst", "Analyze journal changes", "active"),
      capability("subagent", "relationshipPrep", "Prepare relationship context", "planned"),
      capability("subagent", "memoryCurator", "Curate memory and summaries", "planned"),
      capability("subagent", "reviewPlanner", "Plan Review Queue decisions", "planned"),
    ],
  },
};

const emptyCapabilities = (): NudgeHarnessCapabilityGroups => ({
  read: [],
  draft: [],
  reviewGated: [],
  workflow: [],
  subagent: [],
});

const selectCapability = (kind: NudgeHarnessCapabilityKind, id: string): NudgeHarnessCapability => {
  const selected = nudgeHarnessRegistry.capabilities[kind].find(
    (capabilityItem) => capabilityItem.id === id,
  );
  if (!selected) throw new Error(`Unknown Nudge harness capability: ${kind}.${id}`);
  return selected;
};

const flattenCapabilities = (groups: NudgeHarnessCapabilityGroups) => [
  ...groups.read,
  ...groups.draft,
  ...groups.reviewGated,
  ...groups.workflow,
  ...groups.subagent,
];

export const assembleNudgeHarnessTurn = (input: NudgeHarnessTurnInput): NudgeHarnessTurn => {
  const activeCapabilities =
    input.intent === "loopIntake"
      ? {
          read: input.memoryRetrievalAvailable ? [selectCapability("read", "retrieveMemory")] : [],
          draft: [selectCapability("draft", "draftLoopIntake")],
          reviewGated: [],
          workflow: [],
          subagent: [selectCapability("subagent", "loopIntakeThink")],
        }
      : emptyCapabilities();

  return {
    activeCapabilities,
    activeCapabilityIds: flattenCapabilities(activeCapabilities).map(
      (capabilityItem) => capabilityItem.id,
    ),
    intent: input.intent,
  };
};
