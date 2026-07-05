import { Effect } from "effect";
import type { DbService, EventRecord } from "@nudge/db";
import { agentReceiptSource, agentReceiptType } from "../actions/agent-receipts";

export interface WriteAgentReceiptInput {
  readonly action: string;
  readonly changed: Readonly<Record<string, unknown>>;
  readonly db: DbService;
  readonly idempotencyKey: string;
  readonly signalIds: ReadonlyArray<string>;
  readonly userId: string;
  readonly why: string;
}

export type WriteAgentReceiptResult = EventRecord;

export function writeAgentReceipt(
  input: WriteAgentReceiptInput,
): Effect.Effect<WriteAgentReceiptResult> {
  return input.db.appendEvent({
    idempotencyKey: `agent-receipt:${input.idempotencyKey}`,
    occurredAt: new Date().toISOString(),
    payload: {
      action: input.action,
      changed: input.changed,
      signalIds: [...input.signalIds],
      why: input.why,
    },
    schemaVersion: 1,
    source: agentReceiptSource,
    type: agentReceiptType,
    userId: input.userId,
  });
}
