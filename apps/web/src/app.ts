import { Hono } from "hono";
import { Layer } from "effect";
import { createEvalTraceSink, runAgentEvalSuite } from "@nudge/evals";
import type { Env } from "./env";
import type { HonoHandlerContext } from "./request-context";
import type { NudgeAppRuntime, NudgeOkfSandboxFactory, RunEffect } from "./Services/NudgeApp";
import {
  createClerkDesktopSignInToken,
  resolveClerkSession,
  type AuthSessionResolver,
  type DesktopSignInTokenFactory,
} from "./auth";
import { resolveDbLayerForEnv } from "./db-layer";
import {
  makeNudgeAppRuntime,
  resolveNudgeApp,
  runNudgeAppDbEffect,
  type NudgeAppDbLayer,
} from "./Layers/NudgeAppLive";
import { handleNudgeMcpRequest } from "./mcp";
import {
  addWideEventFields,
  evlogWideEvents,
  type ObservabilityHonoEnv,
  requestObservability,
  retryAfterSecondsFor,
  safeErrorFields,
  runWithRequestSpan,
  serverTiming,
  withRequestTraceContext,
  wideEventFields,
} from "./observability";
import { defaultOkfSandboxFactory } from "./okf-sandbox-live";
import { resolveCurrentUser } from "./request-auth";
import { registerApiRoutes } from "./routes/api";
import { registerStaticRoutes } from "./routes/static";
import { captureWebWorkerException, sentryRequestMiddleware } from "./sentry";

interface CreateAppOptions {
  readonly authSessionResolver?: AuthSessionResolver;
  readonly dbLayer?: NudgeAppDbLayer;
  readonly desktopSignInTokenFactory?: DesktopSignInTokenFactory;
  readonly okfSandboxFactory?: NudgeOkfSandboxFactory;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<ObservabilityHonoEnv>();
  const okfSandboxFactory = options.okfSandboxFactory ?? defaultOkfSandboxFactory;
  const resolveSession = options.authSessionResolver ?? resolveClerkSession;
  const desktopSignInTokenFactory =
    options.desktopSignInTokenFactory ?? createClerkDesktopSignInToken;
  const runtimeMemoMap = Layer.makeMemoMapUnsafe();
  const appRuntimes = new WeakMap<Env, NudgeAppRuntime>();
  const runtimeForEnv = (env: Env) => {
    const existing = appRuntimes.get(env);
    if (existing) return existing;
    const runtime = makeNudgeAppRuntime({
      dbLayer: resolveDbLayerForEnv(env, options.dbLayer),
      env,
      memoMap: runtimeMemoMap,
      okfSandboxFactory,
      resolveSession,
    });
    appRuntimes.set(env, runtime);
    return runtime;
  };
  const resolveRequestApp = async (c: HonoHandlerContext) => {
    const appRuntime = runtimeForEnv(c.env);
    const appServices = await runWithRequestSpan(
      c,
      {
        attributes: { "nudge.layer": "NudgeApp" },
        kind: "client",
        name: "app.resolve",
      },
      () => resolveNudgeApp(appRuntime),
    );
    const runEffect: RunEffect = (effect) =>
      runNudgeAppDbEffect(appRuntime, withRequestTraceContext(c, effect));
    return { appServices, runEffect };
  };

  app.use(sentryRequestMiddleware(app));
  app.use("*", evlogWideEvents());
  app.use("*", requestObservability());
  app.use("*", serverTiming());

  app.all("/__clerk/*", wideEventFields({ routeName: "clerk.proxy" }), async (c) => {
    const secretKey = c.env.CLERK_SECRET_KEY;
    if (!secretKey) return c.json({ error: "CLERK_SECRET_KEY is required" }, 503);

    const requestUrl = new URL(c.req.url);
    if (requestUrl.pathname === "/__clerk/v1/proxy-health") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const clerkPath = decodeClerkProxyPath(requestUrl.pathname.slice("/__clerk".length) || "/");
    const targetUrl = new URL(clerkPath, "https://frontend-api.clerk.dev");
    targetUrl.search = requestUrl.search;

    const proxyHeaders = new Headers(c.req.raw.headers);
    proxyHeaders.delete("host");
    proxyHeaders.delete("content-length");
    proxyHeaders.set("Clerk-Proxy-Url", clerkProxyUrl(c.req.url, c.env));
    proxyHeaders.set("Clerk-Secret-Key", secretKey);
    proxyHeaders.set("X-Forwarded-For", c.req.header("CF-Connecting-IP") ?? "");

    const proxyInit: RequestInit = {
      headers: proxyHeaders,
      method: c.req.raw.method,
      redirect: "manual",
    };
    const proxyBody = clerkProxyBody(c.req.raw);
    if (proxyBody) proxyInit.body = proxyBody;

    const proxyRequest = new Request(targetUrl.toString(), proxyInit);
    const response = await fetch(proxyRequest);

    return clerkProxyResponse(response, clerkPath);
  });

  app.post(
    "/__internal/evals/agent",
    wideEventFields({ routeName: "internal.evals.agent" }),
    async (c) => {
      if (!isEvalRunRequestAuthorized(c.req.raw, c.env)) return c.notFound();
      if (typeof c.env.DB?.prepare !== "function") {
        return c.json({ error: "D1 is not configured" }, 503);
      }

      const runId = crypto.randomUUID();
      const artifactPrefix = "evals/cloudflare";
      const report = await runAgentEvalSuite({
        artifactSink: createEvalTraceSink({
          artifactPrefix,
          db: c.env.DB,
          runId,
          ...(c.env.TRACE_ARTIFACTS ? { artifactBucket: c.env.TRACE_ARTIFACTS } : {}),
        }),
      });

      return c.json({
        artifactKey: `${artifactPrefix}/${runId}.jsonl`,
        candidateSummaries: report.candidateSummaries.length,
        guidanceResults: report.guidanceResults.length,
        passed: report.passed,
        results: report.results.length,
        runId,
        score: report.score,
      });
    },
  );

  registerStaticRoutes(app);

  app.on(["GET", "POST", "OPTIONS"], "/mcp", wideEventFields({ routeName: "mcp" }), async (c) => {
    const { appServices, runEffect } = await resolveRequestApp(c);
    const auth = await runWithRequestSpan(
      c,
      { attributes: { "nudge.auth.provider": "clerk" }, name: "auth.current_user" },
      () => resolveCurrentUser({ app: appServices, request: c.req.raw }),
    );
    if (!auth.user) return c.json({ error: "Authentication required" }, 401);
    return handleNudgeMcpRequest(c.req.raw, {
      db: appServices.db,
      runEffect,
      user: auth.user,
      version: appServices.version,
    });
  });

  registerApiRoutes(app, resolveRequestApp, desktopSignInTokenFactory);

  app.onError((error, c) => {
    captureWebWorkerException(error, {
      tags: {
        path: new URL(c.req.url).pathname,
      },
    });
    const retryAfterSeconds = retryAfterSecondsFor(error);
    const status = retryAfterSeconds === null ? 500 : 503;
    addWideEventFields(c, {
      status,
      outcome: "error",
      ...safeErrorFields(error),
      ...(retryAfterSeconds !== null
        ? { retryAfterSeconds, resilienceKind: "transient_backpressure" }
        : {}),
    });

    if (retryAfterSeconds !== null) {
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json({ error: "Service temporarily unavailable", retryAfterSeconds }, 503);
    }

    return c.json({ error: "Internal Server Error" }, status);
  });

  return app;
}

function isEvalRunRequestAuthorized(request: Request, env: Env) {
  const secret = env.AGENT_INTERNAL_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-nudge-eval-secret") === secret;
}

function clerkProxyUrl(requestUrl: string, env: Env) {
  const configured = env.CLERK_PROXY_URL?.trim();
  if (configured && configured.length > 0) return configured;

  const url = new URL(requestUrl);
  url.pathname = "/__clerk";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function clerkProxyBody(request: Request) {
  return request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
}

async function clerkProxyResponse(response: Response, clerkPath: string) {
  if (clerkPath === "/v1/environment" && isJsonResponse(response)) {
    const normalized = normalizeClerkEnvironmentBranding(await response.json());
    const headers = clerkProxyResponseHeaders(response.headers);
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(normalized), {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  return new Response(response.body, {
    headers: new Headers(response.headers),
    status: response.status,
    statusText: response.statusText,
  });
}

function isJsonResponse(response: Response) {
  return response.headers.get("content-type")?.toLowerCase().includes("application/json") === true;
}

function clerkProxyResponseHeaders(headers: Headers) {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete("content-length");
  return nextHeaders;
}

function normalizeClerkEnvironmentBranding(value: unknown) {
  if (!isRecord(value)) return value;

  const displayConfig = value.display_config;
  if (!isRecord(displayConfig)) return value;

  return {
    ...value,
    display_config: {
      ...displayConfig,
      application_name: "Nudge",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeClerkProxyPath(path: string) {
  return path
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}
