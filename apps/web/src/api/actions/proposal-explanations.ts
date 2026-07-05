import type { ProposalRecord, SynthesisRecord, UserDataExport } from "@nudge/db";

export interface ProposalExplanation {
  readonly source: {
    readonly label: string;
    readonly signalIds: string[];
    readonly type: "signals";
  };
  readonly reason: string;
  readonly confidence: number;
  readonly nextAction: string;
}

function sourceLabel(signalIds: ReadonlyArray<string>) {
  return `${signalIds.length} signal${signalIds.length === 1 ? "" : "s"}`;
}

export interface ProposalSourceInput {
  readonly signalIds: ReadonlyArray<string>;
}

export type ProposalSourceResult = ProposalExplanation["source"];

export function proposalSource(input: ProposalSourceInput): ProposalSourceResult {
  return {
    label: sourceLabel(input.signalIds),
    signalIds: [...input.signalIds],
    type: "signals",
  };
}

function nextActionForProposal(kind: ProposalRecord["kind"]) {
  switch (kind) {
    case "clarify":
      return "Answer or edit this clarification.";
    case "follow_up":
      return "Review this follow-up proposal.";
    case "commit":
      return "Accept, edit, or reject this commitment.";
    case "ignore":
      return "Confirm whether Nudge should ignore this.";
  }
}

function confidenceForProposal(proposal: ProposalRecord, synthesis: SynthesisRecord | undefined) {
  const sourceCount = synthesis?.sourceSignalIds.length ?? 0;
  if (proposal.kind === "follow_up" && sourceCount > 0) return 0.82;
  if (proposal.kind === "commit" && sourceCount > 0) return 0.78;
  if (sourceCount > 0) return 0.7;
  return 0.52;
}

export interface BuildProposalExplanationInput {
  readonly proposal: ProposalRecord;
  readonly synthesesById: ReadonlyMap<string, SynthesisRecord>;
}

export function buildProposalExplanation(
  input: BuildProposalExplanationInput,
): ProposalExplanation {
  const synthesis = input.synthesesById.get(input.proposal.synthesisId);
  const signalIds = synthesis ? [...synthesis.sourceSignalIds] : [];
  return {
    source: proposalSource({ signalIds }),
    reason: input.proposal.rationale,
    confidence: confidenceForProposal(input.proposal, synthesis),
    nextAction: nextActionForProposal(input.proposal.kind),
  };
}

export interface SynthesesByIdFromInput {
  readonly exported: Pick<UserDataExport, "syntheses">;
}

export type SynthesesByIdFromResult = Map<string, SynthesisRecord>;

export function synthesesByIdFrom(input: SynthesesByIdFromInput): SynthesesByIdFromResult {
  return new Map(input.exported.syntheses.map((synthesis) => [synthesis.id, synthesis]));
}

function toProposalResponse(proposal: ProposalRecord) {
  return proposal;
}

export type ProposalWithExplanation = ReturnType<typeof toProposalResponse> & {
  readonly explanation: ProposalExplanation;
};

export interface ToProposalWithExplanationInput {
  readonly proposal: ProposalRecord;
  readonly synthesesById: ReadonlyMap<string, SynthesisRecord>;
}

export function toProposalWithExplanation(
  input: ToProposalWithExplanationInput,
): ProposalWithExplanation {
  return {
    ...toProposalResponse(input.proposal),
    explanation: buildProposalExplanation(input),
  };
}
