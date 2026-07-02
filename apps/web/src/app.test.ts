import { describe, expect, spyOn, test } from "bun:test";
import { Db } from "@nudge/db";
import { readHttpTelemetrySnapshot } from "@nudge/observability";
import type { Env } from "./env";
import type { OkfSandbox } from "./okf-sandbox";
import { createApp } from "./app";

const testAi = (() => ({ provider: "test" })) as Ai;
const testWorkflow = {
  create: async (input?: { readonly id?: string }) => ({ id: input?.id ?? "test-workflow-id" }),
} as Workflow;
const anonymousUserId = "anon_550e8400-e29b-41d4-a716-446655440000";
const anonymousUser = { id: anonymousUserId, displayName: "Anonymous User" };
const anonymousHeaders = { "x-nudge-anonymous-user-id": anonymousUserId };
const anonymousJsonHeaders = { ...anonymousHeaders, "content-type": "application/json" };
const anonymousMcpHeaders = {
  ...anonymousJsonHeaders,
  accept: "application/json, text/event-stream",
};

const env = {
  DB: {} as D1Database,
  TRACE_ARTIFACTS: {} as R2Bucket,
  DAILY_DIGEST_WORKFLOW: testWorkflow,
  USER_AGENT_SESSION: {} as DurableObjectNamespace,
  ENVIRONMENT: "test",
  APP_VERSION: "test-version",
  LOG_HTTP_REQUESTS: "false",
  CONVEX_RUNTIME_SECRET: "test-runtime-secret",
  CONVEX_URL: "https://grandiose-hamster-855.eu-west-1.convex.cloud",
  AI: testAi,
  EXTRACTION_MODEL: "@cf/zai-org/glm-4.7-flash",
  THINK_MODEL: "@cf/moonshotai/kimi-k2.6",
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
  test("GET / serves the Nudge Daily Operating Loop app", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/", {}, env);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("viewport");
    expect(body).toContain('rel="manifest"');
    expect(body).toContain('href="/favicon.ico?v=nudge"');
    expect(body).toContain('href="/icons/nudge-app-icon.svg?v=nudge"');
    expect(body).toContain('rel="apple-touch-icon"');
    expect(body).toContain('name="theme-color"');
    expect(body).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(body).toContain("navigator.serviceWorker.register('/sw.js')");
    expect(body).toContain("Today");
    expect(body).toContain("Daily Operating Loop");
    expect(body).toContain("Capture");
    expect(body).toContain("/api/events");
    expect(body).toContain("Agent proposals");
    expect(body).toContain("/api/proposals");
    expect(body).toContain("/api/reviews");
    expect(body).not.toContain("QA build");
    expect(body).not.toContain("smoke test");
  });

  test("GET /health reports service and binding availability", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/health", {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: "nudge-web",
      environment: "test",
      version: "test-version",
      bindings: {
        convex: true,
        d1: true,
        dailyDigestWorkflow: true,
        userAgentSession: true,
      },
    });
  });

  test("GET /health fails when Convex runtime store is not configured", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const { CONVEX_RUNTIME_SECRET: omittedRuntimeSecret, ...unwiredEnv } = env;
    void omittedRuntimeSecret;
    const response = await app.request("/health", {}, unwiredEnv);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      bindings: {
        convex: false,
      },
    });
  });

  test("GET /manifest.webmanifest exposes PWA install metadata", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/manifest.webmanifest", {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: "Nudge",
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      theme_color: "#1a2735",
      icons: [
        expect.objectContaining({ sizes: "192x192", src: "/icons/nudge-app-icon-192.png" }),
        expect.objectContaining({ sizes: "512x512", src: "/icons/nudge-app-icon-512.png" }),
        expect.objectContaining({ src: "/icons/nudge-app-icon.svg" }),
      ],
      shortcuts: [expect.objectContaining({ name: "Today", url: "/" })],
    });
  });

  test("GET /icons/nudge-app-icon.svg serves the Nudge app icon", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/icons/nudge-app-icon.svg", {}, env);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(body).toContain("Nudge app icon");
    expect(body).toContain("#f14f23");
  });

  test("GET /offline.html serves a PWA offline fallback", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/offline.html", {}, env);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("You are offline");
    expect(body).toContain('href="/favicon.ico?v=nudge"');
    expect(body).toContain('href="/icons/nudge-app-icon.svg?v=nudge"');
    expect(body).toContain('name="apple-mobile-web-app-capable"');
  });

  test("legacy app auth routes are no longer registered", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/api/auth/session", {}, env);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  test("POST /__internal/auth/test-account stays hidden without the seed secret", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request(
      "/__internal/auth/test-account",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
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
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/health", { headers: { "cf-ray": "test-ray" } }, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("test-ray");
    expect(response.headers.get("traceparent")).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");
  });

  test("GET /health continues valid incoming trace context", async () => {
    const incomingTraceId = "0af7651916cd43dd8448eb211c80319c";
    const incomingSpanId = "b7ad6b7169203331";
    const app = createApp({ dbLayer: Db.layerMemory });

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
    const app = createApp({ dbLayer: Db.layerMemory });
    const before = await readHttpTelemetrySnapshot();

    await app.request("/health", {}, env);

    const after = await readHttpTelemetrySnapshot();

    expect(after.requestCount).toBe(before.requestCount + 1);
    expect(after.statusCodes["200"]).toBe((before.statusCodes["200"] ?? 0) + 1);
    expect(after.durationSamples).toBe(before.durationSamples + 1);
  });

  test("GET /health emits a wide request completion log", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
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
        service: "nudge-web",
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
    const app = createApp({ dbLayer: Db.layerMemory });
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
      "nudge-web",
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
    const app = createApp({ dbLayer: Db.layerMemory });

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
      "nudge-web",
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
        headers: { ...anonymousJsonHeaders, "cf-ray": "synthesis-ray" },
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
    expect(names).toContain("app.resolve");
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
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/traces/recent",
      { headers: anonymousHeaders },
      { ...env, DB: traceDb },
    );

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
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request("/api/version", {}, { ...env, DB: traceDb });

    expect(response.status).toBe(200);
    expect(spanRows.map((row) => row[3])).toEqual(["GET /api/version"]);
  });

  test("request errors still emit one wide request completion log", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
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
    const app = createApp({ dbLayer: Db.layerMemory });
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
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/api/version", {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      service: "nudge-web",
      version: "test-version",
    });
  });

  test("GET /api/version/ reports service version", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/api/version/", {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      service: "nudge-web",
      version: "test-version",
    });
  });

  test("POST /api/voice/log stores a spoken capture and returns a Siri-friendly response", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/voice/log",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          idempotencyKey: "siri-log-1",
          spokenText: "Log that I need to follow up with Maya tomorrow",
        }),
      },
      env,
    );
    const body = await response.json();
    const signalsResponse = await app.request("/api/signals", { headers: anonymousHeaders }, env);
    const signalsBody = await signalsResponse.json();

    expect(response.status).toBe(200);
    expect(body.spokenResponse).toBe("Understood. I logged it to Nudge.");
    expect(body.route).toBe("capture_only");
    expect(body.capture).toMatchObject({
      idempotencyKey: "siri-log-1",
      payload: { route: "capture_only", text: "Log that I need to follow up with Maya tomorrow" },
      source: "ios_siri",
      type: "capture.voice_log",
      userId: anonymousUserId,
    });
    expect(signalsBody.signals).toHaveLength(1);
    expect(signalsBody.signals[0]).toMatchObject({
      payload: { text: "Log that I need to follow up with Maya tomorrow" },
      source: "ios_siri",
      type: "capture.voice_log",
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
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/traces/recent",
      { headers: anonymousHeaders },
      { ...env, DB: traceDb },
    );

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
    const agentNames: Array<string> = [];
    const agentNamespace = {
      idFromName: (name: string) => {
        agentNames.push(name);
        return { name };
      },
      get: () => ({
        fetch: async (request: Request) => {
          forwardedRequests.push(request);
          return Response.json({
            conversationId: "focus",
            tool: "listRecentSignals",
            signals: [
              {
                id: "signal-1",
                userId: anonymousUserId,
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
    const app = createApp({ dbLayer: Db.layerMemory });
    const consoleLog = spyOn(console, "log").mockImplementation(() => {});

    let response: Response;
    let loggedEvent: unknown;
    try {
      response = await app.request(
        "/api/conversations/focus/tools/list-recent-signals?limit=5",
        { headers: anonymousHeaders },
        { ...env, LOG_HTTP_REQUESTS: "true", USER_AGENT_SESSION: agentNamespace },
      );
      loggedEvent = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])).event;
    } finally {
      consoleLog.mockRestore();
    }

    expect(response.status).toBe(200);
    expect(forwardedRequests).toHaveLength(1);
    expect(agentNames).toEqual([`${anonymousUserId}:focus`]);
    expect(new URL(forwardedRequests[0]!.url).pathname).toBe("/tools/list-recent-signals");
    expect(new URL(forwardedRequests[0]!.url).searchParams.get("limit")).toBe("5");
    expect(forwardedRequests[0]!.headers.get("x-nudge-conversation-id")).toBe("focus");
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
          userId: anonymousUserId,
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

  test("GET /api/conversations/:conversationId/tools/retrieve-memory forwards user-scoped retrieval to the agent session", async () => {
    const forwardedRequests: Array<Request> = [];
    const agentNames: Array<string> = [];
    const agentNamespace = {
      idFromName: (name: string) => {
        agentNames.push(name);
        return { name };
      },
      get: () => ({
        fetch: async (request: Request) => {
          forwardedRequests.push(request);
          return Response.json({
            conversationId: "focus",
            tool: "retrieveMemory",
            results: [
              {
                chunkId: "chunk-1",
                score: 4.2,
                sourceId: "revision-1",
                sourceType: "journal_revision",
                text: "need to write to michael about the launch",
              },
            ],
          });
        },
      }),
    } as DurableObjectNamespace;
    const app = createApp({ dbLayer: Db.layerMemory });
    const consoleLog = spyOn(console, "log").mockImplementation(() => {});

    let response: Response;
    let loggedEvent: unknown;
    try {
      response = await app.request(
        "/api/conversations/focus/tools/retrieve-memory?query=michael%20launch&limit=3",
        { headers: anonymousHeaders },
        {
          ...env,
          AGENT_INTERNAL_SECRET: "test-agent-secret",
          LOG_HTTP_REQUESTS: "true",
          USER_AGENT_SESSION: agentNamespace,
        },
      );
      loggedEvent = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])).event;
    } finally {
      consoleLog.mockRestore();
    }

    expect(response.status).toBe(200);
    expect(forwardedRequests).toHaveLength(1);
    expect(agentNames).toEqual([`${anonymousUserId}:focus`]);
    expect(new URL(forwardedRequests[0]!.url).pathname).toBe("/tools/retrieve-memory");
    expect(new URL(forwardedRequests[0]!.url).searchParams.get("query")).toBe("michael launch");
    expect(new URL(forwardedRequests[0]!.url).searchParams.get("limit")).toBe("3");
    expect(forwardedRequests[0]!.headers.get("x-nudge-user-id")).toBe(anonymousUserId);
    expect(forwardedRequests[0]!.headers.get("x-nudge-internal-signature")).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(loggedEvent).toMatchObject({
      agentTool: "retrieveMemory",
      routeName: "api.conversations",
    });
    expect(await response.json()).toEqual({
      conversationId: "focus",
      tool: "retrieveMemory",
      results: [
        {
          chunkId: "chunk-1",
          score: 4.2,
          sourceId: "revision-1",
          sourceType: "journal_revision",
          text: "need to write to michael about the launch",
        },
      ],
    });
  });

  test("GET /api/conversations/:conversationId returns conversation metadata", async () => {
    const forwardedRequests: Array<Request> = [];
    const agentNames: Array<string> = [];
    const agentNamespace = {
      idFromName: (name: string) => {
        agentNames.push(name);
        return { name };
      },
      get: () => ({
        fetch: async (request: Request) => {
          forwardedRequests.push(request);
          return Response.json({
            conversationId: "focus",
            userId: anonymousUserId,
            createdAt: null,
            updatedAt: null,
            recentToolEvents: [],
            reasoningHarness: { name: "think", runtime: "cloudflare-agents" },
            skills: ["intake-loop", "review-commitment", "close-loop"],
            subAgents: ["loopIntakeThink"],
            tools: ["listRecentSignals", "retrieveMemory"],
            workflows: ["dailyDigest"],
          });
        },
      }),
    } as DurableObjectNamespace;
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/conversations/focus",
      { headers: anonymousHeaders },
      { ...env, USER_AGENT_SESSION: agentNamespace },
    );

    expect(response.status).toBe(200);
    expect(forwardedRequests).toHaveLength(1);
    expect(agentNames).toEqual([`${anonymousUserId}:focus`]);
    expect(new URL(forwardedRequests[0]!.url).pathname).toBe("/metadata");
    expect(forwardedRequests[0]!.headers.get("x-nudge-conversation-id")).toBe("focus");
    expect(await response.json()).toEqual({
      conversationId: "focus",
      userId: anonymousUserId,
      createdAt: null,
      updatedAt: null,
      recentToolEvents: [],
      reasoningHarness: { name: "think", runtime: "cloudflare-agents" },
      skills: ["intake-loop", "review-commitment", "close-loop"],
      subAgents: ["loopIntakeThink"],
      tools: ["listRecentSignals", "retrieveMemory"],
      workflows: ["dailyDigest"],
    });
  });

  test("POST /api/conversations/:conversationId/messages forwards user-scoped messages to the agent", async () => {
    const forwardedRequests: Array<Request> = [];
    const agentNames: Array<string> = [];
    const agentNamespace = {
      idFromName: (name: string) => {
        agentNames.push(name);
        return { name };
      },
      get: () => ({
        fetch: async (request: Request) => {
          forwardedRequests.push(request);
          expect(await request.json()).toEqual({ message: "What should I do next?" });
          return Response.json({
            conversationId: "focus",
            draft: {
              confidence: 0.82,
              signal: {
                id: "signal-1",
                userId: anonymousUserId,
                type: "manual_check_in_submitted",
                source: "nudge_agent_intake",
                occurredAt: "2026-06-12T10:00:00.000Z",
                schemaVersion: 1,
                payload: { note: "What should I do next?" },
                createdAt: "2026-06-12T10:00:00.000Z",
              },
              proposal: {
                id: "proposal-1",
                userId: anonymousUserId,
                synthesisId: "synthesis-1",
                kind: "commit",
                status: "pending",
                title: "Clarify the next step",
                body: "Choose one concrete next action.",
                rationale: "Generated from the latest user message.",
                createdAt: "2026-06-12T10:00:00.000Z",
                updatedAt: "2026-06-12T10:00:00.000Z",
              },
              requiresReview: true,
            },
            message: "What should I do next?",
            memoryResults: [
              {
                chunkId: "chunk-1",
                score: 4.2,
                sourceId: "revision-1",
                sourceType: "journal_revision",
                text: "need to write to michael about the launch",
              },
            ],
            reasoningHarness: { name: "think", runtime: "cloudflare-agents" },
            reply: "I found 1 related memory and drafted a reviewable next step from your message.",
            skillsApplied: ["intake-loop"],
            subAgentsUsed: ["loopIntakeThink"],
            usedTools: ["retrieveMemory", "appendSignal", "createSynthesis", "generateProposals"],
            workflowHooks: ["dailyDigest"],
          });
        },
      }),
    } as DurableObjectNamespace;
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/conversations/focus/messages",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ message: "What should I do next?" }),
      },
      { ...env, USER_AGENT_SESSION: agentNamespace },
    );

    expect(response.status).toBe(200);
    expect(agentNames).toEqual([`${anonymousUserId}:focus`]);
    expect(forwardedRequests).toHaveLength(1);
    expect(new URL(forwardedRequests[0]!.url).pathname).toBe("/messages");
    expect(forwardedRequests[0]!.headers.get("x-nudge-conversation-id")).toBe("focus");
    expect(forwardedRequests[0]!.headers.get("x-nudge-user-id")).toBe(anonymousUserId);
    expect(forwardedRequests[0]!.headers.get("x-nudge-user-display-name")).toBe("Anonymous User");
    expect(await response.json()).toEqual({
      conversationId: "focus",
      draft: {
        confidence: 0.82,
        signal: {
          id: "signal-1",
          userId: anonymousUserId,
          type: "manual_check_in_submitted",
          source: "nudge_agent_intake",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { note: "What should I do next?" },
          createdAt: "2026-06-12T10:00:00.000Z",
        },
        proposal: {
          id: "proposal-1",
          userId: anonymousUserId,
          synthesisId: "synthesis-1",
          kind: "commit",
          status: "pending",
          title: "Clarify the next step",
          body: "Choose one concrete next action.",
          rationale: "Generated from the latest user message.",
          createdAt: "2026-06-12T10:00:00.000Z",
          updatedAt: "2026-06-12T10:00:00.000Z",
        },
        requiresReview: true,
      },
      message: "What should I do next?",
      memoryResults: [
        {
          chunkId: "chunk-1",
          score: 4.2,
          sourceId: "revision-1",
          sourceType: "journal_revision",
          text: "need to write to michael about the launch",
        },
      ],
      reasoningHarness: { name: "think", runtime: "cloudflare-agents" },
      reply: "I found 1 related memory and drafted a reviewable next step from your message.",
      skillsApplied: ["intake-loop"],
      subAgentsUsed: ["loopIntakeThink"],
      usedTools: ["retrieveMemory", "appendSignal", "createSynthesis", "generateProposals"],
      workflowHooks: ["dailyDigest"],
    });
  });

  test("POST /api/conversations/:conversationId/messages/stream proxies the agent text stream", async () => {
    const forwardedRequests: Array<Request> = [];
    const agentNames: Array<string> = [];
    const agentNamespace = {
      idFromName: (name: string) => {
        agentNames.push(name);
        return { name };
      },
      get: () => ({
        fetch: async (request: Request) => {
          forwardedRequests.push(request);
          expect(await request.json()).toEqual({ message: "Stream this" });
          return new Response("Hello streamed reply", {
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        },
      }),
    } as DurableObjectNamespace;
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/conversations/focus/messages/stream",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ message: "Stream this" }),
      },
      { ...env, USER_AGENT_SESSION: agentNamespace },
    );

    expect(response.status).toBe(200);
    expect(agentNames).toEqual([`${anonymousUserId}:focus`]);
    expect(forwardedRequests).toHaveLength(1);
    expect(new URL(forwardedRequests[0]!.url).pathname).toBe("/messages/stream");
    expect(forwardedRequests[0]!.headers.get("x-nudge-conversation-id")).toBe("focus");
    expect(forwardedRequests[0]!.headers.get("x-nudge-user-id")).toBe(anonymousUserId);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("Hello streamed reply");
  });

  test("custom integrations can append and list current user's events", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const appendResponse = await app.request(
      "/api/events",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
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

    const listResponse = await app.request("/api/events", { headers: anonymousHeaders }, env);

    expect(appendResponse.status).toBe(200);
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      events: [
        expect.objectContaining({
          userId: anonymousUserId,
          type: "manual_check_in_submitted",
          source: "api",
          occurredAt: "2026-06-12T10:00:00.000Z",
          schemaVersion: 1,
          payload: { mood: "focused" },
        }),
      ],
    });
  });

  test("media uploads are stored in R2 and returned as attachment references", async () => {
    const writes: Array<{
      readonly key: string;
      readonly options: R2PutOptions | undefined;
      readonly value: Uint8Array;
    }> = [];
    const mediaBucket = {
      get: async () => null,
      put: async (key: string, value: Uint8Array, options?: R2PutOptions) => {
        writes.push({ key, options, value });
        return { key } as R2Object;
      },
    } as R2Bucket;
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/media",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          dataBase64: btoa("image bytes"),
          id: "550e8400-e29b-41d4-a716-446655440000",
          kind: "image",
          label: "Camera photo",
          mimeType: "image/jpeg",
        }),
      },
      { ...env, MEDIA_FILES: mediaBucket },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      byteLength: 11,
      id: "550e8400-e29b-41d4-a716-446655440000",
      kind: "image",
      label: "Camera photo",
      mimeType: "image/jpeg",
      url: "/api/media/550e8400-e29b-41d4-a716-446655440000",
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]!.key).toBe(
      `users/${anonymousUserId}/media/550e8400-e29b-41d4-a716-446655440000`,
    );
    expect(new TextDecoder().decode(writes[0]!.value)).toBe("image bytes");
    expect(writes[0]!.options).toEqual({
      customMetadata: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        kind: "image",
        label: "Camera photo",
        userId: anonymousUserId,
      },
      httpMetadata: { contentType: "image/jpeg" },
    });
  });

  test("custom integrations can inspect the current session workspace", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request("/api/session", { headers: anonymousHeaders }, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authMode: "anonymous",
      user: anonymousUser,
      workspace: { id: anonymousUserId, label: "Anonymous User's workspace" },
    });
  });

  test("custom integrations see an unauthenticated session without a Clerk token", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request("/api/session", {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authMode: "unauthenticated",
      user: null,
      workspace: null,
    });
  });

  test("custom integrations resolve an anonymous install session from a scoped client id", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/session",
      {
        headers: {
          "x-nudge-anonymous-user-id": "anon_550e8400-e29b-41d4-a716-446655440000",
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authMode: "anonymous",
      user: {
        displayName: "Anonymous User",
        id: "anon_550e8400-e29b-41d4-a716-446655440000",
      },
      workspace: {
        id: "anon_550e8400-e29b-41d4-a716-446655440000",
        label: "Anonymous User's workspace",
      },
    });
  });

  test("custom integrations cannot use user data routes without an authenticated production session", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request("/api/signals?limit=10", {}, env);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  test("custom integrations can use user data routes with an anonymous install session", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/signals?limit=10",
      {
        headers: {
          "x-nudge-anonymous-user-id": "anon_550e8400-e29b-41d4-a716-446655440000",
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ signals: [] });
  });

  test("custom integrations resolve workspace from a Clerk session", async () => {
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
      authMode: "clerk",
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
        headers: anonymousJsonHeaders,
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

    const exportResponse = await app.request("/api/export", { headers: anonymousHeaders }, env);
    const exported = await exportResponse.json();
    const deleteResponse = await app.request(
      "/api/account/delete",
      { method: "POST", headers: anonymousHeaders },
      env,
    );
    const afterDeleteResponse = await app.request(
      "/api/export",
      { headers: anonymousHeaders },
      env,
    );

    expect(exportResponse.status).toBe(200);
    expect(exported).toMatchObject({
      user: { id: anonymousUserId, displayName: "Anonymous User" },
      events: [expect.objectContaining({ payload: { note: "export this" } })],
    });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ deleted: true });
    expect(await afterDeleteResponse.json()).toMatchObject({
      user: { id: anonymousUserId, displayName: "Anonymous User" },
      events: [],
      commitments: [],
      outcomes: [],
      proposals: [],
      syntheses: [],
      journalDocuments: [],
      journalRevisions: [],
    });
  });

  test("account deletion removes the user's Turbopuffer namespace without exposing the user id", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const fetch = spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({}));
    let calls: typeof fetch.mock.calls = [];

    let response: Response;
    try {
      response = await app.request(
        "/api/account/delete",
        { method: "POST", headers: anonymousHeaders },
        {
          ...env,
          TURBOPUFFER_API_KEY: "test-key",
          TURBOPUFFER_REGION: "aws-eu-west-1",
        },
      );
      calls = [...fetch.mock.calls];
    } finally {
      fetch.mockRestore();
    }

    expect(response!.status).toBe(200);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(String(url)).toMatch(
      /^https:\/\/aws-eu-west-1\.turbopuffer\.com\/v2\/namespaces\/nudge-user-[a-f0-9]{48}$/,
    );
    expect(String(url)).not.toContain(anonymousUserId);
    expect(init?.method).toBe("DELETE");
  });

  test("custom integrations can save a daily journal and queue agent interpretation", async () => {
    const workflowCreates: Array<{ readonly id?: string; readonly params?: unknown }> = [];
    const workflow = {
      create: async (input?: { readonly id?: string; readonly params?: unknown }) => {
        workflowCreates.push(input ?? {});
        return { id: input?.id ?? "test-workflow-id" };
      },
    } as Workflow;
    const app = createApp({ dbLayer: Db.layerMemory });

    const firstSave = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "need to write to michael",
          localDate: "2026-06-18",
          title: "June 18",
        }),
      },
      { ...env, DAILY_DIGEST_WORKFLOW: workflow },
    );

    expect(firstSave.status).toBe(200);
    const saved = await firstSave.json();
    expect(saved.document.bodyText).toBe("need to write to michael");
    expect(saved.revision.changedText).toBe("need to write to michael");

    expect(saved.analysisRun).toEqual(
      expect.objectContaining({ sourceType: "note_revision", status: "queued" }),
    );
    expect(workflowCreates).toHaveLength(1);

    const documentResponse = await app.request(
      "/api/journal/2026-06-18",
      { headers: anonymousHeaders },
      env,
    );
    expect(documentResponse.status).toBe(200);
    expect((await documentResponse.json()).document.bodyText).toBe("need to write to michael");

    const exportResponse = await app.request("/api/export", { headers: anonymousHeaders }, env);
    const exported = await exportResponse.json();
    expect(exported.journalDocuments).toHaveLength(1);
    expect(exported.journalRevisions).toHaveLength(1);
    expect(exported.dailyNotes).toEqual([
      expect.objectContaining({
        bodyText: "need to write to michael",
        localDate: "2026-06-18",
      }),
    ]);
    expect(exported.noteRevisions).toEqual([
      expect.objectContaining({
        changedText: "need to write to michael",
      }),
    ]);
    expect(exported.extractedItems).toEqual([]);
    expect(exported.summaryDocuments).toEqual([]);
    expect(exported.agentRuns).toEqual([expect.objectContaining({ status: "queued" })]);
    expect(exported.agentRunOutputs).toEqual([]);
    expect(exported.memoryDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: "daily_note" }),
        expect.objectContaining({ sourceType: "note_revision" }),
        expect.objectContaining({ sourceType: "journal_revision" }),
      ]),
    );
    expect(exported.memoryChunks).toEqual(
      expect.arrayContaining([expect.objectContaining({ chunkText: "need to write to michael" })]),
    );
    expect(exported.memoryIndexJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "pending",
        }),
      ]),
    );

    const actionsResponse = await app.request("/api/actions", { headers: anonymousHeaders }, env);
    const actions = await actionsResponse.json();
    expect(actions.actions).toEqual([]);
    expect(actions.latestRun).toEqual(expect.objectContaining({ status: "queued" }));
    const summariesResponse = await app.request(
      "/api/summaries",
      { headers: anonymousHeaders },
      env,
    );
    expect((await summariesResponse.json()).summaries).toEqual([]);
  });

  test("iOS clients can list calendar day activity", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "Met Kai and captured the follow-up.",
          localDate: "2026-06-18",
          title: "June 18",
        }),
      },
      env,
    );
    await app.request(
      "/api/events",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          occurredAt: "2026-06-18T10:00:00.000Z",
          payload: { note: "Follow up with Kai." },
          schemaVersion: 1,
          source: "ios_app",
          type: "manual_check_in_submitted",
        }),
      },
      env,
    );

    const response = await app.request(
      "/api/calendar/days?timeZone=UTC",
      { headers: anonymousHeaders },
      env,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.days).toEqual([
      {
        localDate: "2026-06-18",
        noteCount: 1,
        signalCount: 1,
      },
    ]);
  });

  test("POST /api/journal persists AI context as a debug-wide event", async () => {
    const traceDb = createTraceDb();
    const workflow = {
      create: async (input?: { readonly id?: string }) => ({ id: input?.id ?? "workflow-id" }),
    } as Workflow;
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: {
          ...anonymousJsonHeaders,
          "cf-ray": "journal-ray",
          "content-type": "application/json",
          "user-agent": "Nudge/1",
        },
        body: JSON.stringify({
          bodyText: "I need to work on the guest list",
          localDate: "2026-07-01",
          title: "July 1",
        }),
      },
      { ...env, DB: traceDb.db, DAILY_DIGEST_WORKFLOW: workflow },
    );

    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(traceDb.rows).toHaveLength(1);

    const payload = JSON.parse(String(traceDb.rows[0]?.[16]));
    expect(payload).toMatchObject({
      event: "http_request_completed",
      routeName: "api.journal",
      aiErrorCode: null,
      aiModel: "@cf/zai-org/glm-4.7-flash",
      aiRunId: saved.analysisRun.id,
      aiSourceType: "note_revision",
      aiSystem: "cloudflare-think",
      noteLocalDate: "2026-07-01",
      "otel.name": "api.journal",
      "otel.status_code": "OK",
      "http.request.method": "POST",
      "http.route": "api.journal",
      "http.response.status_code": 200,
      "url.path": "/api/journal",
      "user_agent.original": "Nudge/1",
      "service.name": "nudge-web",
      "deployment.environment.name": "test",
      "nudge.debug_kind": "ai",
      "nudge.ai.system": "cloudflare-think",
      "nudge.ai.model": "@cf/zai-org/glm-4.7-flash",
      "nudge.ai.run_id": saved.analysisRun.id,
      "nudge.ai.error_code": null,
    });
  });

  test("custom integrations can fetch a queued agent run by id", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const save = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "need to work on the guest list",
          localDate: "2026-07-01",
          title: "July 1",
        }),
      },
      env,
    );
    const saved = await save.json();

    const response = await app.request(
      `/api/agent-runs/${saved.analysisRun.id}`,
      { headers: anonymousHeaders },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      run: expect.objectContaining({
        id: saved.analysisRun.id,
        status: "queued",
      }),
    });
  });

  test("agents can read workspace notes through the OKF filesystem API", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const save = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "OKF should be mounted into the sandbox for grep and cat.",
          localDate: "2026-06-29",
          title: "June 29",
        }),
      },
      env,
    );
    expect(save.status).toBe(200);

    const listed = await app.request("/api/okf?path=/daily", { headers: anonymousHeaders }, env);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      entries: ["2026-06-29.md", "index.md"],
      path: "/daily",
    });

    const read = await app.request(
      "/api/okf/file?path=/daily/2026-06-29.md",
      { headers: anonymousHeaders },
      env,
    );
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({
      content: expect.stringContaining("OKF should be mounted into the sandbox"),
      path: "/daily/2026-06-29.md",
    });

    const search = await app.request(
      "/api/okf/search?query=grep&limit=1",
      { headers: anonymousHeaders },
      env,
    );
    expect(search.status).toBe(200);
    expect(await search.json()).toEqual({
      results: [
        {
          path: "/daily/2026-06-29.md",
          snippet: "OKF should be mounted into the sandbox for grep and cat.",
        },
      ],
    });
  });

  test("agents can read workspace notes through MCP OKF tools", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const save = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "MCP should expose the same OKF workspace boundary.",
          localDate: "2026-07-02",
          title: "July 2",
        }),
      },
      env,
    );
    expect(save.status).toBe(200);

    const tools = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 0,
          jsonrpc: "2.0",
          method: "tools/list",
        }),
      },
      env,
    );

    expect(tools.status).toBe(200);
    expect(await tools.json()).toMatchObject({
      id: 0,
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "okf_list" }),
          expect.objectContaining({ name: "okf_read" }),
          expect.objectContaining({ name: "okf_search" }),
        ]),
      },
    });

    const listed = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: { path: "/daily" }, name: "okf_list" },
        }),
      },
      env,
    );

    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      id: 1,
      result: {
        content: [{ text: '["2026-07-02.md","index.md"]', type: "text" }],
      },
    });

    const read = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 2,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: { path: "/daily/2026-07-02.md" }, name: "okf_read" },
        }),
      },
      env,
    );

    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      id: 2,
      result: {
        content: [
          {
            text: expect.stringContaining("MCP should expose the same OKF workspace boundary."),
            type: "text",
          },
        ],
      },
    });

    const resources = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 4,
          jsonrpc: "2.0",
          method: "resources/list",
        }),
      },
      env,
    );

    expect(resources.status).toBe(200);
    expect(await resources.json()).toMatchObject({
      id: 4,
      result: {
        resources: expect.arrayContaining([
          expect.objectContaining({
            mimeType: "text/markdown",
            name: "/daily/2026-07-02.md",
            uri: "file:///okf/daily/2026-07-02.md",
          }),
        ]),
      },
    });

    const templates = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 6,
          jsonrpc: "2.0",
          method: "resources/templates/list",
        }),
      },
      env,
    );

    expect(templates.status).toBe(200);
    expect(await templates.json()).toMatchObject({
      id: 6,
      result: {
        resourceTemplates: expect.arrayContaining([
          expect.objectContaining({ uriTemplate: "file:///okf/{+path}" }),
        ]),
      },
    });

    const resource = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 5,
          jsonrpc: "2.0",
          method: "resources/read",
          params: { uri: "file:///okf/daily/2026-07-02.md" },
        }),
      },
      env,
    );

    expect(resource.status).toBe(200);
    expect(await resource.json()).toMatchObject({
      id: 5,
      result: {
        contents: [
          {
            mimeType: "text/markdown",
            text: expect.stringContaining("MCP should expose the same OKF workspace boundary."),
            uri: "file:///okf/daily/2026-07-02.md",
          },
        ],
      },
    });

    const search = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 3,
          jsonrpc: "2.0",
          method: "tools/call",
          params: { arguments: { limit: 1, query: "boundary" }, name: "okf_search" },
        }),
      },
      env,
    );

    expect(search.status).toBe(200);
    const searchBody = await search.json();
    expect(searchBody).toMatchObject({
      id: 3,
      result: {
        structuredContent: {
          results: [
            {
              mimeType: "text/markdown",
              path: "/daily/2026-07-02.md",
              snippet: "MCP should expose the same OKF workspace boundary.",
              uri: "file:///okf/daily/2026-07-02.md",
            },
          ],
        },
      },
    });
    expect(searchBody).toMatchObject({
      result: {
        content: expect.arrayContaining([
          expect.objectContaining({
            type: "resource_link",
            uri: "file:///okf/daily/2026-07-02.md",
          }),
        ]),
      },
    });
  });

  test("agents can write reviewable proposals through MCP", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const write = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: anonymousMcpHeaders,
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            arguments: {
              body: "Ask Maya whether launch notes need a final pass.",
              frameKey: "current_state",
              kind: "follow_up",
              rationale: "Agent found an unresolved launch follow-up in workspace context.",
              title: "Follow up on launch",
            },
            name: "proposal_write",
          },
        }),
      },
      env,
    );

    expect(write.status).toBe(200);
    expect(await write.json()).toMatchObject({
      id: 1,
      result: {
        structuredContent: {
          proposal: expect.objectContaining({
            kind: "follow_up",
            status: "pending",
            title: "Follow up on launch",
          }),
          requiresReview: true,
        },
      },
    });

    const proposals = await app.request("/api/proposals", { headers: anonymousHeaders }, env);
    expect((await proposals.json()).proposals).toEqual([
      expect.objectContaining({ status: "pending", title: "Follow up on launch" }),
    ]);

    const commitments = await app.request("/api/commitments", { headers: anonymousHeaders }, env);
    expect((await commitments.json()).commitments).toEqual([]);
  });

  test("agents can smoke test projected OKF files inside a sandbox", async () => {
    const files = new Map<string, string>();
    const execCalls: Array<{ readonly command: string; readonly cwd?: string }> = [];
    const sandbox = {
      exec: async (command, options) => {
        execCalls.push({ command, ...(options?.cwd ? { cwd: options.cwd } : {}) });
        return {
          exitCode: 0,
          stderr: "",
          stdout: [...files.keys()].sort().join("\n"),
          success: true,
        };
      },
      mkdir: async () => {},
      writeFile: async (path, content) => {
        files.set(path, content);
      },
    } satisfies OkfSandbox;
    const app = createApp({ dbLayer: Db.layerMemory, okfSandboxFactory: () => sandbox });
    const save = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "Sandbox should expose OKF files to grep.",
          localDate: "2026-06-30",
          title: "June 30",
        }),
      },
      env,
    );
    expect(save.status).toBe(200);

    const smoke = await app.request(
      "/api/okf/sandbox/smoke",
      { method: "POST", headers: anonymousHeaders },
      env,
    );

    expect(smoke.status).toBe(200);
    expect(await smoke.json()).toEqual({
      available: true,
      exitCode: 0,
      fileCount: expect.any(Number),
      root: "/workspace/okf",
      stderr: "",
      stdout: expect.stringContaining("/workspace/okf/daily/2026-06-30.md"),
      success: true,
    });
    expect(files.get("/workspace/okf/daily/2026-06-30.md")).toContain(
      "Sandbox should expose OKF files to grep.",
    );
    expect(execCalls).toEqual([
      {
        command: expect.stringContaining("shutil.rmtree"),
        cwd: "/workspace/okf",
      },
      {
        command: 'find . -type f | sort && grep -R "type:" daily memory',
        cwd: "/workspace/okf",
      },
    ]);
  });

  test("sandbox smoke reports startup failures without crashing the API", async () => {
    const sandbox = {
      exec: async () => {
        throw new Error("exec should not run after materialization fails");
      },
      mkdir: async () => {
        throw new Error("Container failed to start");
      },
      writeFile: async () => {
        throw new Error("writeFile should not run after mkdir fails");
      },
    } satisfies OkfSandbox;
    const app = createApp({ dbLayer: Db.layerMemory, okfSandboxFactory: () => sandbox });

    const save = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "Sandbox startup can fail locally while OKF projection remains valid.",
          localDate: "2026-07-01",
          title: "July 1",
        }),
      },
      env,
    );
    expect(save.status).toBe(200);

    const smoke = await app.request(
      "/api/okf/sandbox/smoke",
      { method: "POST", headers: anonymousHeaders },
      env,
    );

    expect(smoke.status).toBe(200);
    expect(await smoke.json()).toEqual({
      available: true,
      exitCode: null,
      fileCount: expect.any(Number),
      root: "/workspace/okf",
      stderr: "Container failed to start",
      stdout: "",
      success: false,
    });
  });

  test("custom integrations enqueue durable AI analysis instead of extracting synchronously", async () => {
    const workflowCreates: Array<{ readonly id?: string; readonly params?: unknown }> = [];
    const workflow = {
      create: async (input?: { readonly id?: string; readonly params?: unknown }) => {
        workflowCreates.push(input ?? {});
        return { id: input?.id ?? "generated-workflow-id" };
      },
    } as Workflow;
    const agentNamespace = {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: async () => {
          throw new Error("journal save should not call the agent synchronously");
        },
      }),
    } as DurableObjectNamespace;
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "Ask AI to extract this action durably",
          localDate: "2026-06-22",
          title: "June 22",
        }),
      },
      { ...env, DAILY_DIGEST_WORKFLOW: workflow, USER_AGENT_SESSION: agentNamespace },
    );

    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.analysisRun).toEqual(
      expect.objectContaining({
        model: "@cf/zai-org/glm-4.7-flash",
        sourceType: "note_revision",
        status: "queued",
      }),
    );
    expect(workflowCreates).toEqual([
      expect.objectContaining({
        id: `daily-note-analysis-${saved.analysisRun.sourceId}`,
        params: expect.objectContaining({
          changedText: "Ask AI to extract this action durably",
          kind: "daily-note-analysis",
          localDate: "2026-06-22",
          revisionId: saved.analysisRun.sourceId,
          runId: saved.analysisRun.id,
          userId: anonymousUserId,
          workflowVersion: 1,
        }),
      }),
    ]);

    const exported = await (
      await app.request("/api/export", { headers: anonymousHeaders }, env)
    ).json();
    expect(exported.agentRuns).toEqual([expect.objectContaining({ status: "queued" })]);
    expect(exported.extractedItems).toEqual([]);
    expect(exported.summaryDocuments).toEqual([]);
  });

  test("custom integrations expose queued AI analysis status after saving a daily journal", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/journal",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          bodyText: "I have now written to michael",
          localDate: "2026-06-21",
          title: "June 21",
        }),
      },
      env,
    );

    expect(response.status).toBe(200);
    const actions = await (
      await app.request("/api/actions", { headers: anonymousHeaders }, env)
    ).json();
    expect(actions.latestRun).toEqual(
      expect.objectContaining({ model: "@cf/zai-org/glm-4.7-flash", status: "queued" }),
    );
    expect(actions.actions).toEqual([]);
  });

  test("custom integrations can capture and list signals using primitive routes", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    const captureResponse = await app.request(
      "/api/captures",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
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
        headers: anonymousJsonHeaders,
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

    const signalsResponse = await app.request("/api/signals", { headers: anonymousHeaders }, env);
    const body = await signalsResponse.json();
    const capture = await captureResponse.json();
    const retriedCapture = await retriedCaptureResponse.json();

    expect(captureResponse.status).toBe(200);
    expect(retriedCapture.id).toBe(capture.id);
    expect(signalsResponse.status).toBe(200);
    expect(body.signals).toEqual([
      expect.objectContaining({
        userId: anonymousUserId,
        type: "user_context_captured",
        payload: { note: "primitive route" },
      }),
    ]);
  });

  test("voice logs append a primitive signal without queuing analysis", async () => {
    const workflowCreates: Array<unknown> = [];
    const app = createApp({ dbLayer: Db.layerMemory });

    const response = await app.request(
      "/api/voice/log",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          idempotencyKey: "siri-log-1",
          occurredAt: "2026-06-12T10:00:00.000Z",
          spokenText: "Follow up with Maya tomorrow",
        }),
      },
      {
        ...env,
        DAILY_DIGEST_WORKFLOW: {
          create: async (input: unknown) => {
            workflowCreates.push(input);
            return { id: "unexpected-workflow" };
          },
        } as Workflow,
      },
    );
    const voiceLog = await response.json();
    const signals = await (
      await app.request("/api/signals", { headers: anonymousHeaders }, env)
    ).json();

    expect(response.status).toBe(200);
    expect(voiceLog.spokenResponse).toBe("Understood. I'm processing it in Nudge.");
    expect(voiceLog.route).toBe("reasoning_candidate");
    expect(voiceLog.capture).toEqual(
      expect.objectContaining({
        source: "ios_siri",
        type: "capture.voice_log",
        payload: {
          route: "reasoning_candidate",
          text: "Follow up with Maya tomorrow",
        },
      }),
    );
    expect(signals.signals).toEqual([expect.objectContaining({ id: voiceLog.capture.id })]);
    expect(workflowCreates).toEqual([]);
  });

  test("custom integrations can generate a source-linked synthesis for the current frame", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });

    await app.request(
      "/api/captures",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
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
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const latestResponse = await app.request(
      "/api/syntheses/latest?frameKey=current_state",
      { headers: anonymousHeaders },
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
        headers: anonymousJsonHeaders,
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
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );

    const generateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const retriedGenerateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const listBeforeReviewResponse = await app.request(
      "/api/proposals",
      { headers: anonymousHeaders },
      env,
    );
    const listBeforeReview = await listBeforeReviewResponse.json();
    const retriedGenerate = await retriedGenerateResponse.json();
    const proposal = listBeforeReview.proposals[0];
    const reviewResponse = await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ proposalId: proposal.id, decision: "accepted" }),
      },
      env,
    );
    const listAfterReviewResponse = await app.request(
      "/api/proposals",
      { headers: anonymousHeaders },
      env,
    );

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
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const generateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const { proposals } = await generateResponse.json();

    await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ proposalId: proposals[0].id, decision: "accepted" }),
      },
      env,
    );
    const retriedReviewResponse = await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ proposalId: proposals[0].id, decision: "accepted" }),
      },
      env,
    );
    const commitmentsResponse = await app.request(
      "/api/commitments",
      { headers: anonymousHeaders },
      env,
    );
    const { commitments } = await commitmentsResponse.json();
    const outcomeResponse = await app.request(
      "/api/outcomes",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
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
        headers: anonymousJsonHeaders,
        body: JSON.stringify({
          commitmentId: commitments[0].id,
          result: "completed",
          note: "Handled in planning.",
        }),
      },
      env,
    );
    const outcomesResponse = await app.request("/api/outcomes", { headers: anonymousHeaders }, env);
    const activeAfterOutcomeResponse = await app.request(
      "/api/commitments",
      { headers: anonymousHeaders },
      env,
    );

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
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const generateResponse = await app.request(
      "/api/proposals/generate",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
        body: JSON.stringify({ frameKey: "current_state" }),
      },
      env,
    );
    const { proposals } = await generateResponse.json();

    await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: anonymousJsonHeaders,
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
    const commitmentsResponse = await app.request(
      "/api/commitments",
      { headers: anonymousHeaders },
      env,
    );

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
            headers: anonymousJsonHeaders,
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
      { headers: anonymousHeaders },
      env,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events.map((event: { type: string }) => event.type)).toEqual(["inside_range"]);
  });

  test("GET /api/openapi.json documents the public events API", async () => {
    const app = createApp({ dbLayer: Db.layerMemory });
    const response = await app.request("/api/openapi.json", { headers: anonymousHeaders }, env);
    const spec = await response.json();

    expect(response.status).toBe(200);
    expect(spec.info).toEqual({
      title: "Nudge API",
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
    const response = await app.request("/api/docs", { headers: anonymousHeaders }, env);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Nudge API");
  });
});
