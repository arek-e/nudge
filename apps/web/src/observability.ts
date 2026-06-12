import type { Context, MiddlewareHandler } from "hono";
import { timing } from "hono/timing";
import { Effect } from "effect";
import {
  recordHttpRequestTelemetry,
  safeErrorFields,
  shouldSampleWideEvent,
  statusGroup,
} from "@lares/observability";
import type { Env } from "./env";

type AppContext = Context<{ Bindings: Env }>;
type AppMiddleware = MiddlewareHandler<{ Bindings: Env }>;

declare module "hono" {
  interface ContextVariableMap {
    wideEvent?: Record<string, unknown>;
  }
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
};

export const requestObservability = (): AppMiddleware => {
  return async (c, next) => {
    const startedAt = now();
    const id = requestId(c.req.raw);
    const path = new URL(c.req.url).pathname;

    c.header("x-request-id", id);
    c.set("wideEvent", {
      event: "http_request_completed",
      logKind: "wide_event",
      service: "lares-web",
      environment: c.env.ENVIRONMENT ?? "unknown",
      version: c.env.APP_VERSION ?? "0.0.0",
      requestId: id,
      cfRay: c.req.header("cf-ray"),
      method: c.req.method,
      path,
      userAgent: c.req.header("user-agent"),
    });

    try {
      await next();
    } catch (cause) {
      addWideEventFields(c, {
        status: 500,
        outcome: "error",
        ...safeErrorFields(cause),
      });
      c.res = Response.json({ error: "Internal Server Error" }, { status: 500 });
    } finally {
      const durationMs = now() - startedAt;
      const status = c.res.status;
      const outcome = status >= 500 ? "error" : "success";

      await Effect.runPromise(
        recordHttpRequestTelemetry({
          method: c.req.method,
          path,
          status,
          durationMs,
        }),
      );

      const wideEvent = {
        ...c.get("wideEvent"),
        timestamp: new Date().toISOString(),
        status,
        statusGroup: statusGroup(status),
        outcome,
        durationMs: Number(durationMs.toFixed(2)),
      };
      const sampling = shouldSampleWideEvent(wideEvent);

      if (c.env.LOG_HTTP_REQUESTS !== "false" && sampling.sampled) {
        console.log(JSON.stringify({ ...wideEvent, ...sampling }));
      }

      await persistTraceEvent(c, { ...wideEvent, ...sampling });
    }
  };
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

const persistTraceEvent = async (c: AppContext, event: Record<string, unknown>) => {
  if (typeof c.env.DB?.prepare !== "function") return;

  const id = crypto.randomUUID();
  const timestamp = stringField(event, "timestamp", new Date().toISOString());
  const payload = JSON.stringify(event);

  try {
    await c.env.DB.prepare(
      `INSERT INTO trace_events (
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
    )
      .bind(
        id,
        timestamp,
        stringField(event, "event", "unknown"),
        stringField(event, "logKind", "wide_event"),
        stringField(event, "service", "lares-web"),
        stringField(event, "environment", "unknown"),
        stringField(event, "version", "0.0.0"),
        nullableStringField(event, "requestId"),
        nullableStringField(event, "routeName"),
        nullableStringField(event, "method"),
        nullableStringField(event, "path"),
        numberField(event, "status"),
        nullableStringField(event, "outcome"),
        numberField(event, "durationMs"),
        nullableStringField(event, "sampleReason"),
        nullableStringField(event, "artifactKey"),
        payload,
        new Date().toISOString(),
      )
      .run();
  } catch (cause) {
    console.warn(
      JSON.stringify({
        event: "trace_event_persist_failed",
        logKind: "wide_event",
        service: "lares-web",
        requestId: nullableStringField(event, "requestId"),
        ...safeErrorFields(cause),
      }),
    );
  }
};
