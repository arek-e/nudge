import { Effect } from "effect";
import type { AgentRunRecord, ExtractedItemRecord, ExtractedItemStatus } from "@nudge/db";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readActionsListData } from "../db/read-actions-list-data";

export interface ListActionsInput {
  readonly context: ApiContext;
  readonly limit: number;
  readonly status?: ExtractedItemStatus;
}

export interface ListActionsResult {
  readonly actions: ExtractedItemRecord[];
  readonly latestRun?: AgentRunRecord;
}

export function listActions(input: ListActionsInput): ApiAction<ListActionsResult> {
  return readActionsListData({
    db: input.context.db,
    limit: input.limit,
    ...(input.status !== undefined ? { status: input.status } : {}),
    userId: input.context.user.id,
  }).pipe(
    Effect.map(({ actions, latestRuns }) => ({
      actions: [...actions],
      ...(latestRuns[0] ? { latestRun: latestRuns[0] } : {}),
    })),
  );
}
