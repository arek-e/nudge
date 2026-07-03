import { afterEach, describe, expect, test } from "bun:test";
import { createSurfaceEngineClient } from "@nudge/surface";
import { reviewRaycastAction } from "./action-service";
import { askRaycastNudge } from "./ask-service";
import { appendRaycastCapture } from "./capture-service";
import { refreshRaycastCurrentContext } from "./context-service";

interface RecordedEngineRequest {
  readonly anonymousUserId: string | null;
  readonly authorization: string | null;
  readonly body?: unknown;
  readonly client: string | null;
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
}

let server: ReturnType<typeof Bun.serve> | undefined;

afterEach(() => {
  server?.stop(true);
  server = undefined;
});

describe("Raycast service e2e", () => {
  test("submits a capture through the shared Engine client as a Raycast surface", async () => {
    const requests: RecordedEngineRequest[] = [];
    server = startEngineStub(requests);

    const event = await appendRaycastCapture({ note: "  Capture the launch follow-up.  " }, () =>
      Promise.resolve(
        createSurfaceEngineClient({
          baseUrl: engineUrl(server),
          bearerToken: "ray-token",
          surface: "raycast",
        }),
      ),
    );

    const request = recordedRequest(requests, "/api/captures");
    const idempotencyKey = readStringProperty(request.body, "idempotencyKey");

    expect(event.source).toBe("raycast_extension");
    expect(request).toMatchObject({
      authorization: "Bearer ray-token",
      client: "raycast",
      method: "POST",
      path: "/api/captures",
    });
    expect(request.body).toMatchObject({
      payload: { note: "Capture the launch follow-up." },
      schemaVersion: 1,
      source: "raycast_extension",
      type: "manual_check_in_submitted",
    });
    expect(idempotencyKey?.startsWith("raycast:")).toBe(true);
  });

  test("refreshes the same current context bundle as iOS", async () => {
    const requests: RecordedEngineRequest[] = [];
    server = startEngineStub(requests);

    const context = await refreshRaycastCurrentContext(
      () =>
        Promise.resolve(
          createSurfaceEngineClient({
            anonymousUserId: "anon_raycast_e2e",
            baseUrl: engineUrl(server),
            surface: "raycast",
          }),
        ),
      {
        date: new Date("2026-07-03T08:30:00.000Z"),
        timeZone: "Europe/Stockholm",
      },
    );

    expect(context.session.authMode).toBe("anonymous");
    expect(context.journal?.bodyText).toBe("Morning plan");
    expect(context.actions.latestRun?.status).toBe("completed");
    expect(context.signals[0]?.source).toBe("raycast_extension");
    expect(requests.map((request) => request.path).sort()).toEqual([
      "/api/actions",
      "/api/calendar/days",
      "/api/journal/2026-07-03",
      "/api/session",
      "/api/signals",
    ]);
    expect(recordedRequest(requests, "/api/calendar/days").query).toEqual({
      timeZone: "Europe/Stockholm",
    });
    expect(recordedRequest(requests, "/api/actions").query).toEqual({ limit: "24" });
    expect(recordedRequest(requests, "/api/signals").query).toEqual({ limit: "24" });

    for (const request of requests) {
      expect(request.client).toBe("raycast");
      expect(request.anonymousUserId).toBe("anon_raycast_e2e");
    }
  });

  test("reviews an action through the shared Engine client as a Raycast surface", async () => {
    const requests: RecordedEngineRequest[] = [];
    server = startEngineStub(requests);

    const action = await reviewRaycastAction({ itemId: "action-1", status: "accepted" }, () =>
      Promise.resolve(
        createSurfaceEngineClient({
          baseUrl: engineUrl(server),
          bearerToken: "ray-token",
          surface: "raycast",
        }),
      ),
    );

    const request = recordedRequest(requests, "/api/actions/action-1/status");
    expect(action.status).toBe("accepted");
    expect(request).toMatchObject({
      authorization: "Bearer ray-token",
      client: "raycast",
      method: "POST",
      path: "/api/actions/action-1/status",
    });
    expect(request.body).toEqual({ itemId: "action-1", status: "accepted" });
  });

  test("asks Nudge through the shared Engine conversation service as a Raycast surface", async () => {
    const requests: RecordedEngineRequest[] = [];
    server = startEngineStub(requests);

    const response = await askRaycastNudge({ message: " What should I do next? " }, () =>
      Promise.resolve(
        createSurfaceEngineClient({
          baseUrl: engineUrl(server),
          bearerToken: "ray-token",
          surface: "raycast",
        }),
      ),
    );

    const request = recordedRequest(requests, "/api/conversations/default/messages");
    expect(response.reply).toBe("Start with the desktop release owner.");
    expect(request).toMatchObject({
      authorization: "Bearer ray-token",
      client: "raycast",
      method: "POST",
      path: "/api/conversations/default/messages",
    });
    expect(request.body).toEqual({ message: "What should I do next?" });
  });
});

function startEngineStub(requests: RecordedEngineRequest[]) {
  return Bun.serve({
    fetch: async (request) => {
      const url = new URL(request.url);
      const body = request.method === "POST" ? await request.json() : undefined;
      requests.push({
        anonymousUserId: request.headers.get("x-nudge-anonymous-user-id"),
        authorization: request.headers.get("authorization"),
        ...(body !== undefined ? { body } : {}),
        client: request.headers.get("x-nudge-client"),
        method: request.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
      });

      if (url.pathname === "/api/captures") {
        return jsonResponse({
          createdAt: "2026-07-03T08:30:01.000Z",
          id: "event-1",
          idempotencyKey: readStringProperty(body, "idempotencyKey"),
          occurredAt: readStringProperty(body, "occurredAt") ?? "2026-07-03T08:30:00.000Z",
          payload: readObjectProperty(body, "payload"),
          schemaVersion: 1,
          source: "raycast_extension",
          type: "manual_check_in_submitted",
          userId: "user-1",
        });
      }

      if (url.pathname === "/api/session") {
        return jsonResponse({
          authMode: "anonymous",
          user: { displayName: "Raycast", id: "user-1" },
          workspace: { id: "workspace-1", label: "Nudge" },
        });
      }

      if (url.pathname === "/api/calendar/days") {
        return jsonResponse({
          days: [{ localDate: "2026-07-03", noteCount: 1, signalCount: 1 }],
        });
      }

      if (url.pathname === "/api/actions") {
        return jsonResponse({
          actions: [
            {
              body: "Confirm the desktop release owner.",
              confidence: 0.92,
              createdAt: "2026-07-03T08:00:00.000Z",
              id: "action-1",
              kind: "follow_up",
              status: "proposed",
              title: "Confirm release owner",
              updatedAt: "2026-07-03T08:00:00.000Z",
            },
          ],
          latestRun: {
            id: "run-1",
            metadata: { itemCount: 1, provider: "cloudflare-think" },
            sourceId: "journal-1",
            sourceType: "journal",
            startedAt: "2026-07-03T08:00:00.000Z",
            status: "completed",
            triggerType: "manual",
            userId: "user-1",
          },
        });
      }

      if (url.pathname === "/api/actions/action-1/status") {
        return jsonResponse({
          action: {
            body: "Confirm the desktop release owner.",
            confidence: 0.92,
            createdAt: "2026-07-03T08:00:00.000Z",
            id: "action-1",
            kind: "follow_up",
            status: readStringProperty(body, "status") ?? "accepted",
            title: "Confirm release owner",
            updatedAt: "2026-07-03T08:10:00.000Z",
          },
        });
      }

      if (url.pathname === "/api/conversations/default/messages") {
        return jsonResponse({
          conversationId: "default",
          draft: null,
          memoryResults: [
            {
              chunkId: "chunk-1",
              score: 4.2,
              sourceId: "revision-1",
              sourceType: "journal_revision",
              text: "Ship the desktop app first.",
            },
          ],
          message: readStringProperty(body, "message") ?? "",
          reasoningHarness: { name: "think", runtime: "cloudflare-agents" },
          reply: "Start with the desktop release owner.",
          skillsApplied: ["intake-loop"],
          subAgentsUsed: ["loopIntakeThink"],
          usedTools: ["retrieveMemory"],
          workflowHooks: ["dailyDigest"],
        });
      }

      if (url.pathname === "/api/signals") {
        return jsonResponse({
          signals: [
            {
              createdAt: "2026-07-03T08:30:01.000Z",
              id: "event-1",
              occurredAt: "2026-07-03T08:30:00.000Z",
              payload: { note: "Capture the launch follow-up." },
              schemaVersion: 1,
              source: "raycast_extension",
              type: "manual_check_in_submitted",
              userId: "user-1",
            },
          ],
        });
      }

      if (url.pathname === "/api/journal/2026-07-03") {
        return jsonResponse({
          document: {
            bodyText: "Morning plan",
            createdAt: "2026-07-03T07:00:00.000Z",
            id: "journal-1",
            localDate: "2026-07-03",
            title: "Daily note",
            updatedAt: "2026-07-03T08:00:00.000Z",
            userId: "user-1",
          },
        });
      }

      return new Response("missing route", { status: 404 });
    },
    port: 0,
  });
}

function engineUrl(activeServer: ReturnType<typeof Bun.serve> | undefined) {
  if (!activeServer) throw new Error("Missing Raycast e2e Engine stub");
  return `http://127.0.0.1:${activeServer.port}`;
}

function recordedRequest(requests: ReadonlyArray<RecordedEngineRequest>, path: string) {
  const request = requests.find((candidate) => candidate.path === path);
  if (!request) throw new Error(`Missing request for ${path}`);
  return request;
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}
