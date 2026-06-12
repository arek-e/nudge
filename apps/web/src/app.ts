import { Hono } from "hono";
import type { Env } from "./env";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/health", (c) => {
    const env = c.env;

    return c.json({
      ok: true,
      service: "personal-agent-os-web",
      environment: env.ENVIRONMENT ?? "unknown",
      version: env.APP_VERSION ?? "0.0.0",
      bindings: {
        d1: Boolean(env.DB),
        dailyDigestWorkflow: Boolean(env.DAILY_DIGEST_WORKFLOW),
        userAgentSession: Boolean(env.USER_AGENT_SESSION),
      },
    });
  });

  app.get("/api/version", (c) => {
    return c.json({
      service: "personal-agent-os-web",
      version: c.env.APP_VERSION ?? "0.0.0",
    });
  });

  return app;
}
