import type { OutcomeRecord, OutcomeResult } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, runWorkflow } from "./effect-helpers";

export interface CreateOutcomeInput {
  readonly commitmentId: string;
  readonly context: ApiContext;
  readonly note?: string;
  readonly result: OutcomeResult;
}

export type CreateOutcomeResult = OutcomeRecord;

export function createOutcome(input: CreateOutcomeInput): ApiAction<CreateOutcomeResult> {
  return runWorkflow({
    workflow: PrimitiveWorkflows.recordOutcome({
      commitmentId: input.commitmentId,
      ...(input.note !== undefined ? { note: input.note } : {}),
      result: input.result,
      user: input.context.user,
    }),
  });
}
