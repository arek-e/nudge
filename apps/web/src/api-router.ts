import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { implement, onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Effect } from "effect";
import {
  Db,
  type AgentRunRecord,
  type DbService,
  type EventRecord,
  type JournalDocumentRecord,
} from "@vesta/db";
import {
  buildOkfProjection,
  listOkfDirectory,
  MemoryIndex,
  PrimitiveWorkflows,
  readOkfFile,
  searchOkfFiles,
} from "@vesta/effect-services";
import type { RequestSession } from "./request-context";
import type { RunEffect } from "./Services/VestaApp";
import {
  apiContract,
  conversationMessageResponseSchema,
  conversationMetadataSchema,
  listRecentSignalsToolResponseSchema,
  retrieveMemoryToolResponseSchema,
} from "./api-contract";
import { proxyConversationRequest } from "./conversation-proxy";
import { smokeTestOkfProjection, type OkfSandbox } from "./okf-sandbox";

function readSandboxSmokeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "OKF sandbox smoke failed";
}

const reasoningVoiceLogPrefixes = [
  "what ",
  "why ",
  "how ",
  "should ",
  "can ",
  "could ",
  "help ",
  "follow up",
  "remind ",
];

function classifyVoiceLogRoute(spokenText: string) {
  const text = spokenText.trim().toLowerCase();
  return text.includes("?") || reasoningVoiceLogPrefixes.some((prefix) => text.startsWith(prefix))
    ? "reasoning_candidate"
    : "capture_only";
}

interface CalendarDayActivity {
  readonly localDate: string;
  readonly noteCount: number;
  readonly signalCount: number;
}

function localDateInTimeZone(isoDate: string, timeZone: string) {
  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = formattedDatePart(parts, "year");
  const month = formattedDatePart(parts, "month");
  const day = formattedDatePart(parts, "day");
  return year && month && day ? `${year}-${month}-${day}` : isoDate.slice(0, 10);
}

function formattedDatePart(parts: ReadonlyArray<Intl.DateTimeFormatPart>, type: string) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function upsertCalendarDay(
  days: Map<string, CalendarDayActivity>,
  localDate: string,
  increment: { readonly notes?: number; readonly signals?: number },
) {
  const current = days.get(localDate) ?? { localDate, noteCount: 0, signalCount: 0 };
  days.set(localDate, {
    localDate,
    noteCount: current.noteCount + (increment.notes ?? 0),
    signalCount: current.signalCount + (increment.signals ?? 0),
  });
}

function buildCalendarDays(input: {
  readonly events: ReadonlyArray<EventRecord>;
  readonly journalDocuments: ReadonlyArray<JournalDocumentRecord>;
  readonly timeZone: string;
}) {
  const days = new Map<string, CalendarDayActivity>();
  for (const document of input.journalDocuments) {
    upsertCalendarDay(days, document.localDate, { notes: 1 });
  }
  for (const event of input.events) {
    upsertCalendarDay(days, localDateInTimeZone(event.occurredAt, input.timeZone), { signals: 1 });
  }
  return [...days.values()].sort((left, right) => left.localDate.localeCompare(right.localDate));
}

export interface ApiContext {
  readonly addWideEvent: (fields: Record<string, unknown>) => void;
  readonly agentSessions: DurableObjectNamespace;
  readonly agentInternalSecret?: string;
  readonly aiModel: string;
  readonly dailyAnalysisWorkflow: Workflow;
  readonly db: DbService;
  readonly getOkfSandbox: () => Promise<OkfSandbox | null>;
  readonly recordSpan: <A>(
    name: string,
    input: {
      readonly attributes?: Readonly<Record<string, unknown>>;
      readonly kind?: "client" | "internal";
    },
    task: () => Promise<A>,
  ) => Promise<A>;
  readonly runEffect: RunEffect;
  readonly traceDb?: D1Database;
  readonly turbopuffer?: {
    readonly apiKey: string;
    readonly region: string;
  };
  readonly session: RequestSession;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  };
}

const api = implement(apiContract).$context<ApiContext>();

export const apiRouter = api.router({
  actions: {
    list: api.actions.list.handler(async ({ context, input }) => {
      const [actions, latestRuns] = await Promise.all([
        context.runEffect(
          context.db.listExtractedItems({
            limit: input.limit,
            userId: context.user.id,
            ...(input.status !== undefined ? { status: input.status } : {}),
          }),
        ),
        context.runEffect(
          context.db.listAgentRuns({
            limit: 1,
            sourceType: "note_revision",
            userId: context.user.id,
          }),
        ),
      ]);
      return { actions: [...actions], ...(latestRuns[0] ? { latestRun: latestRuns[0] } : {}) };
    }),
    updateStatus: api.actions.updateStatus.handler(async ({ context, input }) => {
      const action = await context.runEffect(
        context.db.updateExtractedItemStatus({
          itemId: input.itemId,
          status: input.status,
          userId: context.user.id,
        }),
      );
      await context.runEffect(
        context.db.recordItemEvent({
          eventType:
            input.status === "completed"
              ? "completed"
              : input.status === "dismissed"
                ? "dismissed"
                : input.status === "archived"
                  ? "archived"
                  : input.status === "accepted"
                    ? "accepted"
                    : "edited",
          itemId: action.id,
          payload: { status: input.status },
          userId: context.user.id,
        }),
      );
      return { action };
    }),
  },
  agentRuns: {
    get: api.agentRuns.get.handler(async ({ context, input }) => {
      const run = await context.runEffect(
        context.db.getAgentRun({ runId: input.runId, userId: context.user.id }),
      );
      return { run };
    }),
  },
  account: {
    delete: api.account.delete.handler(async ({ context }) => {
      const turbopuffer = context.turbopuffer;
      if (turbopuffer) {
        await runMemoryIndex(
          context.runEffect,
          turbopuffer,
          Effect.gen(function* () {
            const memoryIndex = yield* MemoryIndex;
            return yield* memoryIndex.deleteUserNamespace({ user: context.user });
          }),
        );
      }
      await context.runEffect(context.db.deleteUserData({ userId: context.user.id }));
      return { deleted: true };
    }),
  },
  calendar: {
    days: api.calendar.days.handler(async ({ context, input }) => {
      const [events, journalDocuments] = await Promise.all([
        context.runEffect(context.db.listRecentEvents({ limit: 100, userId: context.user.id })),
        context.runEffect(context.db.listJournalDocuments({ userId: context.user.id })),
      ]);
      return {
        days: buildCalendarDays({
          events,
          journalDocuments,
          timeZone: input.timeZone,
        }),
      };
    }),
  },
  conversations: {
    get: api.conversations.get.handler(async ({ context, input }) => {
      return proxyConversationRequest(
        context.agentSessions,
        context.agentInternalSecret,
        context.user,
        input.conversationId,
        "/metadata",
        conversationMetadataSchema,
      );
    }),
    listRecentSignals: api.conversations.listRecentSignals.handler(async ({ context, input }) => {
      const url = new URL("https://vesta.local/tools/list-recent-signals");
      url.searchParams.set("limit", String(input.limit ?? 10));
      return proxyConversationRequest(
        context.agentSessions,
        context.agentInternalSecret,
        context.user,
        input.conversationId,
        url,
        listRecentSignalsToolResponseSchema,
      );
    }),
    retrieveMemory: api.conversations.retrieveMemory.handler(async ({ context, input }) => {
      const url = new URL("https://vesta.local/tools/retrieve-memory");
      url.searchParams.set("query", input.query);
      url.searchParams.set("limit", String(input.limit ?? 5));
      return proxyConversationRequest(
        context.agentSessions,
        context.agentInternalSecret,
        context.user,
        input.conversationId,
        url,
        retrieveMemoryToolResponseSchema,
      );
    }),
    sendMessage: api.conversations.sendMessage.handler(async ({ context, input }) => {
      return proxyConversationRequest(
        context.agentSessions,
        context.agentInternalSecret,
        context.user,
        input.conversationId,
        "/messages",
        conversationMessageResponseSchema,
        {
          body: JSON.stringify({ message: input.message }),
          method: "POST",
        },
      );
    }),
  },
  captures: {
    append: api.captures.append.handler(async ({ context, input }) => {
      return runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.appendSignal({
          occurredAt: input.occurredAt,
          payload: input.payload,
          schemaVersion: input.schemaVersion,
          source: input.source,
          type: input.type,
          user: context.user,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        }),
      );
    }),
  },
  dataExport: api.dataExport.handler(async ({ context }) => {
    const exported = await context.runEffect(context.db.exportUserData(context.user));
    return {
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
    };
  }),
  okf: {
    list: api.okf.list.handler(async ({ context, input }) => {
      const exported = await context.runEffect(context.db.exportUserData(context.user));
      const projection = buildOkfProjection(exported);
      return { entries: listOkfDirectory(projection, input.path), path: input.path };
    }),
    readFile: api.okf.readFile.handler(async ({ context, input }) => {
      const exported = await context.runEffect(context.db.exportUserData(context.user));
      const projection = buildOkfProjection(exported);
      return { content: readOkfFile(projection, input.path), path: input.path };
    }),
    search: api.okf.search.handler(async ({ context, input }) => {
      const exported = await context.runEffect(context.db.exportUserData(context.user));
      const projection = buildOkfProjection(exported);
      return { results: [...searchOkfFiles(projection, input.query, input.limit)] };
    }),
    sandboxSmoke: api.okf.sandboxSmoke.handler(async ({ context }) => {
      const sandbox = await context.getOkfSandbox();
      if (!sandbox) {
        return {
          available: false,
          exitCode: null,
          fileCount: 0,
          root: "/workspace/okf",
          stderr: "OKF sandbox is not configured",
          stdout: "",
          success: false,
        };
      }
      const exported = await context.runEffect(context.db.exportUserData(context.user));
      const projection = buildOkfProjection(exported);
      const root = "/workspace/okf";
      const smoke = await smokeTestOkfProjection(sandbox, projection).catch((error: unknown) => ({
        exitCode: null,
        stderr: readSandboxSmokeError(error),
        stdout: "",
        success: false,
      }));
      return {
        available: true,
        exitCode: smoke.exitCode,
        fileCount: projection.files.size,
        root,
        stderr: smoke.stderr,
        stdout: smoke.stdout,
        success: smoke.success,
      };
    }),
  },
  events: {
    append: api.events.append.handler(async ({ context, input }) => {
      return runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.appendSignal({
          occurredAt: input.occurredAt,
          payload: input.payload,
          schemaVersion: input.schemaVersion,
          source: input.source,
          type: input.type,
          user: context.user,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        }),
      );
    }),
    list: api.events.list.handler(async ({ context, input }) => {
      const events = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.listSignals({
          limit: input.limit ?? 50,
          ...(input.from ? { from: input.from } : {}),
          ...(input.to ? { to: input.to } : {}),
          user: context.user,
        }),
      );

      return { events: [...events] };
    }),
  },
  journal: {
    get: api.journal.get.handler(async ({ context, input }) => {
      const document = await context.runEffect(
        context.db.getJournalDocument({ localDate: input.localDate, userId: context.user.id }),
      );
      return { document };
    }),
    save: api.journal.save.handler(async ({ context, input }) => {
      return runApiEffect(
        context,
        Effect.gen(function* () {
          yield* context.db.ensureUser(context.user);
          const result = yield* context.db.upsertJournalDocument({
            bodyText: input.bodyText,
            ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
            localDate: input.localDate,
            title: input.title,
            userId: context.user.id,
          });
          const noteResult = yield* context.db.upsertDailyNote({
            bodyText: input.bodyText,
            ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
            localDate: input.localDate,
            title: input.title,
            userId: context.user.id,
          });
          let analysisRun: AgentRunRecord | null = null;
          if (result.revision.changedText.trim().length > 0) {
            analysisRun = yield* context.db.startAgentRun({
              metadata: {
                localDate: input.localDate,
                provider: "cloudflare-think",
              },
              model: context.aiModel,
              sourceId: noteResult.revision.id,
              sourceType: "note_revision",
              status: "queued",
              triggerType: "note_inactivity",
              userId: context.user.id,
            });
            const queuedRun = analysisRun;
            yield* Effect.promise(() =>
              context.recordSpan(
                "daily_note.analysis_workflow.create",
                {
                  attributes: {
                    "vesta.ai.source_type": "note_revision",
                    "vesta.ai.system": "cloudflare-think",
                    "workflow.name": "daily-note-analysis",
                  },
                  kind: "client",
                },
                () =>
                  context.dailyAnalysisWorkflow.create({
                    id: `daily-note-analysis-${noteResult.revision.id}`,
                    params: {
                      changedText: result.revision.changedText,
                      documentId: result.document.id,
                      kind: "daily-note-analysis",
                      localDate: result.document.localDate,
                      noteId: noteResult.note.id,
                      revisionId: noteResult.revision.id,
                      runId: queuedRun.id,
                      title: result.document.title,
                      userDisplayName: context.user.displayName,
                      userId: context.user.id,
                      workflowVersion: 1,
                    },
                  }),
              ),
            );
            yield* context.db.upsertMemoryDocument({
              bodyText: noteResult.note.bodyText,
              localDate: noteResult.note.localDate,
              sourceId: noteResult.note.id,
              sourceType: "daily_note",
              title: noteResult.note.title,
              userId: context.user.id,
            });
            yield* context.db.upsertMemoryDocument({
              bodyText: noteResult.revision.changedText,
              localDate: noteResult.note.localDate,
              sourceId: noteResult.revision.id,
              sourceType: "note_revision",
              title: `${noteResult.note.title} delta`,
              userId: context.user.id,
            });
            yield* context.db.upsertMemoryDocument({
              bodyText: result.revision.changedText,
              localDate: result.document.localDate,
              sourceId: result.revision.id,
              sourceType: "journal_revision",
              title: result.document.title,
              userId: context.user.id,
            });
            const turbopuffer = context.turbopuffer;
            if (turbopuffer) {
              yield* Effect.promise(() =>
                context.recordSpan(
                  "memory.index_pending",
                  {
                    attributes: {
                      "vesta.memory_index.provider": "turbopuffer",
                      "turbopuffer.region": turbopuffer.region,
                    },
                    kind: "client",
                  },
                  async () => {
                    await runMemoryIndex(
                      context.runEffect,
                      turbopuffer,
                      Effect.gen(function* () {
                        const memoryIndex = yield* MemoryIndex;
                        return yield* memoryIndex.indexPending({ limit: 20, user: context.user });
                      }),
                    ).catch((error: unknown) => {
                      const safeError =
                        error instanceof Error ? error : new Error("Memory index failed");
                      console.warn(
                        JSON.stringify({
                          event: "memory_index_failed",
                          logKind: "wide_event",
                          provider: "turbopuffer",
                          region: turbopuffer.region,
                          errorType: safeError.name,
                        }),
                      );
                    });
                  },
                ),
              );
            }
          }

          return apiEffectResult(
            { ...result, ...(analysisRun ? { analysisRun } : {}) },
            analysisRun
              ? {
                  aiErrorCode: null,
                  aiModel: context.aiModel,
                  aiRunId: analysisRun.id,
                  aiSourceType: "note_revision",
                  aiSystem: "cloudflare-think",
                  noteLocalDate: input.localDate,
                }
              : undefined,
          );
        }),
      );
    }),
  },
  signals: {
    list: api.signals.list.handler(async ({ context, input }) => {
      const signals = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.listSignals({
          limit: input.limit ?? 50,
          ...(input.from ? { from: input.from } : {}),
          ...(input.to ? { to: input.to } : {}),
          user: context.user,
        }),
      );

      return { signals: [...signals] };
    }),
  },
  summaries: {
    list: api.summaries.list.handler(async ({ context, input }) => {
      const summaries = await context.runEffect(
        context.db.listSummaryDocuments({
          limit: input.limit,
          userId: context.user.id,
          ...(input.periodType !== undefined ? { periodType: input.periodType } : {}),
        }),
      );
      return {
        summaries: summaries.map((summary) => ({
          ...summary,
          sourceItemIds: [...summary.sourceItemIds],
          sourceNoteIds: [...summary.sourceNoteIds],
        })),
      };
    }),
  },
  session: api.session.handler(({ context }) => {
    return {
      authMode: context.session.authMode,
      user: context.session.user,
      workspace: context.session.user
        ? {
            id: context.session.user.id,
            label: `${context.session.user.displayName}'s workspace`,
          }
        : null,
    };
  }),
  proposals: {
    generate: api.proposals.generate.handler(async ({ context, input }) => {
      const proposals = await context.recordSpan(
        "proposals.generate",
        { attributes: { "vesta.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.runEffect,
            PrimitiveWorkflows.generateProposals({
              frameKey: input.frameKey ?? "current_state",
              user: context.user,
            }),
          ),
      );

      return { proposals: proposals.map(toProposalResponse) };
    }),
    list: api.proposals.list.handler(async ({ context, input }) => {
      const proposals = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.listPendingProposals({ limit: input.limit ?? 20, user: context.user }),
      );

      return { proposals: proposals.map(toProposalResponse) };
    }),
  },
  commitments: {
    list: api.commitments.list.handler(async ({ context, input }) => {
      const commitments = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.listCommitments({ limit: input.limit ?? 20, user: context.user }),
      );

      return { commitments: [...commitments] };
    }),
  },
  reviews: {
    create: api.reviews.create.handler(async ({ context, input }) => {
      return runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.reviewProposal({
          decision: input.decision,
          ...(input.editedTitle !== undefined ? { editedTitle: input.editedTitle } : {}),
          ...(input.editedBody !== undefined ? { editedBody: input.editedBody } : {}),
          ...(input.editedBodyDocument !== undefined
            ? { editedBodyDocument: input.editedBodyDocument }
            : {}),
          proposalId: input.proposalId,
          user: context.user,
        }),
      );
    }),
  },
  outcomes: {
    list: api.outcomes.list.handler(async ({ context, input }) => {
      const outcomes = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.listOutcomes({ limit: input.limit ?? 20, user: context.user }),
      );

      return { outcomes: [...outcomes] };
    }),
    create: api.outcomes.create.handler(async ({ context, input }) => {
      return runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.recordOutcome({
          commitmentId: input.commitmentId,
          ...(input.note !== undefined ? { note: input.note } : {}),
          result: input.result,
          user: context.user,
        }),
      );
    }),
  },
  syntheses: {
    create: api.syntheses.create.handler(async ({ context, input }) => {
      return context.recordSpan(
        "syntheses.create",
        { attributes: { "vesta.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.runEffect,
            PrimitiveWorkflows.createSynthesis({
              frameKey: input.frameKey ?? "current_state",
              user: context.user,
            }),
          ).then(({ frame, synthesis }) => ({ frame, synthesis: toSynthesisResponse(synthesis) })),
      );
    }),
    latest: api.syntheses.latest.handler(async ({ context, input }) => {
      return context.recordSpan(
        "syntheses.latest",
        { attributes: { "vesta.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.runEffect,
            PrimitiveWorkflows.latestSynthesis({
              frameKey: input.frameKey ?? "current_state",
              user: context.user,
            }),
          ).then(({ frame, synthesis }) => ({ frame, synthesis: toSynthesisResponse(synthesis) })),
      );
    }),
  },
  traces: {
    recent: api.traces.recent.handler(async ({ context, input }) => {
      const rows = await context.runEffect(
        listRecentTraceSpans(context.traceDb, input.limit ?? 20),
      );
      return { spans: rows.map(toTraceSpanSummary) };
    }),
  },
  voice: {
    log: api.voice.log.handler(async ({ context, input }) => {
      const route = classifyVoiceLogRoute(input.spokenText);
      const spokenResponse =
        route === "reasoning_candidate"
          ? "Understood. I'm processing it in Vesta."
          : "Understood. I logged it to Vesta.";
      const capture = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.appendSignal({
          occurredAt: input.occurredAt ?? new Date().toISOString(),
          payload: { route, text: input.spokenText },
          schemaVersion: 1,
          source: "ios_siri",
          type: "capture.voice_log",
          user: context.user,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        }),
      );

      return { capture, route, spokenResponse };
    }),
  },
});

interface TraceSpanRow {
  readonly id: string;
  readonly trace_id: string;
  readonly parent_span_id: string | null;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly duration_ms: number | null;
  readonly route_name: string | null;
  readonly method: string | null;
  readonly path: string | null;
}

function listRecentTraceSpans(traceDb: D1Database | undefined, limit: number) {
  if (typeof traceDb?.prepare !== "function") return Effect.succeed([]);

  return Effect.tryPromise({
    try: async () => {
      const result = await traceDb
        .prepare(
          `SELECT
            span_id AS id,
            trace_id,
            parent_span_id,
            name,
            kind,
            status,
            started_at,
            ended_at,
            duration_ms,
            route_name,
            method,
            path
          FROM trace_spans
          WHERE route_name IS NULL OR route_name != 'api.traces'
          ORDER BY started_at DESC
          LIMIT ?`,
        )
        .bind(limit)
        .all<TraceSpanRow>();

      return result.results ?? [];
    },
    catch: (cause) => cause,
  }).pipe(Effect.withSpan("TraceSpans.listRecent", { attributes: { limit } }));
}

function toTraceSpanSummary(row: TraceSpanRow) {
  return {
    id: row.id,
    traceId: row.trace_id,
    parentSpanId: row.parent_span_id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    routeName: row.route_name,
    method: row.method,
    path: row.path,
  };
}

function toSynthesisResponse(synthesis: {
  readonly id: string;
  readonly userId: string;
  readonly frameId: string;
  readonly summary: string;
  readonly themes: ReadonlyArray<string>;
  readonly openQuestions: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
  readonly generatedAt: string;
  readonly createdAt: string;
}) {
  return {
    ...synthesis,
    themes: [...synthesis.themes],
    openQuestions: [...synthesis.openQuestions],
    sourceSignalIds: [...synthesis.sourceSignalIds],
  };
}

function toProposalResponse(proposal: {
  readonly id: string;
  readonly userId: string;
  readonly synthesisId: string;
  readonly kind: "clarify" | "follow_up" | "commit" | "ignore";
  readonly status: "pending" | "accepted" | "edited" | "rejected";
  readonly title: string;
  readonly body: string;
  readonly rationale: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}) {
  return proposal;
}

interface ApiEffectResult<A> {
  readonly result: A;
  readonly wideEvent?: Record<string, unknown>;
}

function apiEffectResult<A>(
  result: A,
  wideEvent: Record<string, unknown> | undefined,
): ApiEffectResult<A> {
  return wideEvent ? { result, wideEvent } : { result };
}

async function runApiEffect<A, E>(
  context: ApiContext,
  effect: Effect.Effect<ApiEffectResult<A>, E, Db>,
) {
  const output = await context.runEffect(effect);
  if (output.wideEvent) context.addWideEvent(output.wideEvent);
  return output.result;
}

function runWorkflow<A, E>(runEffect: RunEffect, workflow: Effect.Effect<A, E, Db>) {
  return runEffect(workflow);
}

function runMemoryIndex<A, E>(
  runEffect: RunEffect,
  turbopuffer: { readonly apiKey: string; readonly region: string },
  workflow: Effect.Effect<A, E, Db | MemoryIndex>,
) {
  return runEffect(Effect.provide(workflow, MemoryIndex.layerTurbopuffer(turbopuffer)));
}

export function makeApiHandler() {
  return new OpenAPIHandler(apiRouter, {
    interceptors: [
      onError((error) => {
        const safeError = error instanceof Error ? error : new Error("Unknown API handler error");
        console.warn(
          JSON.stringify({
            event: "api_handler_error",
            logKind: "wide_event",
            service: "vesta-web",
            errorType: safeError.name,
            errorMessage: safeError.message,
          }),
        );
      }),
    ],
    plugins: [
      new OpenAPIReferencePlugin({
        docsPath: "/docs",
        docsProvider: "scalar",
        specGenerateOptions: {
          info: {
            title: "Vesta API",
            version: "0.1.0",
          },
        },
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specPath: "/openapi.json",
      }),
    ],
  });
}
