import { describe, expect, spyOn, test } from "bun:test";
import { Db } from "@lares/db";
import { readHttpTelemetrySnapshot } from "@lares/observability";
import type { Env } from "./env";
import { createApp } from "./app";

const env = {
  DB: {} as D1Database,
  TRACE_ARTIFACTS: {} as R2Bucket,
  DAILY_DIGEST_WORKFLOW: {} as Workflow,
  USER_AGENT_SESSION: {} as DurableObjectNamespace,
  ENVIRONMENT: "test",
  APP_VERSION: "test-version",
  BETTER_AUTH_URL: "http://localhost:8787",
  LOG_HTTP_REQUESTS: "false",
} satisfies Env;

const createTraceDb = () => {
  const rows: Array<ReadonlyArray<unknown>> = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...values: ReadonlyArray<unknown>) => ({
        run: async () => {
          if (sql.includes("INSERT INTO trace_events")) rows.push(values);
          return { success: true };
        },
      }),
    }),
  } as D1Database;

  return { db, rows };
};

describe("web app", () => {
  test("GET / serves the Lares Daily Operating Loop app", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/", {}, env);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("viewport");
    expect(body).toContain('rel="manifest"');
    expect(body).toContain('name="theme-color"');
    expect(body).toContain("Today");
    expect(body).toContain("Daily Operating Loop");
    expect(body).toContain("Capture");
    expect(body).toContain("/api/events");
    expect(body).not.toContain("QA build");
    expect(body).not.toContain("smoke test");
  });

  test("GET /health reports service and binding availability", async () => {
    const app = createApp();
    const response = await app.request("/health", {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: "lares-web",
      environment: "test",
      version: "test-version",
      bindings: {
        d1: true,
        dailyDigestWorkflow: true,
        userAgentSession: true,
      },
    });
  });

  test("GET /manifest.webmanifest exposes PWA install metadata", async () => {
    const app = createApp();
    const response = await app.request("/manifest.webmanifest", {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: "Lares",
      display: "standalone",
      theme_color: "#111111",
      icons: [expect.objectContaining({ src: "/icons/icon.svg" })],
    });
  });

  test("GET /api/auth/session is unavailable until Better Auth is configured", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/api/auth/session", {}, env);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Better Auth is not configured" });
  });

  test("GET /api/auth/sign-up/email does not expose public sign-up by default", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request(
      "/api/auth/sign-up/email",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test User",
          password: "password1234",
        }),
      },
      {
        ...env,
        BETTER_AUTH_SECRET: "test-secret",
      },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("POST /__internal/auth/test-account stays hidden without the seed secret", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request(
      "/__internal/auth/test-account",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "alek@teampitch.app",
          name: "Alek",
          password: "Demo1234",
        }),
      },
      env,
    );

    expect(response.status).toBe(404);
  });

  test("GET /health exposes request observability headers", async () => {
    const app = createApp();
    const response = await app.request("/health", { headers: { "cf-ray": "test-ray" } }, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("test-ray");
    expect(response.headers.get("traceparent")).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");
  });

  test("GET /health continues valid incoming trace context", async () => {
    const incomingTraceId = "0af7651916cd43dd8448eb211c80319c";
    const incomingSpanId = "b7ad6b7169203331";
    const app = createApp();

    const response = await app.request(
      "/health",
      { headers: { traceparent: `00-${incomingTraceId}-${incomingSpanId}-01` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("traceparent")).toMatch(
      new RegExp(`^00-${incomingTraceId}-[a-f0-9]{16}-01$`),
    );
  });

  test("GET /health records request telemetry meters", async () => {
    const app = createApp();
    const before = await readHttpTelemetrySnapshot();

    await app.request("/health", {}, env);

    const after = await readHttpTelemetrySnapshot();

    expect(after.requestCount).toBe(before.requestCount + 1);
    expect(after.statusCodes["200"]).toBe((before.statusCodes["200"] ?? 0) + 1);
    expect(after.durationSamples).toBe(before.durationSamples + 1);
  });

  test("GET /health emits a wide request completion log", async () => {
    const app = createApp();
    const consoleLog = spyOn(console, "log").mockImplementation(() => {});

    try {
      await app.request(
        "/health",
        {
          headers: {
            "cf-ray": "test-ray",
            "user-agent": "test-agent",
          },
        },
        { ...env, LOG_HTTP_REQUESTS: "true" },
      );

      const log = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]));
      expect(log.event).toMatchObject({
        event: "http_request_completed",
        logKind: "wide_event",
        service: "lares-web",
        environment: "test",
        version: "test-version",
        requestId: "test-ray",
        cfRay: "test-ray",
        method: "GET",
        path: "/health",
        status: 200,
        statusGroup: "2xx",
        outcome: "success",
        routeName: "health",
        userAgent: "test-agent",
      });
      expect(typeof log.event.durationMs).toBe("number");
      expect(typeof log.event.timestamp).toBe("string");
    } finally {
      consoleLog.mockRestore();
    }
  });

  test("GET /health persists a safe trace event", async () => {
    const app = createApp();
    const traceDb = createTraceDb();

    const response = await app.request(
      "/health",
      { headers: { "cf-ray": "persisted-ray", "user-agent": "persist-test" } },
      { ...env, DB: traceDb.db },
    );

    expect(response.status).toBe(200);
    expect(traceDb.rows).toHaveLength(1);
    expect(traceDb.rows[0]).toEqual([
      expect.any(String),
      expect.any(String),
      "http_request_completed",
      "wide_event",
      "lares-web",
      "test",
      "test-version",
      "persisted-ray",
      "health",
      "GET",
      "/health",
      200,
      "success",
      expect.any(Number),
      "default",
      null,
      expect.stringContaining("persisted-ray"),
      expect.any(String),
    ]);
  });

  test("GET /health persists a root request trace span", async () => {
    const spanRows: Array<ReadonlyArray<unknown>> = [];
    const traceDb = {
      prepare: (sql: string) => ({
        bind: (...values: ReadonlyArray<unknown>) => ({
          run: async () => {
            if (sql.includes("INSERT INTO trace_spans")) spanRows.push(values);
            return { success: true };
          },
        }),
      }),
    } as D1Database;
    const app = createApp();

    const response = await app.request(
      "/health",
      { headers: { "cf-ray": "span-ray", "user-agent": "span-test" } },
      { ...env, DB: traceDb },
    );

    expect(response.status).toBe(200);
    expect(spanRows).toHaveLength(1);
    expect(spanRows[0]).toEqual([
      expect.stringMatching(/^[a-f0-9]{32}$/),
      expect.stringMatching(/^[a-f0-9]{16}$/),
      null,
      "GET /health",
      "server",
      "ok",
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      "lares-web",
      "test",
      "test-version",
      "span-ray",
      "health",
      "GET",
      "/health",
      200,
      "success",
      expect.any(String),
      expect.any(String),
    ]);
  });

  test("POST /api/syntheses records framework and primitive child spans", async () => {
    const spanRows: Array<ReadonlyArray<unknown>> = [];
    const traceDb = {
      prepare: (sql: string) => ({
        bind: (...values: ReadonlyArray<unknown>) => ({
          run: async () => {
            if (sql.includes("INSERT INTO trace_spans")) spanRows.push(values);
            return { success: true };
          },
        }),
      }),
    } as D1Database;
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/syntheses",
      {
        method: "POST",
        headers: { "content-type": "application/json", "cf-ray": "synthesis-ray" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      { ...env, DB: traceDb },
    );

    const names = spanRows.map((row) => row[3]);
    const traceIds = new Set(spanRows.map((row) => row[0]));
    const rootSpan = spanRows.find((row) => row[2] === null);
    const childSpans = spanRows.filter((row) => row[2] !== null);

    expect(response.status).toBe(200);
    expect(names).toContain("POST /api/syntheses");
    expect(names).toContain("db.resolve");
    expect(names).toContain("auth.current_user");
    expect(names).toContain("orpc.handle");
    expect(names).toContain("syntheses.create");
    expect(traceIds.size).toBe(1);
    expect(rootSpan?.[1]).toEqual(expect.stringMatching(/^[a-f0-9]{16}$/));
    expect(childSpans.every((row) => row[2] === rootSpan?.[1])).toBe(true);
  });

  test("GET /api/traces/recent does not persist trace cache spans for itself", async () => {
    const spanRows: Array<ReadonlyArray<unknown>> = [];
    const traceDb = {
      prepare: (sql: string) => ({
        bind: (...values: ReadonlyArray<unknown>) => ({
          all: async () => ({ results: [] }),
          run: async () => {
            if (sql.includes("INSERT INTO trace_spans")) spanRows.push(values);
            return { success: true };
          },
        }),
      }),
    } as D1Database;
    const app = createApp();

    const response = await app.request("/api/traces/recent", {}, { ...env, DB: traceDb });

    expect(response.status).toBe(200);
    expect(spanRows).toHaveLength(0);
  });

  test("GET /api/version bypasses db and auth spans", async () => {
    const spanRows: Array<ReadonlyArray<unknown>> = [];
    const traceDb = {
      prepare: (sql: string) => ({
        bind: (...values: ReadonlyArray<unknown>) => ({
          run: async () => {
            if (sql.includes("INSERT INTO trace_spans")) spanRows.push(values);
            return { success: true };
          },
        }),
      }),
    } as D1Database;
    const app = createApp();

    const response = await app.request("/api/version", {}, { ...env, DB: traceDb });

    expect(response.status).toBe(200);
    expect(spanRows.map((row) => row[3])).toEqual(["GET /api/version"]);
  });

  test("request errors still emit one wide request completion log", async () => {
    const app = createApp();
    const consoleLog = spyOn(console, "log").mockImplementation(() => {});

    try {
      const response = await app.request(
        "/__test/error",
        { headers: { "cf-ray": "error-ray" } },
        { ...env, LOG_HTTP_REQUESTS: "true" },
      );

      const log = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]));

      expect(response.status).toBe(500);
      expect(consoleLog.mock.calls).toHaveLength(1);
      expect(log.event).toMatchObject({
        event: "http_request_completed",
        logKind: "wide_event",
        requestId: "error-ray",
        path: "/__test/error",
        status: 500,
        statusGroup: "5xx",
        outcome: "error",
        errorType: "Error",
        errorMessage: "test failure",
        sampled: true,
        sampleReason: "error",
      });
    } finally {
      consoleLog.mockRestore();
    }
  });

  test("transient pressure errors return retry-after instead of generic failure", async () => {
    const app = createApp();
    const consoleLog = spyOn(console, "log").mockImplementation(() => {});

    try {
      const response = await app.request(
        "/__test/error?kind=transient",
        { headers: { "cf-ray": "pressure-ray" } },
        { ...env, LOG_HTTP_REQUESTS: "true" },
      );

      const log = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]));

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("5");
      expect(await response.json()).toEqual({
        error: "Service temporarily unavailable",
        retryAfterSeconds: 5,
      });
      expect(log.event).toMatchObject({
        status: 503,
        statusGroup: "5xx",
        outcome: "error",
        resilienceKind: "transient_backpressure",
        retryAfterSeconds: 5,
      });
    } finally {
      consoleLog.mockRestore();
    }
  });

  test("GET /api/version reports service version", async () => {
    const app = createApp();
    const response = await app.request("/api/version", {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      service: "lares-web",
      version: "test-version",
    });
  });

  test("GET /api/traces/recent lists safe trace span summaries", async () => {
    const rows = [
      {
        id: "span-1",
        trace_id: "trace-1",
        parent_span_id: null,
        name: "GET /health",
        kind: "server",
        status: "ok",
        started_at: "2026-06-12T10:00:00.000Z",
        ended_at: "2026-06-12T10:00:00.125Z",
        duration_ms: 125,
        route_name: "health",
        method: "GET",
        path: "/health",
      },
    ];
    let capturedSelectSql = "";
    const traceDb = {
      prepare: (sql: string) => {
        if (sql.includes("SELECT")) capturedSelectSql = sql;
        return {
          bind: () => ({
            all: async () => ({ results: sql.includes("trace_spans") ? rows : [] }),
            run: async () => ({ success: true }),
          }),
        };
      },
    } as D1Database;
    const app = createApp();

    const response = await app.request("/api/traces/recent", {}, { ...env, DB: traceDb });

    expect(response.status).toBe(200);
    expect(capturedSelectSql).toContain("span_id AS id");
    expect(capturedSelectSql).toContain("route_name != 'api.traces'");
    expect(await response.json()).toEqual({
      spans: [
        {
          id: "span-1",
          traceId: "trace-1",
          parentSpanId: null,
          name: "GET /health",
          kind: "server",
          status: "ok",
          startedAt: "2026-06-12T10:00:00.000Z",
          endedAt: "2026-06-12T10:00:00.125Z",
          durationMs: 125,
          routeName: "health",
          method: "GET",
          path: "/health",
        },
      ],
    });
  });

  test("GET /api/conversations/:conversationId/tools/list-recent-signals forwards to the agent session", async () => {
    const forwardedRequests: Array<Request> = [];
    const agentNamespace = {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: async (request: Request) => {
          forwardedRequests.push(request);
          return Response.json({
            conversationId: "focus",
            tool: "listRecentSignals",
            signals: [
              {
                id: "signal-1",
                userId: "dev-user",
                type: "capture.note",
                source: "test",
                occurredAt: "2026-06-12T10:00:00.000Z",
                schemaVersion: 1,
                payload: { note: "Read-only context" },
                createdAt: "2026-06-12T10:00:00.000Z",
              },
            ],
          });
        },
      }),
    } as DurableObjectNamespace;
    const app = createApp();
    const consoleLog = spyOn(console, "log").mockImplementation(() => {});

    let response: Response;
    let loggedEvent: unknown;
    try {
      response = await app.request(
        "/api/conversations/focus/tools/list-recent-signals?limit=5",
        {},
        { ...env, LOG_HTTP_REQUESTS: "true", USER_AGENT_SESSION: agentNamespace },
      );
      loggedEvent = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])).event;
    } finally {
      consoleLog.mockRestore();
    }

    expect(response.status).toBe(200);
    expect(forwardedRequests).toHaveLength(1);
    expect(new URL(forwardedRequests[0]!.url).pathname).toBe("/tools/list-recent-signals");
    expect(new URL(forwardedRequests[0]!.url).searchParams.get("limit")).toBe("5");
    expect(forwardedRequests[0]!.headers.get("x-lares-conversation-id")).toBe("focus");
    expect(loggedEvent).toMatchObject({
      agentTool: "listRecentSignals",
      routeName: "api.conversations",
    });
    expect(await response.json()).toEqual({
      conversationId: "focus",
      tool: "listRecentSignals",
      signals: [
        {
          id: "signal-1",
          userId: "dev-user",
          type: "capture.note",
          source: "test",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { note: "Read-only context" },
          createdAt: "2026-06-12T10:00:00.000Z",
        },
      ],
    });
  });

  test("GET /api/conversations/:conversationId returns conversation metadata", async () => {
    const forwardedRequests: Array<Request> = [];
    const agentNamespace = {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: async (request: Request) => {
          forwardedRequests.push(request);
          return Response.json({
            conversationId: "focus",
            userId: "dev-user",
            createdAt: null,
            updatedAt: null,
            recentToolEvents: [],
            tools: ["listRecentSignals"],
          });
        },
      }),
    } as DurableObjectNamespace;
    const app = createApp();

    const response = await app.request(
      "/api/conversations/focus",
      {},
      { ...env, USER_AGENT_SESSION: agentNamespace },
    );

    expect(response.status).toBe(200);
    expect(forwardedRequests).toHaveLength(1);
    expect(new URL(forwardedRequests[0]!.url).pathname).toBe("/metadata");
    expect(forwardedRequests[0]!.headers.get("x-lares-conversation-id")).toBe("focus");
    expect(await response.json()).toEqual({
      conversationId: "focus",
      userId: "dev-user",
      createdAt: null,
      updatedAt: null,
      recentToolEvents: [],
      tools: ["listRecentSignals"],
    });
  });

  test("custom integrations can append and list current user's events", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const appendResponse = await app.request(
      "/api/events",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "manual_check_in_submitted",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { mood: "focused" },
        }),
      },
      env,
    );

    const listResponse = await app.request("/api/events", {}, env);

    expect(appendResponse.status).toBe(200);
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      events: [
        expect.objectContaining({
          userId: "dev-user",
          type: "manual_check_in_submitted",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { mood: "focused" },
        }),
      ],
    });
  });

  test("custom integrations can inspect the current session workspace", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request("/api/session", {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authMode: "dev",
      user: { id: "dev-user", displayName: "Dev User" },
      workspace: { id: "dev-user", label: "Dev User's workspace" },
    });
  });

  test("custom integrations resolve workspace from a Better Auth session", async () => {
    const app = createApp({
      authSessionResolver: async () => ({
        user: {
          email: "lana@example.com",
          id: "auth-user-1",
          name: "Lana",
        },
      }),
      dbLayer: Db.layerMemory,
    });

    const response = await app.request("/api/session", {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authMode: "better-auth",
      user: { id: "auth-user-1", displayName: "Lana" },
      workspace: { id: "auth-user-1", label: "Lana's workspace" },
    });
  });

  test("custom integrations can export and delete the current user's data", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    await app.request(
      "/api/captures",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_context_captured",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { note: "export this" },
        }),
      },
      env,
    );

    const exportResponse = await app.request("/api/export", {}, env);
    const exported = await exportResponse.json();
    const deleteResponse = await app.request("/api/account/delete", { method: "POST" }, env);
    const afterDeleteResponse = await app.request("/api/export", {}, env);

    expect(exportResponse.status).toBe(200);
    expect(exported).toMatchObject({
      user: { id: "dev-user", displayName: "Dev User" },
      events: [expect.objectContaining({ payload: { note: "export this" } })],
    });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ deleted: true });
    expect(await afterDeleteResponse.json()).toMatchObject({
      user: { id: "dev-user", displayName: "Dev User" },
      events: [],
      commitments: [],
      outcomes: [],
      proposals: [],
      syntheses: [],
    });
  });

  test("custom integrations can capture and list signals using primitive routes", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const captureResponse = await app.request(
      "/api/captures",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_context_captured",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          idempotencyKey: "capture-api-retry-1",
          payload: { note: "primitive route" },
        }),
      },
      env,
    );
    const retriedCaptureResponse = await app.request(
      "/api/captures",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_context_captured",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          idempotencyKey: "capture-api-retry-1",
          payload: { note: "primitive route" },
        }),
      },
      env,
    );

    const signalsResponse = await app.request("/api/signals", {}, env);
    const body = await signalsResponse.json();
    const capture = await captureResponse.json();
    const retriedCapture = await retriedCaptureResponse.json();

    expect(captureResponse.status).toBe(200);
    expect(retriedCapture.id).toBe(capture.id);
    expect(signalsResponse.status).toBe(200);
    expect(body.signals).toEqual([
      expect.objectContaining({
        userId: "dev-user",
        type: "user_context_captured",
        payload: { note: "primitive route" },
      }),
    ]);
  });

  test("custom integrations can generate a source-linked synthesis for the current frame", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    await app.request(
      "/api/captures",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_context_captured",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { note: "Traveling today" },
        }),
      },
      env,
    );

    const response = await app.request(
      "/api/syntheses",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const latestResponse = await app.request(
      "/api/syntheses/latest?frameKey=current_state",
      {},
      env,
    );
    const synthesis = await response.json();
    const latest = await latestResponse.json();

    expect(response.status).toBe(200);
    expect(synthesis.frame).toMatchObject({
      key: "current_state",
      title: "What matters now?",
    });
    expect(synthesis.synthesis).toMatchObject({
      summary: "1 signal captured. Latest: Traveling today",
      themes: ["travel"],
      openQuestions: ["What needs attention next?"],
    });
    expect(synthesis.synthesis.sourceSignalIds).toHaveLength(1);
    expect(latest).toEqual(synthesis);
  });

  test("custom integrations can generate proposals and review one", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    await app.request(
      "/api/captures",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_context_captured",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { note: "Traveling today" },
        }),
      },
      env,
    );
    await app.request(
      "/api/syntheses",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );

    const generateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const retriedGenerateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const listBeforeReviewResponse = await app.request("/api/proposals", {}, env);
    const listBeforeReview = await listBeforeReviewResponse.json();
    const retriedGenerate = await retriedGenerateResponse.json();
    const proposal = listBeforeReview.proposals[0];
    const reviewResponse = await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, decision: "accepted" }),
      },
      env,
    );
    const listAfterReviewResponse = await app.request("/api/proposals", {}, env);

    expect(generateResponse.status).toBe(200);
    expect(retriedGenerate.proposals.map((item: { id: string }) => item.id)).toEqual(
      listBeforeReview.proposals.map((item: { id: string }) => item.id),
    );
    expect(listBeforeReviewResponse.status).toBe(200);
    expect(listBeforeReview.proposals).toEqual([
      expect.objectContaining({
        kind: "clarify",
        status: "pending",
        title: "Clarify next attention point",
      }),
    ]);
    expect(reviewResponse.status).toBe(200);
    expect(await reviewResponse.json()).toEqual(
      expect.objectContaining({ proposalId: proposal.id, decision: "accepted" }),
    );
    expect(await listAfterReviewResponse.json()).toEqual({ proposals: [] });
  });

  test("custom integrations can list commitments and record outcomes", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    await app.request(
      "/api/syntheses",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const generateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const { proposals } = await generateResponse.json();

    await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposals[0].id, decision: "accepted" }),
      },
      env,
    );
    const retriedReviewResponse = await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposals[0].id, decision: "accepted" }),
      },
      env,
    );
    const commitmentsResponse = await app.request("/api/commitments", {}, env);
    const { commitments } = await commitmentsResponse.json();
    const outcomeResponse = await app.request(
      "/api/outcomes",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commitmentId: commitments[0].id,
          result: "completed",
          note: "Handled in planning.",
        }),
      },
      env,
    );
    const retriedOutcomeResponse = await app.request(
      "/api/outcomes",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commitmentId: commitments[0].id,
          result: "completed",
          note: "Handled in planning.",
        }),
      },
      env,
    );
    const outcomesResponse = await app.request("/api/outcomes", {}, env);
    const activeAfterOutcomeResponse = await app.request("/api/commitments", {}, env);

    expect(retriedReviewResponse.status).toBe(200);
    expect(commitmentsResponse.status).toBe(200);
    expect(commitments).toEqual([
      expect.objectContaining({
        status: "active",
        title: "Clarify next attention point",
      }),
    ]);
    expect(outcomeResponse.status).toBe(200);
    const outcome = await outcomeResponse.json();
    expect(outcome).toEqual(
      expect.objectContaining({
        commitmentId: commitments[0].id,
        result: "completed",
        note: "Handled in planning.",
      }),
    );
    expect(await retriedOutcomeResponse.json()).toEqual(outcome);
    expect(await outcomesResponse.json()).toEqual({ outcomes: [outcome] });
    expect(await activeAfterOutcomeResponse.json()).toEqual({ commitments: [] });
  });

  test("custom integrations can persist rich edited commitment documents", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const editedBodyDocument = [{ type: "p", children: [{ text: "Send the travel follow-up." }] }];

    await app.request(
      "/api/syntheses",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const generateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const { proposals } = await generateResponse.json();

    await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposalId: proposals[0].id,
          decision: "edited",
          editedTitle: "Confirm travel follow-up",
          editedBody: "Send the travel follow-up.",
          editedBodyDocument,
        }),
      },
      env,
    );
    const commitmentsResponse = await app.request("/api/commitments", {}, env);

    expect(await commitmentsResponse.json()).toEqual({
      commitments: [
        expect.objectContaining({
          title: "Confirm travel follow-up",
          body: "Send the travel follow-up.",
          bodyDocument: editedBodyDocument,
        }),
      ],
    });
  });

  test("custom integrations can list events by occurred-at time range", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    await Promise.all(
      (
        [
          ["outside_before", "2026-06-01T09:00:00.000Z"],
          ["inside_range", "2026-06-08T09:00:00.000Z"],
          ["outside_after", "2026-06-15T09:00:00.000Z"],
        ] as const
      ).map(([type, occurredAt]) =>
        app.request(
          "/api/events",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type,
              source: "api",
              occurredAt,
              schemaVersion: 1,
              payload: {},
            }),
          },
          env,
        ),
      ),
    );

    const response = await app.request(
      "/api/events?from=2026-06-07T00:00:00.000Z&to=2026-06-14T23:59:59.999Z",
      {},
      env,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events.map((event: { type: string }) => event.type)).toEqual(["inside_range"]);
  });

  test("GET /api/openapi.json documents the public events API", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/api/openapi.json", {}, env);
    const spec = await response.json();

    expect(response.status).toBe(200);
    expect(spec.info).toEqual({
      title: "Lares API",
      version: "0.1.0",
    });
    expect(spec.paths["/events"].get).toMatchObject({
      operationId: "events.list",
    });
    expect(
      spec.paths["/events"].get.parameters.map((parameter: { name: string }) => parameter.name),
    ).toEqual(expect.arrayContaining(["from", "to", "limit"]));
    expect(spec.paths["/events"].post).toMatchObject({
      operationId: "events.append",
    });
    expect(spec.paths["/captures"].post).toMatchObject({
      operationId: "captures.append",
    });
    expect(spec.paths["/signals"].get).toMatchObject({
      operationId: "signals.list",
    });
    expect(spec.paths["/commitments"].get).toMatchObject({
      operationId: "commitments.list",
    });
    expect(spec.paths["/outcomes"].get).toMatchObject({
      operationId: "outcomes.list",
    });
    expect(spec.paths["/outcomes"].post).toMatchObject({
      operationId: "outcomes.create",
    });
    expect(spec.paths["/conversations/{conversationId}"].get).toMatchObject({
      operationId: "conversations.get",
    });
    expect(
      spec.paths["/conversations/{conversationId}/tools/list-recent-signals"].get,
    ).toMatchObject({
      operationId: "conversations.listRecentSignals",
    });
  });

  test("GET /api/docs serves human-readable API documentation", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/api/docs", {}, env);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Lares API");
  });
});
