import { Hono } from "hono";
import { Layer } from "effect";
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
  runWithRequestSpan,
  serverTiming,
  withRequestTraceContext,
  wideEventFields,
} from "./observability";
import { defaultOkfSandboxFactory } from "./okf-sandbox-live";
import { resolveCurrentUser } from "./request-auth";
import { registerApiRoutes } from "./routes/api";
import { registerStaticRoutes } from "./routes/static";

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

  app.use("*", evlogWideEvents());
  app.use("*", requestObservability());
  app.use("*", serverTiming());

  app.all("/__clerk/*", wideEventFields({ routeName: "clerk.proxy" }), async (c) => {
    const secretKey = c.env.CLERK_SECRET_KEY;
    if (!secretKey) return c.json({ error: "CLERK_SECRET_KEY is required" }, 503);

    const requestUrl = new URL(c.req.url);
    const clerkPath = requestUrl.pathname.slice("/__clerk".length) || "/";
    const targetUrl = new URL(clerkPath, "https://frontend-api.clerk.dev");
    targetUrl.search = requestUrl.search;

    const proxyRequest = new Request(targetUrl.toString(), c.req.raw);
    proxyRequest.headers.set("Clerk-Proxy-Url", clerkProxyUrl(c.req.url, c.env));
    proxyRequest.headers.set("Clerk-Secret-Key", secretKey);
    proxyRequest.headers.set("X-Forwarded-For", c.req.header("CF-Connecting-IP") ?? "");

    return fetch(proxyRequest);
  });

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
    const retryAfterSeconds = retryAfterSecondsFor(error);
    const status = retryAfterSeconds === null ? 500 : 503;
    addWideEventFields(c, {
      status,
      outcome: "error",
      errorType: error.name,
      errorMessage: error.message,
      ...(error.stack ? { errorStack: error.stack } : {}),
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

function clerkProxyUrl(requestUrl: string, env: Env) {
  const configured = env.CLERK_PROXY_URL?.trim();
  if (configured && configured.length > 0) return configured;

  const url = new URL(requestUrl);
  url.pathname = "/__clerk";
  url.search = "";
  url.hash = "";
  return url.toString();
}
