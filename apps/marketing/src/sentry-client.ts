import { browserTracingIntegration, init } from "@sentry/react";
import {
  buildNudgeSentryContext,
  redactSentryEvent,
  resolveSentryConfig,
} from "@nudge/observability/sentry";

const defaultMarketingClientDsn =
  "https://3d157fc75828a869b44e08a4774fb6de@o4510926758150144.ingest.de.sentry.io/4511679629426768";

let initialized = false;

const releaseName = (version: unknown) => {
  return typeof version === "string" && version.trim().length > 0
    ? `nudge-marketing-client@${version.trim()}`
    : undefined;
};

export const initializeMarketingClientSentry = () => {
  if (initialized) return true;

  const nudgeContext = buildNudgeSentryContext({
    appSurface: "marketing",
    runtimeSurface: "marketing-client",
  });

  const config = resolveSentryConfig({
    dsn: import.meta.env.VITE_SENTRY_DSN ?? defaultMarketingClientDsn,
    enabled: import.meta.env.VITE_SENTRY_ENABLED,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: releaseName(import.meta.env.VITE_APP_VERSION),
    surface: "marketing-client",
    tracesSampleRate: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
  });

  if (!config) return false;

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
    integrations: [browserTracingIntegration()],
    ...(config.release ? { release: config.release } : {}),
    tracesSampleRate: config.tracesSampleRate,
  });
  initialized = true;
  return true;
};
