import { Effect } from "effect";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { readUserDataExport } from "../db/read-user-data-export";
import { type ApiAction, recordApiSpan, runWorkflow } from "./effect-helpers";
import {
  buildProposalExplanation,
  type ProposalWithExplanation,
  synthesesByIdFrom,
  toProposalWithExplanation,
} from "./proposal-explanations";
import { recordAgentReceipt } from "./record-agent-receipt";

export interface GenerateProposalsInput {
  readonly context: ApiContext;
  readonly frameKey?: string;
}

export interface GenerateProposalsResult {
  readonly proposals: ProposalWithExplanation[];
}

export function generateProposals(
  input: GenerateProposalsInput,
): ApiAction<GenerateProposalsResult> {
  return Effect.gen(function* () {
    const proposals = yield* recordApiSpan({
      attributes: { "nudge.frame_key": input.frameKey },
      context: input.context,
      name: "proposals.generate",
      effect: runWorkflow({
        workflow: PrimitiveWorkflows.generateProposals({
          frameKey: input.frameKey ?? "current_state",
          user: input.context.user,
        }),
      }),
    });
    const exported = yield* readUserDataExport({
      db: input.context.db,
      user: input.context.user,
    });
    const synthesesById = synthesesByIdFrom({ exported });
    yield* Effect.all(
      proposals.map((proposal) => {
        const explanation = buildProposalExplanation({ proposal, synthesesById });
        return recordAgentReceipt({
          action: "proposal.generated",
          changed: {
            proposalId: proposal.id,
            status: proposal.status,
            title: proposal.title,
          },
          context: input.context,
          idempotencyKey: `proposal.generated:${proposal.id}`,
          signalIds: explanation.source.signalIds,
          why: explanation.reason,
        });
      }),
    );

    return {
      proposals: proposals.map((proposal) =>
        toProposalWithExplanation({ proposal, synthesesById }),
      ),
    };
  });
}
