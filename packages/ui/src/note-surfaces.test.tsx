import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NoteComposerSurface,
  ReviewActionSurface,
  StickyNoteSurface,
  stickyColorFrom,
} from "./index";

describe("note surface UI", () => {
  test("renders the shared note composer with color swatches", () => {
    const html = renderToStaticMarkup(
      <NoteComposerSurface
        bodyText="Buy train tickets"
        color="green"
        disabled={false}
        statusMessage="Saved"
        onBodyTextChange={() => {}}
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("Write something to remember");
    expect(html).toContain('aria-label="Note color"');
    expect(html).toContain('aria-label="green"');
    expect(html).toContain("Add note");
    expect(html).toContain("Saved");
  });

  test("renders a sticky note card with sync state controls", () => {
    const html = renderToStaticMarkup(
      <StickyNoteSurface
        archiving={false}
        bodyText="Remember Mara prefers morning reviews"
        color="yellow"
        dirty
        pinned
        saving={false}
        serverRevision="7"
        statusMessage=""
        title="Mara preference"
        onArchive={() => {}}
        onBodyTextChange={() => {}}
        onChange={() => {}}
        onPinnedChange={() => {}}
        onSave={() => {}}
      />,
    );

    expect(html).toContain("Mara preference");
    expect(html).toContain("Revision 7");
    expect(html).toContain("Pinned");
    expect(html).toContain("Unsaved");
    expect(html).toContain("Archive");
    expect(html).toContain("Save");
  });

  test("renders action review follow-through", () => {
    const html = renderToStaticMarkup(
      <ReviewActionSurface
        body="Notify me before the launch review."
        confidencePercent={91}
        disabled={false}
        followThroughText="Reminder proposal for tomorrow."
        kind="reminder"
        status="proposed"
        title="Launch review reminder"
        onAccept={() => {}}
        onComplete={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(html).toContain("reminder · proposed");
    expect(html).toContain("91%");
    expect(html).toContain("Reminder proposal for tomorrow.");
    expect(html).toContain("Accept");
    expect(html).toContain("Done");
    expect(html).toContain("Dismiss");
  });

  test("normalizes unknown stored colors to yellow", () => {
    expect(stickyColorFrom("blue")).toBe("blue");
    expect(stickyColorFrom("legacy-purple")).toBe("yellow");
  });
});
