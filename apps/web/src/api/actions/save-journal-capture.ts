import { Effect } from "effect";
import type { AgentRunRecord, JournalDocumentRecord, JournalRevisionRecord } from "@nudge/db";
import {
  type DailyNoteAnalysisScheduleInput,
  type DailyNoteMemoryIndexInput,
  MemoryIndex,
  NoteAnalysisWorkflows,
} from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { apiEffectResult, type ApiAction, runApiEffect, runMemoryIndex } from "./effect-helpers";
import { errorFromUnknown } from "./error-helpers";

export interface SaveJournalCaptureInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly context: ApiContext;
  readonly localDate: string;
  readonly title: string;
}

export interface SaveJournalCaptureResult {
  readonly analysisRun?: AgentRunRecord;
  readonly document: JournalDocumentRecord;
  readonly revision: JournalRevisionRecord;
}

function dailyNoteAnalysisScheduler(
  context: ApiContext,
): (input: DailyNoteAnalysisScheduleInput) => Effect.Effect<void, Error> {
  return (input) =>
    Effect.tryPromise({
      try: async () => {
        await context.recordSpan(
          "daily_note.analysis_workflow.create",
          {
            attributes: {
              "nudge.ai.source_type": "note_revision",
              "nudge.ai.system": "cloudflare-think",
              "workflow.name": "daily-note-analysis",
            },
            kind: "client",
          },
          async () => {
            await context.dailyAnalysisWorkflow.create({
              id: `daily-note-analysis-${input.params.revisionId}`,
              params: input.params,
            });
          },
        );
      },
      catch: (error) =>
        errorFromUnknown({ error, fallbackMessage: "Daily note analysis scheduling failed" }),
    });
}

function dailyNoteMemoryIndexer(
  context: ApiContext,
): ((input: DailyNoteMemoryIndexInput) => Effect.Effect<void, Error>) | undefined {
  const turbopuffer = context.turbopuffer;
  if (!turbopuffer) return undefined;

  return (input) =>
    Effect.tryPromise({
      try: async () => {
        await context.recordSpan(
          "memory.index_pending",
          {
            attributes: {
              "nudge.memory_index.provider": "turbopuffer",
              "turbopuffer.region": turbopuffer.region,
            },
            kind: "client",
          },
          async () => {
            await context.runEffect(
              runMemoryIndex({
                turbopuffer,
                workflow: Effect.gen(function* () {
                  const memoryIndex = yield* MemoryIndex;
                  return yield* memoryIndex.indexPending({
                    limit: input.limit,
                    user: input.user,
                  });
                }),
              }).pipe(
                Effect.catch((error) =>
                  Effect.sync(() => {
                    const safeError = errorFromUnknown({
                      error,
                      fallbackMessage: "Memory index failed",
                    });
                    console.warn(
                      JSON.stringify({
                        event: "memory_index_failed",
                        logKind: "wide_event",
                        provider: "turbopuffer",
                        region: turbopuffer.region,
                        errorType: safeError.name,
                      }),
                    );
                  }),
                ),
              ),
            );
          },
        );
      },
      catch: (error) =>
        errorFromUnknown({ error, fallbackMessage: "Daily note memory indexing failed" }),
    });
}

export function saveJournalCapture(
  input: SaveJournalCaptureInput,
): ApiAction<SaveJournalCaptureResult, Error> {
  const indexPendingMemory = dailyNoteMemoryIndexer(input.context);
  return runApiEffect({
    context: input.context,
    effect: Effect.gen(function* () {
      const saveResult = yield* NoteAnalysisWorkflows.saveJournalCapture({
        aiModel: input.context.aiModel,
        bodyText: input.bodyText,
        ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
        ...(indexPendingMemory ? { indexPendingMemory } : {}),
        localDate: input.localDate,
        ...(input.context.traceHeaders?.["x-request-id"] !== undefined
          ? { requestId: input.context.traceHeaders["x-request-id"] }
          : {}),
        scheduleAnalysis: dailyNoteAnalysisScheduler(input.context),
        title: input.title,
        ...(input.context.traceHeaders?.traceparent !== undefined
          ? { traceparent: input.context.traceHeaders.traceparent }
          : {}),
        user: input.context.user,
      });

      return apiEffectResult({
        result: {
          document: saveResult.document,
          revision: saveResult.revision,
          ...(saveResult.analysisRun ? { analysisRun: saveResult.analysisRun } : {}),
        },
        ...(saveResult.wideEvent ? { wideEvent: saveResult.wideEvent } : {}),
      });
    }),
  });
}
