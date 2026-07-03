import { Context, Effect, Metric, Option } from "effect";

export interface WideEvent {
  readonly [key: string]: unknown;
}

export interface SamplingDecision {
  readonly sampled: boolean;
  readonly sampleReason: "error" | "slow" | "default";
}

export interface HttpRequestTelemetryInput {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
}

export interface FinalizeRequestWideEventInput {
  readonly base: WideEvent;
  readonly durationMs: number;
  readonly now: string;
  readonly status: number;
}

export interface BuildDebugWideEventInput {
  readonly event: WideEvent;
}

export interface Traceparent {
  readonly flags: string;
  readonly parentSpanId: string;
  readonly traceId: string;
}

export interface RuntimeTraceContext {
  readonly environment: string;
  readonly flags: string;
  readonly method?: string | null;
  readonly parentSpanId: string | null;
  readonly path?: string | null;
  readonly requestId?: string | null;
  readonly rootSpanId: string;
  readonly routeName?: string | null;
  readonly service: string;
  readonly traceId: string;
  readonly version: string;
}

const randomHex = (bytes: number) => {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
};

export const createTraceId = () => randomHex(16);
export const createSpanId = () => randomHex(8);

export class RuntimeTrace extends Context.Service<RuntimeTrace, RuntimeTraceContext>()(
  "nudge/observability/RuntimeTrace",
) {}

export const currentRuntimeTraceContext = Effect.context<never>().pipe(
  Effect.map((context) => Option.getOrNull(Context.getOption(context, RuntimeTrace))),
);

export const withRuntimeTraceContext = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  context: RuntimeTraceContext,
) => Effect.provideService(effect, RuntimeTrace, RuntimeTrace.of(context));

export const parseTraceparent = (value: string | null): Traceparent | null => {
  const match = value?.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/);
  if (!match) return null;
  const [, traceId, parentSpanId, flags] = match;
  if (!traceId || !parentSpanId || !flags) return null;
  return { flags, parentSpanId, traceId };
};

export const traceparentHeader = (input: {
  readonly flags?: string | null;
  readonly spanId: string;
  readonly traceId: string;
}) => `00-${input.traceId}-${input.spanId}-${input.flags ?? "01"}`;

export const statusGroup = (status: number) => `${Math.floor(status / 100)}xx`;

export const safeErrorFields = (cause: unknown) => {
  if (cause instanceof Error) {
    return {
      errorType: cause.name,
      errorMessage: cause.message,
    };
  }

  return {
    errorType: typeof cause,
    errorMessage: String(cause),
  };
};

export const safeExceptionAttributes = (cause: unknown) => {
  const safe = safeErrorFields(cause);
  return {
    "exception.type": safe.errorType,
    "exception.message": safe.errorMessage,
    ...(cause instanceof Error && cause.stack ? { "exception.stacktrace": cause.stack } : {}),
  } satisfies WideEvent;
};

export const isTransientBackpressureError = (cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /\b(rate limit|too many requests|overloaded|temporarily unavailable|timeout|timed out|database is locked)\b/i.test(
    message,
  );
};

export const retryAfterSecondsFor = (cause: unknown) => {
  return isTransientBackpressureError(cause) ? 5 : null;
};

export const shouldSampleWideEvent = (event: WideEvent): SamplingDecision => {
  const status = Number(event.status ?? 0);
  const durationMs = Number(event.durationMs ?? 0);

  if (status >= 500 || event.outcome === "error") {
    return { sampled: true, sampleReason: "error" };
  }

  if (durationMs >= 2_000) {
    return { sampled: true, sampleReason: "slow" };
  }

  return { sampled: true, sampleReason: "default" };
};

const stringField = (event: WideEvent, key: string, fallback = "") => {
  const value = event[key];
  return typeof value === "string" ? value : fallback;
};

const nullableStringField = (event: WideEvent, key: string) => {
  const value = event[key];
  return typeof value === "string" ? value : null;
};

const numberField = (event: WideEvent, key: string) => {
  const value = event[key];
  return typeof value === "number" ? value : null;
};

export const finalizeRequestWideEvent = (input: FinalizeRequestWideEventInput) => {
  const event = {
    ...input.base,
    timestamp: input.now,
    status: input.status,
    statusGroup: statusGroup(input.status),
    outcome: input.status >= 500 ? "error" : "success",
    durationMs: Number(input.durationMs.toFixed(2)),
  } satisfies WideEvent;

  return { ...event, ...shouldSampleWideEvent(event) };
};

export const buildDebugWideEventFields = (input: BuildDebugWideEventInput) => {
  const event = input.event;
  const status = numberField(event, "status");
  const path = nullableStringField(event, "path");
  const routeName = nullableStringField(event, "routeName");
  const aiSystem = nullableStringField(event, "aiSystem");
  const aiModel = nullableStringField(event, "aiModel");
  const errorType = nullableStringField(event, "errorType");

  return {
    "otel.name": stringField(event, "routeName", stringField(event, "event", "unknown")),
    "otel.status_code": status && status >= 500 ? "ERROR" : "OK",
    "http.request.method": nullableStringField(event, "method"),
    "http.response.status_code": status,
    "http.route": routeName,
    "url.path": path,
    "user_agent.original": nullableStringField(event, "userAgent"),
    "service.name": stringField(event, "service", "nudge-web"),
    "service.version": stringField(event, "version", "0.0.0"),
    "deployment.environment.name": stringField(event, "environment", "unknown"),
    "vesta.request_id": nullableStringField(event, "requestId"),
    "vesta.outcome": nullableStringField(event, "outcome"),
    "vesta.duration_ms": numberField(event, "durationMs"),
    "vesta.sample_reason": nullableStringField(event, "sampleReason"),
    "vesta.debug_kind": path?.startsWith("/api/agent-runs/")
      ? "agent_run_poll"
      : aiSystem
        ? "ai"
        : "http",
    "vesta.ai.system": aiSystem,
    "vesta.ai.model": aiModel,
    "vesta.ai.run_id": nullableStringField(event, "aiRunId"),
    "vesta.ai.error_code": nullableStringField(event, "aiErrorCode"),
    "exception.type": errorType,
    "exception.message": nullableStringField(event, "errorMessage"),
  } satisfies WideEvent;
};

const httpRequestsTotal = Metric.counter("http_requests_total", {
  description: "Total HTTP requests handled by the Worker",
  incremental: true,
});

const httpRequestDurationMs = Metric.histogram("http_request_duration_ms", {
  description: "HTTP request duration in milliseconds",
  boundaries: Metric.linearBoundaries({ start: 0, width: 50, count: 20 }),
});

const httpResponseStatusCodes = Metric.frequency("http_response_status_codes", {
  description: "HTTP response status code frequency",
});

export const recordHttpRequestTelemetry = (input: HttpRequestTelemetryInput) => {
  return Effect.all([
    Metric.update(httpRequestsTotal, 1),
    Metric.update(httpRequestDurationMs, input.durationMs),
    Metric.update(httpResponseStatusCodes, String(input.status)),
  ]).pipe(
    Effect.withSpan("telemetry.record_http_request", {
      attributes: {
        method: input.method,
        path: input.path,
        status: String(input.status),
      },
    }),
    Effect.asVoid,
  );
};

export const readHttpTelemetrySnapshot = async () => {
  const [requests, durations, statuses] = await Effect.runPromise(
    Effect.all([
      Metric.value(httpRequestsTotal),
      Metric.value(httpRequestDurationMs),
      Metric.value(httpResponseStatusCodes),
    ]),
  );

  const statusCodes: Record<string, number> = {};
  const occurrences = readObjectProperty(statuses, "occurrences");
  if (occurrences instanceof Map) {
    for (const [status, count] of occurrences) {
      if (typeof status === "string" && typeof count === "number") {
        statusCodes[status] = count;
      }
    }
  }

  return {
    requestCount: readNumberProperty(requests, "count"),
    durationSamples: readNumberProperty(durations, "count"),
    statusCodes,
  };
};

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readNumberProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "number" ? property : 0;
}
