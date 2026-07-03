import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarActivitySurface,
  CaptureResultSurface,
  DailyOperatingLoopSurface,
  DailyJournalSurface,
  NoteComposerSurface,
  ReviewActionSurface,
  SettingsSurface,
  StickyNoteSurface,
  stickyColorFrom,
} from "./index";

describe("note surface UI", () => {
  test("renders an iOS-like Daily Operating Loop shell for React surfaces", () => {
    const html = renderToStaticMarkup(
      <DailyOperatingLoopSurface
        actionCount={3}
        activitySlot={<p>Calendar activity</p>}
        captureSlot={<p>Capture editor</p>}
        currentDate="2026-07-03"
        journalSlot={<p>Daily note rows</p>}
        reviewSlot={<p>Review queue</p>}
        signalCount={9}
        signedInAs="Alex"
        statusMessage="Connected"
      />,
    );

    expect(html).toContain("Daily Operating Loop");
    expect(html).toContain("Today");
    expect(html).toContain("2026-07-03");
    expect(html).toContain("Connected");
    expect(html).toContain("3 open loops");
    expect(html).toContain("9 signals");
    expect(html).toContain("Capture");
    expect(html).toContain("Review");
    expect(html).toContain("Calendar activity");
    expect(html).toContain("Capture editor");
    expect(html).toContain("Daily note rows");
    expect(html).toContain("Review queue");
    expect(html).toContain("Alex");
  });

  test("renders calendar activity like the iOS day stats", () => {
    const html = renderToStaticMarkup(
      <CalendarActivitySurface
        currentDate="2026-07-03"
        days={[
          { localDate: "2026-07-01", noteCount: 0, signalCount: 0 },
          { localDate: "2026-07-02", noteCount: 1, signalCount: 2 },
          { localDate: "2026-07-03", noteCount: 2, signalCount: 5 },
        ]}
      />,
    );

    expect(html).toContain("Activity");
    expect(html).toContain("3 days");
    expect(html).toContain("2 active");
    expect(html).toContain("3 notes");
    expect(html).toContain("7 signals");
    expect(html).toContain("Selected day");
    expect(html).toContain("2 notes");
    expect(html).toContain("5 signals");
    expect(html).toContain("Logged");
  });

  test("renders the Engine daily journal document", () => {
    const html = renderToStaticMarkup(
      <DailyJournalSurface
        bodyText={"Morning plan\n\nFollow up with Sam."}
        localDate="2026-07-03"
        title="2026-07-03"
        updatedAt="2026-07-03T08:30:00.000Z"
      />,
    );

    expect(html).toContain("Journal");
    expect(html).toContain("2026-07-03");
    expect(html).toContain("Morning plan");
    expect(html).toContain("Follow up with Sam.");
    expect(html).toContain("Updated");
  });

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

    expect(html).toContain("What matters now?");
    expect(html).toContain('aria-label="Note color"');
    expect(html).toContain('aria-label="green"');
    expect(html).toContain("Capture");
    expect(html).toContain("Saved");
  });

  test("renders composer attachment controls like the iOS add rail", () => {
    const html = renderToStaticMarkup(
      <NoteComposerSurface
        attachments={[
          {
            id: "media-1",
            kind: "photo",
            label: "Camera photo",
          },
          {
            id: "media-2",
            kind: "drawing",
            label: "Drawing",
          },
          {
            id: "media-3",
            kind: "voice",
            label: "Voice recording",
          },
        ]}
        bodyText="Photo from launch review"
        color="blue"
        disabled={false}
        onAttachDrawing={() => {}}
        onAttachImage={() => {}}
        onAttachVoice={() => {}}
        onBodyTextChange={() => {}}
        onChange={() => {}}
        onRemoveAttachment={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("Photo");
    expect(html).toContain("Drawing");
    expect(html).toContain("Voice");
    expect(html).toContain('aria-label="Attach photo"');
    expect(html).toContain('aria-label="Attach drawing"');
    expect(html).toContain('aria-label="Attach voice"');
    expect(html).toContain("Camera photo");
    expect(html).toContain("Voice recording");
    expect(html).toContain('aria-label="Remove Camera photo"');
    expect(html).toContain('aria-label="Remove Drawing"');
    expect(html).toContain('aria-label="Remove Voice recording"');
  });

  test("renders a continuation draft after attachments like the iOS capture canvas", () => {
    const html = renderToStaticMarkup(
      <NoteComposerSurface
        attachments={[
          {
            id: "media-1",
            kind: "drawing",
            label: "Drawing",
          },
        ]}
        bodyText="Sketch the launch review flow."
        color="blue"
        continuationText="Ask Sam to review it tomorrow."
        disabled={false}
        onBodyTextChange={() => {}}
        onChange={() => {}}
        onContinuationTextChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("Keep writing...");
    expect(html).toContain("Ask Sam to review it tomorrow.");
  });

  test("renders an iOS-like capture saved result", () => {
    const html = renderToStaticMarkup(
      <CaptureResultSurface
        actionCount={2}
        items={[
          {
            subtitle: "Updated in the Engine.",
            title: "Journal",
            tone: "orange",
            value: "2026-07-03",
          },
          {
            subtitle: "Manual Check In Submitted",
            title: "Capture",
            tone: "blue",
            value: "Web App",
          },
          {
            subtitle: "Nudge is looking for follow-ups.",
            title: "AI review",
            tone: "purple",
            value: "Queued",
          },
        ]}
        references={["Journal 2026-07-03", "Web App", "AI review queued"]}
        signalCount={4}
        sourceCount={3}
        summary="Saved to 2026-07-03."
        title="Follow up with Sam."
      />,
    );

    expect(html).toContain("Capture saved");
    expect(html).toContain("Follow up with Sam.");
    expect(html).toContain("Saved");
    expect(html).toContain("4");
    expect(html).toContain("Signals");
    expect(html).toContain("2");
    expect(html).toContain("Open actions");
    expect(html).toContain("3");
    expect(html).toContain("References");
    expect(html).toContain("Journal");
    expect(html).toContain("AI review");
    expect(html).toContain("Saved to 2026-07-03.");
    expect(html).toContain("Journal 2026-07-03");
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

  test("renders an iOS-like dark settings surface", () => {
    const html = renderToStaticMarkup(
      <SettingsSurface
        accountName="Alex"
        accountSlot={<p>Account menu</p>}
        deleteDisabled={false}
        engineLabel="https://nudge.example"
        exportDisabled={false}
        sessionLabel="Signed in"
        surfaceLabel="Web"
        workspaceLabel="Alex's workspace"
        onBack={() => {}}
        onDeleteData={() => {}}
        onExportData={() => {}}
      />,
    );

    expect(html).toContain("Settings");
    expect(html).toContain("Alex");
    expect(html).toContain("Alex&#x27;s workspace");
    expect(html).toContain("Account");
    expect(html).toContain("Sync");
    expect(html).toContain("Data");
    expect(html).toContain("Web");
    expect(html).toContain("https://nudge.example");
    expect(html).toContain("Export");
    expect(html).toContain("Delete local data");
    expect(html).toContain("bg-[#090a0b]");
    expect(html).not.toContain("bg-[#eef1f5]");
  });

  test("normalizes unknown stored colors to yellow", () => {
    expect(stickyColorFrom("blue")).toBe("blue");
    expect(stickyColorFrom("legacy-purple")).toBe("yellow");
  });
});
