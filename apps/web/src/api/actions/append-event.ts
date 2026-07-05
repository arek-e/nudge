import type { EventRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, runWorkflow } from "./effect-helpers";

export interface AppendEventInput {
  readonly context: ApiContext;
  readonly idempotencyKey?: string;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly schemaVersion: number;
  readonly source: string;
  readonly type: string;
}

export type AppendEventResult = EventRecord;

export function appendEvent(input: AppendEventInput): ApiAction<AppendEventResult> {
  return runWorkflow({
    workflow: PrimitiveWorkflows.appendSignal({
      occurredAt: input.occurredAt,
      payload: input.payload,
      schemaVersion: input.schemaVersion,
      source: input.source,
      type: input.type,
      user: input.context.user,
      ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    }),
  });
}
