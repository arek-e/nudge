import { Hono } from "hono";
import { Layer } from "effect";
import { Db } from "@vesta/db";
import type { Env } from "./env";
import type { HonoHandlerContext } from "./request-context";
import type { VestaAppRuntime, VestaOkfSandboxFactory, RunEffect } from "./Services/VestaApp";
import { resolveBetterAuthSession, type AuthSessionResolver } from "./auth";
import {
  makeVestaAppRuntime,
  resolveVestaApp,
  runVestaAppDbEffect,
  type VestaAppDbLayer,
} from "./Layers/VestaAppLive";
import { handleVestaMcpRequest } from "./mcp";
import {
  addWideEventFields,
  evlogWideEvents,
  type ObservabilityHonoEnv,
  requestObservability,
  retryAfterSecondsFor,
  runWithRequestSpan,
  serverTiming,
  wideEventFields,
} from "./observability";
import { defaultOkfSandboxFactory } from "./okf-sandbox-live";
import { resolveCurrentUser } from "./request-auth";
import { registerApiRoutes } from "./routes/api";
import { registerAuthRoutes } from "./routes/auth";
import { registerStaticRoutes } from "./routes/static";

interface CreateAppOptions {
  readonly authSessionResolver?: AuthSessionResolver;
  readonly dbLayer?: VestaAppDbLayer;
  readonly okfSandboxFactory?: VestaOkfSandboxFactory;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<ObservabilityHonoEnv>();
  const okfSandboxFactory = options.okfSandboxFactory ?? defaultOkfSandboxFactory;
  const resolveSession = options.authSessionResolver ?? resolveBetterAuthSession;
  const runtimeMemoMap = Layer.makeMemoMapUnsafe();
  const appRuntimes = new WeakMap<Env, VestaAppRuntime>();
  const d1Layers = new WeakMap<D1Database, VestaAppDbLayer>();
  const dbLayerForEnv = (env: Env) => {
    if (options.dbLayer) return options.dbLayer;
    const existing = d1Layers.get(env.DB);
    if (existing) return existing;
    const layer = Db.layerD1(env.DB);
    d1Layers.set(env.DB, layer);
    return layer;
  };
  const runtimeForEnv = (env: Env) => {
    const existing = appRuntimes.get(env);
    if (existing) return existing;
    const runtime = makeVestaAppRuntime({
      dbLayer: dbLayerForEnv(env),
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
        attributes: { "vesta.layer": "VestaApp" },
        kind: "client",
        name: "app.resolve",
      },
      () => resolveVestaApp(appRuntime),
    );
    const runEffect: RunEffect = (effect) => runVestaAppDbEffect(appRuntime, effect);
    return { appServices, runEffect };
  };

  app.use("*", evlogWideEvents());
  app.use("*", requestObservability());
  app.use("*", serverTiming());

  registerStaticRoutes(app);

  app.on(["GET", "POST", "OPTIONS"], "/mcp", wideEventFields({ routeName: "mcp" }), async (c) => {
    const { appServices, runEffect } = await resolveRequestApp(c);
    const auth = await runWithRequestSpan(
      c,
      { attributes: { "vesta.auth.provider": "better-auth" }, name: "auth.current_user" },
      () => resolveCurrentUser({ app: appServices, headers: c.req.raw.headers }),
    );
    if (!auth.user) return c.json({ error: "Authentication required" }, 401);
    return handleVestaMcpRequest(c.req.raw, {
      db: appServices.db,
      runEffect,
      user: auth.user,
      version: appServices.version,
    });
  });

  registerAuthRoutes(app, resolveRequestApp);

  registerApiRoutes(app, resolveRequestApp);

  app.onError((error, c) => {
    const retryAfterSeconds = retryAfterSecondsFor(error);
    const status = retryAfterSeconds === null ? 500 : 503;
    addWideEventFields(c, {
      status,
      outcome: "error",
      errorType: error.name,
      errorMessage: error.message,
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
