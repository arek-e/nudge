import { Think } from "@cloudflare/think";
export { ContainerProxy, Sandbox } from "@cloudflare/sandbox";
import { Agent } from "agents";
import { generateObject, smoothStream, streamText, type LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { Effect } from "effect";
import { Db } from "@nudge/db";
import {
  currentWorkflowVersion,
  durableWorkflowStepConfig,
  MemoryIndex,
  NoteAnalysisWorkflows,
  PrimitiveWorkflows,
  workflowStepName,
  type DailyNoteAnalysisExtractedItemInput,
  type DailyNoteAnalysisWorkflowParams,
  type WorkflowVersion,
} from "@nudge/effect-services";
import {
  createSpanId,
  createTraceId,
  parseTraceparent,
  persistTraceCacheSpan,
  traceparentHeader,
  type RuntimeTraceContext,
  type SqlInsertRow,
  withRuntimeTraceContext,
} from "@nudge/observability";
import type { Env } from "./env";
import { dailyNoteExtractionPrompt, loopIntakeSystemPrompt } from "./agent-prompts";
import { createApp } from "./app";
import {
  ensureBraintrustTracing,
  runBraintrustSpan,
  wrapBraintrustAISDK,
} from "./braintrust-tracing";
import {
  DailyNoteExtractionHttpError,
  dailyNoteAnalysisErrorCode,
  dailyNoteAnalysisExtractionStepConfig,
  dailyNoteAnalysisHttpStatus,
  dailyNoteAnalysisResponseError,
} from "./daily-note-analysis";
import { resolveDbLayerForEnv } from "./db-layer";

const app = createApp();
const tracedAI = wrapBraintrustAISDK({ generateObject, smoothStream, streamText });
const extractionModelName = (env: Env) => env.EXTRACTION_MODEL ?? env.THINK_MODEL;

export default app;

const safeRecordSpan = (env: Env) => (row: SqlInsertRow) => {
  if (typeof env.DB?.prepare !== "function") return;
  const persistence = persistTraceCacheSpan(env.DB, row).pipe(Effect.catch(() => Effect.void));
  void Effect.runPromise(persistence);
};

const runtimeTraceContextFromRequest = (
  env: Env,
  request: Request,
  service: string,
  routeName: string,
): RuntimeTraceContext => {
  const incomingTrace = parseTraceparent(request.headers.get("traceparent"));
  const traceId = incomingTrace?.traceId ?? createTraceId();
  const rootSpanId = createSpanId();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const path = new URL(request.url).pathname;

  return {
    cacheable: true,
    environment: env.ENVIRONMENT ?? "unknown",
    flags: incomingTrace?.flags ?? "01",
    method: request.method,
    parentSpanId: incomingTrace?.parentSpanId ?? rootSpanId,
    path,
    recordSpan: safeRecordSpan(env),
    requestId,
    rootSpanId,
    routeName,
    service,
    traceId,
    version: env.APP_VERSION ?? "0.0.0",
  };
};

const runtimeTraceContextFromWorkflow = (
  env: Env,
  input: NudgeWorkflowParams,
  routeName: string,
): RuntimeTraceContext => {
  const incomingTrace =
    input.kind === "daily-note-analysis" ? parseTraceparent(input.traceparent ?? null) : null;
  const traceId = incomingTrace?.traceId ?? createTraceId();
  const rootSpanId = createSpanId();

  return {
    cacheable: true,
    environment: env.ENVIRONMENT ?? "unknown",
    flags: incomingTrace?.flags ?? "01",
    method: "WORKFLOW",
    parentSpanId: incomingTrace?.parentSpanId ?? rootSpanId,
    path: routeName,
    recordSpan: safeRecordSpan(env),
    requestId: input.kind === "daily-note-analysis" ? (input.requestId ?? null) : null,
    rootSpanId,
    routeName,
    service: "nudge-workflow",
    traceId,
    version: env.APP_VERSION ?? "0.0.0",
  };
};

const runRuntimeDbEffect = <A, E>(
  env: Env,
  traceContext: RuntimeTraceContext | undefined,
  effect: Effect.Effect<A, E, Db>,
) => {
  const provided = Effect.provide(effect, resolveDbLayerForEnv(env));
  if (traceContext) return Effect.runPromise(withRuntimeTraceContext(provided, traceContext));
  return Effect.runPromise(provided);
};

const traceHeadersFromContext = (traceContext: RuntimeTraceContext) => ({
  traceparent: traceparentHeader({
    flags: traceContext.flags,
    spanId: traceContext.rootSpanId,
    traceId: traceContext.traceId,
  }),
  ...(traceContext.requestId ? { "x-request-id": traceContext.requestId } : {}),
});

interface UserAgentSessionState {
  readonly conversationId: string | null;
  readonly createdAt: string | null;
  readonly recentMemoryRetrievalsAt: ReadonlyArray<string>;
  readonly recentToolEvents: ReadonlyArray<{
    readonly at: string;
    readonly resultCount: number;
    readonly tool: "listRecentSignals" | "retrieveMemory" | "reply";
  }>;
  readonly updatedAt: string | null;
  readonly userId: string | null;
}

type RecentToolEvent = UserAgentSessionState["recentToolEvents"][number];

const recentToolEvent = (event: RecentToolEvent) => event;

interface NudgeUserRef {
  readonly displayName: string;
  readonly id: string;
}

interface LoopIntakeDraftInput {
  readonly conversationId: string;
  readonly memoryResults: ReadonlyArray<{
    readonly chunkId: string;
    readonly score: number;
    readonly sourceId: string;
    readonly sourceType: string;
    readonly text: string;
  }>;
  readonly message: string;
  readonly traceContext?: RuntimeTraceContext;
  readonly user: NudgeUserRef;
}

interface LoopIntakeReplyStreamInput extends LoopIntakeDraftInput {
  readonly draft: {
    readonly body: string;
    readonly kind: string;
    readonly rationale: string;
    readonly title: string;
  } | null;
  readonly fallbackReply: string;
}

const thinkExtractedItemSchema = z.object({
  body: z.string().min(1).max(2_000),
  confidence: z.number().min(0).max(1).optional(),
  dueAt: z.string().optional(),
  eventEndsAt: z.string().optional(),
  eventStartsAt: z.string().optional(),
  kind: z.enum(["task", "reminder", "follow_up", "event", "memory", "question", "idea"]),
  remindAt: z.string().optional(),
  title: z.string().min(1).max(200),
});

const thinkDailyNoteExtractionSchema = z.object({
  dailySummary: z.string().max(2_000).optional(),
  items: z.array(thinkExtractedItemSchema).default([]),
});

const replyRequestBodySchema = z.object({
  message: z.string().optional(),
});

const journalInterpretRequestBodySchema = z.object({
  changedText: z.string().optional(),
  documentId: z.string().optional(),
  localDate: z.string().optional(),
  revisionId: z.string().optional(),
});

const extractionHttpErrorBodySchema = z.object({
  error: z.string().optional(),
  errorCode: z.string().optional(),
});

type ThinkDailyNoteExtraction = z.infer<typeof thinkDailyNoteExtractionSchema> & {
  readonly model: string;
  readonly provider: "cloudflare-think";
};

function dailyNoteAnalysisItemsFrom(
  items: ThinkDailyNoteExtraction["items"],
): ReadonlyArray<DailyNoteAnalysisExtractedItemInput> {
  return items.map((item) => ({
    body: item.body,
    ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
    ...(item.dueAt !== undefined ? { dueAt: item.dueAt } : {}),
    ...(item.eventEndsAt !== undefined ? { eventEndsAt: item.eventEndsAt } : {}),
    ...(item.eventStartsAt !== undefined ? { eventStartsAt: item.eventStartsAt } : {}),
    kind: item.kind,
    ...(item.remindAt !== undefined ? { remindAt: item.remindAt } : {}),
    title: item.title,
  }));
}

const reasoningHarness = {
  name: "think",
  runtime: "cloudflare-agents",
};

const initialUserAgentSessionState = {
  conversationId: null,
  createdAt: null,
  recentMemoryRetrievalsAt: [],
  recentToolEvents: [],
  updatedAt: null,
  userId: null,
} satisfies UserAgentSessionState;

export class UserAgentSession extends Agent<Env, UserAgentSessionState> {
  initialState = initialUserAgentSessionState;

  async onRequest(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/metadata") {
      return this.metadata(request);
    }
    if (url.pathname === "/tools/list-recent-signals") {
      return this.listRecentSignals(request, url);
    }
    if (url.pathname === "/tools/retrieve-memory") {
      return this.retrieveMemory(request, url);
    }
    if (url.pathname === "/messages" && request.method === "POST") {
      return this.reply(request);
    }
    if (url.pathname === "/messages/stream" && request.method === "POST") {
      return this.replyStream(request);
    }
    if (url.pathname === "/journal/interpret" && request.method === "POST") {
      return this.interpretJournal(request);
    }

    return Response.json({
      ok: true,
      role: "user-agent-session",
      reasoningHarness,
      skills: ["intake-loop", "review-commitment", "close-loop"],
      subAgents: ["loopIntakeThink"],
      session: this.state,
      tools: ["listRecentSignals", "retrieveMemory"],
      workflows: ["dailyDigest"],
    });
  }

  private resolveUser(request: Request) {
    const id = request.headers.get("x-nudge-user-id");
    if (!id) return null;
    return {
      displayName: request.headers.get("x-nudge-user-display-name") ?? "Nudge User",
      id,
    };
  }

  private async verifyInternalRequest(
    request: Request,
    user: NudgeUserRef,
    conversationId: string,
  ) {
    const secret = this.env.AGENT_INTERNAL_SECRET;
    if (!secret) return true;
    const providedSignature = request.headers.get("x-nudge-internal-signature");
    if (!providedSignature) return false;
    const expectedSignature = await signAgentRequest(secret, user.id, conversationId);
    return providedSignature === expectedSignature;
  }

  private reserveMemoryRetrieval(previous: UserAgentSessionState, now: Date) {
    const windowStart = now.getTime() - 60_000;
    const recent = (previous.recentMemoryRetrievalsAt ?? []).filter(
      (timestamp) => Date.parse(timestamp) >= windowStart,
    );
    if (recent.length >= 30) return null;
    return [now.toISOString(), ...recent].slice(0, 30);
  }

  private async metadata(request: Request) {
    const conversationId = request.headers.get("x-nudge-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (!(await this.verifyInternalRequest(request, user, conversationId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const state = this.state ?? initialUserAgentSessionState;

    return Response.json({
      conversationId,
      userId: state.userId ?? user.id,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      recentToolEvents: state.recentToolEvents,
      reasoningHarness,
      skills: ["intake-loop", "review-commitment", "close-loop"],
      subAgents: ["loopIntakeThink"],
      tools: ["listRecentSignals", "retrieveMemory"],
      workflows: ["dailyDigest"],
    });
  }

  private async listRecentSignals(request: Request, url: URL) {
    const traceContext = runtimeTraceContextFromRequest(
      this.env,
      request,
      "nudge-agent",
      "agent.list_recent_signals",
    );
    const conversationId = request.headers.get("x-nudge-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (!(await this.verifyInternalRequest(request, user, conversationId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10), 1), 50);
    const signals = await runRuntimeDbEffect(
      this.env,
      traceContext,
      PrimitiveWorkflows.listSignals({
        user,
        limit,
      }),
    );
    const timestamp = new Date().toISOString();
    const previous = this.state ?? initialUserAgentSessionState;

    this.setState({
      conversationId,
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt: previous.recentMemoryRetrievalsAt ?? [],
      recentToolEvents: [
        recentToolEvent({ at: timestamp, resultCount: signals.length, tool: "listRecentSignals" }),
        ...previous.recentToolEvents,
      ].slice(0, 20),
      updatedAt: timestamp,
      userId: user.id,
    });

    return Response.json({
      conversationId,
      tool: "listRecentSignals",
      signals: signals.map((signal) => ({
        id: signal.id,
        userId: signal.userId,
        type: signal.type,
        source: signal.source,
        occurredAt: signal.occurredAt,
        schemaVersion: signal.schemaVersion,
        payload: signal.payload,
        createdAt: signal.createdAt,
      })),
    });
  }

  private async retrieveMemory(request: Request, url: URL) {
    const traceContext = runtimeTraceContextFromRequest(
      this.env,
      request,
      "nudge-agent",
      "agent.retrieve_memory",
    );
    const conversationId = request.headers.get("x-nudge-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (!(await this.verifyInternalRequest(request, user, conversationId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const query = String(url.searchParams.get("query") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 20);
    if (query.length === 0) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }
    const previous = this.state ?? initialUserAgentSessionState;
    const now = new Date();
    const recentMemoryRetrievalsAt = this.reserveMemoryRetrieval(previous, now);
    if (!recentMemoryRetrievalsAt) {
      return Response.json({ error: "memory retrieval rate limit exceeded" }, { status: 429 });
    }

    const memoryIndexLayer = this.env.TURBOPUFFER_API_KEY
      ? MemoryIndex.layerTurbopuffer({
          apiKey: this.env.TURBOPUFFER_API_KEY,
          region: this.env.TURBOPUFFER_REGION ?? "aws-eu-west-1",
        })
      : MemoryIndex.layerMemory;
    const retrieved = await runRuntimeDbEffect(
      this.env,
      traceContext,
      Effect.gen(function* () {
        const memoryIndex = yield* MemoryIndex;
        return yield* memoryIndex.retrieve({ limit, query, user });
      }).pipe(Effect.provide(memoryIndexLayer)),
    );
    const timestamp = now.toISOString();

    this.setState({
      conversationId,
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt,
      recentToolEvents: [
        recentToolEvent({
          at: timestamp,
          resultCount: retrieved.results.length,
          tool: "retrieveMemory",
        }),
        ...previous.recentToolEvents,
      ].slice(0, 20),
      updatedAt: timestamp,
      userId: user.id,
    });

    return Response.json({
      conversationId,
      tool: "retrieveMemory",
      results: retrieved.results,
    });
  }

  private async prepareReply(request: Request) {
    const traceContext = runtimeTraceContextFromRequest(
      this.env,
      request,
      "nudge-agent",
      "agent.reply",
    );
    const conversationId = request.headers.get("x-nudge-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (!(await this.verifyInternalRequest(request, user, conversationId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const body = replyRequestBodySchema.parse(await request.json());
    const message = String(body.message ?? "").trim();
    const previous = this.state ?? initialUserAgentSessionState;
    const now = new Date();
    const recentMemoryRetrievalsAt = this.reserveMemoryRetrieval(previous, now);
    const memoryResults = recentMemoryRetrievalsAt
      ? await this.retrieveMemoryResults(user, message, 5, traceContext)
      : [];
    const intake = await this.subAgent(LoopIntakeThinkAgent, "current-state");
    const draft = await intake.draftFromMessage({
      conversationId,
      memoryResults,
      message,
      traceContext,
      user,
    });
    const timestamp = now.toISOString();

    this.setState({
      conversationId,
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt: recentMemoryRetrievalsAt ?? previous.recentMemoryRetrievalsAt ?? [],
      recentToolEvents: [
        recentToolEvent({ at: timestamp, resultCount: draft.draft ? 1 : 0, tool: "reply" }),
        recentToolEvent({
          at: timestamp,
          resultCount: memoryResults.length,
          tool: "retrieveMemory",
        }),
        ...previous.recentToolEvents,
      ].slice(0, 20),
      updatedAt: timestamp,
      userId: user.id,
    });

    return { conversationId, draft, intake, memoryResults, message, user };
  }

  private async reply(request: Request) {
    const prepared = await this.prepareReply(request);
    if (prepared instanceof Response) return prepared;
    const { conversationId, draft, memoryResults, message } = prepared;

    return Response.json({
      conversationId,
      draft: draft.draft,
      memoryResults,
      message,
      reasoningHarness,
      reply: draft.reply,
      skillsApplied: ["intake-loop"],
      subAgentsUsed: ["loopIntakeThink"],
      usedTools: ["retrieveMemory", "appendSignal", "createSynthesis", "generateProposals"],
      workflowHooks: ["dailyDigest"],
    });
  }

  private async replyStream(request: Request) {
    const prepared = await this.prepareReply(request);
    if (prepared instanceof Response) return prepared;
    const { conversationId, draft, intake, memoryResults, message, user } = prepared;

    return intake.streamReplyText({
      conversationId,
      draft: draft.draft
        ? {
            body: draft.draft.proposal.body,
            kind: draft.draft.proposal.kind,
            rationale: draft.draft.proposal.rationale,
            title: draft.draft.proposal.title,
          }
        : null,
      fallbackReply: draft.reply,
      memoryResults,
      message,
      user,
    });
  }

  private async interpretJournal(request: Request) {
    const user = this.resolveUser(request);
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (!(await this.verifyInternalRequest(request, user, "journal"))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const body = journalInterpretRequestBodySchema.parse(await request.json());
    const changedText = String(body.changedText ?? "").trim();
    const localDate = String(body.localDate ?? "today");
    let extraction: ThinkDailyNoteExtraction = {
      items: [],
      model: extractionModelName(this.env),
      provider: "cloudflare-think",
    };
    if (changedText.length > 0) {
      const intake = await this.subAgent(LoopIntakeThinkAgent, "journal-current-state");
      ensureBraintrustTracing(this.env.BRAINTRUST_API_KEY);
      try {
        extraction = await runBraintrustSpan(
          {
            attributes: {
              "nudge.ai.changed_text_chars": changedText.length,
              "nudge.ai.local_date": localDate,
              "nudge.ai.revision_id": String(body.revisionId ?? ""),
              "nudge.ai.system": "cloudflare-think",
            },
            name: "journal.interpret.extract_daily_note",
            type: "task",
          },
          () => intake.extractDailyNote({ changedText, localDate }),
        );
      } catch (error) {
        const errorCode = dailyNoteAnalysisErrorCode(error);
        const safeError =
          error instanceof Error ? error : new Error("Daily note extraction failed");
        console.warn(
          JSON.stringify({
            event: "daily_note_ai_extract_request_failed",
            errorCode,
            errorType: safeError.name,
            logKind: "wide_event",
            model: extractionModelName(this.env),
            provider: "cloudflare-think",
          }),
        );
        return Response.json(
          {
            error: dailyNoteAnalysisResponseError(errorCode),
            errorCode,
          },
          { status: dailyNoteAnalysisHttpStatus(errorCode) },
        );
      }
    }
    const timestamp = new Date().toISOString();
    const previous = this.state ?? initialUserAgentSessionState;
    this.setState({
      conversationId: "journal",
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt: previous.recentMemoryRetrievalsAt ?? [],
      recentToolEvents: [
        recentToolEvent({
          at: timestamp,
          resultCount: changedText.length > 0 ? 1 : 0,
          tool: "reply",
        }),
        ...previous.recentToolEvents,
      ].slice(0, 20),
      updatedAt: timestamp,
      userId: user.id,
    });

    return Response.json(extraction);
  }

  private async retrieveMemoryResults(
    user: NudgeUserRef,
    query: string,
    limit: number,
    traceContext?: RuntimeTraceContext,
  ) {
    if (query.trim().length === 0) return [];
    try {
      const memoryIndexLayer = this.env.TURBOPUFFER_API_KEY
        ? MemoryIndex.layerTurbopuffer({
            apiKey: this.env.TURBOPUFFER_API_KEY,
            region: this.env.TURBOPUFFER_REGION ?? "aws-eu-west-1",
          })
        : MemoryIndex.layerMemory;
      const retrieved = await runRuntimeDbEffect(
        this.env,
        traceContext,
        Effect.gen(function* () {
          const memoryIndex = yield* MemoryIndex;
          return yield* memoryIndex.retrieve({ limit, query, user });
        }).pipe(Effect.provide(memoryIndexLayer)),
      );
      return [...retrieved.results];
    } catch (error) {
      const safeError = error instanceof Error ? error : new Error("Memory retrieval failed");
      console.warn(
        JSON.stringify({
          event: "memory_retrieval_failed",
          logKind: "wide_event",
          provider: this.env.TURBOPUFFER_API_KEY ? "turbopuffer" : "memory",
          errorType: safeError.name,
        }),
      );
      return [];
    }
  }
}

export class LoopIntakeThinkAgent extends Think<Env> {
  workspaceBash = false;

  getModel(): LanguageModel {
    ensureBraintrustTracing(this.env.BRAINTRUST_API_KEY);
    return createWorkersAI({ binding: this.env.AI })(this.env.THINK_MODEL);
  }

  getExtractionModel(): LanguageModel {
    ensureBraintrustTracing(this.env.BRAINTRUST_API_KEY);
    return createWorkersAI({ binding: this.env.AI })(extractionModelName(this.env));
  }

  getSystemPrompt(): string {
    return loopIntakeSystemPrompt;
  }

  async draftFromMessage(input: LoopIntakeDraftInput) {
    // Think owns the durable reasoning harness; this RPC seam stays stable while model-produced
    // structured output is introduced behind the same contract.
    return this.deterministicDraftFromMessage(input);
  }

  async streamReplyText(input: LoopIntakeReplyStreamInput) {
    const memoryContext = input.memoryResults.length
      ? input.memoryResults.map((result, index) => `${index + 1}. ${result.text}`).join("\n")
      : "No related memory found.";
    const draftContext = input.draft
      ? [
          `Draft title: ${input.draft.title}`,
          `Draft kind: ${input.draft.kind}`,
          `Draft body: ${input.draft.body}`,
          `Draft rationale: ${input.draft.rationale}`,
        ].join("\n")
      : "No review draft was created.";
    const result = tracedAI.streamText({
      abortSignal: AbortSignal.timeout(30_000),
      experimental_transform: tracedAI.smoothStream({
        chunking: "word",
        delayInMs: 20,
      }),
      model: this.getModel(),
      prompt: [
        "Write the assistant reply for this private operating-loop chat.",
        "Keep it concise, concrete, and grounded in the draft and memory context.",
        "Do not claim external side effects were completed.",
        `User: ${input.user.displayName} (${input.user.id})`,
        `Message: ${input.message}`,
        `Related memory:\n${memoryContext}`,
        `Review draft:\n${draftContext}`,
        `Fallback reply if nothing else is useful: ${input.fallbackReply}`,
      ].join("\n\n"),
      system: this.getSystemPrompt(),
    });

    return result.toTextStreamResponse({
      headers: {
        "cache-control": "no-cache",
        "x-nudge-conversation-id": input.conversationId,
      },
    });
  }

  async extractDailyNote(input: {
    readonly changedText: string;
    readonly localDate: string;
  }): Promise<ThinkDailyNoteExtraction> {
    const { object } = await tracedAI.generateObject({
      abortSignal: AbortSignal.timeout(10_000),
      model: this.getExtractionModel(),
      prompt: dailyNoteExtractionPrompt(input),
      schema: thinkDailyNoteExtractionSchema,
    });

    return {
      ...(object.dailySummary ? { dailySummary: object.dailySummary } : {}),
      items: object.items,
      model: extractionModelName(this.env),
      provider: "cloudflare-think",
    };
  }

  private async deterministicDraftFromMessage(input: LoopIntakeDraftInput) {
    const occurredAt = new Date().toISOString();
    const signal = await runRuntimeDbEffect(
      this.env,
      input.traceContext,
      PrimitiveWorkflows.appendSignal({
        idempotencyKey: `agent:${input.conversationId}:${input.message}`,
        occurredAt,
        payload: { note: input.message },
        schemaVersion: 1,
        source: "nudge_agent_intake",
        type: "manual_check_in_submitted",
        user: input.user,
      }),
    );
    await runRuntimeDbEffect(
      this.env,
      input.traceContext,
      PrimitiveWorkflows.createSynthesis({ frameKey: "current_state", user: input.user }),
    );
    const proposals = await runRuntimeDbEffect(
      this.env,
      input.traceContext,
      PrimitiveWorkflows.generateProposals({ frameKey: "current_state", user: input.user }),
    );
    const proposal = proposals[0];

    return {
      draft: proposal
        ? {
            confidence: 0.82,
            proposal: {
              id: proposal.id,
              userId: proposal.userId,
              synthesisId: proposal.synthesisId,
              kind: proposal.kind,
              status: proposal.status,
              title: proposal.title,
              body: proposal.body,
              rationale: proposal.rationale,
              createdAt: proposal.createdAt,
              updatedAt: proposal.updatedAt,
            },
            requiresReview: true,
            signal: {
              id: signal.id,
              userId: signal.userId,
              type: signal.type,
              source: signal.source,
              occurredAt: signal.occurredAt,
              schemaVersion: signal.schemaVersion,
              payload: signal.payload,
              createdAt: signal.createdAt,
            },
          }
        : null,
      reply: proposal
        ? input.memoryResults.length > 0
          ? `I found ${input.memoryResults.length} related memory and drafted a reviewable next step from your message.`
          : "I drafted a reviewable next step from your message."
        : "I captured this, but I do not have a reviewable next step yet.",
    };
  }
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

export interface DailyDigestWorkflowParams {
  kind?: "daily-digest";
  userId: string;
  requestedBy: "api" | "cron";
  workflowVersion?: WorkflowVersion;
}

type NudgeWorkflowParams = DailyDigestWorkflowParams | DailyNoteAnalysisWorkflowParams;

export class DailyDigestWorkflow extends WorkflowEntrypoint<Env, NudgeWorkflowParams> {
  async run(event: WorkflowEvent<NudgeWorkflowParams>, step: WorkflowStep) {
    const input = event.payload;
    const workflowVersion = input.workflowVersion ?? currentWorkflowVersion;

    if (input.kind === "daily-note-analysis") {
      return this.runDailyNoteAnalysis(input, workflowVersion, step);
    }

    return await step.do(
      workflowStepName(workflowVersion, "daily-digest-health-check"),
      durableWorkflowStepConfig,
      async () => ({
        ok: true,
        workflow: "daily-digest-workflow",
        workflowVersion,
        userId: input.userId,
        requestedBy: input.requestedBy,
      }),
    );
  }

  private async runDailyNoteAnalysis(
    input: DailyNoteAnalysisWorkflowParams,
    workflowVersion: WorkflowVersion,
    step: WorkflowStep,
  ) {
    const traceContext = runtimeTraceContextFromWorkflow(
      this.env,
      input,
      "workflow.daily_note_analysis",
    );
    await step.do(
      workflowStepName(workflowVersion, "daily-note-analysis-mark-running"),
      durableWorkflowStepConfig,
      async () => {
        await runRuntimeDbEffect(
          this.env,
          traceContext,
          NoteAnalysisWorkflows.markAnalysisRunRunning({
            runId: input.runId,
            userId: input.userId,
          }),
        );
      },
    );

    try {
      const extraction = await step.do(
        workflowStepName(workflowVersion, "daily-note-analysis-extract-with-think"),
        dailyNoteAnalysisExtractionStepConfig,
        async () => {
          const agentId = this.env.USER_AGENT_SESSION.idFromName(`${input.userId}:journal`);
          const agent = this.env.USER_AGENT_SESSION.get(agentId);
          const internalSecret = this.env.AGENT_INTERNAL_SECRET;
          const internalSignature = internalSecret
            ? await signAgentRequest(internalSecret, input.userId, "journal")
            : undefined;
          const response = await agent.fetch(
            new Request("https://nudge.local/journal/interpret", {
              body: JSON.stringify({
                changedText: input.changedText,
                documentId: input.documentId,
                localDate: input.localDate,
                revisionId: input.revisionId,
              }),
              headers: {
                "content-type": "application/json",
                ...traceHeadersFromContext(traceContext),
                "x-nudge-conversation-id": "journal",
                ...(internalSignature ? { "x-nudge-internal-signature": internalSignature } : {}),
                "x-nudge-user-display-name": input.userDisplayName,
                "x-nudge-user-id": input.userId,
              },
              method: "POST",
            }),
          );
          if (!response.ok) {
            let responseError: string | null = null;
            try {
              const body = extractionHttpErrorBodySchema.parse(await response.json());
              responseError = body.errorCode ?? body.error ?? null;
            } catch {
              responseError = null;
            }
            throw new DailyNoteExtractionHttpError(response.status, responseError);
          }
          return thinkDailyNoteExtractionSchema
            .extend({ model: z.string(), provider: z.literal("cloudflare-think") })
            .parse(await response.json());
        },
      );

      return await step.do(
        workflowStepName(workflowVersion, "daily-note-analysis-persist-results"),
        durableWorkflowStepConfig,
        async () => {
          const persisted = await runRuntimeDbEffect(
            this.env,
            traceContext,
            NoteAnalysisWorkflows.persistAnalysisResults({
              changedText: input.changedText,
              extraction: {
                ...(extraction.dailySummary !== undefined
                  ? { dailySummary: extraction.dailySummary }
                  : {}),
                items: dailyNoteAnalysisItemsFrom(extraction.items),
                model: extraction.model,
                provider: extraction.provider,
              },
              localDate: input.localDate,
              noteId: input.noteId,
              revisionId: input.revisionId,
              runId: input.runId,
              userId: input.userId,
            }),
          );
          console.info(
            JSON.stringify({
              event: "daily_note_ai_extract_completed",
              itemCount: persisted.itemCount,
              logKind: "wide_event",
              model: extraction.model,
              provider: "cloudflare-think",
            }),
          );
          return { itemCount: persisted.itemCount, ok: true, userId: input.userId };
        },
      );
    } catch (error) {
      const safeError = error instanceof Error ? error : new Error("Daily note analysis failed");
      const errorCode = dailyNoteAnalysisErrorCode(safeError);
      await step.do(
        workflowStepName(workflowVersion, "daily-note-analysis-mark-failed"),
        durableWorkflowStepConfig,
        async () => {
          await runRuntimeDbEffect(
            this.env,
            traceContext,
            NoteAnalysisWorkflows.markAnalysisRunFailed({
              errorCode,
              runId: input.runId,
              userId: input.userId,
            }),
          );
          console.warn(
            JSON.stringify({
              event: "daily_note_ai_extract_failed",
              errorCode,
              errorType: safeError.name,
              logKind: "wide_event",
              model: extractionModelName(this.env),
              provider: "cloudflare-think",
            }),
          );
          return { errorType: safeError.name, ok: false, userId: input.userId };
        },
      );
      throw error;
    }
  }
}
