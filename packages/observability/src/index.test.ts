import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  buildRootServerSpan,
  buildTraceSpanRow,
  buildTraceEventRow,
  createSpanId,
  createTraceId,
  finalizeRequestWideEvent,
  isTransientBackpressureError,
  persistTraceCacheEvent,
  persistTraceCacheSpan,
  persistAgentTraceRun,
  pruneTraceCache,
  retryAfterSecondsFor,
  safeErrorFields,
  shouldSampleWideEvent,
  statusGroup,
} from "./index";

describe("observability", () => {
  test("groups HTTP statuses by family", () => {
    expect(statusGroup(200)).toBe("2xx");
    expect(statusGroup(404)).toBe("4xx");
    expect(statusGroup(503)).toBe("5xx");
  });

  test("keeps errors and slow requests during sampling", () => {
    expect(shouldSampleWideEvent({ status: 500 })).toEqual({
      sampled: true,
      sampleReason: "error",
    });
    expect(shouldSampleWideEvent({ durationMs: 2_500 })).toEqual({
      sampled: true,
      sampleReason: "slow",
    });
    expect(shouldSampleWideEvent({ status: 200, durationMs: 20 })).toEqual({
      sampled: true,
      sampleReason: "default",
    });
  });

  test("converts unknown errors into safe fields", () => {
    expect(safeErrorFields(new Error("boom"))).toEqual({
      errorType: "Error",
      errorMessage: "boom",
    });
    expect(safeErrorFields("boom")).toEqual({
      errorType: "string",
      errorMessage: "boom",
    });
  });

  test("classifies transient backpressure errors for retry-after responses", () => {
    const transient = new Error("D1_ERROR: database is locked");
    const permanent = new Error("Proposal already reviewed");

    expect(isTransientBackpressureError(transient)).toBe(true);
    expect(retryAfterSecondsFor(transient)).toBe(5);
    expect(isTransientBackpressureError(permanent)).toBe(false);
    expect(retryAfterSecondsFor(permanent)).toBeNull();
  });

  test("finalizes a safe request wide event for future handlers", () => {
    expect(
      finalizeRequestWideEvent({
        base: {
          event: "http_request_completed",
          service: "lares-web",
          requestId: "ray-1",
          method: "GET",
          path: "/health",
        },
        durationMs: 12.345,
        now: "2026-06-12T10:00:00.000Z",
        status: 200,
      }),
    ).toEqual({
      event: "http_request_completed",
      service: "lares-web",
      requestId: "ray-1",
      method: "GET",
      path: "/health",
      timestamp: "2026-06-12T10:00:00.000Z",
      status: 200,
      statusGroup: "2xx",
      outcome: "success",
      durationMs: 12.35,
      sampled: true,
      sampleReason: "default",
    });
  });

  test("maps wide events to trace_events rows without knowing D1", () => {
    const row = buildTraceEventRow({
      event: {
        event: "http_request_completed",
        logKind: "wide_event",
        service: "lares-web",
        environment: "test",
        version: "test-version",
        requestId: "ray-1",
        routeName: "health",
        method: "GET",
        path: "/health",
        status: 200,
        outcome: "success",
        durationMs: 8,
        sampleReason: "default",
        timestamp: "2026-06-12T10:00:00.000Z",
      },
      id: "event-1",
      now: "2026-06-12T10:00:00.100Z",
    });

    expect(row.values).toEqual([
      "event-1",
      "2026-06-12T10:00:00.000Z",
      "http_request_completed",
      "wide_event",
      "lares-web",
      "test",
      "test-version",
      "ray-1",
      "health",
      "GET",
      "/health",
      200,
      "success",
      8,
      "default",
      null,
      expect.stringContaining("ray-1"),
      "2026-06-12T10:00:00.100Z",
    ]);
  });

  test("builds an OTel-shaped root server span from the request event", () => {
    const span = buildRootServerSpan({
      durationMs: 23,
      endedAt: "2026-06-12T10:00:00.023Z",
      event: {
        service: "lares-web",
        environment: "test",
        version: "test-version",
        requestId: "ray-1",
        routeName: "health",
        method: "GET",
        path: "/health",
        status: 500,
        outcome: "error",
        sampled: true,
        userAgent: "test-agent",
      },
      spanId: "span-1",
      startedAt: "2026-06-12T10:00:00.000Z",
      traceId: "trace-1",
    });

    expect(span.values).toEqual([
      "trace-1",
      "span-1",
      null,
      "GET /health",
      "server",
      "error",
      "2026-06-12T10:00:00.000Z",
      "2026-06-12T10:00:00.023Z",
      23,
      "lares-web",
      "test",
      "test-version",
      "ray-1",
      "health",
      "GET",
      "/health",
      500,
      "error",
      expect.stringContaining("http.request.method"),
      expect.any(String),
    ]);
  });

  test("builds reusable child spans without feature-specific route knowledge", () => {
    const span = buildTraceSpanRow({
      attributes: { "db.system.name": "cloudflare-d1", "lares.operation": "db.resolve" },
      durationMs: 4,
      endedAt: "2026-06-12T10:00:00.004Z",
      environment: "test",
      httpStatus: 200,
      kind: "client",
      name: "db.resolve",
      outcome: "success",
      parentSpanId: "parent-1",
      path: "/api/syntheses",
      requestId: "ray-1",
      routeName: "api.syntheses",
      service: "lares-web",
      spanId: "span-1",
      startedAt: "2026-06-12T10:00:00.000Z",
      status: "ok",
      traceId: "trace-1",
      version: "test-version",
    });

    expect(span.values).toEqual([
      "trace-1",
      "span-1",
      "parent-1",
      "db.resolve",
      "client",
      "ok",
      "2026-06-12T10:00:00.000Z",
      "2026-06-12T10:00:00.004Z",
      4,
      "lares-web",
      "test",
      "test-version",
      "ray-1",
      "api.syntheses",
      null,
      "/api/syntheses",
      200,
      "success",
      expect.stringContaining("cloudflare-d1"),
      "2026-06-12T10:00:00.004Z",
    ]);
  });

  test("creates OpenTelemetry-compatible trace and span identifiers", () => {
    expect(createTraceId()).toMatch(/^[a-f0-9]{32}$/);
    expect(createSpanId()).toMatch(/^[a-f0-9]{16}$/);
  });

  test("persists and prunes trace cache rows through a small D1 adapter", async () => {
    const statements: Array<{ readonly sql: string; readonly values: ReadonlyArray<unknown> }> = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: ReadonlyArray<unknown>) => ({
          run: async () => {
            statements.push({ sql, values });
            return { success: true };
          },
        }),
      }),
    };

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* persistTraceCacheEvent(db, {
          event: { event: "http_request_completed", requestId: "ray-1" },
          id: "event-1",
          now: "2026-06-12T10:00:00.000Z",
        });
        yield* persistTraceCacheSpan(
          db,
          buildTraceSpanRow({
            attributes: {},
            durationMs: 1,
            endedAt: "2026-06-12T10:00:00.001Z",
            environment: "test",
            kind: "internal",
            name: "test.span",
            parentSpanId: null,
            service: "lares-web",
            spanId: "span-1",
            startedAt: "2026-06-12T10:00:00.000Z",
            status: "ok",
            traceId: "trace-1",
            version: "test-version",
          }),
        );
        yield* pruneTraceCache(db);
      }),
    );

    expect(statements.map((statement) => statement.sql)).toEqual([
      expect.stringContaining("INSERT INTO trace_events"),
      expect.stringContaining("INSERT INTO trace_spans"),
      expect.stringContaining("DELETE FROM trace_spans"),
      expect.stringContaining("DELETE FROM trace_spans"),
      expect.stringContaining("DELETE FROM trace_events"),
      expect.stringContaining("DELETE FROM trace_events"),
    ]);
  });

  test("persists real agent run metadata with redacted artifacts", async () => {
    const statements: Array<{ readonly sql: string; readonly values: ReadonlyArray<unknown> }> = [];
    const objects: Array<{ readonly body: string; readonly key: string }> = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: ReadonlyArray<unknown>) => ({
          run: async () => {
            statements.push({ sql, values });
            return { success: true };
          },
        }),
      }),
    };
    const artifactBucket = {
      put: async (key: string, body: string) => {
        objects.push({ body, key });
      },
    };

    await persistAgentTraceRun(
      {
        artifactBucket,
        artifactPrefix: "agent-runs/test",
        db,
        now: () => "2026-06-30T20:40:00.000Z",
      },
      {
        agentName: "daily-note-analysis",
        completedAt: "2026-06-30T20:40:00.000Z",
        evalCaseIds: ["okf-reviewable-write-policy"],
        id: "agent-run-1",
        outcomeLabels: ["completed", "items:2"],
        startedAt: "2026-06-30T20:39:55.000Z",
        status: "completed",
        toolCalls: [
          {
            durationMs: 1200,
            resultCount: 2,
            status: "completed",
            tool: "daily-note-analysis-extract-with-think",
          },
        ],
        traceId: "trace-1",
        userId: "user-1",
      },
    );

    expect(objects).toEqual([
      {
        key: "agent-runs/test/agent-run-1.json",
        body: expect.stringContaining("daily-note-analysis-extract-with-think"),
      },
    ]);
    expect(statements[0]!.sql).toContain("INSERT OR REPLACE INTO agent_runs");
    expect(statements[0]!.values).toEqual([
      "agent-run-1",
      "trace-1",
      "user-1",
      "daily-note-analysis",
      "completed",
      "2026-06-30T20:39:55.000Z",
      "2026-06-30T20:40:00.000Z",
      expect.stringContaining('"toolCallCount":1'),
      "agent-runs/test/agent-run-1.json",
      "2026-06-30T20:40:00.000Z",
    ]);
  });
});
