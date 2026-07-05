import type { EventRecord } from "@nudge/db";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { writeAgentReceipt } from "../db/write-agent-receipt";

export interface RecordAgentReceiptInput {
  readonly action: string;
  readonly changed: Readonly<Record<string, unknown>>;
  readonly context: ApiContext;
  readonly idempotencyKey: string;
  readonly signalIds: ReadonlyArray<string>;
  readonly why: string;
}

export type RecordAgentReceiptResult = EventRecord;

export function recordAgentReceipt(
  input: RecordAgentReceiptInput,
): ApiAction<RecordAgentReceiptResult> {
  return writeAgentReceipt({
    action: input.action,
    changed: input.changed,
    db: input.context.db,
    idempotencyKey: input.idempotencyKey,
    signalIds: input.signalIds,
    userId: input.context.user.id,
    why: input.why,
  });
}
