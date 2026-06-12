import { Effect, Metric } from "effect";

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
  const occurrences = (statuses as { occurrences?: Map<string, number> }).occurrences ?? new Map();
  for (const [status, count] of occurrences) {
    statusCodes[status] = count;
  }

  return {
    requestCount: Number((requests as { count?: number }).count ?? 0),
    durationSamples: Number((durations as { count?: number }).count ?? 0),
    statusCodes,
  };
};
