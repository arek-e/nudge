import { Effect } from "effect";
import type { DbService, SummaryDocumentRecord, SummaryPeriodType } from "@nudge/db";

export interface ReadSummaryDocumentsInput {
  readonly db: DbService;
  readonly limit: number;
  readonly periodType?: SummaryPeriodType;
  readonly userId: string;
}

export type ReadSummaryDocumentsResult = readonly SummaryDocumentRecord[];

export function readSummaryDocuments(
  input: ReadSummaryDocumentsInput,
): Effect.Effect<ReadSummaryDocumentsResult> {
  return input.db.listSummaryDocuments({
    limit: input.limit,
    userId: input.userId,
    ...(input.periodType !== undefined ? { periodType: input.periodType } : {}),
  });
}
