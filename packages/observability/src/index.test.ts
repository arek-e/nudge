import { describe, expect, test } from "bun:test";
import {
  buildDebugWideEventFields,
  createSpanId,
  createTraceId,
  finalizeRequestWideEvent,
  isTransientBackpressureError,
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
    const transient = new Error("database is locked");
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
      "vesta.request_id": "ray-1",
      "vesta.outcome": "error",
      "vesta.duration_ms": 10001,
      "vesta.sample_reason": "error",
      "vesta.debug_kind": "ai",
      "vesta.ai.system": "cloudflare-think",
      "vesta.ai.model": "@cf/zai-org/glm-4.7-flash",
      "vesta.ai.run_id": "run-1",
      "vesta.ai.error_code": "AI_EXTRACTION_TIMEOUT",
      "exception.type": "TimeoutError",
      "exception.message": "The operation was aborted due to timeout",
    });
  });

  test("creates OpenTelemetry-compatible trace and span identifiers", () => {
    expect(createTraceId()).toMatch(/^[a-f0-9]{32}$/);
    expect(createSpanId()).toMatch(/^[a-f0-9]{16}$/);
  });
});
