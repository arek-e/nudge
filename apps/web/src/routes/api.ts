import type { Hono } from "hono";
import type { DesktopSignInTokenFactory } from "../auth";
import type { ResolveRequestApp } from "../request-context";
import { conversationMessageInputSchema } from "../api-contract";
import { makeApiHandler, type ApiContext } from "../api-router";
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

  app.use("/api/*", async (c, next) => {
    const { appServices, runEffect } = await resolveRequestApp(c);
    const auth = await runWithRequestSpan(
      c,
      { attributes: { "nudge.auth.provider": "clerk" }, name: "auth.current_user" },
      () => resolveCurrentUser({ app: appServices, request: c.req.raw }),
    );
    if (!auth.user && !c.req.path.startsWith("/api/session")) {
      return c.json({ error: "Authentication required" }, 401);
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
            dailyAnalysisWorkflow: appServices.dailyAnalysisWorkflow,
            db: appServices.db,
            getOkfSandbox: () => appServices.okfSandboxFor(user),
            recordSpan,
            runEffect,
            session: auth,
            traceHeaders: requestTraceHeaders(c),
            traceDb: appServices.traceDb,
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

function responseWithMutableHeaders(response: Response) {
  return new Response(response.body, {
    headers: new Headers(response.headers),
    status: response.status,
    statusText: response.statusText,
  });
}

function apiRouteWideEventFields(path: string) {
  if (path.startsWith("/api/captures")) {
    return { routeName: "api.captures" };
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
  } else if (path.startsWith("/api/traces")) {
    return { routeName: "api.traces" };
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
