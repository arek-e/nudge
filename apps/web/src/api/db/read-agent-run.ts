import { Effect } from "effect";
import type { AgentRunRecord, DbService } from "@nudge/db";

export interface ReadAgentRunInput {
  readonly db: DbService;
  readonly runId: string;
  readonly userId: string;
}

export type ReadAgentRunResult = AgentRunRecord | null;

export function readAgentRun(input: ReadAgentRunInput): Effect.Effect<ReadAgentRunResult> {
  return input.db.getAgentRun({ runId: input.runId, userId: input.userId });
}
