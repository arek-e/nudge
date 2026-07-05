import { browserTracingIntegration, init } from "@sentry/react";
import {
  buildNudgeSentryContext,
  redactSentryEvent,
  resolveSentryConfig,
} from "@nudge/observability/sentry";
import { currentAppSurface } from "./surface-runtime";

const defaultWebClientDsn =
  "https://3fe4af305fc498b5a216f68af4e898ab@o4510926758150144.ingest.de.sentry.io/4510926760312912";

let initialized = false;

const releaseName = (version: unknown) => {
  return typeof version === "string" && version.trim().length > 0
    ? `nudge-web-client@${version.trim()}`
    : undefined;
};

export const webClientRuntimeSurface = (surface: string) => {
  return surface === "desktop" ? "desktop-renderer" : "web-browser";
};

export const initializeWebClientSentry = () => {
  if (initialized) return true;

  const appSurface = currentAppSurface();
  const nudgeContext = buildNudgeSentryContext({
    appSurface,
    runtimeSurface: webClientRuntimeSurface(appSurface),
  });

  const config = resolveSentryConfig({
    dsn: import.meta.env.VITE_SENTRY_DSN ?? defaultWebClientDsn,
    enabled: import.meta.env.VITE_SENTRY_ENABLED,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: releaseName(import.meta.env.VITE_APP_VERSION),
    surface: "web-client",
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
    tracePropagationTargets: [
      /^\/api\//,
      /^\/mcp$/,
      /^https:\/\/app\.explorenudge\.com\/api\//,
      /^https:\/\/app\.staging\.explorenudge\.com\/api\//,
      /^https:\/\/nudge-web\.teampitch\.workers\.dev\/api\//,
      /^https:\/\/nudge-web-staging\.teampitch\.workers\.dev\/api\//,
    ],
    tracesSampleRate: config.tracesSampleRate,
  });
  initialized = true;
  return true;
};
