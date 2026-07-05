import { Effect } from "effect";
import type { EventRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, runWorkflow } from "./effect-helpers";

export interface ListEventsInput {
  readonly context: ApiContext;
  readonly from?: string;
  readonly limit?: number;
  readonly to?: string;
}

export interface ListEventsResult {
  readonly events: EventRecord[];
}

export function listEvents(input: ListEventsInput): ApiAction<ListEventsResult> {
  return runWorkflow({
    workflow: PrimitiveWorkflows.listSignals({
      limit: input.limit ?? 50,
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {}),
      user: input.context.user,
    }),
  }).pipe(Effect.map((events) => ({ events: [...events] })));
}
