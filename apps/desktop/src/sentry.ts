import { captureException, flush, init } from "@sentry/electron/main";
import {
  buildNudgeSentryContext,
  redactSentryEvent,
  resolveSentryConfig,
} from "@nudge/observability/sentry";

const defaultDesktopDsn =
  "https://15fbe29a9068940d7e74de52d652bd13@o4510926758150144.ingest.de.sentry.io/4511679630868560";

let initialized = false;

const releaseName = (version: string) => {
  return version.trim().length > 0 ? `nudge-desktop@${version.trim()}` : undefined;
};

const readEnv = (env: Readonly<Record<string, string | undefined>>, name: string) => {
  return env[name];
};

export const initializeDesktopSentry = (input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly isPackaged: boolean;
  readonly version: string;
}) => {
  if (initialized) return true;

  const config = resolveSentryConfig({
    dsn:
      readEnv(input.env, "SENTRY_DSN") ??
      readEnv(input.env, "NUDGE_SENTRY_DSN") ??
      defaultDesktopDsn,
    enabled: readEnv(input.env, "SENTRY_ENABLED") ?? readEnv(input.env, "NUDGE_SENTRY_ENABLED"),
    environment:
      readEnv(input.env, "SENTRY_ENVIRONMENT") ?? (input.isPackaged ? "production" : "development"),
    release: releaseName(input.version),
    surface: "desktop-main",
    tracesSampleRate: readEnv(input.env, "SENTRY_TRACES_SAMPLE_RATE"),
  });

  if (!config) return false;

  const nudgeContext = buildNudgeSentryContext({
    appSurface: "desktop",
    runtimeSurface: "desktop-main",
  });

  init({
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
  });
  initialized = true;
  return true;
};

export const captureDesktopException = (
  cause: unknown,
  tags: Readonly<Record<string, string>> = {},
) => {
  if (!initialized) return;
  captureException(cause, {
    tags: {
      surface: "desktop-main",
      ...tags,
    },
  });
};

export const flushDesktopSentry = async () => {
  if (!initialized) return;
  await flush(2_000);
};
