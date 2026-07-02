import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  buildRootServerSpan,
  buildDebugWideEventFields,
  buildTraceSpanRow,
  buildTraceEventRow,
  createSpanId,
  createTraceId,
  currentRuntimeTraceContext,
  finalizeRequestWideEvent,
  isTransientBackpressureError,
  parseTraceparent,
  persistTraceCacheEvent,
  persistTraceCacheSpan,
  pruneTraceCache,
  retryAfterSecondsFor,
  safeErrorFields,
  safeExceptionAttributes,
  shouldSampleWideEvent,
  statusGroup,
  traceparentHeader,
  withRuntimeTraceContext,
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
          service: "nudge-web",
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
      service: "nudge-web",
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
        service: "nudge-web",
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
      "nudge-web",
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
        service: "nudge-web",
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
      "nudge-web",
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
    expect(JSON.parse(String(span.values[18]))).toMatchObject({
      "otel.name": "health",
      "otel.status_code": "ERROR",
      "http.request.method": "GET",
      "http.response.status_code": 500,
      "http.route": "health",
      "url.path": "/health",
      "user_agent.original": "test-agent",
      "nudge.request_id": "ray-1",
      "nudge.outcome": "error",
      "nudge.debug_kind": "http",
      "nudge.sampled": true,
    });
  });

  test("adds wide-event fields useful for automatic debugging", () => {
    expect(
      buildDebugWideEventFields({
        event: {
          event: "http_request_completed",
          service: "nudge-web",
          environment: "test",
          version: "test-version",
          requestId: "ray-1",
          routeName: "api.journal.save",
          method: "POST",
          path: "/api/journal",
          status: 504,
          outcome: "error",
          durationMs: 10_001,
          sampleReason: "error",
          userAgent: "Nudge/1",
          aiSystem: "cloudflare-think",
          aiModel: "@cf/zai-org/glm-4.7-flash",
          aiRunId: "run-1",
          aiErrorCode: "AI_EXTRACTION_TIMEOUT",
          errorType: "TimeoutError",
          errorMessage: "The operation was aborted due to timeout",
        },
      }),
    ).toEqual({
      "otel.name": "api.journal.save",
      "otel.status_code": "ERROR",
      "http.request.method": "POST",
      "http.response.status_code": 504,
      "http.route": "api.journal.save",
      "url.path": "/api/journal",
      "user_agent.original": "Nudge/1",
      "service.name": "nudge-web",
      "service.version": "test-version",
      "deployment.environment.name": "test",
      "nudge.request_id": "ray-1",
      "nudge.outcome": "error",
      "nudge.duration_ms": 10001,
      "nudge.sample_reason": "error",
      "nudge.debug_kind": "ai",
      "nudge.ai.system": "cloudflare-think",
      "nudge.ai.model": "@cf/zai-org/glm-4.7-flash",
      "nudge.ai.run_id": "run-1",
      "nudge.ai.error_code": "AI_EXTRACTION_TIMEOUT",
      "exception.type": "TimeoutError",
      "exception.message": "The operation was aborted due to timeout",
      "exception.stacktrace": null,
    });
  });

  test("parses and builds W3C traceparent headers", () => {
    const traceId = "0123456789abcdef0123456789abcdef";
    const spanId = "0123456789abcdef";
    const header = traceparentHeader({ flags: "01", spanId, traceId });

    expect(header).toBe(`00-${traceId}-${spanId}-01`);
    expect(parseTraceparent(header)).toEqual({
      flags: "01",
      parentSpanId: spanId,
      traceId,
    });
    expect(parseTraceparent("not-a-traceparent")).toBeNull();
  });

  test("scopes runtime trace context to the current Effect fiber", async () => {
    const context = {
      cacheable: true,
      environment: "test",
      flags: "01",
      parentSpanId: "parent-1",
      requestId: "ray-1",
      rootSpanId: "root-1",
      service: "nudge-web",
      traceId: "trace-1",
      version: "test-version",
    };

    const inside = await Effect.runPromise(
      withRuntimeTraceContext(currentRuntimeTraceContext, context),
    );
    const outside = await Effect.runPromise(currentRuntimeTraceContext);

    expect(inside).toEqual(context);
    expect(outside).toBeNull();
  });

  test("keeps exception stack traces in span attributes", () => {
    const error = new Error("boom");
    expect(safeExceptionAttributes(error)).toMatchObject({
      "exception.type": "Error",
      "exception.message": "boom",
      "exception.stacktrace": expect.stringContaining("Error: boom"),
    });
  });

  test("builds reusable child spans without feature-specific route knowledge", () => {
    const span = buildTraceSpanRow({
      attributes: { "db.system.name": "cloudflare-d1", "nudge.operation": "db.resolve" },
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
      service: "nudge-web",
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
      "nudge-web",
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
            service: "nudge-web",
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
});
