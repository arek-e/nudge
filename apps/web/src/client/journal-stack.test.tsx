import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JournalStack } from "./journal-stack";

describe("web journal stack", () => {
  test("renders the Engine journal with recent Engine signals instead of legacy sticky notes", () => {
    const html = renderToStaticMarkup(
      <JournalStack
        journal={{
          bodyText: "Morning plan",
          createdAt: "2026-07-03T08:00:00.000Z",
          id: "journal-1",
          localDate: "2026-07-03",
          title: "Daily note",
          updatedAt: "2026-07-03T08:30:00.000Z",
          userId: "user-1",
        }}
        signedInAs="Alex"
        signals={[
          {
            createdAt: "2026-07-03T08:35:00.000Z",
            id: "signal-1",
            occurredAt: "2026-07-03T08:34:00.000Z",
            payload: { note: "Ship the desktop shell." },
            schemaVersion: 1,
            source: "web_app",
            type: "manual_check_in_submitted",
            userId: "user-1",
          },
          {
            createdAt: "2026-07-03T08:40:00.000Z",
            id: "signal-2",
            occurredAt: "2026-07-03T08:39:00.000Z",
            payload: { text: "Review Raycast ask flow." },
            schemaVersion: 1,
            source: "raycast",
            type: "manual_check_in_submitted",
            userId: "user-1",
          },
        ]}
      />,
    );

    expect(html).toContain("Journal");
    expect(html).toContain("Daily note");
    expect(html).toContain("Morning plan");
    expect(html).toContain("Recent signals");
    expect(html).toContain("Ship the desktop shell.");
    expect(html).toContain("Review Raycast ask flow.");
    expect(html).not.toContain("Revision");
    expect(html).not.toContain("Pinned");
  });
});
