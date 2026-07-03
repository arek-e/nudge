import { initLogger } from "evlog";
import { evlog, type EvlogVariables } from "evlog/hono";
import type { Context, MiddlewareHandler } from "hono";
import { timing } from "hono/timing";
import { Effect } from "effect";
import {
  buildDebugWideEventFields,
  createSpanId,
  createTraceId,
  finalizeRequestWideEvent,
  parseTraceparent,
  recordHttpRequestTelemetry,
  retryAfterSecondsFor,
  safeErrorFields,
  traceparentHeader,
  type RuntimeTraceContext,
  withRuntimeTraceContext,
} from "@nudge/observability";
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
  env: { service: "nudge-web" },
  redact: true,
  silent: true,
});

declare module "hono" {
  interface ContextVariableMap {
    traceContext?: RuntimeTraceContext;
    wideEvent?: Record<string, unknown>;
  }
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
    const id = requestId(c.req.raw);
    const incomingTrace = parseTraceparent(c.req.header("traceparent") ?? null);
    const traceId = incomingTrace?.traceId ?? createTraceId();
    const spanId = createSpanId();
    const flags = incomingTrace?.flags ?? "01";
    const path = new URL(c.req.url).pathname;

    c.header("x-request-id", id);
    c.header("traceparent", traceparentHeader({ flags, spanId, traceId }));
    c.set("traceContext", {
      environment: c.env.ENVIRONMENT ?? "unknown",
      flags,
      method: c.req.method,
      parentSpanId: spanId,
      path,
      requestId: id,
      rootSpanId: spanId,
      service: "nudge-web",
      traceId,
      version: c.env.APP_VERSION ?? "0.0.0",
    });
    c.set("wideEvent", {
      event: "http_request_completed",
      logKind: "wide_event",
      service: "nudge-web",
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
            "nudge.environment": c.env.ENVIRONMENT ?? "unknown",
            "nudge.request_id": id,
            "nudge.version": c.env.APP_VERSION ?? "0.0.0",
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
  return runBraintrustSpan(
    {
      attributes: {
        ...(input.attributes ?? {}),
        "span.kind": input.kind ?? "internal",
      },
      name: input.name,
    },
    task,
  );
};

const requestRuntimeTraceContext = (c: AppContext) => c.get("traceContext");

export const withRequestTraceContext = <A, E, R>(c: AppContext, effect: Effect.Effect<A, E, R>) => {
  const traceContext = requestRuntimeTraceContext(c);
  return traceContext ? withRuntimeTraceContext(effect, traceContext) : effect;
};

export const requestTraceHeaders = (c: AppContext) => {
  const traceContext = requestRuntimeTraceContext(c);
  if (!traceContext) return {};

  return {
    traceparent: traceparentHeader({
      flags: traceContext.flags,
      spanId: traceContext.rootSpanId,
      traceId: traceContext.traceId,
    }),
    ...(traceContext.requestId ? { "x-request-id": traceContext.requestId } : {}),
  };
};

export const serverTiming = () => {
  return timing({
    total: true,
    totalDescription: "Total Response Time",
  });
};

const nullableStringField = (event: Record<string, unknown>, key: string) => {
  const value = event[key];
  return typeof value === "string" ? value : null;
};

const safeExecutionContext = (c: AppContext) => {
  try {
    return typeof c.executionCtx?.waitUntil === "function" ? c.executionCtx : null;
  } catch {
    return null;
  }
};

const runBackgroundPromise = (c: AppContext, promise: Promise<unknown>, failureEvent: string) => {
  const guarded = promise.catch((cause) => {
    console.warn(
      JSON.stringify({
        event: failureEvent,
        logKind: "wide_event",
        service: "nudge-web",
        requestId: nullableStringField(c.get("wideEvent") ?? {}, "requestId"),
        ...safeErrorFields(cause),
      }),
    );
  });
  const executionCtx = safeExecutionContext(c);
  if (executionCtx) executionCtx.waitUntil(guarded);
};
