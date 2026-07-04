import { z } from "zod";
import type { Env } from "./env";
import { signAgentRequest } from "./conversation-proxy";

interface RateLimitConfig {
  readonly max: number;
  readonly windowMs: number;
}

export interface AiRateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly reservedTimestamps: ReadonlyArray<string>;
  readonly retryAfterSeconds: number;
  readonly resetAt: string;
}

export const aiRouteQuotaRequestSchema = z.object({
  max: z.number().int().positive().max(10_000),
  route: z.string().min(1).max(100),
  windowSeconds: z.number().int().positive().max(86_400),
});

const aiRateLimitDecisionSchema = z.object({
  allowed: z.boolean(),
  limit: z.number().int().positive(),
  remaining: z.number().int().min(0),
  reservedTimestamps: z.array(z.string()),
  resetAt: z.string(),
  retryAfterSeconds: z.number().int().min(0),
});

type AiRateLimitEnv = Pick<
  Env,
  | "AI_AGENT_RATE_LIMIT_MAX"
  | "AI_AGENT_RATE_LIMIT_WINDOW_SECONDS"
  | "AI_ROUTE_RATE_LIMIT_MAX"
  | "AI_ROUTE_RATE_LIMIT_WINDOW_SECONDS"
>;

const defaultRouteLimit = 60;
const defaultAgentLimit = defaultRouteLimit;
const defaultWindowSeconds = 60;

export async function reserveAiRouteQuota(input: {
  readonly agentSessions: DurableObjectNamespace;
  readonly env: AiRateLimitEnv;
  readonly internalSecret?: string;
  readonly route: string;
  readonly user: {
    readonly displayName: string;
    readonly id: string;
  };
}) {
  const config = routeRateLimitConfig(input.env);
  const quotaConversationId = "ai-quota";
  const agentId = input.agentSessions.idFromName(`${input.user.id}:${quotaConversationId}`);
  const agent = input.agentSessions.get(agentId);
  const internalSignature = input.internalSecret
    ? await signAgentRequest(input.internalSecret, input.user.id, quotaConversationId)
    : undefined;
  const response = await agent.fetch(
    new Request("https://nudge.local/quota/ai", {
      body: JSON.stringify({
        max: config.max,
        route: input.route,
        windowSeconds: Math.floor(config.windowMs / 1_000),
      }),
      headers: {
        "content-type": "application/json",
        "x-nudge-conversation-id": quotaConversationId,
        "x-nudge-user-display-name": input.user.displayName,
        "x-nudge-user-id": input.user.id,
        ...(internalSignature !== undefined
          ? { "x-nudge-internal-signature": internalSignature }
          : {}),
      },
      method: "POST",
    }),
  );

  if (!response.ok) return closedRateLimitDecision(config);
  const payload = aiRateLimitDecisionSchema.safeParse(
    await response
      .clone()
      .json()
      .catch(() => null),
  );
  if (!payload.success) return closedRateLimitDecision(config);
  return payload.data;
}

export function reserveConfiguredAiQuota(input: {
  readonly max: number;
  readonly previousTimestamps: ReadonlyArray<string>;
  readonly windowSeconds: number;
}) {
  return reserveTimestampQuota({
    config: { max: input.max, windowMs: input.windowSeconds * 1_000 },
    previousTimestamps: input.previousTimestamps,
  });
}

export function reserveAiAgentQuota(input: {
  readonly env: AiRateLimitEnv;
  readonly previousTimestamps: ReadonlyArray<string>;
}) {
  return reserveTimestampQuota({
    config: agentRateLimitConfig(input.env),
    previousTimestamps: input.previousTimestamps,
  });
}

export function aiRateLimitResponse(decision: AiRateLimitDecision) {
  return Response.json(aiRateLimitBody(decision), {
    headers: aiRateLimitHeaders(decision),
    status: 429,
  });
}

function reserveTimestampQuota(input: {
  readonly config: RateLimitConfig;
  readonly previousTimestamps: ReadonlyArray<string>;
}): AiRateLimitDecision {
  const now = new Date();
  const nowMs = now.getTime();
  const windowStart = nowMs - input.config.windowMs;
  const recent = input.previousTimestamps
    .map((timestamp) => Date.parse(timestamp))
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp >= windowStart)
    .sort((left, right) => right - left);

  if (recent.length >= input.config.max) {
    const retryAfterSeconds = retryAfterFor(recent, nowMs, input.config.windowMs);
    return {
      allowed: false,
      limit: input.config.max,
      remaining: 0,
      reservedTimestamps: recent.map((timestamp) => new Date(timestamp).toISOString()),
      resetAt: new Date(nowMs + retryAfterSeconds * 1_000).toISOString(),
      retryAfterSeconds,
    };
  }

  const reserved = [nowMs, ...recent].slice(0, input.config.max);
  return {
    allowed: true,
    limit: input.config.max,
    remaining: Math.max(input.config.max - reserved.length, 0),
    reservedTimestamps: reserved.map((timestamp) => new Date(timestamp).toISOString()),
    resetAt: new Date(nowMs + input.config.windowMs).toISOString(),
    retryAfterSeconds: 0,
  };
}

function routeRateLimitConfig(env: AiRateLimitEnv): RateLimitConfig {
  return {
    max: positiveInteger(env.AI_ROUTE_RATE_LIMIT_MAX, defaultRouteLimit),
    windowMs: positiveInteger(env.AI_ROUTE_RATE_LIMIT_WINDOW_SECONDS, defaultWindowSeconds) * 1_000,
  };
}

function agentRateLimitConfig(env: AiRateLimitEnv): RateLimitConfig {
  return {
    max: positiveInteger(
      env.AI_AGENT_RATE_LIMIT_MAX ?? env.AI_ROUTE_RATE_LIMIT_MAX,
      defaultAgentLimit,
    ),
    windowMs:
      positiveInteger(
        env.AI_AGENT_RATE_LIMIT_WINDOW_SECONDS ?? env.AI_ROUTE_RATE_LIMIT_WINDOW_SECONDS,
        defaultWindowSeconds,
      ) * 1_000,
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function retryAfterFor(recent: ReadonlyArray<number>, nowMs: number, windowMs: number) {
  const oldest = Math.min(...recent);
  return Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1_000));
}

function closedRateLimitDecision(config: RateLimitConfig): AiRateLimitDecision {
  const retryAfterSeconds = Math.max(1, Math.ceil(config.windowMs / 1_000));
  return {
    allowed: false,
    limit: config.max,
    remaining: 0,
    reservedTimestamps: [],
    resetAt: new Date(Date.now() + retryAfterSeconds * 1_000).toISOString(),
    retryAfterSeconds,
  };
}

function aiRateLimitHeaders(decision: AiRateLimitDecision) {
  return {
    "retry-after": String(decision.retryAfterSeconds),
    "x-ratelimit-limit": String(decision.limit),
    "x-ratelimit-remaining": String(decision.remaining),
    "x-ratelimit-reset": decision.resetAt,
  };
}

function aiRateLimitBody(decision: AiRateLimitDecision) {
  return {
    error: "AI rate limit exceeded",
    limit: decision.limit,
    retryAfterSeconds: decision.retryAfterSeconds,
    resetAt: decision.resetAt,
  };
}
