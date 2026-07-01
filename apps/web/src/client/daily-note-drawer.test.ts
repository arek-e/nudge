import { describe, expect, test } from "bun:test";
import { dailyNoteDrawerText } from "./daily-note-drawer";

describe("dailyNoteDrawerText", () => {
  test("hydrates the drawer from Convex when the local draft is clean", () => {
    expect(
      dailyNoteDrawerText({
        currentText: "",
        dirty: false,
        remoteBodyText: "Morning note",
      }),
    ).toBe("Morning note");
  });

  test("keeps local editing text when a remote update arrives", () => {
    expect(
      dailyNoteDrawerText({
        currentText: "Unsaved local edit",
        dirty: true,
        remoteBodyText: "Remote note",
      }),
    ).toBe("Unsaved local edit");
  });
});
