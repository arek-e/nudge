import { Agent } from "agents";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "./env";
import { createApp } from "./app";

const app = createApp();

export default app;

export class UserAgentSession extends Agent<Env> {
  async onRequest() {
    return Response.json({
      ok: true,
      role: "user-agent-session",
      note: "Cloudflare Agents SDK session coordination will attach here.",
    });
  }
}

export interface DailyDigestWorkflowParams {
  userId: string;
  requestedBy: "api" | "cron";
}

export class DailyDigestWorkflow extends WorkflowEntrypoint<Env, DailyDigestWorkflowParams> {
  async run(event: WorkflowEvent<DailyDigestWorkflowParams>, step: WorkflowStep) {
    const input = event.payload;

    return await step.do("daily-digest-health-check", async () => ({
      ok: true,
      workflow: "daily-digest-workflow",
      userId: input.userId,
      requestedBy: input.requestedBy,
    }));
  }
}
