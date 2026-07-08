import { afterEach, describe, expect, test } from "bun:test";
import {
  createWebSurfaceEngineClient,
  setSessionTokenResolver,
  streamConversationMessage,
} from "./api-client";

const originalFetch = globalThis.fetch;

describe("web App Surface Engine client", () => {
  afterEach(() => {
    setSessionTokenResolver(null);
    globalThis.fetch = originalFetch;
  });

  test("refreshes iOS-equivalent context through the shared surface client with Clerk identity", async () => {
    const requests: Request[] = [];
    setSessionTokenResolver(async () => "session-token");
    const client = await createWebSurfaceEngineClient({
      baseUrl: "https://nudge.example",
      fetch: async (request) => {
        requests.push(request);
        const url = new URL(request.url);
        if (url.pathname === "/api/session") {
          return jsonResponse({
            authMode: "clerk",
            user: { displayName: "Alex", id: "user-1" },
            workspace: { id: "workspace-1", label: "Alex's workspace" },
          });
        }
        if (url.pathname === "/api/calendar/days") {
          return jsonResponse({
            days: [{ localDate: "2026-07-03", noteCount: 1, signalCount: 2 }],
          });
        }
        if (url.pathname === "/api/actions") {
          return jsonResponse({
            actions: [
              {
                body: "Ask Sam for the launch date.",
                confidence: 0.91,
                createdAt: "2026-07-03T08:00:00.000Z",
                eventStartsAt: "2026-07-04T09:00:00.000Z",
                id: "action-1",
                kind: "event",
                status: "proposed",
                title: "Schedule launch review",
                updatedAt: "2026-07-03T08:00:00.000Z",
              },
            ],
          });
        }
        if (url.pathname === "/api/signals") {
          return jsonResponse({
            signals: [
              {
                createdAt: "2026-07-03T08:02:00.000Z",
                id: "signal-1",
                occurredAt: "2026-07-03T08:02:00.000Z",
                payload: { note: "Ship desktop shell" },
                schemaVersion: 1,
                source: "web_app",
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
    });

    const context = await client.refreshContext({
      actionLimit: 24,
      localDate: "2026-07-03",
      signalLimit: 12,
      timeZone: "Europe/Stockholm",
    });

    expect(context.session.user?.displayName).toBe("Alex");
    expect(context.actions.actions[0]?.eventStartsAt).toBe("2026-07-04T09:00:00.000Z");
    expect(context.signals).toHaveLength(1);
    expect(context.journal?.title).toBe("Daily note");
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/api/session",
      "/api/calendar/days",
      "/api/actions",
      "/api/signals",
      "/api/journal/2026-07-03",
    ]);
    for (const request of requests) {
      expect(request.headers.get("authorization")).toBe("Bearer session-token");
      expect(request.headers.get("x-nudge-client")).toBe("web");
    }
  });

  test("surfaces stream error payloads from the conversation API", async () => {
    const requests: Request[] = [];
    globalThis.fetch = async (input, init) => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), "https://nudge.example"), init);
      requests.push(request);
      return new Response(JSON.stringify({ error: "Workers AI is unavailable" }), {
        headers: { "content-type": "application/json" },
        status: 503,
      });
    };

    await expect(
      streamConversationMessage({
        conversationId: "default",
        message: "Can you help?",
      }),
    ).rejects.toThrow("Workers AI is unavailable");

    expect(
      requests.map((request) => new URL(request.url, "https://nudge.example").pathname),
    ).toEqual(["/api/conversations/default/messages/stream"]);
    expect(requests[0]?.headers.get("x-nudge-client")).toBe("web");
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}
