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

export interface FinalizeRequestWideEventInput {
  readonly base: WideEvent;
  readonly durationMs: number;
  readonly now: string;
  readonly status: number;
}

export interface TraceEventRowInput {
  readonly event: WideEvent;
  readonly id: string;
  readonly now: string;
}

export interface RootServerSpanInput {
  readonly durationMs: number;
  readonly endedAt: string;
  readonly event: WideEvent;
  readonly parentSpanId?: string | null;
  readonly spanId: string;
  readonly startedAt: string;
  readonly traceId: string;
}

export interface TraceSpanRowInput {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly durationMs: number;
  readonly endedAt: string;
  readonly environment: string;
  readonly httpStatus?: number | null;
  readonly kind: "server" | "client" | "internal" | "producer" | "consumer";
  readonly method?: string | null;
  readonly name: string;
  readonly outcome?: string | null;
  readonly parentSpanId: string | null;
  readonly path?: string | null;
  readonly requestId?: string | null;
  readonly routeName?: string | null;
  readonly service: string;
  readonly spanId: string;
  readonly startedAt: string;
  readonly status: "ok" | "error" | "unset";
  readonly traceId: string;
  readonly version: string;
}

export interface SqlInsertRow {
  readonly sql: string;
  readonly values: ReadonlyArray<unknown>;
}

export interface TraceCacheDb {
  readonly prepare: (sql: string) => {
    readonly bind: (...values: ReadonlyArray<unknown>) => {
      readonly run: () => Promise<unknown>;
    };
  };
}

export interface AgentTraceArtifactBucket {
  readonly put: (key: string, body: string) => Promise<unknown>;
}

export interface AgentTraceRunToolCallSummary {
  readonly durationMs?: number;
  readonly resultCount?: number;
  readonly status: "completed" | "failed" | "skipped";
  readonly tool: string;
}

export interface AgentTraceRunInput {
  readonly agentName: string;
  readonly completedAt?: string | null;
  readonly evalCaseIds?: ReadonlyArray<string>;
  readonly id?: string;
  readonly outcomeLabels?: ReadonlyArray<string>;
  readonly startedAt: string;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly toolCalls?: ReadonlyArray<AgentTraceRunToolCallSummary>;
  readonly traceId?: string | null;
  readonly userId?: string | null;
}

export interface AgentTraceSinkConfig {
  readonly artifactBucket?: AgentTraceArtifactBucket;
  readonly artifactPrefix?: string;
  readonly db: TraceCacheDb;
  readonly now?: () => string;
}

const randomHex = (bytes: number) => {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
};

export const createTraceId = () => randomHex(16);
export const createSpanId = () => randomHex(8);

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

export const isTransientBackpressureError = (cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /\b(rate limit|too many requests|overloaded|temporarily unavailable|timeout|timed out|database is locked|D1_ERROR)\b/i.test(
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

export const buildTraceEventRow = (input: TraceEventRowInput): SqlInsertRow => {
  return {
    sql: `INSERT INTO trace_events (
      id,
      timestamp,
      event,
      log_kind,
      service,
      environment,
      version,
      request_id,
      route_name,
      method,
      path,
      status,
      outcome,
      duration_ms,
      sample_reason,
      artifact_key,
      payload,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      input.id,
      stringField(input.event, "timestamp", input.now),
      stringField(input.event, "event", "unknown"),
      stringField(input.event, "logKind", "wide_event"),
      stringField(input.event, "service", "lares-web"),
      stringField(input.event, "environment", "unknown"),
      stringField(input.event, "version", "0.0.0"),
      nullableStringField(input.event, "requestId"),
      nullableStringField(input.event, "routeName"),
      nullableStringField(input.event, "method"),
      nullableStringField(input.event, "path"),
      numberField(input.event, "status"),
      nullableStringField(input.event, "outcome"),
      numberField(input.event, "durationMs"),
      nullableStringField(input.event, "sampleReason"),
      nullableStringField(input.event, "artifactKey"),
      JSON.stringify(input.event),
      input.now,
    ],
  };
};

export const buildRootServerSpan = (input: RootServerSpanInput): SqlInsertRow => {
  const status = numberField(input.event, "status");
  const method = stringField(input.event, "method", "HTTP");
  const path = stringField(input.event, "path", "/");
  const routeName = nullableStringField(input.event, "routeName");

  return buildTraceSpanRow({
    attributes: {
      "http.request.method": method,
      "http.route": routeName,
      "url.path": path,
      "user_agent.original": nullableStringField(input.event, "userAgent"),
      "lares.request_id": nullableStringField(input.event, "requestId"),
      "lares.sampled": input.event.sampled === true,
    },
    durationMs: input.durationMs,
    endedAt: input.endedAt,
    environment: stringField(input.event, "environment", "unknown"),
    httpStatus: status,
    kind: "server",
    method: nullableStringField(input.event, "method"),
    name: `${method} ${path}`,
    outcome: nullableStringField(input.event, "outcome"),
    parentSpanId: input.parentSpanId ?? null,
    path: nullableStringField(input.event, "path"),
    requestId: nullableStringField(input.event, "requestId"),
    routeName,
    service: stringField(input.event, "service", "lares-web"),
    spanId: input.spanId,
    startedAt: input.startedAt,
    status: status && status >= 500 ? "error" : "ok",
    traceId: input.traceId,
    version: stringField(input.event, "version", "0.0.0"),
  });
};

export const buildTraceSpanRow = (input: TraceSpanRowInput): SqlInsertRow => {
  return {
    sql: `INSERT INTO trace_spans (
      trace_id,
      span_id,
      parent_span_id,
      name,
      kind,
      status,
      started_at,
      ended_at,
      duration_ms,
      service,
      environment,
      version,
      request_id,
      route_name,
      method,
      path,
      http_status,
      outcome,
      attributes,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      input.traceId,
      input.spanId,
      input.parentSpanId,
      input.name,
      input.kind,
      input.status,
      input.startedAt,
      input.endedAt,
      input.durationMs,
      input.service,
      input.environment,
      input.version,
      input.requestId ?? null,
      input.routeName ?? null,
      input.method ?? null,
      input.path ?? null,
      input.httpStatus ?? null,
      input.outcome ?? null,
      JSON.stringify(input.attributes),
      input.endedAt,
    ],
  };
};

export const persistTraceCacheEvent = (db: TraceCacheDb, input: TraceEventRowInput) =>
  runTraceCacheRow(db, buildTraceEventRow(input));

export const persistTraceCacheSpan = (db: TraceCacheDb, row: SqlInsertRow) => {
  return runTraceCacheRow(db, row);
};

export const pruneTraceCache = (db: TraceCacheDb) =>
  Effect.gen(function* () {
    yield* runTraceCacheStatement(
      db,
      "DELETE FROM trace_spans WHERE julianday(created_at) < julianday('now', '-7 days')",
    );
    yield* runTraceCacheStatement(
      db,
      "DELETE FROM trace_spans WHERE span_id NOT IN (SELECT span_id FROM trace_spans ORDER BY created_at DESC LIMIT 5000)",
    );
    yield* runTraceCacheStatement(
      db,
      "DELETE FROM trace_events WHERE julianday(created_at) < julianday('now', '-7 days')",
    );
    yield* runTraceCacheStatement(
      db,
      "DELETE FROM trace_events WHERE id NOT IN (SELECT id FROM trace_events ORDER BY created_at DESC LIMIT 1000)",
    );
  });

export const persistAgentTraceRun = async (
  config: AgentTraceSinkConfig,
  input: AgentTraceRunInput,
) => {
  const id = input.id ?? crypto.randomUUID();
  const now = config.now?.() ?? new Date().toISOString();
  const artifactKey = config.artifactBucket
    ? `${config.artifactPrefix ?? "agent-runs"}/${id}.json`
    : null;
  const toolCalls = input.toolCalls ?? [];
  const evalCaseIds = input.evalCaseIds ?? [];
  const outcomeLabels = input.outcomeLabels ?? [];
  const summary = JSON.stringify({
    evalCaseIds,
    outcomeLabels,
    status: input.status,
    toolCallCount: toolCalls.length,
  });

  if (artifactKey && config.artifactBucket) {
    await config.artifactBucket.put(
      artifactKey,
      JSON.stringify({
        agentName: input.agentName,
        completedAt: input.completedAt ?? null,
        evalCaseIds,
        outcomeLabels,
        startedAt: input.startedAt,
        status: input.status,
        toolCalls,
        traceId: input.traceId ?? null,
      }),
    );
  }

  await config.db
    .prepare(
      `INSERT OR REPLACE INTO agent_runs (
        id,
        trace_id,
        user_id,
        agent_name,
        status,
        started_at,
        completed_at,
        summary,
        artifact_key,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.traceId ?? null,
      input.userId ?? null,
      input.agentName,
      input.status,
      input.startedAt,
      input.completedAt ?? null,
      summary,
      artifactKey,
      now,
    )
    .run();
};

const runTraceCacheRow = (db: TraceCacheDb, row: SqlInsertRow) => {
  return Effect.tryPromise({
    try: () =>
      db
        .prepare(row.sql)
        .bind(...row.values)
        .run(),
    catch: (cause) => cause,
  }).pipe(Effect.asVoid);
};

const runTraceCacheStatement = (db: TraceCacheDb, sql: string) => {
  return Effect.tryPromise({
    try: () => db.prepare(sql).bind().run(),
    catch: (cause) => cause,
  }).pipe(Effect.asVoid);
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
