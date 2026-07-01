import { initLogger } from "evlog";
import { evlog, type EvlogVariables } from "evlog/hono";
import type { Context, MiddlewareHandler } from "hono";
import { timing } from "hono/timing";
import { Effect } from "effect";
import {
  buildRootServerSpan,
  buildDebugWideEventFields,
  buildTraceSpanRow,
  createSpanId,
  createTraceId,
  finalizeRequestWideEvent,
  persistTraceCacheEvent,
  persistTraceCacheSpan,
  pruneTraceCache,
  recordHttpRequestTelemetry,
  retryAfterSecondsFor,
  safeErrorFields,
} from "@vesta/observability";
import type { Env } from "./env";
import {
  ensureBraintrustTracing,
  flushBraintrustTracing,
  runBraintrustSpan,
} from "./braintrust-tracing";

export type ObservabilityHonoEnv = { Bindings: Env } & EvlogVariables;

export { retryAfterSecondsFor };

type AppContext = Context<ObservabilityHonoEnv>;
type AppMiddleware = MiddlewareHandler<ObservabilityHonoEnv>;

initLogger({
  drain: () => {},
  env: { service: "vesta-web" },
  redact: true,
  silent: true,
});

declare module "hono" {
  interface ContextVariableMap {
    traceContext?: RequestTraceContext;
    wideEvent?: Record<string, unknown>;
  }
}

interface RequestTraceContext {
  readonly cacheable: boolean;
  readonly parentSpanId: string | null;
  readonly rootSpanId: string;
  readonly traceId: string;
}

interface RequestSpanInput {
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly kind?: "server" | "client" | "internal" | "producer" | "consumer";
  readonly name: string;
}

const now = () => {
  try {
    return performance.now();
  } catch {
    return Date.now();
  }
};

const requestId = (request: Request) => {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
};

const parseTraceparent = (value: string | null) => {
  const match = value?.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/);
  if (!match) return null;
  return { flags: match[3], parentSpanId: match[2], traceId: match[1] };
};

const isTraceCacheRoute = (path: string) => path.startsWith("/api/traces");

export const addWideEventFields = (c: AppContext, fields: Record<string, unknown>) => {
  const current = c.get("wideEvent") ?? {};
  c.set("wideEvent", { ...current, ...fields });
  c.get("log").set(fields);
};

export const wideEventFields = (fields: Record<string, unknown>): AppMiddleware => {
  return (c, next) => {
    addWideEventFields(c, fields);
    return next();
  };
};

export const wideEventFieldsFrom = (
  readFields: (c: AppContext) => Record<string, unknown> | undefined,
): AppMiddleware => {
  return (c, next) => {
    const fields = readFields(c);
    if (fields) addWideEventFields(c, fields);
    return next();
  };
};

export const evlogWideEvents = (): AppMiddleware => {
  return (c, next) =>
    evlog({
      drain: (event) => {
        if (c.env.LOG_HTTP_REQUESTS !== "false") console.log(JSON.stringify(event));
      },
      keep: (ctx) => {
        if (ctx.status && ctx.status >= 400) ctx.shouldKeep = true;
        if (ctx.duration && ctx.duration >= 2_000) ctx.shouldKeep = true;
      },
    })(c, next);
};

export const requestObservability = (): AppMiddleware => {
  return async (c, next) => {
    const startedAt = now();
    const startedAtIso = new Date().toISOString();
    const id = requestId(c.req.raw);
    const incomingTrace = parseTraceparent(c.req.header("traceparent") ?? null);
    const traceId = incomingTrace?.traceId ?? createTraceId();
    const spanId = createSpanId();
    const path = new URL(c.req.url).pathname;
    const cacheable = !isTraceCacheRoute(path);

    c.header("x-request-id", id);
    c.header("traceparent", `00-${traceId}-${spanId}-${incomingTrace?.flags ?? "01"}`);
    c.set("traceContext", {
      cacheable,
      parentSpanId: incomingTrace?.parentSpanId ?? null,
      rootSpanId: spanId,
      traceId,
    });
    c.set("wideEvent", {
      event: "http_request_completed",
      logKind: "wide_event",
      service: "vesta-web",
      environment: c.env.ENVIRONMENT ?? "unknown",
      version: c.env.APP_VERSION ?? "0.0.0",
      requestId: id,
      spanId,
      traceId,
      cfRay: c.req.header("cf-ray"),
      method: c.req.method,
      path,
      userAgent: c.req.header("user-agent"),
    });
    c.get("log").set(c.get("wideEvent") ?? {});
    ensureBraintrustTracing(c.env.BRAINTRUST_API_KEY);

    try {
      await runBraintrustSpan(
        {
          attributes: {
            "http.request.method": c.req.method,
            "vesta.environment": c.env.ENVIRONMENT ?? "unknown",
            "vesta.request_id": id,
            "vesta.version": c.env.APP_VERSION ?? "0.0.0",
            "url.path": path,
          },
          name: `${c.req.method} ${path}`,
          type: "task",
        },
        next,
      );
    } catch (cause) {
      addWideEventFields(c, {
        status: 500,
        outcome: "error",
        ...safeErrorFields(cause),
      });
      c.get("log").error(cause instanceof Error ? cause : new Error(String(cause)));
      c.res = Response.json({ error: "Internal Server Error" }, { status: 500 });
    } finally {
      const durationMs = now() - startedAt;
      const endedAtIso = new Date().toISOString();
      const status = c.res.status;

      await Effect.runPromise(
        recordHttpRequestTelemetry({
          method: c.req.method,
          path,
          status,
          durationMs,
        }),
      );

      const wideEvent = finalizeRequestWideEvent({
        base: c.get("wideEvent") ?? {},
        durationMs,
        now: new Date().toISOString(),
        status,
      });
      const debugWideEvent = { ...wideEvent, ...buildDebugWideEventFields({ event: wideEvent }) };

      c.get("log").set(debugWideEvent);

      if (cacheable && typeof c.env.DB?.prepare === "function") {
        runBackgroundEffect(
          c,
          Effect.gen(function* () {
            yield* persistTraceEvent(c, debugWideEvent);
            yield* persistRootTraceSpan(c, {
              ...debugWideEvent,
              durationMs,
              endedAt: endedAtIso,
              parentSpanId: incomingTrace?.parentSpanId ?? null,
              startedAt: startedAtIso,
              traceId,
            });
            yield* pruneTraceCache(c.env.DB).pipe(
              Effect.catch((cause) =>
                Effect.sync(() => {
                  console.warn(
                    JSON.stringify({
                      event: "trace_cache_prune_failed",
                      logKind: "wide_event",
                      service: "vesta-web",
                      requestId: nullableStringField(c.get("wideEvent") ?? {}, "requestId"),
                      ...safeErrorFields(cause),
                    }),
                  );
                }),
              ),
            );
          }),
        );
      }

      runBackgroundPromise(
        c,
        flushBraintrustTracing(c.env.BRAINTRUST_API_KEY),
        "braintrust_trace_flush_failed",
      );
    }
  };
};

export const runWithRequestSpan = async <A>(
  c: AppContext,
  input: RequestSpanInput,
  task: () => Promise<A>,
) => {
  const traceContext = c.get("traceContext");
  const startedAt = now();
  const startedAtIso = new Date().toISOString();
  const spanId = createSpanId();
  let spanStatus: "ok" | "error" = "ok";

  try {
    return await runBraintrustSpan(
      {
        attributes: {
          ...(input.attributes ?? {}),
          "span.kind": input.kind ?? "internal",
        },
        name: input.name,
      },
      task,
    );
  } catch (cause) {
    spanStatus = "error";
    throw cause;
  } finally {
    if (traceContext?.cacheable && typeof c.env.DB?.prepare === "function") {
      const event = c.get("wideEvent") ?? {};
      const row = buildTraceSpanRow({
        attributes: input.attributes ?? {},
        durationMs: Number((now() - startedAt).toFixed(2)),
        endedAt: new Date().toISOString(),
        environment: stringField(event, "environment", c.env.ENVIRONMENT ?? "unknown"),
        httpStatus: numberField(event, "status"),
        kind: input.kind ?? "internal",
        method: nullableStringField(event, "method"),
        name: input.name,
        outcome: spanStatus === "error" ? "error" : "success",
        parentSpanId: traceContext.rootSpanId,
        path: nullableStringField(event, "path"),
        requestId: nullableStringField(event, "requestId"),
        routeName: nullableStringField(event, "routeName"),
        service: stringField(event, "service", "vesta-web"),
        spanId,
        startedAt: startedAtIso,
        status: spanStatus,
        traceId: traceContext.traceId,
        version: stringField(event, "version", c.env.APP_VERSION ?? "0.0.0"),
      });

      runBackgroundEffect(c, persistTraceSpanRow(c, row));
    }
  }
};

export const serverTiming = () => {
  return timing({
    total: true,
    totalDescription: "Total Response Time",
  });
};

const stringField = (event: Record<string, unknown>, key: string, fallback = "") => {
  const value = event[key];
  return typeof value === "string" ? value : fallback;
};

const nullableStringField = (event: Record<string, unknown>, key: string) => {
  const value = event[key];
  return typeof value === "string" ? value : null;
};

const numberField = (event: Record<string, unknown>, key: string) => {
  const value = event[key];
  return typeof value === "number" ? value : null;
};

const persistTraceEvent = (c: AppContext, event: Record<string, unknown>) => {
  if (typeof c.env.DB?.prepare !== "function") return Effect.void;

  return persistTraceCacheEvent(c.env.DB, {
    event,
    id: crypto.randomUUID(),
    now: new Date().toISOString(),
  }).pipe(
    Effect.catch((cause) =>
      Effect.sync(() => {
        console.warn(
          JSON.stringify({
            event: "trace_event_persist_failed",
            logKind: "wide_event",
            service: "vesta-web",
            requestId: nullableStringField(event, "requestId"),
            ...safeErrorFields(cause),
          }),
        );
      }),
    ),
    Effect.asVoid,
  );
};

const persistRootTraceSpan = (c: AppContext, event: Record<string, unknown>) => {
  if (typeof c.env.DB?.prepare !== "function") return Effect.void;

  const row = buildRootServerSpan({
    durationMs: numberField(event, "durationMs") ?? 0,
    endedAt: stringField(event, "endedAt", new Date().toISOString()),
    event,
    parentSpanId: nullableStringField(event, "parentSpanId"),
    spanId: stringField(event, "spanId", createSpanId()),
    startedAt: stringField(event, "startedAt", new Date().toISOString()),
    traceId: stringField(event, "traceId", createTraceId()),
  });

  return persistTraceSpanRow(c, row);
};

const persistTraceSpanRow = (
  c: AppContext,
  row: { readonly sql: string; readonly values: ReadonlyArray<unknown> },
) => {
  return persistTraceCacheSpan(c.env.DB, row).pipe(
    Effect.catch((cause) =>
      Effect.sync(() => {
        console.warn(
          JSON.stringify({
            event: "trace_span_persist_failed",
            logKind: "wide_event",
            service: "vesta-web",
            requestId: nullableStringField(c.get("wideEvent") ?? {}, "requestId"),
            ...safeErrorFields(cause),
          }),
        );
      }),
    ),
    Effect.asVoid,
  );
};

const safeExecutionContext = (c: AppContext) => {
  try {
    return typeof c.executionCtx?.waitUntil === "function" ? c.executionCtx : null;
  } catch {
    return null;
  }
};

const runBackgroundEffect = (c: AppContext, effect: Effect.Effect<void, unknown>) => {
  const persistence = Effect.runPromise(effect);
  const executionCtx = safeExecutionContext(c);
  if (executionCtx) {
    executionCtx.waitUntil(persistence);
    return;
  }
};

const runBackgroundPromise = (c: AppContext, promise: Promise<unknown>, failureEvent: string) => {
  const guarded = promise.catch((cause) => {
    console.warn(
      JSON.stringify({
        event: failureEvent,
        logKind: "wide_event",
        service: "vesta-web",
        requestId: nullableStringField(c.get("wideEvent") ?? {}, "requestId"),
        ...safeErrorFields(cause),
      }),
    );
  });
  const executionCtx = safeExecutionContext(c);
  if (executionCtx) executionCtx.waitUntil(guarded);
};
