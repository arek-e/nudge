import { describe, expect, test } from "bun:test";
import type { Env } from "./env";
import { createApp } from "./app";

const env = {
  DB: {} as D1Database,
  DAILY_DIGEST_WORKFLOW: {} as Workflow,
  USER_AGENT_SESSION: {} as DurableObjectNamespace,
  ENVIRONMENT: "test",
  APP_VERSION: "test-version",
} satisfies Env;

describe("web app", () => {
  test("GET /health reports service and binding availability", async () => {
    const app = createApp();
    const response = await app.request("/health", {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: "personal-agent-os-web",
      environment: "test",
      version: "test-version",
      bindings: {
        d1: true,
        dailyDigestWorkflow: true,
        userAgentSession: true,
      },
    });
  });

  test("GET /api/version reports service version", async () => {
    const app = createApp();
    const response = await app.request("/api/version", {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      service: "personal-agent-os-web",
      version: "test-version",
    });
  });
});
