import { Effect } from "effect";
import type { SummaryDocumentRecord, SummaryPeriodType } from "@nudge/db";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readSummaryDocuments } from "../db/read-summary-documents";

export interface ListSummariesInput {
  readonly context: ApiContext;
  readonly limit: number;
  readonly periodType?: SummaryPeriodType;
}

export interface ListSummariesResult {
  readonly summaries: Array<
    Omit<SummaryDocumentRecord, "sourceItemIds" | "sourceNoteIds"> & {
      readonly sourceItemIds: string[];
      readonly sourceNoteIds: string[];
    }
  >;
}

export function listSummaries(input: ListSummariesInput): ApiAction<ListSummariesResult> {
  return readSummaryDocuments({
    db: input.context.db,
    limit: input.limit,
    ...(input.periodType !== undefined ? { periodType: input.periodType } : {}),
    userId: input.context.user.id,
  }).pipe(
    Effect.map((summaries) => ({
      summaries: summaries.map((summary) => ({
        ...summary,
        sourceItemIds: [...summary.sourceItemIds],
        sourceNoteIds: [...summary.sourceNoteIds],
      })),
    })),
  );
}
