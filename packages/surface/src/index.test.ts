import { describe, expect, test } from "bun:test";
import {
  buildDailyNotePatchInput,
  buildStickyNoteCreateInput,
  buildStickyNotePatchInput,
  dailyNoteDrawerText,
  noteTextFromPayload,
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
});
