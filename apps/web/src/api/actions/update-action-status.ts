import { Effect } from "effect";
import type { ExtractedItemRecord, ExtractedItemStatus } from "@nudge/db";
import { NoteAnalysisWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";

export interface UpdateActionStatusInput {
  readonly context: ApiContext;
  readonly itemId: string;
  readonly status: ExtractedItemStatus;
}

export interface UpdateActionStatusResult {
  readonly action: ExtractedItemRecord;
}

export function updateActionStatus(
  input: UpdateActionStatusInput,
): ApiAction<UpdateActionStatusResult> {
  return NoteAnalysisWorkflows.reviewExtractedItemStatus({
    itemId: input.itemId,
    status: input.status,
    userId: input.context.user.id,
  }).pipe(Effect.map((reviewed) => ({ action: reviewed.action })));
}
