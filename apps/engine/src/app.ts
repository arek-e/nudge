import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { implement, onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { z } from "zod";
import { Hono, type Context, type Handler } from "hono";
import { Effect, type Layer } from "effect";
import { Db, type AgentRunRecord, type DbService } from "@lares/db";
import {
  AuthService,
  buildOkfProjection,
  listOkfDirectory,
  MemoryIndex,
  PrimitiveWorkflows,
  readOkfFile,
  searchOkfFiles,
} from "@lares/effect-services";
import {
  apiContract,
  conversationMessageInputSchema,
  conversationMessageResponseSchema,
  conversationMetadataSchema,
  listRecentSignalsToolResponseSchema,
  retrieveMemoryToolResponseSchema,
} from "@lares/engine-contract";
import { listRecentTraceSpans } from "@lares/observability";
import type { Env } from "./env";
import {
  createBetterAuth,
  isBetterAuthConfigured,
  resolveBetterAuthSession,
  type AuthSessionResolver,
} from "./auth";
import { handleLaresMcpRequest } from "./mcp";
import {
  addWideEventFields,
  evlogWideEvents,
  type ObservabilityHonoEnv,
  requestObservability,
  retryAfterSecondsFor,
  runWithRequestSpan,
  serverTiming,
} from "./observability";
import { smokeTestOkfProjection, type OkfSandbox } from "./okf-sandbox";

type AppDbLayer = Layer.Layer<Db>;

async function runBetterAuthApi<T>(c: Context, run: () => Promise<T>) {
  try {
    const result = await run();
    if (result instanceof Response) return result;
    return c.json(result);
  } catch (error) {
    const status = readErrorStatus(error);
    return new Response(JSON.stringify({ error: readErrorMessage(error) }), {
      headers: { "content-type": "application/json" },
      status,
    });
  }
}

function readErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const record = error as { readonly status?: unknown; readonly statusCode?: unknown };
    if (typeof record.status === "number" && record.status >= 400 && record.status < 600) {
      return record.status;
    }
    if (
      typeof record.statusCode === "number" &&
      record.statusCode >= 400 &&
      record.statusCode < 600
    ) {
      return record.statusCode;
    }
  }
  return 401;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Authentication failed";
}

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

interface ApiContext {
  readonly agentSessions: DurableObjectNamespace;
  readonly agentInternalSecret?: string;
  readonly aiModel: string;
  readonly dailyAnalysisWorkflow: Workflow;
  readonly db: DbService;
  readonly googleAuthConfigured: boolean;
  readonly getOkfSandbox: () => Promise<OkfSandbox | null>;
  readonly recordSpan: <A>(
    name: string,
    input: {
      readonly attributes?: Readonly<Record<string, unknown>>;
      readonly kind?: "client" | "internal";
    },
    task: () => Promise<A>,
  ) => Promise<A>;
  readonly traceDb?: D1Database;
  readonly turbopuffer?: {
    readonly apiKey: string;
    readonly region: string;
  };
  readonly session: {
    readonly authMode: "better-auth" | "dev" | "unauthenticated";
    readonly user: {
      readonly id: string;
      readonly displayName: string;
    } | null;
  };
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  };
}

interface CreateAppOptions {
  readonly authSessionResolver?: AuthSessionResolver;
  readonly dbLayer?: AppDbLayer;
  readonly okfSandboxFactory?: (input: {
    readonly env: Env;
    readonly user: { readonly displayName: string; readonly id: string };
  }) => Promise<OkfSandbox | null> | OkfSandbox | null;
}

async function defaultOkfSandboxFactory(input: {
  readonly env: Env;
  readonly user: { readonly displayName: string; readonly id: string };
}) {
  if (!input.env.OKF_SANDBOX) return null;
  const { getSandbox } = await import("@cloudflare/sandbox");
  const sandbox = getSandbox(
    input.env.OKF_SANDBOX as Parameters<typeof getSandbox>[0],
    `okf-${input.user.id}`,
  );
  return {
    ...(input.env.OKF_FILES
      ? {
          deletePrefix: (prefix: string) => deleteR2Prefix(input.env.OKF_FILES!, prefix),
          mountBucket: (bucket, mountPath, options) =>
            sandbox.mountBucket(bucket, mountPath, {
              ...options,
              ...(input.env.ENVIRONMENT === "local" ? { localBucket: true as const } : {}),
            }),
          putObject: (key: string, content: string) =>
            input.env.OKF_FILES!.put(key, content, {
              httpMetadata: { contentType: "text/markdown; charset=utf-8" },
            }),
        }
      : {}),
    exec: (command, options) => sandbox.exec(command, options),
    mkdir: (path, options) => sandbox.mkdir(path, options),
    writeFile: (path, content) => sandbox.writeFile(path, content),
  } satisfies OkfSandbox;
}

async function deleteR2Prefix(bucket: R2Bucket, prefix: string, cursor?: string): Promise<void> {
  const page = await bucket.list(cursor ? { cursor, prefix } : { prefix });
  const keys = page.objects.map((object) => object.key);
  if (keys.length > 0) await bucket.delete(keys);
  if (page.truncated) await deleteR2Prefix(bucket, prefix, page.cursor);
}

const api = implement(apiContract).$context<ApiContext>();

export const apiRouter = api.router({
  actions: {
    list: api.actions.list.handler(async ({ context, input }) => {
      const [actions, latestRuns] = await Promise.all([
        Effect.runPromise(
          context.db.listExtractedItems({
            limit: input.limit,
            userId: context.user.id,
            ...(input.status !== undefined ? { status: input.status } : {}),
          }),
        ),
        Effect.runPromise(
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
      const action = await Effect.runPromise(
        context.db.updateExtractedItemStatus({
          itemId: input.itemId,
          status: input.status,
          userId: context.user.id,
        }),
      );
      await Effect.runPromise(
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
  account: {
    delete: api.account.delete.handler(async ({ context }) => {
      const turbopuffer = context.turbopuffer;
      if (turbopuffer) {
        await runMemoryIndex(
          context.db,
          turbopuffer,
          Effect.gen(function* () {
            const memoryIndex = yield* MemoryIndex;
            return yield* memoryIndex.deleteUserNamespace({ user: context.user });
          }),
        );
      }
      await Effect.runPromise(context.db.deleteUserData({ userId: context.user.id }));
      return { deleted: true };
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
      const url = new URL("https://lares.local/tools/list-recent-signals");
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
      const url = new URL("https://lares.local/tools/retrieve-memory");
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
        context.db,
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
    const exported = await Effect.runPromise(context.db.exportUserData(context.user));
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
      const exported = await Effect.runPromise(context.db.exportUserData(context.user));
      const projection = buildOkfProjection(exported);
      return { entries: listOkfDirectory(projection, input.path), path: input.path };
    }),
    readFile: api.okf.readFile.handler(async ({ context, input }) => {
      const exported = await Effect.runPromise(context.db.exportUserData(context.user));
      const projection = buildOkfProjection(exported);
      return { content: readOkfFile(projection, input.path), path: input.path };
    }),
    search: api.okf.search.handler(async ({ context, input }) => {
      const exported = await Effect.runPromise(context.db.exportUserData(context.user));
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
      const exported = await Effect.runPromise(context.db.exportUserData(context.user));
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
        context.db,
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
        context.db,
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
      const document = await Effect.runPromise(
        context.db.getJournalDocument({ localDate: input.localDate, userId: context.user.id }),
      );
      return { document };
    }),
    save: api.journal.save.handler(async ({ context, input }) => {
      await Effect.runPromise(context.db.ensureUser(context.user));
      const result = await Effect.runPromise(
        context.db.upsertJournalDocument({
          bodyText: input.bodyText,
          ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
          localDate: input.localDate,
          title: input.title,
          userId: context.user.id,
        }),
      );
      const noteResult = await Effect.runPromise(
        context.db.upsertDailyNote({
          bodyText: input.bodyText,
          ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
          localDate: input.localDate,
          title: input.title,
          userId: context.user.id,
        }),
      );
      let analysisRun: AgentRunRecord | null = null;
      if (result.revision.changedText.trim().length > 0) {
        analysisRun = await Effect.runPromise(
          context.db.startAgentRun({
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
          }),
        );
        const queuedRun = analysisRun;
        await context.recordSpan(
          "daily_note.analysis_workflow.create",
          {
            attributes: {
              "lares.ai.source_type": "note_revision",
              "lares.ai.system": "cloudflare-think",
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
                revisionId: result.revision.id,
                runId: queuedRun.id,
                title: result.document.title,
                userDisplayName: context.user.displayName,
                userId: context.user.id,
                workflowVersion: 1,
              },
            }),
        );
        await Effect.runPromise(
          context.db.upsertMemoryDocument({
            bodyText: noteResult.note.bodyText,
            localDate: noteResult.note.localDate,
            sourceId: noteResult.note.id,
            sourceType: "daily_note",
            title: noteResult.note.title,
            userId: context.user.id,
          }),
        );
        await Effect.runPromise(
          context.db.upsertMemoryDocument({
            bodyText: noteResult.revision.changedText,
            localDate: noteResult.note.localDate,
            sourceId: noteResult.revision.id,
            sourceType: "note_revision",
            title: `${noteResult.note.title} delta`,
            userId: context.user.id,
          }),
        );
        await Effect.runPromise(
          context.db.upsertMemoryDocument({
            bodyText: result.revision.changedText,
            localDate: result.document.localDate,
            sourceId: result.revision.id,
            sourceType: "journal_revision",
            title: result.document.title,
            userId: context.user.id,
          }),
        );
        const turbopuffer = context.turbopuffer;
        if (turbopuffer) {
          await context.recordSpan(
            "memory.index_pending",
            {
              attributes: {
                "lares.memory_index.provider": "turbopuffer",
                "turbopuffer.region": turbopuffer.region,
              },
              kind: "client",
            },
            async () => {
              await runMemoryIndex(
                context.db,
                turbopuffer,
                Effect.gen(function* () {
                  const memoryIndex = yield* MemoryIndex;
                  return yield* memoryIndex.indexPending({ limit: 20, user: context.user });
                }),
              ).catch((error: unknown) => {
                const safeError = error instanceof Error ? error : new Error("Memory index failed");
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
        }
      }
      return { ...result, ...(analysisRun ? { analysisRun } : {}) };
    }),
  },
  signals: {
    list: api.signals.list.handler(async ({ context, input }) => {
      const signals = await runWorkflow(
        context.db,
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
      const summaries = await Effect.runPromise(
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
      authMethods: {
        emailOtp: context.session.authMode !== "dev",
        google: context.session.authMode !== "dev" && context.googleAuthConfigured,
        passkey: context.session.authMode !== "dev",
      },
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
        { attributes: { "lares.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.db,
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
        context.db,
        PrimitiveWorkflows.listPendingProposals({ limit: input.limit ?? 20, user: context.user }),
      );

      return { proposals: proposals.map(toProposalResponse) };
    }),
  },
  commitments: {
    list: api.commitments.list.handler(async ({ context, input }) => {
      const commitments = await runWorkflow(
        context.db,
        PrimitiveWorkflows.listCommitments({ limit: input.limit ?? 20, user: context.user }),
      );

      return { commitments: [...commitments] };
    }),
  },
  reviews: {
    create: api.reviews.create.handler(async ({ context, input }) => {
      return runWorkflow(
        context.db,
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
        context.db,
        PrimitiveWorkflows.listOutcomes({ limit: input.limit ?? 20, user: context.user }),
      );

      return { outcomes: [...outcomes] };
    }),
    create: api.outcomes.create.handler(async ({ context, input }) => {
      return runWorkflow(
        context.db,
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
        { attributes: { "lares.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.db,
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
        { attributes: { "lares.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.db,
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
      return {
        spans: await Effect.runPromise(listRecentTraceSpans(context.traceDb, input.limit ?? 20)),
      };
    }),
  },
  voice: {
    log: api.voice.log.handler(async ({ context, input }) => {
      const route = classifyVoiceLogRoute(input.spokenText);
      const spokenResponse =
        route === "reasoning_candidate"
          ? "Understood. I'm processing it in Lares."
          : "Understood. I logged it to Lares.";
      const capture = await runWorkflow(
        context.db,
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

async function proxyConversationRequest<Schema extends z.ZodType>(
  agentSessions: DurableObjectNamespace,
  internalSecret: string | undefined,
  user: { readonly id: string; readonly displayName: string },
  conversationId: string,
  pathOrUrl: string | URL,
  schema: Schema,
  init: { readonly body?: BodyInit; readonly method?: string } = {},
): Promise<z.infer<Schema>> {
  const agentId = agentSessions.idFromName(`${user.id}:${conversationId}`);
  const agent = agentSessions.get(agentId);
  const url =
    typeof pathOrUrl === "string" ? new URL(`https://lares.local${pathOrUrl}`) : pathOrUrl;
  const internalSignature = internalSecret
    ? await signAgentRequest(internalSecret, user.id, conversationId)
    : undefined;
  const requestInit = {
    headers: {
      "content-type": "application/json",
      "x-lares-conversation-id": conversationId,
      "x-lares-user-display-name": user.displayName,
      "x-lares-user-id": user.id,
      ...(internalSignature !== undefined
        ? { "x-lares-internal-signature": internalSignature }
        : {}),
    },
    method: init.method ?? "GET",
    ...(init.body !== undefined ? { body: init.body } : {}),
  } satisfies RequestInit;
  const response = await agent.fetch(new Request(url.toString(), requestInit));

  if (!response.ok) {
    throw new Error(`Conversation agent request failed with ${response.status}`);
  }

  return schema.parse(await response.json());
}

function conversationStreamPath(path: string) {
  const match = /^\/api\/conversations\/([^/]+)\/messages\/stream$/.exec(path);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function proxyConversationStream(
  agentSessions: DurableObjectNamespace,
  internalSecret: string | undefined,
  user: { readonly id: string; readonly displayName: string },
  conversationId: string,
  message: string,
): Promise<Response> {
  const agentId = agentSessions.idFromName(`${user.id}:${conversationId}`);
  const agent = agentSessions.get(agentId);
  const internalSignature = internalSecret
    ? await signAgentRequest(internalSecret, user.id, conversationId)
    : undefined;
  const response = await agent.fetch(
    new Request("https://lares.local/messages/stream", {
      body: JSON.stringify({ message }),
      headers: {
        "content-type": "application/json",
        "x-lares-conversation-id": conversationId,
        "x-lares-user-display-name": user.displayName,
        "x-lares-user-id": user.id,
        ...(internalSignature !== undefined
          ? { "x-lares-internal-signature": internalSignature }
          : {}),
      },
      method: "POST",
    }),
  );

  if (!response.ok) {
    throw new Error(`Conversation agent stream failed with ${response.status}`);
  }

  return response;
}

async function signAgentRequest(secret: string, userId: string, conversationId: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}:${conversationId}`),
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

function runWorkflow<A, E>(db: DbService, workflow: Effect.Effect<A, E, Db>) {
  return Effect.runPromise(Effect.provideService(workflow, Db, db));
}

function runMemoryIndex<A, E>(
  db: DbService,
  turbopuffer: { readonly apiKey: string; readonly region: string },
  workflow: Effect.Effect<A, E, Db | MemoryIndex>,
) {
  return Effect.runPromise(
    Effect.provide(workflow, MemoryIndex.layerTurbopuffer(turbopuffer)).pipe(
      Effect.provideService(Db, db),
    ),
  );
}

function makeApiHandler() {
  return new OpenAPIHandler(apiRouter, {
    interceptors: [
      onError((error) => {
        const safeError = error instanceof Error ? error : new Error("Unknown API handler error");
        console.warn(
          JSON.stringify({
            event: "api_handler_error",
            logKind: "wide_event",
            service: "lares-web",
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
            title: "Lares API",
            version: "0.1.0",
          },
        },
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specPath: "/openapi.json",
      }),
    ],
  });
}

function resolveDb(layer: AppDbLayer) {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        return yield* Db;
      }),
      layer,
    ),
  );
}

async function resolveCurrentUser(input: {
  readonly env: Env;
  readonly headers: Headers;
  readonly resolveSession: AuthSessionResolver;
}) {
  const session = await input.resolveSession({ env: input.env, headers: input.headers });
  if (session) {
    const user = {
      displayName: session.user.name ?? session.user.email ?? "Lares User",
      id: session.user.id,
    };
    return {
      authMode: "better-auth" as const,
      user,
    };
  }

  if (isBetterAuthConfigured(input.env)) {
    return {
      authMode: "unauthenticated" as const,
      user: null,
    };
  }

  if (
    input.env.ENVIRONMENT !== "local" &&
    input.env.ENVIRONMENT !== "test" &&
    input.env.ALLOW_DEV_AUTH !== "true"
  ) {
    return {
      authMode: "unauthenticated" as const,
      user: null,
    };
  }

  return {
    authMode: "dev" as const,
    user: await Effect.runPromise(Effect.provide(currentUser, AuthService.layerDev)),
  };
}

const currentUser = Effect.gen(function* () {
  const auth = yield* AuthService;
  return yield* auth.currentUser;
});

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<ObservabilityHonoEnv>();
  const apiHandler = makeApiHandler();
  const sharedDb = options.dbLayer ? resolveDb(options.dbLayer) : undefined;
  const okfSandboxFactory = options.okfSandboxFactory ?? defaultOkfSandboxFactory;
  const resolveSession = options.authSessionResolver ?? resolveBetterAuthSession;

  app.use("*", evlogWideEvents());
  app.use("*", requestObservability());
  app.use("*", serverTiming());

  const versionHandler: Handler<ObservabilityHonoEnv> = (c) => {
    addWideEventFields(c, { routeName: "api.version" });
    return c.json({
      service: "lares-web",
      version: c.env.APP_VERSION ?? "0.0.0",
    });
  };

  app.get("/api/version", versionHandler);
  app.get("/api/version/", versionHandler);

  app.get("/manifest.webmanifest", (c) => {
    addWideEventFields(c, { routeName: "manifest" });
    return c.json({
      name: "Lares",
      short_name: "Lares",
      description: "A private daily operating loop for personal context and follow-through.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      background_color: "#111111",
      theme_color: "#111111",
      categories: ["productivity", "lifestyle"],
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "/icons/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
      shortcuts: [
        {
          name: "Today",
          short_name: "Today",
          description: "Open today's operating loop.",
          url: "/",
          icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
        },
      ],
    });
  });

  app.get("/offline.html", (c) => {
    addWideEventFields(c, { routeName: "pwa.offline" });
    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#111111" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Lares" />
    <title>Lares Offline</title>
  </head>
  <body><main><p>Lares</p><h1>You are offline</h1><p>Reconnect to sync your daily operating loop and talk to Lares.</p></main></body>
</html>`);
  });

  app.get("/icons/icon.svg", (c) => {
    addWideEventFields(c, { routeName: "pwa.icon" });
    c.header("content-type", "image/svg+xml; charset=utf-8");
    return c.body(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111111"/><path d="M256 96c70.7 0 128 57.3 128 128 0 96-128 192-128 192S128 320 128 224c0-70.7 57.3-128 128-128Z" fill="#f4f1eb"/><circle cx="256" cy="224" r="56" fill="#111111"/></svg>`,
    );
  });

  app.post("/__internal/auth/test-account", async (c) => {
    addWideEventFields(c, { routeName: "internal.auth.seed" });
    const configuredSecret = c.env.AUTH_SEED_SECRET;
    const providedSecret = c.req.header("x-lares-seed-secret");
    if (!configuredSecret || providedSecret !== configuredSecret) {
      return c.notFound();
    }

    const body = await c.req.json<{
      readonly email?: string;
      readonly name?: string;
      readonly password?: string;
    }>();
    if (!body.email || !body.name || !body.password) {
      return c.json({ error: "email, name, and password are required" }, 400);
    }

    await createBetterAuth(c.env, { allowSignUpForSeed: true }).api.signUpEmail({
      body: {
        email: body.email,
        name: body.name,
        password: body.password,
      },
    });

    return c.json({ created: true });
  });

  app.on(["GET", "POST", "OPTIONS"], "/mcp", async (c) => {
    addWideEventFields(c, { routeName: "mcp" });
    const db = await runWithRequestSpan(
      c,
      {
        attributes: { "db.system.name": "cloudflare-d1" },
        kind: "client",
        name: "db.resolve",
      },
      () => (sharedDb ? sharedDb : resolveDb(Db.layerD1(c.env.DB))),
    );
    const auth = await runWithRequestSpan(
      c,
      { attributes: { "lares.auth.provider": "better-auth" }, name: "auth.current_user" },
      () => resolveCurrentUser({ env: c.env, headers: c.req.raw.headers, resolveSession }),
    );
    if (!auth.user) return c.json({ error: "Authentication required" }, 401);
    return handleLaresMcpRequest(c.req.raw, {
      db,
      user: auth.user,
      version: c.env.APP_VERSION ?? "0.0.0",
    });
  });

  app.get("/api/auth/passkey/generate-register-options", async (c) => {
    addWideEventFields(c, { routeName: "api.auth" });
    if (!isBetterAuthConfigured(c.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(c.env);
    return runBetterAuthApi(c, () =>
      auth.api.generatePasskeyRegistrationOptions({
        asResponse: true,
        headers: c.req.raw.headers,
        query: {
          ...(c.req.query("authenticatorAttachment")
            ? {
                authenticatorAttachment: c.req.query("authenticatorAttachment") as
                  | "platform"
                  | "cross-platform",
              }
            : {}),
          ...(c.req.query("context") ? { context: c.req.query("context") } : {}),
          ...(c.req.query("name") ? { name: c.req.query("name") } : {}),
        },
      }),
    );
  });

  app.post("/api/auth/passkey/verify-registration", async (c) => {
    addWideEventFields(c, { routeName: "api.auth" });
    if (!isBetterAuthConfigured(c.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(c.env);
    return runBetterAuthApi(c, async () =>
      auth.api.verifyPasskeyRegistration({
        asResponse: true,
        body: await c.req.json(),
        headers: c.req.raw.headers,
      }),
    );
  });

  app.get("/api/auth/passkey/generate-authenticate-options", async (c) => {
    addWideEventFields(c, { routeName: "api.auth" });
    if (!isBetterAuthConfigured(c.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(c.env);
    return runBetterAuthApi(c, () =>
      auth.api.generatePasskeyAuthenticationOptions({
        asResponse: true,
        headers: c.req.raw.headers,
      }),
    );
  });

  app.post("/api/auth/passkey/verify-authentication", async (c) => {
    addWideEventFields(c, { routeName: "api.auth" });
    if (!isBetterAuthConfigured(c.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    const auth = createBetterAuth(c.env);
    return runBetterAuthApi(c, async () =>
      auth.api.verifyPasskeyAuthentication({
        asResponse: true,
        body: await c.req.json(),
        headers: c.req.raw.headers,
      }),
    );
  });

  app.on(["GET", "POST"], "/api/auth/*", (c) => {
    addWideEventFields(c, { routeName: "api.auth" });
    if (!isBetterAuthConfigured(c.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    if (c.req.path.startsWith("/api/auth/passkey/")) {
      const url = new URL(c.req.url);
      url.pathname = url.pathname.replace("/api/auth", "");
      return createBetterAuth(c.env).handler(new Request(url, c.req.raw));
    }

    return createBetterAuth(c.env).handler(c.req.raw);
  });

  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/captures")) {
      addWideEventFields(c, { routeName: "api.captures" });
    } else if (c.req.path.startsWith("/api/conversations")) {
      addWideEventFields(c, { routeName: "api.conversations" });
      if (c.req.path.includes("/tools/list-recent-signals")) {
        addWideEventFields(c, { agentTool: "listRecentSignals" });
      } else if (c.req.path.includes("/tools/retrieve-memory")) {
        addWideEventFields(c, { agentTool: "retrieveMemory" });
      }
    } else if (c.req.path.startsWith("/api/signals")) {
      addWideEventFields(c, { routeName: "api.signals" });
    } else if (c.req.path.startsWith("/api/syntheses")) {
      addWideEventFields(c, { routeName: "api.syntheses" });
    } else if (c.req.path.startsWith("/api/proposals")) {
      addWideEventFields(c, { routeName: "api.proposals" });
    } else if (c.req.path.startsWith("/api/commitments")) {
      addWideEventFields(c, { routeName: "api.commitments" });
    } else if (c.req.path.startsWith("/api/reviews")) {
      addWideEventFields(c, { routeName: "api.reviews" });
    } else if (c.req.path.startsWith("/api/outcomes")) {
      addWideEventFields(c, { routeName: "api.outcomes" });
    } else if (c.req.path.startsWith("/api/traces")) {
      addWideEventFields(c, { routeName: "api.traces" });
    } else if (c.req.path.startsWith("/api/voice")) {
      addWideEventFields(c, { routeName: "api.voice" });
    } else if (c.req.path.startsWith("/api/events")) {
      addWideEventFields(c, { routeName: "api.events" });
    } else if (c.req.path.startsWith("/api/session")) {
      addWideEventFields(c, { routeName: "api.session" });
    } else if (c.req.path.startsWith("/api/export")) {
      addWideEventFields(c, { routeName: "api.export" });
    } else if (c.req.path.startsWith("/api/okf")) {
      addWideEventFields(c, { routeName: "api.okf" });
    } else if (c.req.path.startsWith("/api/account")) {
      addWideEventFields(c, { routeName: "api.account" });
    }

    const db = await runWithRequestSpan(
      c,
      {
        attributes: { "db.system.name": "cloudflare-d1" },
        kind: "client",
        name: "db.resolve",
      },
      () => (sharedDb ? sharedDb : resolveDb(Db.layerD1(c.env.DB))),
    );
    const auth = await runWithRequestSpan(
      c,
      { attributes: { "lares.auth.provider": "better-auth" }, name: "auth.current_user" },
      () => resolveCurrentUser({ env: c.env, headers: c.req.raw.headers, resolveSession }),
    );
    if (!auth.user && !c.req.path.startsWith("/api/session")) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const user = auth.user ?? { displayName: "Unauthenticated", id: "unauthenticated" };
    const recordSpan: ApiContext["recordSpan"] = (name, input, task) =>
      runWithRequestSpan(c, { ...input, name }, task);
    const streamConversationId = conversationStreamPath(c.req.path);
    if (streamConversationId && c.req.method === "POST") {
      const input = conversationMessageInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!input.success) {
        return c.json({ error: "Invalid conversation message" }, 400);
      }
      return proxyConversationStream(
        c.env.USER_AGENT_SESSION,
        c.env.AGENT_INTERNAL_SECRET ?? c.env.BETTER_AUTH_SECRET,
        user,
        streamConversationId,
        input.data.message,
      );
    }

    const result = await runWithRequestSpan(
      c,
      { attributes: { "rpc.system": "orpc" }, name: "orpc.handle" },
      () =>
        apiHandler.handle(c.req.raw, {
          context: {
            agentSessions: c.env.USER_AGENT_SESSION,
            ...((c.env.AGENT_INTERNAL_SECRET ?? c.env.BETTER_AUTH_SECRET)
              ? { agentInternalSecret: c.env.AGENT_INTERNAL_SECRET ?? c.env.BETTER_AUTH_SECRET }
              : {}),
            aiModel: c.env.THINK_MODEL,
            dailyAnalysisWorkflow: c.env.DAILY_DIGEST_WORKFLOW,
            db,
            googleAuthConfigured: Boolean(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
            getOkfSandbox: () => Promise.resolve(okfSandboxFactory({ env: c.env, user })),
            recordSpan,
            session: auth,
            traceDb: c.env.DB,
            ...(c.env.TURBOPUFFER_API_KEY
              ? {
                  turbopuffer: {
                    apiKey: c.env.TURBOPUFFER_API_KEY,
                    region: c.env.TURBOPUFFER_REGION ?? "aws-eu-west-1",
                  },
                }
              : {}),
            user,
          },
          prefix: "/api",
        }),
    );

    if (result.matched) {
      return c.newResponse(result.response.body, result.response);
    }

    await next();
  });

  app.onError((error, c) => {
    const retryAfterSeconds = retryAfterSecondsFor(error);
    const status = retryAfterSeconds === null ? 500 : 503;
    addWideEventFields(c, {
      status,
      outcome: "error",
      errorType: error.name,
      errorMessage: error.message,
      ...(retryAfterSeconds !== null
        ? { retryAfterSeconds, resilienceKind: "transient_backpressure" }
        : {}),
    });

    if (retryAfterSeconds !== null) {
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json({ error: "Service temporarily unavailable", retryAfterSeconds }, 503);
    }

    return c.json({ error: "Internal Server Error" }, status);
  });

  app.get("/", (c) => {
    addWideEventFields(c, { routeName: "today" });

    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#111111" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Lares" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="mobile-web-app-capable" content="yes" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/icon.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <title>Lares Daily Operating Loop</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0d1117;
        color: #f4efe8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(196, 167, 111, 0.24), transparent 30rem),
          linear-gradient(180deg, #15120f 0%, #0d1117 52%, #080a0f 100%);
      }
      main {
        width: min(100%, 44rem);
        margin: 0 auto;
        padding: max(1rem, env(safe-area-inset-top)) 1rem max(2rem, env(safe-area-inset-bottom));
      }
      header {
        padding: 1.5rem 0 1rem;
      }
      .eyebrow {
        margin: 0 0 0.5rem;
        color: #c4a76f;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.3rem, 13vw, 4.8rem);
        line-height: 0.9;
        letter-spacing: -0.08em;
      }
      .summary {
        margin: 1rem 0 0;
        color: #c9d1d9;
        font-size: 1.05rem;
        line-height: 1.55;
      }
      .card {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid rgba(244, 239, 232, 0.14);
        border-radius: 1.5rem;
        background: rgba(13, 17, 23, 0.72);
        box-shadow: 0 1.25rem 4rem rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(18px);
      }
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 750;
      }
      textarea {
        width: 100%;
        min-height: 9rem;
        resize: vertical;
        border: 1px solid rgba(244, 239, 232, 0.18);
        border-radius: 1rem;
        padding: 0.9rem;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        font: inherit;
        line-height: 1.45;
      }
      button, a.button {
        display: inline-flex;
        min-height: 3rem;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        padding: 0 1rem;
        background: #c4a76f;
        color: #15120f;
        font: inherit;
        font-weight: 800;
        text-decoration: none;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
        margin-top: 0.9rem;
      }
      .secondary {
        background: rgba(244, 239, 232, 0.1) !important;
        color: #f4efe8 !important;
      }
      #status {
        min-height: 1.5rem;
        margin: 0.85rem 0 0;
        color: #c9d1d9;
      }
      #proposal-status {
        min-height: 1.5rem;
        margin: 0.85rem 0 0;
        color: #c9d1d9;
      }
      ul {
        display: grid;
        gap: 0.75rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        border: 1px solid rgba(244, 239, 232, 0.1);
        border-radius: 1rem;
        padding: 0.85rem;
        background: rgba(255, 255, 255, 0.04);
      }
      .event-type {
        color: #c4a76f;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .event-note {
        margin-top: 0.35rem;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .proposal-title {
        margin: 0;
        font-size: 1rem;
      }
      .proposal-body, .proposal-rationale {
        margin: 0.45rem 0 0;
        color: #c9d1d9;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .proposal-rationale {
        font-size: 0.9rem;
      }
      @media (min-width: 40rem) {
        main { padding-inline: 1.5rem; }
        .actions { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">Lares</p>
        <h1>Daily Operating Loop</h1>
        <p class="summary">Your private operating layer for what changed, what matters now, and what Lares should remember before it helps you act.</p>
      </header>

      <section class="card" aria-labelledby="today-title">
        <p class="eyebrow">Today</p>
        <h2 id="today-title">Start with the current state</h2>
        <p class="summary">Capture priorities, constraints, energy, and follow-ups. Lares stores this as user-owned context for the Daily Operating Loop.</p>
      </section>

      <section class="card" aria-labelledby="check-in-title">
        <h2 id="check-in-title">Morning check-in</h2>
        <form id="check-in-form">
          <label for="note">What should Lares know this morning?</label>
          <textarea id="note" name="note" autocomplete="off" placeholder="Priorities, energy, constraints, people to follow up with..."></textarea>
          <div class="actions">
            <button type="submit">Save check-in</button>
            <a class="button secondary" href="/api/docs">API docs</a>
          </div>
          <p id="status" role="status"></p>
        </form>
      </section>

      <section class="card" aria-labelledby="proposals-title">
        <h2 id="proposals-title">Agent proposals</h2>
        <ul id="proposals"><li>Loading proposals...</li></ul>
        <p id="proposal-status" role="status"></p>
      </section>

      <section class="card" aria-labelledby="events-title">
        <h2 id="events-title">Recent events</h2>
        <ul id="events"><li>Loading events...</li></ul>
      </section>
    </main>
    <script>
      const form = document.querySelector('#check-in-form');
      const note = document.querySelector('#note');
      const status = document.querySelector('#status');
      const events = document.querySelector('#events');
      const proposals = document.querySelector('#proposals');
      const proposalStatus = document.querySelector('#proposal-status');

      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        });
      }

      async function loadEvents() {
        const response = await fetch('/api/events');
        const body = await response.json();
        events.innerHTML = '';
        if (!body.events.length) {
          events.innerHTML = '<li>No events yet. Save the first check-in.</li>';
          return;
        }
        for (const event of body.events) {
          const item = document.createElement('li');
          const text = event.payload && typeof event.payload.note === 'string' ? event.payload.note : JSON.stringify(event.payload);
          item.innerHTML = '<div class="event-type"></div><div class="event-note"></div>';
          item.querySelector('.event-type').textContent = event.type;
          item.querySelector('.event-note').textContent = text;
          events.append(item);
        }
      }

      async function loadProposals() {
        const response = await fetch('/api/proposals');
        const body = await response.json();
        proposals.innerHTML = '';
        if (!body.proposals.length) {
          proposals.innerHTML = '<li>No proposals waiting for review.</li>';
          return;
        }
        for (const proposal of body.proposals) {
          const item = document.createElement('li');
          item.innerHTML = [
            '<h3 class="proposal-title"></h3>',
            '<p class="proposal-body"></p>',
            '<p class="proposal-rationale"></p>',
            '<div class="actions">',
            '<button type="button" data-decision="accepted">Accept</button>',
            '<button class="secondary" type="button" data-decision="rejected">Reject</button>',
            '</div>',
          ].join('');
          item.querySelector('.proposal-title').textContent = proposal.title;
          item.querySelector('.proposal-body').textContent = proposal.body;
          item.querySelector('.proposal-rationale').textContent = proposal.rationale;
          for (const button of item.querySelectorAll('button')) {
            button.addEventListener('click', () => reviewProposal(proposal.id, button.dataset.decision));
          }
          proposals.append(item);
        }
      }

      async function reviewProposal(proposalId, decision) {
        proposalStatus.textContent = 'Saving review...';
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ proposalId, decision }),
        });
        if (!response.ok) {
          proposalStatus.textContent = 'Could not save review. Check the deployment logs.';
          return;
        }
        proposalStatus.textContent = 'Review saved.';
        await loadProposals();
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Saving...';
        const value = note.value.trim();
        if (!value) {
          status.textContent = 'Write a short check-in first.';
          return;
        }
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'manual_check_in_submitted',
            source: 'today_app',
            occurredAt: new Date().toISOString(),
            schemaVersion: 1,
            payload: { note: value },
          }),
        });
        if (!response.ok) {
          status.textContent = 'Could not save. Check the deployment logs.';
          return;
        }
        note.value = '';
        status.textContent = 'Saved. This is now in the user-owned event log.';
        await loadEvents();
      });

      loadEvents().catch(() => {
        events.innerHTML = '<li>Could not load events. Check the deployment logs.</li>';
      });
      loadProposals().catch(() => {
        proposals.innerHTML = '<li>Could not load proposals. Check the deployment logs.</li>';
      });
    </script>
  </body>
</html>`);
  });

  app.get("/health", (c) => {
    const env = c.env;
    addWideEventFields(c, { routeName: "health" });

    return c.json({
      ok: true,
      service: "lares-web",
      environment: env.ENVIRONMENT ?? "unknown",
      version: env.APP_VERSION ?? "0.0.0",
      bindings: {
        d1: Boolean(env.DB),
        dailyDigestWorkflow: Boolean(env.DAILY_DIGEST_WORKFLOW),
        userAgentSession: Boolean(env.USER_AGENT_SESSION),
      },
    });
  });

  app.get("/__test/error", (c) => {
    if (c.env.ENVIRONMENT !== "test") {
      return c.notFound();
    }

    addWideEventFields(c, { routeName: "test.error" });
    if (c.req.query("kind") === "transient") {
      throw new Error("D1_ERROR: database is locked");
    }
    throw new Error("test failure");
  });

  return app;
}
