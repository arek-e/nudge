import { Think } from "@cloudflare/think";
import { Agent } from "agents";
import { generateObject, type LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { Effect } from "effect";
import { Db } from "@lares/db";
import {
  currentWorkflowVersion,
  durableWorkflowStepConfig,
  MemoryIndex,
  PrimitiveWorkflows,
  workflowStepName,
  type WorkflowVersion,
} from "@lares/effect-services";
import type { Env } from "./env";
import { createApp } from "./app";

const app = createApp();

export default app;

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
  readonly userId: string;
}

interface LaresUserRef {
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
  readonly user: LaresUserRef;
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

type ThinkDailyNoteExtraction = z.infer<typeof thinkDailyNoteExtractionSchema> & {
  readonly fallbackReason?: string;
  readonly model: string;
  readonly provider: "cloudflare-think" | "deterministic";
};

const reasoningHarness = {
  name: "think" as const,
  runtime: "cloudflare-agents" as const,
};

const initialUserAgentSessionState = {
  conversationId: null,
  createdAt: null,
  recentMemoryRetrievalsAt: [],
  recentToolEvents: [],
  updatedAt: null,
  userId: "dev-user",
} satisfies UserAgentSessionState;

const normalizeDedupe = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 96);

const titleCaseFragment = (text: string) => {
  const cleaned = text.replaceAll(/^(need to|i should|should|remember to)\s+/gi, "").trim();
  if (!cleaned) return "Review note";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const deterministicDailyNoteExtraction = (
  changedText: string,
  localDate: string,
  fallbackReason: string,
): ThinkDailyNoteExtraction => {
  const items: ThinkDailyNoteExtraction["items"] = [];
  for (const part of changedText
    .split(/\n|\.|;|!/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    const lower = part.toLowerCase();
    const base = { body: part, confidence: 0.82 };
    if (/\b(next week|tomorrow|party|meeting|appointment|birthday)\b/.test(lower)) {
      items.push({ ...base, kind: "reminder", title: titleCaseFragment(part) });
    } else if (/\b(need to|should|todo|to do|write to|call|send|follow up)\b/.test(lower)) {
      items.push({
        ...base,
        kind: lower.includes("follow up") ? "follow_up" : "task",
        title: titleCaseFragment(part),
      });
    } else if (/\b(remember|prefers|likes|important|completed|done|finished)\b/.test(lower)) {
      items.push({ ...base, kind: "memory", title: titleCaseFragment(part) });
    }
  }

  return {
    dailySummary: `Executive summary: ${changedText.trim().slice(0, 500)}`,
    fallbackReason,
    items: items.map((item) => ({
      ...item,
      title: item.title || `Review ${normalizeDedupe(item.body)}`,
    })),
    model: "deterministic-delta-extractor",
    provider: "deterministic",
  };
};

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
    return {
      displayName: request.headers.get("x-lares-user-display-name") ?? "Lares User",
      id: request.headers.get("x-lares-user-id") ?? "dev-user",
    };
  }

  private async verifyInternalRequest(
    request: Request,
    user: LaresUserRef,
    conversationId: string,
  ) {
    const secret = this.env.AGENT_INTERNAL_SECRET ?? this.env.BETTER_AUTH_SECRET;
    if (!secret) return true;
    const providedSignature = request.headers.get("x-lares-internal-signature");
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
    const conversationId = request.headers.get("x-lares-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    if (!(await this.verifyInternalRequest(request, user, conversationId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const state = this.state ?? initialUserAgentSessionState;

    return Response.json({
      conversationId,
      userId: state.userId,
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
    const conversationId = request.headers.get("x-lares-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    if (!(await this.verifyInternalRequest(request, user, conversationId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10), 1), 50);
    const signals = await Effect.runPromise(
      Effect.provide(
        PrimitiveWorkflows.listSignals({
          user,
          limit,
        }),
        Db.layerD1(this.env.DB),
      ),
    );
    const timestamp = new Date().toISOString();
    const previous = this.state ?? initialUserAgentSessionState;

    this.setState({
      conversationId,
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt: previous.recentMemoryRetrievalsAt ?? [],
      recentToolEvents: [
        { at: timestamp, resultCount: signals.length, tool: "listRecentSignals" as const },
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
    const conversationId = request.headers.get("x-lares-conversation-id") ?? "default";
    const user = this.resolveUser(request);
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
    const retrieved = await Effect.runPromise(
      Effect.gen(function* () {
        const memoryIndex = yield* MemoryIndex;
        return yield* memoryIndex.retrieve({ limit, query, user });
      }).pipe(Effect.provide(memoryIndexLayer), Effect.provide(Db.layerD1(this.env.DB))),
    );
    const timestamp = now.toISOString();

    this.setState({
      conversationId,
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt,
      recentToolEvents: [
        { at: timestamp, resultCount: retrieved.results.length, tool: "retrieveMemory" as const },
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

  private async reply(request: Request) {
    const conversationId = request.headers.get("x-lares-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    if (!(await this.verifyInternalRequest(request, user, conversationId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as { readonly message?: string };
    const message = String(body.message ?? "").trim();
    const previous = this.state ?? initialUserAgentSessionState;
    const now = new Date();
    const recentMemoryRetrievalsAt = this.reserveMemoryRetrieval(previous, now);
    const memoryResults = recentMemoryRetrievalsAt
      ? await this.retrieveMemoryResults(user, message, 5)
      : [];
    const intake = await this.subAgent(LoopIntakeThinkAgent, "current-state");
    const draft = await intake.draftFromMessage({ conversationId, memoryResults, message, user });
    const timestamp = now.toISOString();

    this.setState({
      conversationId,
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt: recentMemoryRetrievalsAt ?? previous.recentMemoryRetrievalsAt ?? [],
      recentToolEvents: [
        { at: timestamp, resultCount: draft.draft ? 1 : 0, tool: "reply" as const },
        { at: timestamp, resultCount: memoryResults.length, tool: "retrieveMemory" as const },
        ...previous.recentToolEvents,
      ].slice(0, 20),
      updatedAt: timestamp,
      userId: user.id,
    });

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

  private async interpretJournal(request: Request) {
    const user = this.resolveUser(request);
    if (!(await this.verifyInternalRequest(request, user, "journal"))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as {
      readonly changedText?: string;
      readonly documentId?: string;
      readonly localDate?: string;
      readonly revisionId?: string;
    };
    const changedText = String(body.changedText ?? "").trim();
    const localDate = String(body.localDate ?? "today");
    let extraction: ThinkDailyNoteExtraction = {
      items: [],
      model: this.env.THINK_MODEL,
      provider: "cloudflare-think",
    };
    if (changedText.length > 0) {
      const intake = await this.subAgent(LoopIntakeThinkAgent, "journal-current-state");
      extraction = await intake.extractDailyNote({ changedText, localDate });
    }
    const timestamp = new Date().toISOString();
    const previous = this.state ?? initialUserAgentSessionState;
    this.setState({
      conversationId: "journal",
      createdAt: previous.createdAt ?? timestamp,
      recentMemoryRetrievalsAt: previous.recentMemoryRetrievalsAt ?? [],
      recentToolEvents: [
        { at: timestamp, resultCount: changedText.length > 0 ? 1 : 0, tool: "reply" as const },
        ...previous.recentToolEvents,
      ].slice(0, 20),
      updatedAt: timestamp,
      userId: user.id,
    });

    return Response.json(extraction);
  }

  private async retrieveMemoryResults(user: LaresUserRef, query: string, limit: number) {
    if (query.trim().length === 0) return [];
    try {
      const memoryIndexLayer = this.env.TURBOPUFFER_API_KEY
        ? MemoryIndex.layerTurbopuffer({
            apiKey: this.env.TURBOPUFFER_API_KEY,
            region: this.env.TURBOPUFFER_REGION ?? "aws-eu-west-1",
          })
        : MemoryIndex.layerMemory;
      const retrieved = await Effect.runPromise(
        Effect.gen(function* () {
          const memoryIndex = yield* MemoryIndex;
          return yield* memoryIndex.retrieve({ limit, query, user });
        }).pipe(Effect.provide(memoryIndexLayer), Effect.provide(Db.layerD1(this.env.DB))),
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
    return createWorkersAI({ binding: this.env.AI })(this.env.THINK_MODEL);
  }

  getSystemPrompt(): string {
    return [
      "You are Lares, a private operating loop agent.",
      "Interpret the user's journal or message into reviewable loop operations.",
      "Never create external side effects. Draft signals, proposals, follow-ups, and reminders for review.",
      "Prefer concrete next actions over generic advice.",
    ].join("\n");
  }

  async draftFromMessage(input: LoopIntakeDraftInput) {
    // Think owns the durable reasoning harness; this RPC seam stays stable while model-produced
    // structured output is introduced behind the same contract.
    return this.deterministicDraftFromMessage(input);
  }

  async extractDailyNote(input: {
    readonly changedText: string;
    readonly localDate: string;
  }): Promise<ThinkDailyNoteExtraction> {
    try {
      const { object } = await generateObject({
        abortSignal: AbortSignal.timeout(10_000),
        model: this.getModel(),
        prompt: [
          "Extract reviewable tasks, reminders, memories, questions, ideas, events, and follow-ups from this private daily note.",
          "Return only facts grounded in the note. Do not invent actions.",
          `Local date: ${input.localDate}`,
          `Daily note: ${input.changedText}`,
        ].join("\n"),
        schema: thinkDailyNoteExtractionSchema,
      });

      return {
        ...(object.dailySummary ? { dailySummary: object.dailySummary } : {}),
        items: object.items,
        model: this.env.THINK_MODEL,
        provider: "cloudflare-think",
      };
    } catch (error) {
      const safeError = error instanceof Error ? error : new Error("Think extraction failed");
      console.warn(
        JSON.stringify({
          event: "daily_note_think_extract_failed",
          logKind: "wide_event",
          errorType: safeError.name,
          model: this.env.THINK_MODEL,
        }),
      );
      return deterministicDailyNoteExtraction(input.changedText, input.localDate, "think_failed");
    }
  }

  private async deterministicDraftFromMessage(input: LoopIntakeDraftInput) {
    const occurredAt = new Date().toISOString();
    const signal = await Effect.runPromise(
      Effect.provide(
        PrimitiveWorkflows.appendSignal({
          idempotencyKey: `agent:${input.conversationId}:${input.message}`,
          occurredAt,
          payload: { note: input.message },
          schemaVersion: 1,
          source: "lares_agent_intake",
          type: "manual_check_in_submitted",
          user: input.user,
        }),
        Db.layerD1(this.env.DB),
      ),
    );
    await Effect.runPromise(
      Effect.provide(
        PrimitiveWorkflows.createSynthesis({ frameKey: "current_state", user: input.user }),
        Db.layerD1(this.env.DB),
      ),
    );
    const proposals = await Effect.runPromise(
      Effect.provide(
        PrimitiveWorkflows.generateProposals({ frameKey: "current_state", user: input.user }),
        Db.layerD1(this.env.DB),
      ),
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
            requiresReview: true as const,
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
  userId: string;
  requestedBy: "api" | "cron";
  workflowVersion?: WorkflowVersion;
}

export class DailyDigestWorkflow extends WorkflowEntrypoint<Env, DailyDigestWorkflowParams> {
  async run(event: WorkflowEvent<DailyDigestWorkflowParams>, step: WorkflowStep) {
    const input = event.payload;
    const workflowVersion = input.workflowVersion ?? currentWorkflowVersion;

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
}
