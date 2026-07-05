import { Effect } from "effect";
import type {
  AgentRunRecord,
  DbService,
  ExtractedItemRecord,
  ExtractedItemStatus,
} from "@nudge/db";

export interface ReadActionsListDataInput {
  readonly db: DbService;
  readonly limit: number;
  readonly status?: ExtractedItemStatus;
  readonly userId: string;
}

export interface ReadActionsListDataResult {
  readonly actions: readonly ExtractedItemRecord[];
  readonly latestRuns: readonly AgentRunRecord[];
}

export function readActionsListData(
  input: ReadActionsListDataInput,
): Effect.Effect<ReadActionsListDataResult> {
  return Effect.all([
    input.db.listExtractedItems({
      limit: input.limit,
      userId: input.userId,
      ...(input.status !== undefined ? { status: input.status } : {}),
    }),
    input.db.listAgentRuns({
      limit: 1,
      sourceType: "note_revision",
      userId: input.userId,
    }),
  ]).pipe(Effect.map(([actions, latestRuns]) => ({ actions, latestRuns })));
}
