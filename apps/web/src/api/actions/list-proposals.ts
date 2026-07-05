import { Effect } from "effect";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { readUserDataExport } from "../db/read-user-data-export";
import { type ApiAction, runWorkflow } from "./effect-helpers";
import {
  type ProposalWithExplanation,
  synthesesByIdFrom,
  toProposalWithExplanation,
} from "./proposal-explanations";

export interface ListProposalsInput {
  readonly context: ApiContext;
  readonly limit?: number;
}

export interface ListProposalsResult {
  readonly proposals: ProposalWithExplanation[];
}

export function listProposals(input: ListProposalsInput): ApiAction<ListProposalsResult> {
  return Effect.gen(function* () {
    const proposals = yield* runWorkflow({
      workflow: PrimitiveWorkflows.listPendingProposals({
        limit: input.limit ?? 20,
        user: input.context.user,
      }),
    });
    const exported = yield* readUserDataExport({
      db: input.context.db,
      user: input.context.user,
    });
    const synthesesById = synthesesByIdFrom({ exported });

    return {
      proposals: proposals.map((proposal) =>
        toProposalWithExplanation({ proposal, synthesesById }),
      ),
    };
  });
}
