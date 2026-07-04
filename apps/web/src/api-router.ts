import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { implement, onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Effect } from "effect";
import {
  Db,
  type DbService,
  type EventRecord,
  type JournalDocumentRecord,
  type ProposalRecord,
  type SynthesisRecord,
  type UserDataExport,
} from "@nudge/db";
import {
  buildOkfProjection,
  listOkfDirectory,
  MemoryIndex,
  NoteAnalysisWorkflows,
  PrimitiveWorkflows,
  readOkfFile,
  searchOkfFiles,
  type SaveJournalCaptureInput,
} from "@nudge/effect-services";
import type { RequestSession } from "./request-context";
import type { RunEffect } from "./Services/NudgeApp";
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

function errorFromUnknown(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
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

interface AgentReceiptPayload {
  readonly action: string;
  readonly changed: Readonly<Record<string, unknown>>;
  readonly signalIds: ReadonlyArray<string>;
  readonly why: string;
}

interface ProposalExplanation {
  readonly source: {
    readonly label: string;
    readonly signalIds: string[];
    readonly type: "signals";
  };
  readonly reason: string;
  readonly confidence: number;
  readonly nextAction: string;
}

const agentReceiptType = "agent.receipt";
const agentReceiptSource = "nudge_engine";

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

function sourceLabel(signalIds: ReadonlyArray<string>) {
  return `${signalIds.length} signal${signalIds.length === 1 ? "" : "s"}`;
}

function proposalSource(signalIds: ReadonlyArray<string>): ProposalExplanation["source"] {
  return {
    label: sourceLabel(signalIds),
    signalIds: [...signalIds],
    type: "signals",
  };
}

function nextActionForProposal(kind: ProposalRecord["kind"]) {
  switch (kind) {
    case "clarify":
      return "Answer or edit this clarification.";
    case "follow_up":
      return "Review this follow-up proposal.";
    case "commit":
      return "Accept, edit, or reject this commitment.";
    case "ignore":
      return "Confirm whether Nudge should ignore this.";
  }
}

function confidenceForProposal(proposal: ProposalRecord, synthesis: SynthesisRecord | undefined) {
  const sourceCount = synthesis?.sourceSignalIds.length ?? 0;
  if (proposal.kind === "follow_up" && sourceCount > 0) return 0.82;
  if (proposal.kind === "commit" && sourceCount > 0) return 0.78;
  if (sourceCount > 0) return 0.7;
  return 0.52;
}

function buildProposalExplanation(
  proposal: ProposalRecord,
  synthesesById: ReadonlyMap<string, SynthesisRecord>,
): ProposalExplanation {
  const synthesis = synthesesById.get(proposal.synthesisId);
  const signalIds = synthesis ? [...synthesis.sourceSignalIds] : [];
  return {
    source: proposalSource(signalIds),
    reason: proposal.rationale,
    confidence: confidenceForProposal(proposal, synthesis),
    nextAction: nextActionForProposal(proposal.kind),
  };
}

function synthesesByIdFrom(exported: Pick<UserDataExport, "syntheses">) {
  return new Map(exported.syntheses.map((synthesis) => [synthesis.id, synthesis]));
}

function readReceiptPayload(value: unknown): AgentReceiptPayload | null {
  if (!value || typeof value !== "object") return null;
  const action = Reflect.get(value, "action");
  const changed = Reflect.get(value, "changed");
  const signalIds = Reflect.get(value, "signalIds");
  const why = Reflect.get(value, "why");
  if (
    typeof action !== "string" ||
    !changed ||
    typeof changed !== "object" ||
    !Array.isArray(signalIds) ||
    !signalIds.every((signalId) => typeof signalId === "string") ||
    typeof why !== "string"
  ) {
    return null;
  }
  return {
    action,
    changed: Object.fromEntries(Object.entries(changed)),
    signalIds,
    why,
  };
}

function toReceiptResponse(event: EventRecord) {
  const payload = readReceiptPayload(event.payload);
  if (!payload) return null;
  return {
    id: event.id,
    action: payload.action,
    changed: payload.changed,
    createdAt: event.createdAt,
    signalIds: [...payload.signalIds],
    why: payload.why,
  };
}

function quickCaptureSourceFromClient(value: string | undefined) {
  switch (value) {
    case "desktop":
      return "desktop_app";
    case "ios":
      return "ios_app";
    case "raycast":
      return "raycast_extension";
    case "web":
    default:
      return "web_app";
  }
}

function listReceiptResponses(exported: Pick<UserDataExport, "events">, limit: number) {
  return exported.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === agentReceiptType)
    .sort(
      (left, right) =>
        right.event.createdAt.localeCompare(left.event.createdAt) || right.index - left.index,
    )
    .flatMap(({ event }) => {
      const receipt = toReceiptResponse(event);
      return receipt ? [receipt] : [];
    })
    .slice(0, limit);
}

async function recordAgentReceipt(
  context: ApiContext,
  input: {
    readonly action: string;
    readonly changed: Readonly<Record<string, unknown>>;
    readonly idempotencyKey: string;
    readonly signalIds: ReadonlyArray<string>;
    readonly why: string;
  },
) {
  await context.runEffect(
    context.db.appendEvent({
      idempotencyKey: `agent-receipt:${input.idempotencyKey}`,
      occurredAt: new Date().toISOString(),
      payload: {
        action: input.action,
        changed: input.changed,
        signalIds: [...input.signalIds],
        why: input.why,
      },
      schemaVersion: 1,
      source: agentReceiptSource,
      type: agentReceiptType,
      userId: context.user.id,
    }),
  );
}

export interface ApiContext {
  readonly addWideEvent: (fields: Record<string, unknown>) => void;
  readonly agentSessions: DurableObjectNamespace;
  readonly agentInternalSecret?: string;
  readonly aiModel: string;
  readonly clientSurface?: string;
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
  readonly traceHeaders?: Readonly<Record<string, string>>;
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
      const reviewed = await context.runEffect(
        NoteAnalysisWorkflows.reviewExtractedItemStatus({
          itemId: input.itemId,
          status: input.status,
          userId: context.user.id,
        }),
      );
      return { action: reviewed.action };
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
        {},
        context.traceHeaders,
      );
    }),
    listRecentSignals: api.conversations.listRecentSignals.handler(async ({ context, input }) => {
      const url = new URL("https://nudge.local/tools/list-recent-signals");
      url.searchParams.set("limit", String(input.limit ?? 10));
      return proxyConversationRequest(
        context.agentSessions,
        context.agentInternalSecret,
        context.user,
        input.conversationId,
        url,
        listRecentSignalsToolResponseSchema,
        {},
        context.traceHeaders,
      );
    }),
    retrieveMemory: api.conversations.retrieveMemory.handler(async ({ context, input }) => {
      const url = new URL("https://nudge.local/tools/retrieve-memory");
      url.searchParams.set("query", input.query);
      url.searchParams.set("limit", String(input.limit ?? 5));
      return proxyConversationRequest(
        context.agentSessions,
        context.agentInternalSecret,
        context.user,
        input.conversationId,
        url,
        retrieveMemoryToolResponseSchema,
        {},
        context.traceHeaders,
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
        context.traceHeaders,
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
  quickCaptures: {
    submit: api.quickCaptures.submit.handler(async ({ context, input }) => {
      const result = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.draftLoopIntake({
          conversationId: "quick-capture",
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
          message: input.note,
          ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
          source: quickCaptureSourceFromClient(context.clientSurface),
          user: context.user,
        }),
      );
      return {
        capture: result.signal,
        draft: result.draft
          ? {
              confidence: result.draft.confidence,
              proposal: result.draft.proposal,
              requiresReview: true,
            }
          : null,
        processingStatus: result.draft ? "drafted" : "captured",
      };
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
      const indexPendingMemory = dailyNoteMemoryIndexer(context);
      return runApiEffect(
        context,
        Effect.gen(function* () {
          const saveResult = yield* NoteAnalysisWorkflows.saveJournalCapture({
            aiModel: context.aiModel,
            bodyText: input.bodyText,
            ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
            ...(indexPendingMemory ? { indexPendingMemory } : {}),
            localDate: input.localDate,
            ...(context.traceHeaders?.["x-request-id"] !== undefined
              ? { requestId: context.traceHeaders["x-request-id"] }
              : {}),
            scheduleAnalysis: dailyNoteAnalysisScheduler(context),
            title: input.title,
            ...(context.traceHeaders?.traceparent !== undefined
              ? { traceparent: context.traceHeaders.traceparent }
              : {}),
            user: context.user,
          });

          return apiEffectResult(
            {
              document: saveResult.document,
              revision: saveResult.revision,
              ...(saveResult.analysisRun ? { analysisRun: saveResult.analysisRun } : {}),
            },
            saveResult.wideEvent,
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
        { attributes: { "nudge.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.runEffect,
            PrimitiveWorkflows.generateProposals({
              frameKey: input.frameKey ?? "current_state",
              user: context.user,
            }),
          ),
      );
      const exported = await context.runEffect(context.db.exportUserData(context.user));
      const synthesesById = synthesesByIdFrom(exported);
      await Promise.all(
        proposals.map((proposal) => {
          const explanation = buildProposalExplanation(proposal, synthesesById);
          return recordAgentReceipt(context, {
            action: "proposal.generated",
            changed: {
              proposalId: proposal.id,
              status: proposal.status,
              title: proposal.title,
            },
            idempotencyKey: `proposal.generated:${proposal.id}`,
            signalIds: explanation.source.signalIds,
            why: explanation.reason,
          });
        }),
      );

      return {
        proposals: proposals.map((proposal) => toProposalWithExplanation(proposal, synthesesById)),
      };
    }),
    list: api.proposals.list.handler(async ({ context, input }) => {
      const proposals = await runWorkflow(
        context.runEffect,
        PrimitiveWorkflows.listPendingProposals({ limit: input.limit ?? 20, user: context.user }),
      );
      const exported = await context.runEffect(context.db.exportUserData(context.user));
      const synthesesById = synthesesByIdFrom(exported);

      return {
        proposals: proposals.map((proposal) => toProposalWithExplanation(proposal, synthesesById)),
      };
    }),
  },
  reviewInbox: {
    list: api.reviewInbox.list.handler(async ({ context, input }) => {
      const exported = await context.runEffect(context.db.exportUserData(context.user));
      const synthesesById = synthesesByIdFrom(exported);
      const pendingProposals = exported.proposals
        .filter((proposal) => proposal.status === "pending")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, input.limit);

      return {
        items: pendingProposals.map((proposal) => ({
          id: proposal.id,
          createdAt: proposal.createdAt,
          kind: "proposal",
          proposal: toProposalWithExplanation(proposal, synthesesById),
        })),
        receipts: listReceiptResponses(exported, input.limit),
      };
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
      const exportedBeforeReview = await context.runEffect(context.db.exportUserData(context.user));
      const synthesesById = synthesesByIdFrom(exportedBeforeReview);
      const proposal = exportedBeforeReview.proposals.find(
        (candidate) => candidate.id === input.proposalId,
      );
      const explanation = proposal
        ? buildProposalExplanation(proposal, synthesesById)
        : {
            source: proposalSource([]),
            reason: "Review decision recorded.",
            confidence: 0.5,
            nextAction: "Review saved.",
          };
      const review = await runWorkflow(
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
      await recordAgentReceipt(context, {
        action: `review.${review.decision}`,
        changed: {
          decision: review.decision,
          proposalId: review.proposalId,
          reviewId: review.id,
        },
        idempotencyKey: `review.${review.id}`,
        signalIds: explanation.source.signalIds,
        why: explanation.reason,
      });
      return review;
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
        { attributes: { "nudge.frame_key": input.frameKey } },
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
        { attributes: { "nudge.frame_key": input.frameKey } },
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
  voice: {
    log: api.voice.log.handler(async ({ context, input }) => {
      const route = classifyVoiceLogRoute(input.spokenText);
      const spokenResponse =
        route === "reasoning_candidate"
          ? "Understood. I'm processing it in Nudge."
          : "Understood. I logged it to Nudge.";
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

function toProposalWithExplanation(
  proposal: ProposalRecord,
  synthesesById: ReadonlyMap<string, SynthesisRecord>,
) {
  return {
    ...toProposalResponse(proposal),
    explanation: buildProposalExplanation(proposal, synthesesById),
  };
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

function dailyNoteAnalysisScheduler(
  context: ApiContext,
): NonNullable<SaveJournalCaptureInput["scheduleAnalysis"]> {
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
      catch: (error) => errorFromUnknown(error, "Daily note analysis scheduling failed"),
    });
}

function dailyNoteMemoryIndexer(
  context: ApiContext,
): SaveJournalCaptureInput["indexPendingMemory"] | undefined {
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
            await runMemoryIndex(
              context.runEffect,
              turbopuffer,
              Effect.gen(function* () {
                const memoryIndex = yield* MemoryIndex;
                return yield* memoryIndex.indexPending({
                  limit: input.limit,
                  user: input.user,
                });
              }),
            ).catch((error: unknown) => {
              const safeError = errorFromUnknown(error, "Memory index failed");
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
        );
      },
      catch: (error) => errorFromUnknown(error, "Daily note memory indexing failed"),
    });
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
            service: "nudge-web",
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
            title: "Nudge API",
            version: "0.1.0",
          },
        },
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specPath: "/openapi.json",
      }),
    ],
  });
}
