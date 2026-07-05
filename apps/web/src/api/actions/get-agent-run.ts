import { Effect } from "effect";
import type { AgentRunRecord } from "@nudge/db";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readAgentRun } from "../db/read-agent-run";

export interface GetAgentRunInput {
  readonly context: ApiContext;
  readonly runId: string;
}

export interface GetAgentRunResult {
  readonly run: AgentRunRecord | null;
}

export function getAgentRun(input: GetAgentRunInput): ApiAction<GetAgentRunResult> {
  return readAgentRun({
    db: input.context.db,
    runId: input.runId,
    userId: input.context.user.id,
  }).pipe(Effect.map((run) => ({ run })));
}
