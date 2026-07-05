import { captureException, flush, init, setContext, setTag } from "@sentry/node";
import {
  buildNudgeSentryContext,
  redactSentryEvent,
  resolveSentryConfig,
} from "@nudge/observability/sentry";

const defaultRaycastDsn =
  "https://1ca9997b525d933254f16b73dee817fa@o4510926758150144.ingest.de.sentry.io/4511679633621072";

let initialized = false;

const readEnv = (name: string) => {
  return process.env[name];
};

const releaseName = () => {
  const version = readEnv("npm_package_version");
  return version && version.trim().length > 0 ? `nudge-raycast@${version.trim()}` : undefined;
};

export const initializeRaycastSentry = (command: string) => {
  const config = resolveSentryConfig({
    dsn: readEnv("SENTRY_DSN") ?? readEnv("NUDGE_SENTRY_DSN") ?? defaultRaycastDsn,
    enabled: readEnv("SENTRY_ENABLED") ?? readEnv("NUDGE_SENTRY_ENABLED"),
    environment: readEnv("SENTRY_ENVIRONMENT") ?? readEnv("NODE_ENV") ?? "production",
    release: releaseName(),
    surface: "raycast",
    tracesSampleRate: readEnv("SENTRY_TRACES_SAMPLE_RATE"),
  });

  if (!config) return false;

  const nudgeContext = buildNudgeSentryContext({
    appSurface: "raycast",
    command,
    runtimeSurface: "raycast-command",
  });

  if (!initialized) {
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
  }

  setTag("raycast.command", command);
  for (const [key, value] of Object.entries(nudgeContext.tags)) {
    setTag(key, value);
  }
  setContext("nudge", nudgeContext.contexts.nudge);
  return true;
};

export const captureRaycastException = async (
  cause: unknown,
  tags: Readonly<Record<string, string>> = {},
) => {
  if (!initialized) return;
  captureException(cause, {
    tags: {
      surface: "raycast",
      ...tags,
    },
  });
  await flush(2_000);
};
