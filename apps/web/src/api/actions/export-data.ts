import type { z } from "zod";
import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { dataExportResponseSchema } from "../../api-contract";
import { readUserDataExport } from "../db/read-user-data-export";

export interface ExportDataInput {
  readonly context: ApiContext;
}

export type ExportDataResult = z.infer<typeof dataExportResponseSchema>;

export function exportData(input: ExportDataInput): ApiAction<ExportDataResult> {
  return readUserDataExport({
    db: input.context.db,
    user: input.context.user,
  }).pipe(
    Effect.map((exported) => ({
      agentRunOutputs: [...exported.agentRunOutputs],
      agentRuns: [...exported.agentRuns],
      user: exported.user,
      commitments: [...exported.commitments],
      dailyNotes: [...exported.dailyNotes],
      events: [...exported.events],
      extractedItems: [...exported.extractedItems],
      frames: [...exported.frames],
      itemEvents: [...exported.itemEvents],
      journalDocuments: [...exported.journalDocuments],
      journalRevisions: [...exported.journalRevisions],
      memoryChunks: [...exported.memoryChunks],
      memoryDocuments: [...exported.memoryDocuments],
      memoryIndexJobs: [...exported.memoryIndexJobs],
      memoryRetrievalEvents: exported.memoryRetrievalEvents.map((retrievalEvent) => ({
        ...retrievalEvent,
        resultChunkIds: [...retrievalEvent.resultChunkIds],
      })),
      noteRevisions: [...exported.noteRevisions],
      outcomes: [...exported.outcomes],
      proposals: [...exported.proposals],
      reviews: [...exported.reviews],
      summaryDocuments: exported.summaryDocuments.map((summary) => ({
        ...summary,
        sourceItemIds: [...summary.sourceItemIds],
        sourceNoteIds: [...summary.sourceNoteIds],
      })),
      syntheses: exported.syntheses.map((synthesis) => ({
        ...synthesis,
        openQuestions: [...synthesis.openQuestions],
        sourceSignalIds: [...synthesis.sourceSignalIds],
        themes: [...synthesis.themes],
      })),
    })),
  );
}
