import { Effect } from "effect";
import type { OutcomeRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, runWorkflow } from "./effect-helpers";

export interface ListOutcomesInput {
  readonly context: ApiContext;
  readonly limit?: number;
}

export interface ListOutcomesResult {
  readonly outcomes: OutcomeRecord[];
}

export function listOutcomes(input: ListOutcomesInput): ApiAction<ListOutcomesResult> {
  return runWorkflow({
    workflow: PrimitiveWorkflows.listOutcomes({
      limit: input.limit ?? 20,
      user: input.context.user,
    }),
  }).pipe(Effect.map((outcomes) => ({ outcomes: [...outcomes] })));
}
