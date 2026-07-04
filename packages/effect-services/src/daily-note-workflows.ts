import { Effect } from "effect";
import {
  Db,
  type AgentRunOutputRecord,
  type AgentRunRecord,
  type DbUser,
  type ExtractedItemKind,
  type ExtractedItemRecord,
  type ExtractedItemStatus,
  type ItemEventRecord,
  type ItemEventType,
  type JournalDocumentRecord,
  type JournalRevisionRecord,
  type SummaryDocumentRecord,
  type UpsertDailyNoteResult,
} from "@nudge/db";
import { currentWorkflowVersion, type WorkflowVersion } from "./workflow-config";

export interface DailyNoteAnalysisWorkflowParams {
  readonly changedText: string;
  readonly documentId: string;
  readonly kind: "daily-note-analysis";
  readonly localDate: string;
  readonly noteId: string;
  readonly requestId?: string;
  readonly revisionId: string;
  readonly runId: string;
  readonly title: string;
  readonly traceparent?: string;
  readonly userDisplayName: string;
  readonly userId: string;
  readonly workflowVersion?: WorkflowVersion;
}

export interface DailyNoteAnalysisScheduleInput {
  readonly params: DailyNoteAnalysisWorkflowParams;
  readonly run: AgentRunRecord;
}

export interface DailyNoteMemoryIndexInput {
  readonly limit: number;
  readonly user: DbUser;
}

export interface SaveJournalCaptureInput {
  readonly aiModel: string;
  readonly analysisProvider?: string;
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly indexPendingMemory?: (input: DailyNoteMemoryIndexInput) => Effect.Effect<void, Error>;
  readonly localDate: string;
  readonly memoryIndexLimit?: number;
  readonly requestId?: string;
  readonly scheduleAnalysis?: (input: DailyNoteAnalysisScheduleInput) => Effect.Effect<void, Error>;
  readonly title: string;
  readonly traceparent?: string;
  readonly user: DbUser;
}

export interface SaveJournalCaptureResult {
  readonly dailyNote: UpsertDailyNoteResult;
  readonly document: JournalDocumentRecord;
  readonly revision: JournalRevisionRecord;
  readonly analysisParams?: DailyNoteAnalysisWorkflowParams;
  readonly analysisRun?: AgentRunRecord;
  readonly wideEvent?: Record<string, unknown>;
}

export interface DailyNoteAnalysisExtractedItemInput {
  readonly body: string;
  readonly confidence?: number;
  readonly dueAt?: string;
  readonly eventEndsAt?: string;
  readonly eventStartsAt?: string;
  readonly kind: ExtractedItemKind;
  readonly remindAt?: string;
  readonly title: string;
}

export interface DailyNoteAnalysisExtractionInput {
  readonly dailySummary?: string;
  readonly items: ReadonlyArray<DailyNoteAnalysisExtractedItemInput>;
  readonly model: string;
  readonly provider: string;
}

export interface PersistDailyNoteAnalysisResultsInput {
  readonly changedText: string;
  readonly extraction: DailyNoteAnalysisExtractionInput;
  readonly localDate: string;
  readonly noteId: string;
  readonly revisionId: string;
  readonly runId: string;
  readonly userId: string;
}

export interface PersistDailyNoteAnalysisResultsResult {
  readonly dailySummary: SummaryDocumentRecord;
  readonly extractedItems: ReadonlyArray<ExtractedItemRecord>;
  readonly itemCount: number;
  readonly weeklySummary: SummaryDocumentRecord;
}

export interface ReviewExtractedItemStatusInput {
  readonly itemId: string;
  readonly status: ExtractedItemStatus;
  readonly userId: string;
}

export interface ReviewExtractedItemStatusResult {
  readonly action: ExtractedItemRecord;
  readonly event: ItemEventRecord;
}

type FollowThroughReceipt =
  | {
      readonly eventEndsAt?: string;
      readonly eventStartsAt?: string;
      readonly status: "needs_adapter";
      readonly type: "calendar_event";
    }
  | {
      readonly remindAt?: string;
      readonly status: "needs_adapter";
      readonly type: "reminder";
    }
  | {
      readonly status: "tracked";
      readonly type: "task";
    }
  | {
      readonly status: "saved";
      readonly type: "memory_document";
    };

const agentRunOutput = (output: Pick<AgentRunOutputRecord, "outputId" | "outputType">) => output;

const normalizeDedupe = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 96);

const weekRangeFor = (localDate: string) => {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { end: end.toISOString().slice(0, 10), start: start.toISOString().slice(0, 10) };
};

const dailySummaryFrom = (input: {
  readonly items: ReadonlyArray<{ readonly kind: string; readonly title: string }>;
  readonly noteText: string;
}) => {
  const actionText = input.items.length
    ? input.items.map((item) => `${item.kind}: ${item.title}`).join("; ")
    : "No extracted actions.";
  return [`Actions: ${actionText}`, `Context: ${input.noteText.slice(0, 500)}`].join("\n");
};

function dailyNoteAnalysisParams(input: {
  readonly changedText: string;
  readonly dailyNote: UpsertDailyNoteResult;
  readonly document: JournalDocumentRecord;
  readonly localDate: string;
  readonly requestId?: string;
  readonly run: AgentRunRecord;
  readonly title: string;
  readonly traceparent?: string;
  readonly user: DbUser;
}): DailyNoteAnalysisWorkflowParams {
  return {
    changedText: input.changedText,
    documentId: input.document.id,
    kind: "daily-note-analysis",
    localDate: input.localDate,
    noteId: input.dailyNote.note.id,
    ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
    revisionId: input.dailyNote.revision.id,
    runId: input.run.id,
    title: input.title,
    ...(input.traceparent !== undefined ? { traceparent: input.traceparent } : {}),
    userDisplayName: input.user.displayName,
    userId: input.user.id,
    workflowVersion: currentWorkflowVersion,
  };
}

function analysisWideEvent(input: {
  readonly aiModel: string;
  readonly analysisProvider: string;
  readonly localDate: string;
  readonly run: AgentRunRecord;
}) {
  return {
    aiErrorCode: null,
    aiModel: input.aiModel,
    aiRunId: input.run.id,
    aiSourceType: "note_revision",
    aiSystem: input.analysisProvider,
    noteLocalDate: input.localDate,
  };
}

function itemEventTypeForStatus(status: ExtractedItemStatus): ItemEventType {
  switch (status) {
    case "accepted":
      return "accepted";
    case "archived":
      return "archived";
    case "completed":
      return "completed";
    case "dismissed":
      return "dismissed";
    case "proposed":
      return "edited";
  }
}

function followThroughFor(
  action: ExtractedItemRecord,
  status: ExtractedItemStatus,
): FollowThroughReceipt | null {
  if (status !== "accepted" && status !== "completed") return null;
  if (action.kind === "event") {
    return {
      ...(action.eventEndsAt !== undefined ? { eventEndsAt: action.eventEndsAt } : {}),
      ...(action.eventStartsAt !== undefined ? { eventStartsAt: action.eventStartsAt } : {}),
      status: "needs_adapter",
      type: "calendar_event",
    };
  }
  if (action.kind === "reminder") {
    return {
      ...(action.remindAt !== undefined ? { remindAt: action.remindAt } : {}),
      status: "needs_adapter",
      type: "reminder",
    };
  }
  if (action.kind === "task" || action.kind === "follow_up") {
    return {
      status: "tracked",
      type: "task",
    };
  }
  if (action.kind === "memory") {
    return {
      status: "saved",
      type: "memory_document",
    };
  }
  return null;
}

export const NoteAnalysisWorkflows = {
  markAnalysisRunFailed: (input: {
    readonly errorCode: string;
    readonly runId: string;
    readonly userId: string;
  }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      return yield* db.completeAgentRun({
        errorCode: input.errorCode,
        runId: input.runId,
        status: "failed",
        userId: input.userId,
      });
    }),

  markAnalysisRunRunning: (input: { readonly runId: string; readonly userId: string }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      return yield* db.markAgentRunRunning({
        runId: input.runId,
        userId: input.userId,
      });
    }),

  persistAnalysisResults: (input: PersistDailyNoteAnalysisResultsInput) =>
    Effect.gen(function* () {
      const db = yield* Db;
      const extractedItems: Array<ExtractedItemRecord> = [];
      for (const extracted of input.extraction.items) {
        const item = yield* db.upsertExtractedItem({
          body: extracted.body,
          confidence: extracted.confidence ?? 0.74,
          dedupeKey: `${extracted.kind}:${normalizeDedupe(`${extracted.title}:${extracted.body}`)}`,
          ...(extracted.dueAt !== undefined ? { dueAt: extracted.dueAt } : {}),
          ...(extracted.eventEndsAt !== undefined ? { eventEndsAt: extracted.eventEndsAt } : {}),
          ...(extracted.eventStartsAt !== undefined
            ? { eventStartsAt: extracted.eventStartsAt }
            : {}),
          kind: extracted.kind,
          metadata: { extractor: input.extraction.provider },
          ...(extracted.remindAt !== undefined ? { remindAt: extracted.remindAt } : {}),
          sourceNoteId: input.noteId,
          sourceRevisionId: input.revisionId,
          status: "proposed",
          title: extracted.title,
          userId: input.userId,
        });
        yield* db.recordItemEvent({
          eventType: "created",
          itemId: item.id,
          payload: { sourceRevisionId: input.revisionId },
          userId: input.userId,
        });
        yield* db.upsertMemoryDocument({
          bodyText: `${item.title}\n${item.body}`,
          localDate: input.localDate,
          sourceId: item.id,
          sourceType: "extracted_item",
          title: item.title,
          userId: input.userId,
        });
        extractedItems.push(item);
      }

      const dailySummary = yield* db.upsertSummaryDocument({
        body:
          input.extraction.dailySummary ??
          dailySummaryFrom({ items: extractedItems, noteText: input.changedText }),
        metadata: { generatedBy: input.extraction.provider, model: input.extraction.model },
        periodEnd: input.localDate,
        periodStart: input.localDate,
        periodType: "day",
        sourceItemIds: extractedItems.map((item) => item.id),
        sourceNoteIds: [input.noteId],
        status: "ready",
        title: `${input.localDate} summary`,
        userId: input.userId,
      });
      const week = weekRangeFor(input.localDate);
      const weeklySummary = yield* db.upsertSummaryDocument({
        body: `Week so far: ${dailySummary.body}`,
        metadata: { generatedBy: input.extraction.provider, model: input.extraction.model },
        periodEnd: week.end,
        periodStart: week.start,
        periodType: "week",
        sourceItemIds: extractedItems.map((item) => item.id),
        sourceNoteIds: [input.noteId],
        status: "ready",
        title: `${week.start} week summary`,
        userId: input.userId,
      });
      yield* db.completeAgentRun({
        outputs: [
          ...extractedItems.map((item) =>
            agentRunOutput({ outputId: item.id, outputType: "extracted_item" }),
          ),
          agentRunOutput({ outputId: dailySummary.id, outputType: "summary" }),
          agentRunOutput({ outputId: weeklySummary.id, outputType: "summary" }),
        ],
        runId: input.runId,
        status: "completed",
        userId: input.userId,
      });

      return {
        dailySummary,
        extractedItems,
        itemCount: extractedItems.length,
        weeklySummary,
      };
    }),

  reviewExtractedItemStatus: (
    input: ReviewExtractedItemStatusInput,
  ): Effect.Effect<ReviewExtractedItemStatusResult, never, Db> =>
    Effect.gen(function* () {
      const db = yield* Db;
      const action = yield* db.updateExtractedItemStatus({
        itemId: input.itemId,
        status: input.status,
        userId: input.userId,
      });

      if (action.kind === "memory" && input.status === "accepted") {
        yield* db.upsertMemoryDocument({
          bodyText: `${action.title}\n${action.body}`,
          sourceId: action.id,
          sourceType: "extracted_item",
          title: action.title,
          userId: input.userId,
        });
      }

      const followThrough = followThroughFor(action, input.status);
      const event = yield* db.recordItemEvent({
        eventType: itemEventTypeForStatus(input.status),
        itemId: action.id,
        payload:
          followThrough === null
            ? { status: input.status }
            : { followThrough, status: input.status },
        userId: input.userId,
      });

      return { action, event };
    }),

  saveJournalCapture: (input: SaveJournalCaptureInput) =>
    Effect.gen(function* () {
      const db = yield* Db;
      const analysisProvider = input.analysisProvider ?? "cloudflare-think";
      yield* db.ensureUser(input.user);
      const journal = yield* db.upsertJournalDocument({
        bodyText: input.bodyText,
        ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
        localDate: input.localDate,
        title: input.title,
        userId: input.user.id,
      });
      const dailyNote = yield* db.upsertDailyNote({
        bodyText: input.bodyText,
        ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
        localDate: input.localDate,
        title: input.title,
        userId: input.user.id,
      });

      if (journal.revision.changedText.trim().length === 0) {
        return {
          dailyNote,
          document: journal.document,
          revision: journal.revision,
        };
      }

      const analysisRun = yield* db.startAgentRun({
        metadata: {
          localDate: input.localDate,
          provider: analysisProvider,
        },
        model: input.aiModel,
        sourceId: dailyNote.revision.id,
        sourceType: "note_revision",
        status: "queued",
        triggerType: "note_inactivity",
        userId: input.user.id,
      });
      const analysisParams = dailyNoteAnalysisParams({
        changedText: journal.revision.changedText,
        dailyNote,
        document: journal.document,
        localDate: input.localDate,
        ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
        run: analysisRun,
        title: journal.document.title,
        ...(input.traceparent !== undefined ? { traceparent: input.traceparent } : {}),
        user: input.user,
      });

      if (input.scheduleAnalysis) {
        yield* input.scheduleAnalysis({ params: analysisParams, run: analysisRun });
      }

      yield* db.upsertMemoryDocument({
        bodyText: dailyNote.note.bodyText,
        localDate: dailyNote.note.localDate,
        sourceId: dailyNote.note.id,
        sourceType: "daily_note",
        title: dailyNote.note.title,
        userId: input.user.id,
      });
      yield* db.upsertMemoryDocument({
        bodyText: dailyNote.revision.changedText,
        localDate: dailyNote.note.localDate,
        sourceId: dailyNote.revision.id,
        sourceType: "note_revision",
        title: `${dailyNote.note.title} delta`,
        userId: input.user.id,
      });
      yield* db.upsertMemoryDocument({
        bodyText: journal.revision.changedText,
        localDate: journal.document.localDate,
        sourceId: journal.revision.id,
        sourceType: "journal_revision",
        title: journal.document.title,
        userId: input.user.id,
      });

      if (input.indexPendingMemory) {
        yield* input.indexPendingMemory({
          limit: input.memoryIndexLimit ?? 20,
          user: input.user,
        });
      }

      return {
        analysisParams,
        analysisRun,
        dailyNote,
        document: journal.document,
        revision: journal.revision,
        wideEvent: analysisWideEvent({
          aiModel: input.aiModel,
          analysisProvider,
          localDate: input.localDate,
          run: analysisRun,
        }),
      };
    }),
};

export const DailyNoteWorkflows = NoteAnalysisWorkflows;
