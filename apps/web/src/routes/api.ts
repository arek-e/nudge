import type { Hono } from "hono";
import type { ApiContext } from "../api/context";
import type { DesktopSignInTokenFactory } from "../auth";
import type { ResolveRequestApp } from "../request-context";
import { aiRateLimitResponse, reserveAiRouteQuota } from "../ai-rate-limit";
import { conversationMessageInputSchema } from "../api-contract";
import { makeApiHandler } from "../api-router";
import { conversationStreamPath, proxyConversationStream } from "../conversation-proxy";
import { mediaIdSchema, mediaObjectKey, storeMediaUpload } from "../media-storage";
import {
  addWideEventFields,
  type ObservabilityHonoEnv,
  requestTraceHeaders,
  runWithRequestSpan,
  wideEventFieldsFrom,
} from "../observability";
import { resolveCurrentUser } from "../request-auth";

export function registerApiRoutes(
  app: Hono<ObservabilityHonoEnv>,
  resolveRequestApp: ResolveRequestApp,
  createDesktopSignInToken: DesktopSignInTokenFactory,
) {
  const apiHandler = makeApiHandler();

  app.use(
    "/api/*",
    wideEventFieldsFrom((c) => apiRouteWideEventFields(c.req.path)),
  );

  app.get("/api/traces/agent-runs/recent", async (c) => {
    const limit = traceSummaryLimit(c.req.url);
    const summaries = await listRecentAgentAndEvalRunSummaries(c.env.DB, limit);
    return c.json(summaries);
  });

  app.use("/api/*", async (c, next) => {
    const { appServices, runEffect } = await resolveRequestApp(c);
    if (hasUnsafeApiPath(rawPathFromRequest(c.req.raw)) || hasUnsafeApiPath(c.req.path)) {
      return c.json({ error: "Not found" }, 404);
    }
    const clientSurface = c.req.header("x-nudge-client");
    if (clientSurface !== undefined) {
      addWideEventFields(c, { clientSurface });
    }
    const auth = await runWithRequestSpan(
      c,
      { attributes: { "nudge.auth.provider": "clerk" }, name: "auth.current_user" },
      () => resolveCurrentUser({ app: appServices, request: c.req.raw }),
    );
    addWideEventFields(c, {
      authMode: auth.authMode,
      ...(auth.user ? { userId: auth.user.id, workspaceId: auth.user.id } : {}),
    });
    if (!auth.user && !isPublicApiSessionPath(c.req.path)) {
      return c.json({ error: "Authentication required" }, 401);
    }
    if (isTraceApiPath(c.req.path)) {
      const traceUser = auth.user;
      if (auth.authMode !== "clerk" || !traceUser) {
        return c.json({ error: "Authentication required" }, 401);
      }
      const access = traceApiAccess(c.env, traceUser.id);
      if (access === "disabled") {
        return c.json({ error: "Not found" }, 404);
      }
      if (access === "forbidden") return c.json({ error: "Forbidden" }, 403);
    }

    const user = auth.user ?? { displayName: "Unauthenticated", id: "unauthenticated" };
    if (c.req.path === "/api/auth/desktop-ticket" && c.req.method === "POST") {
      if (auth.authMode !== "clerk" || !auth.user) {
        return c.json({ error: "Clerk session required" }, 401);
      }
      const signInToken = await createDesktopSignInToken({
        env: appServices.env,
        userId: auth.user.id,
      });
      return c.json(signInToken);
    }

    const recordSpan: ApiContext["recordSpan"] = (name, input, task) =>
      runWithRequestSpan(c, { ...input, name }, task);
    const streamConversationId = conversationStreamPath(c.req.path);
    const expensiveAiRoute = expensiveAiRouteFor(c.req.method, c.req.path, streamConversationId);
    if (expensiveAiRoute) {
      const quota = await reserveAiRouteQuota({
        agentSessions: appServices.agentSessions,
        env: c.env,
        ...(appServices.agentInternalSecret
          ? { internalSecret: appServices.agentInternalSecret }
          : {}),
        route: expensiveAiRoute,
        user,
      });
      if (!quota.allowed) return aiRateLimitResponse(quota);
    }

    if (streamConversationId && c.req.method === "POST") {
      const input = conversationMessageInputSchema.safeParse(
        await c.req.raw
          .clone()
          .json()
          .catch(() => null),
      );
      if (!input.success) {
        return c.json({ error: "Invalid conversation message" }, 400);
      }
      const response = await proxyConversationStream(
        appServices.agentSessions,
        appServices.agentInternalSecret,
        user,
        streamConversationId,
        input.data.message,
        requestTraceHeaders(c),
        c.req.header("accept"),
      );
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        return response;
      }
      return responseWithMutableHeaders(response);
    }

    if (c.req.path === "/api/media" && c.req.method === "POST") {
      const mediaFiles = appServices.mediaFiles;
      if (!mediaFiles) {
        return c.json({ error: "Media storage unavailable" }, 503);
      }
      const payload = await c.req.json().catch(() => null);
      const result = await storeMediaUpload({ bucket: mediaFiles, payload, userId: user.id });
      if (!result.ok) {
        return c.json({ error: result.error }, result.status);
      }
      return c.json(result.media);
    }

    if (c.req.path.startsWith("/api/media/") && c.req.method === "GET") {
      const mediaFiles = appServices.mediaFiles;
      if (!mediaFiles) {
        return c.json({ error: "Media storage unavailable" }, 503);
      }
      const mediaId = mediaIdSchema.safeParse(decodeURIComponent(c.req.path.slice(11)));
      if (!mediaId.success) {
        return c.json({ error: "Media not found" }, 404);
      }
      const object = await mediaFiles.get(mediaObjectKey(user.id, mediaId.data));
      if (!object) {
        return c.json({ error: "Media not found" }, 404);
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      return new Response(object.body, { headers });
    }

    const result = await runWithRequestSpan(
      c,
      { attributes: { "rpc.system": "orpc" }, name: "orpc.handle" },
      () =>
        apiHandler.handle(c.req.raw, {
          context: {
            addWideEvent: (fields) => addWideEventFields(c, fields),
            agentSessions: appServices.agentSessions,
            ...(appServices.agentInternalSecret
              ? { agentInternalSecret: appServices.agentInternalSecret }
              : {}),
            aiModel: appServices.aiModel,
            aiProvider: appServices.aiProvider,
            dailyAnalysisWorkflow: appServices.dailyAnalysisWorkflow,
            db: appServices.db,
            getOkfSandbox: () => appServices.okfSandboxFor(user),
            ...(clientSurface !== undefined ? { clientSurface } : {}),
            ...(appServices.mediaFiles ? { mediaFiles: appServices.mediaFiles } : {}),
            recordSpan,
            runEffect,
            session: auth,
            ...(appServices.env.TRACE_ARTIFACTS !== undefined
              ? { traceArtifacts: appServices.env.TRACE_ARTIFACTS }
              : {}),
            ...(appServices.env.DB !== undefined ? { traceDb: appServices.env.DB } : {}),
            traceHeaders: requestTraceHeaders(c),
            ...(appServices.turbopuffer ? { turbopuffer: appServices.turbopuffer } : {}),
            user,
          },
          prefix: "/api",
        }),
    );

    if (result.matched) {
      return c.newResponse(result.response.body, result.response);
    }

    await next();
  });
}

function expensiveAiRouteFor(method: string, path: string, streamConversationId: string | null) {
  if (method !== "POST") return null;
  if (streamConversationId) return "conversation_message";
  if (/^\/api\/conversations\/[^/]+\/messages$/.test(path)) return "conversation_message";
  if (path === "/api/journal") return "journal_analysis";
  return null;
}

function isPublicApiSessionPath(path: string) {
  return path === "/api/session" || path === "/api/session/";
}

function hasUnsafeApiPath(path: string) {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes("%2e") || lowerPath.includes("%2f") || lowerPath.includes("%5c")) {
    return true;
  }
  return path.split("/").some((segment) => segment === "." || segment === "..");
}

function rawPathFromRequest(request: Request) {
  const schemeEnd = request.url.indexOf("://");
  const pathStart = request.url.indexOf("/", schemeEnd === -1 ? 0 : schemeEnd + 3);
  if (pathStart === -1) return "/";
  const queryStart = request.url.indexOf("?", pathStart);
  return queryStart === -1
    ? request.url.slice(pathStart)
    : request.url.slice(pathStart, queryStart);
}

function isTraceApiPath(path: string) {
  return path.startsWith("/api/traces");
}

function traceApiEnabled(env: ObservabilityHonoEnv["Bindings"]) {
  return (
    env.TRACE_API_ENABLED === "true" || env.ENVIRONMENT === "local" || env.ENVIRONMENT === "test"
  );
}

function traceApiAccess(env: ObservabilityHonoEnv["Bindings"], userId: string) {
  if (!traceApiEnabled(env)) return "disabled";
  if (env.ENVIRONMENT === "local" || env.ENVIRONMENT === "test") return "allowed";
  const allowedUserIds = new Set(
    (env.TRACE_API_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
  return allowedUserIds.has(userId) ? "allowed" : "forbidden";
}

function responseWithMutableHeaders(response: Response) {
  return new Response(response.body, {
    headers: new Headers(response.headers),
    status: response.status,
    statusText: response.statusText,
  });
}

async function listRecentAgentAndEvalRunSummaries(traceDb: D1Database | undefined, limit: number) {
  if (typeof traceDb?.prepare !== "function") return { agentRuns: [], evalRuns: [] };

  const [agentRuns, evalRuns] = await Promise.all([
    traceDb
      .prepare(
        `SELECT
          id,
          trace_id,
          user_id,
          agent_name,
          status,
          started_at,
          completed_at,
          summary,
          artifact_key,
          created_at
        FROM agent_runs
        ORDER BY started_at DESC
        LIMIT ?`,
      )
      .bind(limit)
      .all(),
    traceDb
      .prepare(
        `SELECT
          id,
          suite_name,
          status,
          started_at,
          completed_at,
          summary,
          artifact_key,
          created_at
        FROM eval_runs
        ORDER BY started_at DESC
        LIMIT ?`,
      )
      .bind(limit)
      .all(),
  ]);

  return {
    agentRuns: traceRows(agentRuns).map(agentRunSummaryFromRow).filter(isPresent),
    evalRuns: traceRows(evalRuns).map(evalRunSummaryFromRow).filter(isPresent),
  };
}

function traceSummaryLimit(requestUrl: string) {
  const rawLimit = new URL(requestUrl).searchParams.get("limit");
  const limit = Number(rawLimit ?? "20");
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function traceRows(result: { readonly results?: unknown }) {
  return Array.isArray(result.results) ? result.results : [];
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function readRowProperty(row: unknown, key: string) {
  return typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
}

function readStringProperty(row: unknown, key: string) {
  const value = readRowProperty(row, key);
  return typeof value === "string" ? value : null;
}

function readJsonSummary(row: unknown): unknown | null {
  const value = readStringProperty(row, "summary");
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    return null;
  }
}

function agentRunSummaryFromRow(row: unknown) {
  const id = readStringProperty(row, "id");
  const agentName = readStringProperty(row, "agent_name");
  const status = readStringProperty(row, "status");
  const startedAt = readStringProperty(row, "started_at");
  const createdAt = readStringProperty(row, "created_at");
  if (!id || !agentName || !status || !startedAt || !createdAt) return null;

  return {
    id,
    traceId: readStringProperty(row, "trace_id"),
    userId: readStringProperty(row, "user_id"),
    agentName,
    status,
    startedAt,
    completedAt: readStringProperty(row, "completed_at"),
    summary: readJsonSummary(row),
    artifactKey: readStringProperty(row, "artifact_key"),
    createdAt,
  };
}

function evalRunSummaryFromRow(row: unknown) {
  const id = readStringProperty(row, "id");
  const suiteName = readStringProperty(row, "suite_name");
  const status = readStringProperty(row, "status");
  const startedAt = readStringProperty(row, "started_at");
  const createdAt = readStringProperty(row, "created_at");
  if (!id || !suiteName || !status || !startedAt || !createdAt) return null;

  return {
    id,
    suiteName,
    status,
    startedAt,
    completedAt: readStringProperty(row, "completed_at"),
    summary: readJsonSummary(row),
    artifactKey: readStringProperty(row, "artifact_key"),
    createdAt,
  };
}

function apiRouteWideEventFields(path: string) {
  if (path.startsWith("/api/captures")) {
    return { routeName: "api.captures" };
  } else if (path.startsWith("/api/quick-captures")) {
    return { routeName: "api.quick_captures" };
  } else if (path.startsWith("/api/media")) {
    return { routeName: "api.media" };
  } else if (path.startsWith("/api/conversations")) {
    if (path.includes("/tools/list-recent-signals")) {
      return { agentTool: "listRecentSignals", routeName: "api.conversations" };
    } else if (path.includes("/tools/retrieve-memory")) {
      return { agentTool: "retrieveMemory", routeName: "api.conversations" };
    }
    return { routeName: "api.conversations" };
  } else if (path.startsWith("/api/journal")) {
    return { routeName: "api.journal" };
  } else if (path.startsWith("/api/actions")) {
    return { routeName: "api.actions" };
  } else if (path.startsWith("/api/calendar")) {
    return { routeName: "api.calendar" };
  } else if (path.startsWith("/api/agent-runs")) {
    return { routeName: "api.agent-runs" };
  } else if (path.startsWith("/api/traces")) {
    return { routeName: "api.traces" };
  } else if (path.startsWith("/api/signals")) {
    return { routeName: "api.signals" };
  } else if (path.startsWith("/api/syntheses")) {
    return { routeName: "api.syntheses" };
  } else if (path.startsWith("/api/proposals")) {
    return { routeName: "api.proposals" };
  } else if (path.startsWith("/api/review-inbox")) {
    return { routeName: "api.review-inbox" };
  } else if (path.startsWith("/api/commitments")) {
    return { routeName: "api.commitments" };
  } else if (path.startsWith("/api/reviews")) {
    return { routeName: "api.reviews" };
  } else if (path.startsWith("/api/outcomes")) {
    return { routeName: "api.outcomes" };
  } else if (path.startsWith("/api/voice")) {
    return { routeName: "api.voice" };
  } else if (path.startsWith("/api/events")) {
    return { routeName: "api.events" };
  } else if (path.startsWith("/api/session")) {
    return { routeName: "api.session" };
  } else if (path.startsWith("/api/auth/desktop-ticket")) {
    return { routeName: "api.auth.desktop_ticket" };
  } else if (path.startsWith("/api/export")) {
    return { routeName: "api.export" };
  } else if (path.startsWith("/api/okf")) {
    return { routeName: "api.okf" };
  } else if (path.startsWith("/api/account")) {
    return { routeName: "api.account" };
  }
  return undefined;
}
