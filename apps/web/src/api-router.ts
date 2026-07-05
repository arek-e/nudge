import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { implement, onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { ApiContext } from "./api/context";
import { apiContract } from "./api-contract";
import { appendCapture } from "./api/actions/append-capture";
import { appendEvent } from "./api/actions/append-event";
import { createOutcome } from "./api/actions/create-outcome";
import { createReview } from "./api/actions/create-review";
import { createSynthesis } from "./api/actions/create-synthesis";
import { deleteAccount } from "./api/actions/delete-account";
import { type ApiAction, runApiAction } from "./api/actions/effect-helpers";
import { exportData } from "./api/actions/export-data";
import { generateProposals } from "./api/actions/generate-proposals";
import { getAgentRun } from "./api/actions/get-agent-run";
import { getConversation } from "./api/actions/get-conversation";
import { getJournalDocument } from "./api/actions/get-journal-document";
import { getLatestSynthesis } from "./api/actions/get-latest-synthesis";
import { getSession } from "./api/actions/get-session";
import { listActions } from "./api/actions/list-actions";
import { listCalendarDays } from "./api/actions/list-calendar-days";
import { listCommitments } from "./api/actions/list-commitments";
import { listConversationRecentSignals } from "./api/actions/list-conversation-recent-signals";
import { listEvents } from "./api/actions/list-events";
import { listOkfDirectoryAction } from "./api/actions/list-okf-directory";
import { listOutcomes } from "./api/actions/list-outcomes";
import { listProposals } from "./api/actions/list-proposals";
import { listRecentTraceSpans } from "./api/actions/list-recent-trace-spans";
import { listReviewInbox } from "./api/actions/list-review-inbox";
import { listSignals } from "./api/actions/list-signals";
import { listSummaries } from "./api/actions/list-summaries";
import { logVoice } from "./api/actions/log-voice";
import { readOkfFileAction } from "./api/actions/read-okf-file";
import { retrieveConversationMemory } from "./api/actions/retrieve-conversation-memory";
import { saveJournalCapture } from "./api/actions/save-journal-capture";
import { searchOkfFilesAction } from "./api/actions/search-okf-files";
import { sendConversationMessage } from "./api/actions/send-conversation-message";
import { smokeOkfSandbox } from "./api/actions/smoke-okf-sandbox";
import { submitQuickCapture } from "./api/actions/submit-quick-capture";
import { updateActionStatus } from "./api/actions/update-action-status";

const api = implement(apiContract).$context<ApiContext>();

function run<A, E>(context: ApiContext, effect: ApiAction<A, E>) {
  return runApiAction({ context, effect });
}

export const apiRouter = api.router({
  actions: {
    list: api.actions.list.handler(async ({ context, input }) => {
      return run(
        context,
        listActions({
          context,
          limit: input.limit,
          ...(input.status !== undefined ? { status: input.status } : {}),
        }),
      );
    }),
    updateStatus: api.actions.updateStatus.handler(async ({ context, input }) => {
      return run(
        context,
        updateActionStatus({ context, itemId: input.itemId, status: input.status }),
      );
    }),
  },
  agentRuns: {
    get: api.agentRuns.get.handler(async ({ context, input }) => {
      return run(context, getAgentRun({ context, runId: input.runId }));
    }),
  },
  account: {
    delete: api.account.delete.handler(async ({ context }) => {
      return run(context, deleteAccount({ context }));
    }),
  },
  calendar: {
    days: api.calendar.days.handler(async ({ context, input }) => {
      return run(context, listCalendarDays({ context, timeZone: input.timeZone }));
    }),
  },
  conversations: {
    get: api.conversations.get.handler(async ({ context, input }) => {
      return run(context, getConversation({ context, conversationId: input.conversationId }));
    }),
    listRecentSignals: api.conversations.listRecentSignals.handler(async ({ context, input }) => {
      return run(
        context,
        listConversationRecentSignals({
          context,
          conversationId: input.conversationId,
          ...(input.limit !== undefined ? { limit: input.limit } : {}),
        }),
      );
    }),
    retrieveMemory: api.conversations.retrieveMemory.handler(async ({ context, input }) => {
      return run(
        context,
        retrieveConversationMemory({
          context,
          conversationId: input.conversationId,
          ...(input.limit !== undefined ? { limit: input.limit } : {}),
          query: input.query,
        }),
      );
    }),
    sendMessage: api.conversations.sendMessage.handler(async ({ context, input }) => {
      return run(
        context,
        sendConversationMessage({
          context,
          conversationId: input.conversationId,
          message: input.message,
        }),
      );
    }),
  },
  captures: {
    append: api.captures.append.handler(async ({ context, input }) => {
      return run(
        context,
        appendCapture({
          context,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
          occurredAt: input.occurredAt,
          payload: input.payload,
          schemaVersion: input.schemaVersion,
          source: input.source,
          type: input.type,
        }),
      );
    }),
  },
  quickCaptures: {
    submit: api.quickCaptures.submit.handler(async ({ context, input }) => {
      return run(
        context,
        submitQuickCapture({
          context,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
          note: input.note,
          ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
        }),
      );
    }),
  },
  dataExport: api.dataExport.handler(async ({ context }) => {
    return run(context, exportData({ context }));
  }),
  okf: {
    list: api.okf.list.handler(async ({ context, input }) => {
      return run(context, listOkfDirectoryAction({ context, path: input.path }));
    }),
    readFile: api.okf.readFile.handler(async ({ context, input }) => {
      return run(context, readOkfFileAction({ context, path: input.path }));
    }),
    search: api.okf.search.handler(async ({ context, input }) => {
      return run(
        context,
        searchOkfFilesAction({ context, limit: input.limit, query: input.query }),
      );
    }),
    sandboxSmoke: api.okf.sandboxSmoke.handler(async ({ context }) => {
      return run(context, smokeOkfSandbox({ context }));
    }),
  },
  events: {
    append: api.events.append.handler(async ({ context, input }) => {
      return run(
        context,
        appendEvent({
          context,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
          occurredAt: input.occurredAt,
          payload: input.payload,
          schemaVersion: input.schemaVersion,
          source: input.source,
          type: input.type,
        }),
      );
    }),
    list: api.events.list.handler(async ({ context, input }) => {
      return run(
        context,
        listEvents({
          context,
          ...(input.from ? { from: input.from } : {}),
          limit: input.limit,
          ...(input.to ? { to: input.to } : {}),
        }),
      );
    }),
  },
  journal: {
    get: api.journal.get.handler(async ({ context, input }) => {
      return run(context, getJournalDocument({ context, localDate: input.localDate }));
    }),
    save: api.journal.save.handler(async ({ context, input }) => {
      return run(
        context,
        saveJournalCapture({
          context,
          bodyText: input.bodyText,
          ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
          localDate: input.localDate,
          title: input.title,
        }),
      );
    }),
  },
  signals: {
    list: api.signals.list.handler(async ({ context, input }) => {
      return run(
        context,
        listSignals({
          context,
          ...(input.from ? { from: input.from } : {}),
          limit: input.limit,
          ...(input.to ? { to: input.to } : {}),
        }),
      );
    }),
  },
  summaries: {
    list: api.summaries.list.handler(async ({ context, input }) => {
      return run(
        context,
        listSummaries({
          context,
          limit: input.limit,
          ...(input.periodType !== undefined ? { periodType: input.periodType } : {}),
        }),
      );
    }),
  },
  session: api.session.handler(({ context }) => {
    return run(context, getSession({ context }));
  }),
  proposals: {
    generate: api.proposals.generate.handler(async ({ context, input }) => {
      return run(
        context,
        generateProposals({
          context,
          ...(input.frameKey !== undefined ? { frameKey: input.frameKey } : {}),
        }),
      );
    }),
    list: api.proposals.list.handler(async ({ context, input }) => {
      return run(context, listProposals({ context, limit: input.limit }));
    }),
  },
  reviewInbox: {
    list: api.reviewInbox.list.handler(async ({ context, input }) => {
      return run(context, listReviewInbox({ context, limit: input.limit }));
    }),
  },
  commitments: {
    list: api.commitments.list.handler(async ({ context, input }) => {
      return run(context, listCommitments({ context, limit: input.limit }));
    }),
  },
  reviews: {
    create: api.reviews.create.handler(async ({ context, input }) => {
      return run(
        context,
        createReview({
          context,
          decision: input.decision,
          ...(input.editedTitle !== undefined ? { editedTitle: input.editedTitle } : {}),
          ...(input.editedBody !== undefined ? { editedBody: input.editedBody } : {}),
          ...(input.editedBodyDocument !== undefined
            ? { editedBodyDocument: input.editedBodyDocument }
            : {}),
          proposalId: input.proposalId,
        }),
      );
    }),
  },
  outcomes: {
    list: api.outcomes.list.handler(async ({ context, input }) => {
      return run(context, listOutcomes({ context, limit: input.limit }));
    }),
    create: api.outcomes.create.handler(async ({ context, input }) => {
      return run(
        context,
        createOutcome({
          commitmentId: input.commitmentId,
          context,
          ...(input.note !== undefined ? { note: input.note } : {}),
          result: input.result,
        }),
      );
    }),
  },
  syntheses: {
    create: api.syntheses.create.handler(async ({ context, input }) => {
      return run(
        context,
        createSynthesis({
          context,
          ...(input.frameKey !== undefined ? { frameKey: input.frameKey } : {}),
        }),
      );
    }),
    latest: api.syntheses.latest.handler(async ({ context, input }) => {
      return run(
        context,
        getLatestSynthesis({
          context,
          ...(input.frameKey !== undefined ? { frameKey: input.frameKey } : {}),
        }),
      );
    }),
  },
  traces: {
    recent: api.traces.recent.handler(async ({ context, input }) => {
      return run(context, listRecentTraceSpans({ context, limit: input.limit }));
    }),
  },
  voice: {
    log: api.voice.log.handler(async ({ context, input }) => {
      return run(
        context,
        logVoice({
          context,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
          ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
          spokenText: input.spokenText,
        }),
      );
    }),
  },
});

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
