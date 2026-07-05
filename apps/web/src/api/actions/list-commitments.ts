import { Effect } from "effect";
import type { CommitmentRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, runWorkflow } from "./effect-helpers";

export interface ListCommitmentsInput {
  readonly context: ApiContext;
  readonly limit?: number;
}

export interface ListCommitmentsResult {
  readonly commitments: CommitmentRecord[];
}

export function listCommitments(input: ListCommitmentsInput): ApiAction<ListCommitmentsResult> {
  return runWorkflow({
    workflow: PrimitiveWorkflows.listCommitments({
      limit: input.limit ?? 20,
      user: input.context.user,
    }),
  }).pipe(Effect.map((commitments) => ({ commitments: [...commitments] })));
}
