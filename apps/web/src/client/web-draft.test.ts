import { describe, expect, test } from "bun:test";
import {
  clearWebLocalDraft,
  loadWebLocalDraft,
  saveWebLocalDraft,
  type WebDraftStorage,
} from "./web-draft";

describe("web local draft", () => {
  test("saves and reloads a daily draft scoped to surface and date", () => {
    const storage = memoryDraftStorage();

    saveWebLocalDraft({
      bodyText: "Sketch the launch review flow.",
      continuationText: "Ask Sam to review it tomorrow.",
      localDate: "2026-07-03",
      storage,
      surface: "desktop",
    });

    expect(
      loadWebLocalDraft({
        localDate: "2026-07-03",
        storage,
        surface: "desktop",
      }),
    ).toEqual({
      bodyText: "Sketch the launch review flow.",
      continuationText: "Ask Sam to review it tomorrow.",
      localDate: "2026-07-03",
      version: 1,
    });
    expect(
      loadWebLocalDraft({
        localDate: "2026-07-03",
        storage,
        surface: "web",
      }),
    ).toBeNull();
  });

  test("clears the stored draft when both draft fields are blank", () => {
    const storage = memoryDraftStorage();

    saveWebLocalDraft({
      bodyText: "Morning plan",
      continuationText: "",
      localDate: "2026-07-03",
      storage,
      surface: "web",
    });
    saveWebLocalDraft({
      bodyText: "  ",
      continuationText: "\n",
      localDate: "2026-07-03",
      storage,
      surface: "web",
    });

    expect(loadWebLocalDraft({ localDate: "2026-07-03", storage, surface: "web" })).toBeNull();
  });

  test("ignores corrupted stored draft payloads", () => {
    const storage = memoryDraftStorage();
    storage.setItem("nudge.web.local-draft.2026-07-03", "{not json");

    expect(loadWebLocalDraft({ localDate: "2026-07-03", storage, surface: "web" })).toBeNull();
  });

  test("clears a daily draft after a successful capture", () => {
    const storage = memoryDraftStorage();

    saveWebLocalDraft({
      bodyText: "Morning plan",
      continuationText: "",
      localDate: "2026-07-03",
      storage,
      surface: "web",
    });
    clearWebLocalDraft({ localDate: "2026-07-03", storage, surface: "web" });

    expect(loadWebLocalDraft({ localDate: "2026-07-03", storage, surface: "web" })).toBeNull();
  });
});

function memoryDraftStorage(): WebDraftStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
