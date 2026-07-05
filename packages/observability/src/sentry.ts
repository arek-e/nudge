export type SentrySurface =
  | "desktop-main"
  | "marketing-client"
  | "raycast"
  | "web-client"
  | "web-worker";

export interface SentryConfigInput {
  readonly dsn?: string | null | undefined;
  readonly enabled?: boolean | string | null | undefined;
  readonly environment?: string | null | undefined;
  readonly release?: string | null | undefined;
  readonly surface: SentrySurface;
  readonly tracesSampleRate?: number | string | null | undefined;
}

export interface SentryConfig {
  readonly dsn: string;
  readonly environment: string;
  readonly release?: string;
  readonly tags: {
    readonly app: string;
    readonly surface: SentrySurface;
  };
  readonly tracesSampleRate: number;
}

export interface NudgeSentryContextInput {
  readonly appSurface?: string | null | undefined;
  readonly command?: string | null | undefined;
  readonly conversationId?: string | null | undefined;
  readonly requestId?: string | null | undefined;
  readonly routeName?: string | null | undefined;
  readonly runtimeSurface?: string | null | undefined;
  readonly traceId?: string | null | undefined;
  readonly userId?: string | null | undefined;
  readonly workflowId?: string | null | undefined;
  readonly workspaceId?: string | null | undefined;
}

export interface NudgeSentryContext {
  readonly contexts: {
    readonly nudge: Record<string, string>;
  };
  readonly tags: Record<string, string>;
  readonly user?: {
    readonly id: string;
  };
}

interface RedactableSentryRequest {
  cookies?: unknown;
  data?: unknown;
  headers?: Record<string, unknown>;
}

interface RedactableSentryUser {
  email?: unknown;
  ip_address?: unknown;
  username?: unknown;
}

interface RedactableSentryEvent {
  request?: RedactableSentryRequest;
  user?: RedactableSentryUser;
}

const sensitiveRequestHeaders = new Set([
  "authorization",
  "cf-connecting-ip",
  "cookie",
  "proxy-authorization",
  "x-forwarded-for",
  "x-real-ip",
]);

const optionalString = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const sentryString = (value: string | null | undefined) => {
  const normalized = optionalString(value);
  return normalized ? normalized.slice(0, 200) : undefined;
};

const addContextValue = (
  context: Record<string, string>,
  key: string,
  value: string | null | undefined,
) => {
  const normalized = sentryString(value);
  if (normalized) context[key] = normalized;
};

const addTagValue = (
  tags: Record<string, string>,
  key: string,
  value: string | null | undefined,
) => {
  const normalized = sentryString(value);
  if (normalized) tags[key] = normalized;
};

export const sentryEnabled = (value: boolean | string | null | undefined) => {
  if (typeof value === "boolean") return value;
  const normalized = value?.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0";
};

export const sentryTracesSampleRate = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1, Math.max(0, parsed));
};

export const resolveSentryConfig = (input: SentryConfigInput): SentryConfig | null => {
  if (!sentryEnabled(input.enabled)) return null;

  const dsn = optionalString(input.dsn);
  if (!dsn) return null;

  const release = optionalString(input.release);
  return {
    dsn,
    environment: optionalString(input.environment) ?? "development",
    ...(release ? { release } : {}),
    tags: {
      app: "nudge",
      surface: input.surface,
    },
    tracesSampleRate: sentryTracesSampleRate(input.tracesSampleRate),
  };
};

export const buildNudgeSentryContext = (input: NudgeSentryContextInput): NudgeSentryContext => {
  const nudge: Record<string, string> = {};
  const tags: Record<string, string> = {};

  addContextValue(nudge, "appSurface", input.appSurface);
  addContextValue(nudge, "command", input.command);
  addContextValue(nudge, "conversationId", input.conversationId);
  addContextValue(nudge, "requestId", input.requestId);
  addContextValue(nudge, "routeName", input.routeName);
  addContextValue(nudge, "runtimeSurface", input.runtimeSurface);
  addContextValue(nudge, "traceId", input.traceId);
  addContextValue(nudge, "userId", input.userId);
  addContextValue(nudge, "workflowId", input.workflowId);
  addContextValue(nudge, "workspaceId", input.workspaceId);

  addTagValue(tags, "app_surface", input.appSurface);
  addTagValue(tags, "raycast_command", input.command);
  addTagValue(tags, "route_name", input.routeName);
  addTagValue(tags, "runtime_surface", input.runtimeSurface);

  const userId = sentryString(input.userId);
  return {
    contexts: { nudge },
    tags,
    ...(userId ? { user: { id: userId } } : {}),
  };
};

export const redactSentryEvent = <Event extends RedactableSentryEvent>(event: Event) => {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;

    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (sensitiveRequestHeaders.has(key.toLowerCase())) {
          event.request.headers[key] = "[redacted]";
        }
      }
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  return event;
};
