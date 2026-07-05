import { setContext, setTag, setUser } from "@sentry/cloudflare";
import { captureException, sentry } from "@sentry/hono/cloudflare";
import type { Hono } from "hono";
import {
  buildNudgeSentryContext,
  redactSentryEvent,
  resolveSentryConfig,
  type NudgeSentryContextInput,
} from "@nudge/observability/sentry";
import type { Env } from "./env";
import type { ObservabilityHonoEnv } from "./observability";

const releaseName = (version?: string | null) => {
  const normalized = version?.trim();
  return normalized && normalized.length > 0 ? `nudge-web-worker@${normalized}` : undefined;
};

export const sentryRequestMiddleware = (app: Hono<ObservabilityHonoEnv>) => {
  return sentry(app, (env: Env) => {
    const config = resolveSentryConfig({
      dsn: env.SENTRY_DSN,
      enabled: env.SENTRY_ENABLED,
      environment: env.ENVIRONMENT,
      release: releaseName(env.APP_VERSION),
      surface: "web-worker",
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    });

    if (!config) return { enabled: false };

    const nudgeContext = buildNudgeSentryContext({
      appSurface: "server",
      runtimeSurface: "cloudflare-worker",
    });

    return {
      beforeSend: (event) => redactSentryEvent(event),
      dataCollection: {
        httpBodies: [],
        userInfo: false,
      },
      dsn: config.dsn,
      environment: config.environment,
      initialScope: {
        contexts: nudgeContext.contexts,
        tags: { ...config.tags, ...nudgeContext.tags },
      },
      ...(config.release ? { release: config.release } : {}),
      tracesSampleRate: config.tracesSampleRate,
    };
  });
};

export const setWebWorkerSentryContext = (input: NudgeSentryContextInput) => {
  const context = buildNudgeSentryContext(input);
  for (const [key, value] of Object.entries(context.tags)) {
    setTag(key, value);
  }
  setContext("nudge", context.contexts.nudge);
  setUser(context.user ?? null);
};

export const captureWebWorkerException = (
  cause: unknown,
  input: {
    readonly extra?: Readonly<Record<string, unknown>>;
    readonly tags?: Readonly<Record<string, string>>;
  } = {},
) => {
  captureException(cause, {
    ...(input.extra ? { extra: input.extra } : {}),
    tags: {
      surface: "web-worker",
      ...(input.tags ?? {}),
    },
  });
};
