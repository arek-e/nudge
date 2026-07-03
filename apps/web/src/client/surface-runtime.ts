import type { AppSurface } from "@nudge/surface";

const processingAgentRunStatuses = new Set([
  "in_progress",
  "pending",
  "processing",
  "queued",
  "running",
]);

declare global {
  interface Window {
    readonly nudgeDesktop?: {
      readonly appVersion?: string;
      readonly surface?: string;
    };
  }
}

function appSurfaceFrom(value: string | undefined): AppSurface | null {
  switch (value) {
    case "desktop":
      return "desktop";
    case "ios":
      return "ios";
    case "raycast":
      return "raycast";
    case "web":
      return "web";
    default:
      return null;
  }
}

export function resolveAppSurface(
  input: {
    readonly desktopSurface?: string;
    readonly envSurface?: string;
  } = {},
): AppSurface {
  return appSurfaceFrom(input.desktopSurface) ?? appSurfaceFrom(input.envSurface) ?? "web";
}

export function currentAppSurface(): AppSurface {
  const desktopSurface = globalThis.window?.nudgeDesktop?.surface;
  const envSurface = import.meta.env.VITE_NUDGE_SURFACE;
  return resolveAppSurface({
    ...(desktopSurface !== undefined ? { desktopSurface } : {}),
    ...(envSurface !== undefined ? { envSurface } : {}),
  });
}

export function anonymousUiEnabled(
  input: {
    readonly anonymousUi?: string;
  } = {},
) {
  const value = input.anonymousUi ?? import.meta.env.VITE_NUDGE_ANONYMOUS_UI;
  return value === "1" || value === "true";
}

export function surfaceContextRefetchInterval(value: unknown) {
  const status = latestAgentRunStatus(value);
  return status && processingAgentRunStatuses.has(status.toLowerCase()) ? 2_000 : false;
}

function latestAgentRunStatus(value: unknown) {
  const actions = readObjectProperty(value, "actions");
  const latestRun = readObjectProperty(actions, "latestRun");
  const status = readObjectProperty(latestRun, "status");
  return typeof status === "string" ? status : null;
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}
