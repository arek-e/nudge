import { describe, expect, test } from "bun:test";
import {
  anonymousUserIdFromStorage,
  buildManualCaptureInput,
  buildSurfaceIdentityHeaders,
  buildDailyNotePatchInput,
  buildStickyNoteCreateInput,
  buildStickyNotePatchInput,
  createSurfaceEngineClient,
  dailyNoteDrawerText,
  generatedAnonymousUserId,
  noteTextFromPayload,
  surfaceCaptureSource,
  surfaceClientHeader,
  surfacePayloadHash,
  stickyNoteTitleFromText,
  todayLocalDate,
} from "./index";

describe("surface note sync logic", () => {
  test("keeps local drawer text when a remote note arrives during editing", () => {
    expect(
      dailyNoteDrawerText({
        currentText: "Unsaved local edit",
        dirty: true,
        remoteBodyText: "Remote note",
      }),
    ).toBe("Unsaved local edit");
  });

  test("builds one canonical Convex patch payload shape for App Surfaces", () => {
    expect(
      buildDailyNotePatchInput({
        bodyDocument: [{ children: [{ text: "Hello" }], type: "p" }],
        bodyText: "Hello",
        idempotencyKey: "surface-save-1",
        localDate: "2026-07-03",
        serverRevision: "7",
        title: "Today",
      }),
    ).toEqual({
      baseServerRevision: "7",
      bodyDocument: [{ children: [{ text: "Hello" }], type: "p" }],
      bodyText: "Hello",
      idempotencyKey: "surface-save-1",
      localDate: "2026-07-03",
      payloadHash: "5:Hello",
      title: "Today",
    });
  });

  test("normalizes note previews from common signal payloads", () => {
    expect(noteTextFromPayload({ note: "Captured note" })).toBe("Captured note");
    expect(noteTextFromPayload({ changedText: "New paragraph" })).toBe("New paragraph");
    expect(surfacePayloadHash("abc")).toBe("3:abc");
  });

  test("builds canonical sticky note create and patch inputs for every surface", () => {
    const payloadHash = surfacePayloadHash(
      JSON.stringify({
        bodyText: "Buy train tickets",
        color: "green",
        pinned: true,
        title: "Travel",
      }),
    );

    expect(
      buildStickyNoteCreateInput({
        bodyDocument: [{ children: [{ text: "Buy train tickets" }], type: "p" }],
        bodyText: "Buy train tickets",
        color: "green",
        idempotencyKey: "surface-create-1",
        pinned: true,
        title: "Travel",
      }),
    ).toEqual({
      bodyDocument: [{ children: [{ text: "Buy train tickets" }], type: "p" }],
      bodyText: "Buy train tickets",
      color: "green",
      idempotencyKey: "surface-create-1",
      payloadHash,
      pinned: true,
      title: "Travel",
    });

    expect(
      buildStickyNotePatchInput({
        bodyText: "Buy train tickets",
        color: "green",
        idempotencyKey: "surface-patch-1",
        noteId: "note-1",
        pinned: true,
        serverRevision: "4",
        title: "Travel",
      }),
    ).toEqual({
      baseServerRevision: "4",
      bodyText: "Buy train tickets",
      color: "green",
      idempotencyKey: "surface-patch-1",
      noteId: "note-1",
      payloadHash,
      pinned: true,
      title: "Travel",
    });
  });

  test("derives compact sticky note titles from text", () => {
    expect(stickyNoteTitleFromText("Remember Mara prefers morning reviews\nAdd to wiki")).toBe(
      "Remember Mara prefers morning reviews",
    );
    expect(stickyNoteTitleFromText("")).toBe("Untitled note");
  });

  test("formats local dates without leaking clock logic into surfaces", () => {
    expect(todayLocalDate(new Date("2026-07-03T22:30:00.000Z"))).toBe("2026-07-03");
  });

  test("normalizes App Surface identity for Engine requests", () => {
    expect(surfaceClientHeader("web")).toBe("web");
    expect(surfaceClientHeader("desktop")).toBe("desktop");
    expect(surfaceClientHeader("raycast")).toBe("raycast");
    expect(surfaceClientHeader("ios")).toBe("ios");
    expect(surfaceCaptureSource("raycast")).toBe("raycast_extension");

    expect(
      buildSurfaceIdentityHeaders({
        anonymousUserId: "anon_550e8400-e29b-41d4-a716-446655440000",
        surface: "desktop",
      }),
    ).toEqual({
      "x-nudge-anonymous-user-id": "anon_550e8400-e29b-41d4-a716-446655440000",
      "x-nudge-client": "desktop",
    });

    expect(
      buildSurfaceIdentityHeaders({
        bearerToken: "session-token",
        surface: "web",
      }),
    ).toEqual({
      authorization: "Bearer session-token",
      "x-nudge-client": "web",
    });
  });

  test("persists one anonymous install identity across App Surfaces", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(generatedAnonymousUserId(() => "550E8400-E29B-41D4-A716-446655440000")).toBe(
      "anon_550e8400-e29b-41d4-a716-446655440000",
    );
    expect(
      anonymousUserIdFromStorage({
        randomUUID: () => "550E8400-E29B-41D4-A716-446655440000",
        storage,
      }),
    ).toBe("anon_550e8400-e29b-41d4-a716-446655440000");
    expect(
      anonymousUserIdFromStorage({
        randomUUID: () => "00000000-0000-0000-0000-000000000000",
        storage,
      }),
    ).toBe("anon_550e8400-e29b-41d4-a716-446655440000");
  });

  test("builds canonical manual capture payloads for platform services", () => {
    expect(
      buildManualCaptureInput({
        attachments: [{ id: "media-1", kind: "image" }],
        idempotencyKey: "raycast-capture-1",
        note: "Follow up with Maya about travel tomorrow.",
        occurredAt: "2026-07-03T10:00:00.000Z",
        surface: "raycast",
      }),
    ).toEqual({
      idempotencyKey: "raycast-capture-1",
      occurredAt: "2026-07-03T10:00:00.000Z",
      payload: {
        attachments: [{ id: "media-1", kind: "image" }],
        note: "Follow up with Maya about travel tomorrow.",
      },
      schemaVersion: 1,
      source: "raycast_extension",
      type: "manual_check_in_submitted",
    });
  });

  test("creates a small Engine HTTP service for TypeScript App Surfaces", async () => {
    const requests: Array<Request> = [];
    const client = createSurfaceEngineClient({
      anonymousUserId: "anon_550e8400-e29b-41d4-a716-446655440000",
      baseUrl: "https://nudge.example",
      fetch: async (request) => {
        requests.push(request);
        return new Response(
          JSON.stringify({
            id: "event-1",
            userId: "anon_550e8400-e29b-41d4-a716-446655440000",
            type: "manual_check_in_submitted",
            source: "desktop_app",
            occurredAt: "2026-07-03T10:00:00.000Z",
            schemaVersion: 1,
            idempotencyKey: "desktop-capture-1",
            payload: { note: "Shared capture" },
            createdAt: "2026-07-03T10:00:01.000Z",
          }),
          { headers: { "content-type": "application/json" }, status: 200 },
        );
      },
      surface: "desktop",
    });

    const event = await client.appendManualCapture({
      idempotencyKey: "desktop-capture-1",
      note: "Shared capture",
      occurredAt: "2026-07-03T10:00:00.000Z",
    });

    expect(event).toMatchObject({
      id: "event-1",
      source: "desktop_app",
      type: "manual_check_in_submitted",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://nudge.example/api/captures");
    expect(requests[0]?.headers.get("x-nudge-client")).toBe("desktop");
    expect(requests[0]?.headers.get("x-nudge-anonymous-user-id")).toBe(
      "anon_550e8400-e29b-41d4-a716-446655440000",
    );
    expect(await requests[0]?.json()).toEqual({
      idempotencyKey: "desktop-capture-1",
      occurredAt: "2026-07-03T10:00:00.000Z",
      payload: { note: "Shared capture" },
      schemaVersion: 1,
      source: "desktop_app",
      type: "manual_check_in_submitted",
    });
  });

  test("saves daily journals through the shared Engine service", async () => {
    const requests: Array<Request> = [];
    const client = createSurfaceEngineClient({
      anonymousUserId: "anon_550e8400-e29b-41d4-a716-446655440000",
      baseUrl: "https://nudge.example",
      fetch: async (request) => {
        requests.push(request);
        return jsonResponse({
          analysisRun: {
            id: "run-1",
            metadata: { itemCount: 1 },
            sourceId: "revision-1",
            sourceType: "note_revision",
            startedAt: "2026-07-03T10:00:00.000Z",
            status: "queued",
            triggerType: "note_inactivity",
            userId: "anon_550e8400-e29b-41d4-a716-446655440000",
          },
          document: {
            bodyText: "Morning plan\n\nFollow up with Sam.",
            createdAt: "2026-07-03T10:00:00.000Z",
            id: "journal-1",
            localDate: "2026-07-03",
            title: "2026-07-03",
            updatedAt: "2026-07-03T10:00:00.000Z",
            userId: "anon_550e8400-e29b-41d4-a716-446655440000",
          },
          revision: {
            bodyText: "Morning plan\n\nFollow up with Sam.",
            changeHash: "38:Morning plan\n\nFollow up with Sam.",
            changedText: "Follow up with Sam.",
            createdAt: "2026-07-03T10:00:00.000Z",
            documentId: "journal-1",
            id: "revision-1",
            revisionNumber: 2,
            userId: "anon_550e8400-e29b-41d4-a716-446655440000",
          },
        });
      },
      surface: "desktop",
    });

    const saved = await client.saveJournal({
      bodyText: "Morning plan\n\nFollow up with Sam.",
      localDate: "2026-07-03",
      title: "2026-07-03",
    });

    expect(saved.document.bodyText).toBe("Morning plan\n\nFollow up with Sam.");
    expect(saved.analysisRun?.status).toBe("queued");
    expect(saved.revision.revisionNumber).toBe(2);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://nudge.example/api/journal");
    expect(requests[0]?.headers.get("x-nudge-client")).toBe("desktop");
    expect(await requests[0]?.json()).toEqual({
      bodyText: "Morning plan\n\nFollow up with Sam.",
      localDate: "2026-07-03",
      title: "2026-07-03",
    });
  });

  test("updates action review status through the shared Engine service", async () => {
    const requests: Array<Request> = [];
    const client = createSurfaceEngineClient({
      anonymousUserId: "anon_550e8400-e29b-41d4-a716-446655440000",
      baseUrl: "https://nudge.example",
      fetch: async (request) => {
        requests.push(request);
        return jsonResponse({
          action: {
            body: "Confirm the release owner.",
            confidence: 0.92,
            createdAt: "2026-07-03T08:00:00.000Z",
            id: "action/with spaces",
            kind: "follow_up",
            status: "accepted",
            title: "Confirm release owner",
            updatedAt: "2026-07-03T09:00:00.000Z",
          },
        });
      },
      surface: "raycast",
    });

    const action = await client.updateActionStatus({
      itemId: "action/with spaces",
      status: "accepted",
    });

    expect(action.status).toBe("accepted");
    expect(action.title).toBe("Confirm release owner");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://nudge.example/api/actions/action%2Fwith%20spaces/status",
    );
    expect(requests[0]?.headers.get("x-nudge-client")).toBe("raycast");
    expect(await requests[0]?.json()).toEqual({
      itemId: "action/with spaces",
      status: "accepted",
    });
  });

  test("sends conversation messages through the shared Engine service", async () => {
    const requests: Array<Request> = [];
    const client = createSurfaceEngineClient({
      anonymousUserId: "anon_550e8400-e29b-41d4-a716-446655440000",
      baseUrl: "https://nudge.example",
      fetch: async (request) => {
        requests.push(request);
        return jsonResponse({
          conversationId: "focus",
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
          message: "What should I do next?",
          reasoningHarness: { name: "think", runtime: "cloudflare-agents" },
          reply: "Start with the desktop release owner.",
          skillsApplied: ["intake-loop"],
          subAgentsUsed: ["loopIntakeThink"],
          usedTools: ["retrieveMemory"],
          workflowHooks: ["dailyDigest"],
        });
      },
      surface: "raycast",
    });

    const response = await client.sendConversationMessage({
      conversationId: "focus",
      message: "What should I do next?",
    });

    expect(response.reply).toBe("Start with the desktop release owner.");
    expect(response.memoryResults[0]?.text).toBe("Ship the desktop app first.");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://nudge.example/api/conversations/focus/messages");
    expect(requests[0]?.headers.get("x-nudge-client")).toBe("raycast");
    expect(await requests[0]?.json()).toEqual({ message: "What should I do next?" });
  });

  test("loads the iOS-equivalent context refresh through the shared Engine service", async () => {
    const requests: Array<Request> = [];
    const client = createSurfaceEngineClient({
      anonymousUserId: "anon_550e8400-e29b-41d4-a716-446655440000",
      baseUrl: "https://nudge.example",
      fetch: async (request) => {
        requests.push(request);
        const url = new URL(request.url);
        if (url.pathname === "/api/session") {
          return jsonResponse({
            authMode: "anonymous",
            user: {
              displayName: "Anonymous User",
              id: "anon_550e8400-e29b-41d4-a716-446655440000",
            },
            workspace: {
              id: "anon_550e8400-e29b-41d4-a716-446655440000",
              label: "Anonymous User's workspace",
            },
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
                body: "Send the note.",
                confidence: 0.82,
                createdAt: "2026-07-03T10:00:00.000Z",
                eventStartsAt: "2026-07-04T09:00:00.000Z",
                id: "action-1",
                kind: "follow_up",
                status: "proposed",
                title: "Follow up with Maya",
                updatedAt: "2026-07-03T10:00:00.000Z",
              },
            ],
            latestRun: {
              completedAt: undefined,
              errorCode: undefined,
              id: "run-1",
              metadata: { itemCount: 1 },
              model: "@cf/test",
              sourceId: "revision-1",
              sourceType: "note_revision",
              startedAt: "2026-07-03T10:00:00.000Z",
              status: "queued",
              triggerType: "note_inactivity",
              userId: "anon_550e8400-e29b-41d4-a716-446655440000",
            },
          });
        }
        if (url.pathname === "/api/signals") {
          return jsonResponse({
            signals: [
              {
                createdAt: "2026-07-03T10:00:01.000Z",
                id: "signal-1",
                occurredAt: "2026-07-03T10:00:00.000Z",
                payload: { note: "Captured from Raycast" },
                schemaVersion: 1,
                source: "raycast_extension",
                type: "manual_check_in_submitted",
                userId: "anon_550e8400-e29b-41d4-a716-446655440000",
              },
            ],
          });
        }
        if (url.pathname === "/api/journal/2026-07-03") {
          return jsonResponse({
            document: {
              bodyText: "Captured from Raycast",
              createdAt: "2026-07-03T10:00:01.000Z",
              id: "journal-1",
              localDate: "2026-07-03",
              title: "2026-07-03",
              updatedAt: "2026-07-03T10:00:01.000Z",
              userId: "anon_550e8400-e29b-41d4-a716-446655440000",
            },
          });
        }
        return new Response("missing route", { status: 404 });
      },
      surface: "raycast",
    });

    const context = await client.refreshContext({
      actionLimit: 25,
      localDate: "2026-07-03",
      signalLimit: 10,
      timeZone: "Europe/Stockholm",
    });

    expect(context.session.user?.displayName).toBe("Anonymous User");
    expect(context.calendarDays).toEqual([
      { localDate: "2026-07-03", noteCount: 1, signalCount: 2 },
    ]);
    expect(context.actions.actions[0]?.title).toBe("Follow up with Maya");
    expect(context.actions.actions[0]?.eventStartsAt).toBe("2026-07-04T09:00:00.000Z");
    expect(context.signals[0]?.source).toBe("raycast_extension");
    expect(context.journal?.bodyText).toBe("Captured from Raycast");
    const requestUrls = requests.map((request) => new URL(request.url));
    expect(requestUrls.map((url) => url.pathname)).toEqual([
      "/api/session",
      "/api/calendar/days",
      "/api/actions",
      "/api/signals",
      "/api/journal/2026-07-03",
    ]);
    expect(searchParamAt(requestUrls, 1, "timeZone")).toBe("Europe/Stockholm");
    expect(searchParamAt(requestUrls, 2, "limit")).toBe("25");
    expect(searchParamAt(requestUrls, 3, "limit")).toBe("10");
    for (const request of requests) {
      expect(request.headers.get("x-nudge-client")).toBe("raycast");
    }
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function searchParamAt(urls: ReadonlyArray<URL>, index: number, key: string) {
  const url = urls[index];
  return url ? url.searchParams.get(key) : null;
}
