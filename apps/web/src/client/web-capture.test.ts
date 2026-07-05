import { describe, expect, test } from "bun:test";
import {
  appendWebCapture,
  captureResultFromSavedWebCapture,
  saveWebCapture,
  saveWebDailyNoteDraft,
  uploadWebMediaAttachment,
} from "./web-capture";

describe("web capture", () => {
  test("appends trimmed manual captures through the shared Engine client", async () => {
    const calls: unknown[] = [];

    const event = await appendWebCapture(
      {
        idempotencyKey: "web:capture-1",
        note: "  Follow up with Sam after launch review.  ",
        occurredAt: "2026-07-03T08:30:00.000Z",
      },
      async () => ({
        appendManualCapture: async (input) => {
          calls.push(input);
          return {
            createdAt: "2026-07-03T08:30:01.000Z",
            id: "event-1",
            idempotencyKey: input.idempotencyKey,
            occurredAt: input.occurredAt ?? "2026-07-03T08:30:00.000Z",
            payload: { note: input.note },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          };
        },
      }),
    );

    expect(calls).toEqual([
      {
        idempotencyKey: "web:capture-1",
        note: "Follow up with Sam after launch review.",
        occurredAt: "2026-07-03T08:30:00.000Z",
      },
    ]);
    expect(event.source).toBe("web_app");
    expect(event.payload).toEqual({ note: "Follow up with Sam after launch review." });
  });

  test("rejects blank captures before creating an Engine client", async () => {
    let createdClient = false;

    await expect(
      appendWebCapture({ note: " \n " }, async () => {
        createdClient = true;
        return {
          appendManualCapture: async () => ({
            createdAt: "2026-07-03T08:30:01.000Z",
            id: "event-1",
            occurredAt: "2026-07-03T08:30:00.000Z",
            payload: { note: "" },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          }),
        };
      }),
    ).rejects.toThrow("Write a note first.");

    expect(createdClient).toBe(false);
  });

  test("saves Engine journal context before appending the capture signal", async () => {
    const calls: unknown[] = [];

    const saved = await saveWebCapture(
      {
        existingJournalText: "Morning plan",
        idempotencyKey: "web:capture-2",
        localDate: "2026-07-03",
        note: " Follow up with Sam. ",
      },
      async () => ({
        appendManualCapture: async (input) => {
          calls.push({ input, type: "capture" });
          return {
            createdAt: "2026-07-03T08:30:01.000Z",
            id: "event-2",
            idempotencyKey: input.idempotencyKey,
            occurredAt: input.occurredAt ?? "2026-07-03T08:30:00.000Z",
            payload: { note: input.note },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          };
        },
        saveJournal: async (input) => {
          calls.push({ input, type: "journal" });
          return {
            analysisRun: {
              id: "run-1",
              metadata: { itemCount: 1 },
              sourceId: "revision-1",
              sourceType: "note_revision",
              startedAt: "2026-07-03T08:30:00.000Z",
              status: "queued",
              triggerType: "note_inactivity",
              userId: "user-1",
            },
            document: {
              bodyText: input.bodyText,
              createdAt: "2026-07-03T08:30:00.000Z",
              id: "journal-1",
              localDate: input.localDate,
              title: input.title,
              updatedAt: "2026-07-03T08:30:00.000Z",
              userId: "user-1",
            },
            revision: {
              bodyText: input.bodyText,
              changeHash: "31:Morning plan\n\nFollow up with Sam.",
              changedText: "Follow up with Sam.",
              createdAt: "2026-07-03T08:30:00.000Z",
              documentId: "journal-1",
              id: "revision-1",
              revisionNumber: 2,
              userId: "user-1",
            },
          };
        },
      }),
    );

    expect(calls).toEqual([
      {
        input: {
          bodyText: "Morning plan\n\nFollow up with Sam.",
          localDate: "2026-07-03",
          title: "2026-07-03",
        },
        type: "journal",
      },
      {
        input: {
          idempotencyKey: "web:capture-2",
          note: "Follow up with Sam.",
        },
        type: "capture",
      },
    ]);
    expect(saved.journal.bodyText).toBe("Morning plan\n\nFollow up with Sam.");
    expect(saved.capture.source).toBe("web_app");
    expect(saved.analysisRun?.status).toBe("queued");
  });

  test("autosaves a typed daily note through the journal without appending a capture signal", async () => {
    const calls: unknown[] = [];

    const saved = await saveWebDailyNoteDraft(
      {
        existingJournalText: "Morning plan",
        idempotencyKey: "web:autosave-1",
        localDate: "2026-07-03",
        note: " Follow up with Sam after the launch review. ",
      },
      async () => ({
        saveJournal: async (input) => {
          calls.push({ input, type: "journal" });
          return {
            analysisRun: {
              id: "run-autosave",
              metadata: { itemCount: 1 },
              sourceId: "revision-autosave",
              sourceType: "note_revision",
              startedAt: "2026-07-03T08:30:00.000Z",
              status: "queued",
              triggerType: "note_inactivity",
              userId: "user-1",
            },
            document: {
              bodyText: input.bodyText,
              createdAt: "2026-07-03T08:30:00.000Z",
              id: "journal-autosave",
              localDate: input.localDate,
              title: input.title,
              updatedAt: "2026-07-03T08:30:00.000Z",
              userId: "user-1",
            },
            revision: {
              bodyText: input.bodyText,
              changeHash: "autosave",
              changedText: "Follow up with Sam after the launch review.",
              createdAt: "2026-07-03T08:30:00.000Z",
              documentId: "journal-autosave",
              id: "revision-autosave",
              revisionNumber: 2,
              userId: "user-1",
            },
          };
        },
      }),
    );

    expect(calls).toEqual([
      {
        input: {
          bodyText: "Morning plan\n\nFollow up with Sam after the launch review.",
          idempotencyKey: "web:autosave-1",
          localDate: "2026-07-03",
          title: "2026-07-03",
        },
        type: "journal",
      },
    ]);
    expect(saved.journal.bodyText).toBe(
      "Morning plan\n\nFollow up with Sam after the launch review.",
    );
    expect(saved.analysisRun?.status).toBe("queued");
  });

  test("uploads media attachments and stores them on the journal and capture", async () => {
    const calls: unknown[] = [];
    const saved = await saveWebCapture(
      {
        existingJournalText: "Morning plan",
        idempotencyKey: "web:capture-media",
        localDate: "2026-07-03",
        mediaAttachments: [
          {
            dataURL: `data:image/jpeg;base64,${btoa("image bytes")}`,
            id: "550e8400-e29b-41d4-a716-446655440000",
            kind: "image",
            label: "Camera photo",
            mimeType: "image/jpeg",
          },
        ],
        note: " Add a photo from the launch review. ",
      },
      async () => ({
        appendManualCapture: async (input) => {
          calls.push({ input, type: "capture" });
          return {
            createdAt: "2026-07-03T08:30:01.000Z",
            id: "event-media",
            idempotencyKey: input.idempotencyKey,
            occurredAt: input.occurredAt ?? "2026-07-03T08:30:00.000Z",
            payload: { attachments: input.attachments, note: input.note },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          };
        },
        saveJournal: async (input) => {
          calls.push({ input, type: "journal" });
          return {
            document: {
              bodyDocument: input.bodyDocument,
              bodyText: input.bodyText,
              createdAt: "2026-07-03T08:30:00.000Z",
              id: "journal-media",
              localDate: input.localDate,
              title: input.title,
              updatedAt: "2026-07-03T08:30:00.000Z",
              userId: "user-1",
            },
            revision: {
              bodyText: input.bodyText,
              changeHash: "media",
              changedText: "Add a photo from the launch review.",
              createdAt: "2026-07-03T08:30:00.000Z",
              documentId: "journal-media",
              id: "revision-media",
              revisionNumber: 2,
              userId: "user-1",
            },
          };
        },
      }),
      async (attachment) => {
        calls.push({ attachment, type: "upload" });
        return {
          byteLength: 11,
          id: attachment.id,
          kind: attachment.kind,
          label: attachment.label,
          mimeType: attachment.mimeType,
          url: `/api/media/${attachment.id}`,
        };
      },
    );

    expect(calls).toEqual([
      {
        attachment: {
          dataURL: `data:image/jpeg;base64,${btoa("image bytes")}`,
          id: "550e8400-e29b-41d4-a716-446655440000",
          kind: "image",
          label: "Camera photo",
          mimeType: "image/jpeg",
        },
        type: "upload",
      },
      {
        input: {
          bodyDocument: [
            { children: [{ text: "Morning plan" }], type: "p" },
            { children: [{ text: "Add a photo from the launch review." }], type: "p" },
            {
              attrs: {
                alt: "Camera photo",
                id: "550e8400-e29b-41d4-a716-446655440000",
                mimeType: "image/jpeg",
                src: "/api/media/550e8400-e29b-41d4-a716-446655440000",
              },
              type: "img",
            },
          ],
          bodyText: "Morning plan\n\nAdd a photo from the launch review.",
          localDate: "2026-07-03",
          title: "2026-07-03",
        },
        type: "journal",
      },
      {
        input: {
          attachments: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              kind: "image",
              label: "Camera photo",
              mimeType: "image/jpeg",
              url: "/api/media/550e8400-e29b-41d4-a716-446655440000",
            },
          ],
          idempotencyKey: "web:capture-media",
          note: "Add a photo from the launch review.",
        },
        type: "capture",
      },
    ]);
    expect(saved.capture.payload).toEqual({
      attachments: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          kind: "image",
          label: "Camera photo",
          mimeType: "image/jpeg",
          url: "/api/media/550e8400-e29b-41d4-a716-446655440000",
        },
      ],
      note: "Add a photo from the launch review.",
    });
  });

  test("saves leading media and trailing continuation like the iOS capture composer", async () => {
    const calls: unknown[] = [];
    await saveWebCapture(
      {
        existingJournalText: "Morning plan",
        idempotencyKey: "web:capture-continuation",
        localDate: "2026-07-03",
        mediaAttachments: [
          {
            dataURL: `data:image/png;base64,${btoa("drawing bytes")}`,
            id: "550e8400-e29b-41d4-a716-446655440004",
            kind: "image",
            label: "Drawing",
            mimeType: "image/png",
          },
        ],
        note: " Sketch the launch review flow. ",
        trailingNote: " Ask Sam to review it tomorrow. ",
      },
      async () => ({
        appendManualCapture: async (input) => {
          calls.push({ input, type: "capture" });
          return {
            createdAt: "2026-07-03T08:30:01.000Z",
            id: "event-continuation",
            idempotencyKey: input.idempotencyKey,
            occurredAt: input.occurredAt ?? "2026-07-03T08:30:00.000Z",
            payload: { attachments: input.attachments, note: input.note },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          };
        },
        saveJournal: async (input) => {
          calls.push({ input, type: "journal" });
          return {
            document: {
              bodyDocument: input.bodyDocument,
              bodyText: input.bodyText,
              createdAt: "2026-07-03T08:30:00.000Z",
              id: "journal-continuation",
              localDate: input.localDate,
              title: input.title,
              updatedAt: "2026-07-03T08:30:00.000Z",
              userId: "user-1",
            },
            revision: {
              bodyText: input.bodyText,
              changeHash: "continuation",
              changedText: "Sketch the launch review flow.\n\nAsk Sam to review it tomorrow.",
              createdAt: "2026-07-03T08:30:00.000Z",
              documentId: "journal-continuation",
              id: "revision-continuation",
              revisionNumber: 2,
              userId: "user-1",
            },
          };
        },
      }),
      async (attachment) => {
        calls.push({ attachment, type: "upload" });
        return {
          byteLength: 13,
          id: attachment.id,
          kind: attachment.kind,
          label: attachment.label,
          mimeType: attachment.mimeType,
          url: `/api/media/${attachment.id}`,
        };
      },
    );

    expect(calls).toEqual([
      {
        attachment: {
          dataURL: `data:image/png;base64,${btoa("drawing bytes")}`,
          id: "550e8400-e29b-41d4-a716-446655440004",
          kind: "image",
          label: "Drawing",
          mimeType: "image/png",
        },
        type: "upload",
      },
      {
        input: {
          bodyDocument: [
            { children: [{ text: "Morning plan" }], type: "p" },
            { children: [{ text: "Sketch the launch review flow." }], type: "p" },
            {
              attrs: {
                alt: "Drawing",
                id: "550e8400-e29b-41d4-a716-446655440004",
                mimeType: "image/png",
                src: "/api/media/550e8400-e29b-41d4-a716-446655440004",
              },
              type: "img",
            },
            { children: [{ text: "Ask Sam to review it tomorrow." }], type: "p" },
          ],
          bodyText:
            "Morning plan\n\nSketch the launch review flow.\n\nAsk Sam to review it tomorrow.",
          localDate: "2026-07-03",
          title: "2026-07-03",
        },
        type: "journal",
      },
      {
        input: {
          attachments: [
            {
              id: "550e8400-e29b-41d4-a716-446655440004",
              kind: "image",
              label: "Drawing",
              mimeType: "image/png",
              url: "/api/media/550e8400-e29b-41d4-a716-446655440004",
            },
          ],
          idempotencyKey: "web:capture-continuation",
          note: "Sketch the launch review flow.\n\nAsk Sam to review it tomorrow.",
        },
        type: "capture",
      },
    ]);
  });

  test("stores voice attachments as audio journal blocks", async () => {
    const calls: unknown[] = [];
    await saveWebCapture(
      {
        idempotencyKey: "web:capture-voice",
        localDate: "2026-07-03",
        mediaAttachments: [
          {
            dataURL: `data:audio/mp4;base64,${btoa("voice bytes")}`,
            id: "550e8400-e29b-41d4-a716-446655440002",
            kind: "voice",
            label: "Voice recording",
            mimeType: "audio/mp4",
          },
        ],
        note: " Voice note from the launch review. ",
      },
      async () => ({
        appendManualCapture: async (input) => {
          calls.push({ input, type: "capture" });
          return {
            createdAt: "2026-07-03T08:30:01.000Z",
            id: "event-voice",
            occurredAt: "2026-07-03T08:30:00.000Z",
            payload: { attachments: input.attachments, note: input.note },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          };
        },
        saveJournal: async (input) => {
          calls.push({ input, type: "journal" });
          return {
            document: {
              bodyDocument: input.bodyDocument,
              bodyText: input.bodyText,
              createdAt: "2026-07-03T08:30:00.000Z",
              id: "journal-voice",
              localDate: input.localDate,
              title: input.title,
              updatedAt: "2026-07-03T08:30:00.000Z",
              userId: "user-1",
            },
            revision: {
              bodyText: input.bodyText,
              changeHash: "voice",
              changedText: "Voice note from the launch review.",
              createdAt: "2026-07-03T08:30:00.000Z",
              documentId: "journal-voice",
              id: "revision-voice",
              revisionNumber: 1,
              userId: "user-1",
            },
          };
        },
      }),
      async (attachment) => {
        calls.push({ attachment, type: "upload" });
        return {
          byteLength: 11,
          id: attachment.id,
          kind: attachment.kind,
          label: attachment.label,
          mimeType: attachment.mimeType,
          url: `/api/media/${attachment.id}`,
        };
      },
    );

    expect(calls).toEqual([
      {
        attachment: {
          dataURL: `data:audio/mp4;base64,${btoa("voice bytes")}`,
          id: "550e8400-e29b-41d4-a716-446655440002",
          kind: "voice",
          label: "Voice recording",
          mimeType: "audio/mp4",
        },
        type: "upload",
      },
      {
        input: {
          bodyDocument: [
            { children: [{ text: "Voice note from the launch review." }], type: "p" },
            {
              attrs: {
                alt: "Voice recording",
                id: "550e8400-e29b-41d4-a716-446655440002",
                mimeType: "audio/mp4",
                src: "/api/media/550e8400-e29b-41d4-a716-446655440002",
              },
              type: "audio",
            },
          ],
          bodyText: "Voice note from the launch review.",
          localDate: "2026-07-03",
          title: "2026-07-03",
        },
        type: "journal",
      },
      {
        input: {
          attachments: [
            {
              id: "550e8400-e29b-41d4-a716-446655440002",
              kind: "voice",
              label: "Voice recording",
              mimeType: "audio/mp4",
              url: "/api/media/550e8400-e29b-41d4-a716-446655440002",
            },
          ],
          idempotencyKey: "web:capture-voice",
          note: "Voice note from the launch review.",
        },
        type: "capture",
      },
    ]);
  });

  test("stores browser voice recordings as WebM audio journal blocks", async () => {
    const calls: unknown[] = [];
    await saveWebCapture(
      {
        idempotencyKey: "web:capture-browser-voice",
        localDate: "2026-07-03",
        mediaAttachments: [
          {
            dataURL: `data:audio/webm;base64,${btoa("voice bytes")}`,
            id: "550e8400-e29b-41d4-a716-446655440003",
            kind: "voice",
            label: "Voice recording",
            mimeType: "audio/webm",
          },
        ],
        note: " Voice note from the browser recorder. ",
      },
      async () => ({
        appendManualCapture: async (input) => {
          calls.push({ input, type: "capture" });
          return {
            createdAt: "2026-07-03T08:30:01.000Z",
            id: "event-browser-voice",
            occurredAt: "2026-07-03T08:30:00.000Z",
            payload: { attachments: input.attachments, note: input.note },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          };
        },
        saveJournal: async (input) => {
          calls.push({ input, type: "journal" });
          return {
            document: {
              bodyDocument: input.bodyDocument,
              bodyText: input.bodyText,
              createdAt: "2026-07-03T08:30:00.000Z",
              id: "journal-browser-voice",
              localDate: input.localDate,
              title: input.title,
              updatedAt: "2026-07-03T08:30:00.000Z",
              userId: "user-1",
            },
            revision: {
              bodyText: input.bodyText,
              changeHash: "browser-voice",
              changedText: "Voice note from the browser recorder.",
              createdAt: "2026-07-03T08:30:00.000Z",
              documentId: "journal-browser-voice",
              id: "revision-browser-voice",
              revisionNumber: 1,
              userId: "user-1",
            },
          };
        },
      }),
      async (attachment) => {
        calls.push({ attachment, type: "upload" });
        return {
          byteLength: 11,
          id: attachment.id,
          kind: attachment.kind,
          label: attachment.label,
          mimeType: attachment.mimeType,
          url: `/api/media/${attachment.id}`,
        };
      },
    );

    expect(calls).toEqual([
      {
        attachment: {
          dataURL: `data:audio/webm;base64,${btoa("voice bytes")}`,
          id: "550e8400-e29b-41d4-a716-446655440003",
          kind: "voice",
          label: "Voice recording",
          mimeType: "audio/webm",
        },
        type: "upload",
      },
      {
        input: {
          bodyDocument: [
            { children: [{ text: "Voice note from the browser recorder." }], type: "p" },
            {
              attrs: {
                alt: "Voice recording",
                id: "550e8400-e29b-41d4-a716-446655440003",
                mimeType: "audio/webm",
                src: "/api/media/550e8400-e29b-41d4-a716-446655440003",
              },
              type: "audio",
            },
          ],
          bodyText: "Voice note from the browser recorder.",
          localDate: "2026-07-03",
          title: "2026-07-03",
        },
        type: "journal",
      },
      {
        input: {
          attachments: [
            {
              id: "550e8400-e29b-41d4-a716-446655440003",
              kind: "voice",
              label: "Voice recording",
              mimeType: "audio/webm",
              url: "/api/media/550e8400-e29b-41d4-a716-446655440003",
            },
          ],
          idempotencyKey: "web:capture-browser-voice",
          note: "Voice note from the browser recorder.",
        },
        type: "capture",
      },
    ]);
  });

  test("uploads media data URLs through the existing media service", async () => {
    const requests: Request[] = [];

    const stored = await uploadWebMediaAttachment(
      {
        dataURL: `data:image/png;base64,${btoa("drawing bytes")}`,
        id: "550e8400-e29b-41d4-a716-446655440001",
        kind: "image",
        label: "Drawing",
        mimeType: "image/png",
      },
      {
        baseUrl: "https://nudge.example",
        fetch: async (request) => {
          requests.push(request);
          return jsonResponse({
            byteLength: 13,
            id: "550e8400-e29b-41d4-a716-446655440001",
            kind: "image",
            label: "Drawing",
            mimeType: "image/png",
            url: "/api/media/550e8400-e29b-41d4-a716-446655440001",
          });
        },
        headers: async () => ({ "x-nudge-client": "web" }),
      },
    );

    expect(stored.url).toBe("/api/media/550e8400-e29b-41d4-a716-446655440001");
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("https://nudge.example/api/media");
    expect(requests[0]!.method).toBe("POST");
    expect(requests[0]!.headers.get("content-type")).toBe("application/json");
    expect(requests[0]!.headers.get("x-nudge-client")).toBe("web");
    expect(await requests[0]!.json()).toEqual({
      byteLength: 13,
      dataBase64: btoa("drawing bytes"),
      id: "550e8400-e29b-41d4-a716-446655440001",
      kind: "image",
      label: "Drawing",
      mimeType: "image/png",
    });
  });

  test("uploads browser voice data URLs through the existing media service", async () => {
    const stored = await uploadWebMediaAttachment(
      {
        dataURL: `data:audio/webm;base64,${btoa("voice bytes")}`,
        id: "550e8400-e29b-41d4-a716-446655440003",
        kind: "voice",
        label: "Voice recording",
        mimeType: "audio/webm",
      },
      {
        baseUrl: "https://nudge.example",
        fetch: async () =>
          jsonResponse({
            byteLength: 11,
            id: "550e8400-e29b-41d4-a716-446655440003",
            kind: "voice",
            label: "Voice recording",
            mimeType: "audio/webm",
            url: "/api/media/550e8400-e29b-41d4-a716-446655440003",
          }),
        headers: async () => ({ "x-nudge-client": "web" }),
      },
    );

    expect(stored).toEqual({
      byteLength: 11,
      id: "550e8400-e29b-41d4-a716-446655440003",
      kind: "voice",
      label: "Voice recording",
      mimeType: "audio/webm",
      url: "/api/media/550e8400-e29b-41d4-a716-446655440003",
    });
  });

  test("derives an iOS-like capture result from a saved Engine capture", () => {
    const result = captureResultFromSavedWebCapture({
      actionCount: 2,
      noteText: "Follow up with Sam.",
      saved: {
        analysisRun: {
          id: "run-1",
          metadata: { itemCount: 1 },
          sourceId: "revision-1",
          sourceType: "note_revision",
          startedAt: "2026-07-03T08:30:00.000Z",
          status: "queued",
          triggerType: "note_inactivity",
          userId: "user-1",
        },
        capture: {
          createdAt: "2026-07-03T08:30:01.000Z",
          id: "event-2",
          occurredAt: "2026-07-03T08:30:00.000Z",
          payload: { note: "Follow up with Sam." },
          schemaVersion: 1,
          source: "web_app",
          type: "manual_check_in_submitted",
          userId: "user-1",
        },
        journal: {
          bodyText: "Morning plan\n\nFollow up with Sam.",
          createdAt: "2026-07-03T08:30:00.000Z",
          id: "journal-1",
          localDate: "2026-07-03",
          title: "2026-07-03",
          updatedAt: "2026-07-03T08:30:00.000Z",
          userId: "user-1",
        },
        revision: {
          bodyText: "Morning plan\n\nFollow up with Sam.",
          changeHash: "31:Morning plan\n\nFollow up with Sam.",
          changedText: "Follow up with Sam.",
          createdAt: "2026-07-03T08:30:00.000Z",
          documentId: "journal-1",
          id: "revision-1",
          revisionNumber: 2,
          userId: "user-1",
        },
      },
      signalCount: 4,
    });

    expect(result.title).toBe("Follow up with Sam.");
    expect(result.signalCount).toBe(4);
    expect(result.actionCount).toBe(2);
    expect(result.sourceCount).toBe(5);
    expect(result.summary).toContain("Saved to 2026-07-03");
    expect(result.references).toEqual([
      "Journal 2026-07-03",
      "Web App",
      "4 signals",
      "2 open actions",
      "AI review queued",
    ]);
    expect(result.items.map((item) => item.title)).toEqual([
      "Journal",
      "Capture",
      "Open actions",
      "AI review",
    ]);
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}
