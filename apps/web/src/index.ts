import { Agent } from "agents";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { Effect } from "effect";
import { Db } from "@lares/db";
import {
  currentWorkflowVersion,
  durableWorkflowStepConfig,
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
  readonly recentToolEvents: ReadonlyArray<{
    readonly at: string;
    readonly resultCount: number;
    readonly tool: "listRecentSignals" | "reply";
  }>;
  readonly updatedAt: string | null;
  readonly userId: string;
}

const initialUserAgentSessionState = {
  conversationId: null,
  createdAt: null,
  recentToolEvents: [],
  updatedAt: null,
  userId: "dev-user",
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
    if (url.pathname === "/messages" && request.method === "POST") {
      return this.reply(request);
    }

    return Response.json({
      ok: true,
      role: "user-agent-session",
      session: this.state,
      tools: ["listRecentSignals"],
    });
  }

  private resolveUser(request: Request) {
    return {
      displayName: request.headers.get("x-lares-user-display-name") ?? "Lares User",
      id: request.headers.get("x-lares-user-id") ?? "dev-user",
    };
  }

  private metadata(request: Request) {
    const conversationId = request.headers.get("x-lares-conversation-id") ?? "default";
    const state = this.state ?? initialUserAgentSessionState;

    return Response.json({
      conversationId,
      userId: state.userId,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      recentToolEvents: state.recentToolEvents,
      tools: ["listRecentSignals"],
    });
  }

  private async listRecentSignals(request: Request, url: URL) {
    const conversationId = request.headers.get("x-lares-conversation-id") ?? "default";
    const user = this.resolveUser(request);
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

  private async reply(request: Request) {
    const conversationId = request.headers.get("x-lares-conversation-id") ?? "default";
    const user = this.resolveUser(request);
    const body = (await request.json()) as { readonly message?: string };
    const message = String(body.message ?? "").trim();
    const occurredAt = new Date().toISOString();
    const signal = await Effect.runPromise(
      Effect.provide(
        PrimitiveWorkflows.appendSignal({
          idempotencyKey: `agent:${conversationId}:${message}`,
          occurredAt,
          payload: { note: message },
          schemaVersion: 1,
          source: "lares_agent_intake",
          type: "manual_check_in_submitted",
          user,
        }),
        Db.layerD1(this.env.DB),
      ),
    );
    await Effect.runPromise(
      Effect.provide(
        PrimitiveWorkflows.createSynthesis({ frameKey: "current_state", user }),
        Db.layerD1(this.env.DB),
      ),
    );
    const proposals = await Effect.runPromise(
      Effect.provide(
        PrimitiveWorkflows.generateProposals({ frameKey: "current_state", user }),
        Db.layerD1(this.env.DB),
      ),
    );
    const proposal = proposals[0];
    const timestamp = new Date().toISOString();
    const previous = this.state ?? initialUserAgentSessionState;

    this.setState({
      conversationId,
      createdAt: previous.createdAt ?? timestamp,
      recentToolEvents: [
        { at: timestamp, resultCount: proposal ? 1 : 0, tool: "reply" as const },
        ...previous.recentToolEvents,
      ].slice(0, 20),
      updatedAt: timestamp,
      userId: user.id,
    });

    return Response.json({
      conversationId,
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
      message,
      reply: proposal
        ? "I drafted a reviewable next step from your message."
        : "I captured this, but I do not have a reviewable next step yet.",
      usedTools: ["appendSignal", "createSynthesis", "generateProposals"],
    });
  }
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
