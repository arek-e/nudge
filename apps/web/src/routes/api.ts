import type { Hono } from "hono";
import type { ResolveRequestApp } from "../request-context";
import { conversationMessageInputSchema } from "../api-contract";
import { makeApiHandler, type ApiContext } from "../api-router";
import { conversationStreamPath, proxyConversationStream } from "../conversation-proxy";
import {
  addWideEventFields,
  type ObservabilityHonoEnv,
  runWithRequestSpan,
  wideEventFieldsFrom,
} from "../observability";
import { resolveCurrentUser } from "../request-auth";

export function registerApiRoutes(
  app: Hono<ObservabilityHonoEnv>,
  resolveRequestApp: ResolveRequestApp,
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
      { attributes: { "lares.auth.provider": "better-auth" }, name: "auth.current_user" },
      () => resolveCurrentUser({ app: appServices, headers: c.req.raw.headers }),
    );
    if (!auth.user && !c.req.path.startsWith("/api/session")) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const user = auth.user ?? { displayName: "Unauthenticated", id: "unauthenticated" };
    const recordSpan: ApiContext["recordSpan"] = (name, input, task) =>
      runWithRequestSpan(c, { ...input, name }, task);
    const streamConversationId = conversationStreamPath(c.req.path);
    if (streamConversationId && c.req.method === "POST") {
      const input = conversationMessageInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!input.success) {
        return c.json({ error: "Invalid conversation message" }, 400);
      }
      return proxyConversationStream(
        appServices.agentSessions,
        appServices.agentInternalSecret,
        user,
        streamConversationId,
        input.data.message,
      );
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
            googleAuthConfigured: appServices.googleAuthConfigured,
            getOkfSandbox: () => appServices.okfSandboxFor(user),
            recordSpan,
            runEffect,
            session: auth,
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

function apiRouteWideEventFields(path: string) {
  if (path.startsWith("/api/captures")) {
    return { routeName: "api.captures" };
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
  } else if (path.startsWith("/api/export")) {
    return { routeName: "api.export" };
  } else if (path.startsWith("/api/okf")) {
    return { routeName: "api.okf" };
  } else if (path.startsWith("/api/account")) {
    return { routeName: "api.account" };
  }
  return undefined;
}
