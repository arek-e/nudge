import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarActivitySurface,
  CaptureResultSurface,
  DailyOperatingLoopSurface,
  DailyJournalSurface,
  NoteFirstWorkspaceSurface,
  NoteComposerSurface,
  NudgeSidebarNavigationSurface,
  NudgeWorkspaceShellSurface,
  ReviewActionSurface,
  SettingsSurface,
  StickyNoteSurface,
  stickyColorFrom,
} from "./index";

describe("note surface UI", () => {
  test("renders notes as the primary Nudge workspace", () => {
    const html = renderToStaticMarkup(
      <NoteFirstWorkspaceSurface
        composerSlot={
          <NoteComposerSurface
            bodyText="Ask Sam about launch follow-through"
            color="yellow"
            disabled={false}
            statusMessage="Saved on this device"
            variant="chat"
            onBodyTextChange={() => {}}
            onChange={() => {}}
            onSubmit={() => {}}
          />
        }
        notes={[
          {
            bodyText: "Send Mara the new onboarding sketch before Friday.",
            id: "note-1",
            metaText: "Today",
            title: "Mara onboarding",
          },
        ]}
        reviewSlot={<p>AI review queue</p>}
        signedInAs="Alex"
        statusMessage="Connected"
        utilitySlot={<p>Account menu</p>}
      />,
    );

    expect(html).toContain("Notes");
    expect(html).toContain("Ask Nudge");
    expect(html).toContain('data-testid="workbench-layout" data-layout="page-with-agent-rail"');
    const workbenchLayoutClass = html.match(
      /class="([^"]*)" data-testid="workbench-layout" data-layout="page-with-agent-rail"/,
    )?.[1];
    expect(workbenchLayoutClass).toContain("bg-surface-page");
    expect(workbenchLayoutClass).not.toContain("border-[var(--line-soft)]");
    expect(workbenchLayoutClass).not.toContain("[border-width:var(--border-width-workbench)]");
    expect(workbenchLayoutClass).not.toContain("bg-transparent");
    expect(html).toContain('data-testid="workbench-page"');
    expect(html).toContain('data-testid="agent-rail"');
    expect(html).toContain("border-[var(--line-soft)]");
    expect(html).toContain("[border-width:var(--border-width-workbench)]");
    expect(html).toContain('data-testid="page-header"');
    expect(html).toContain('data-testid="page-titlebar"');
    expect(html).toContain("bg-surface-page");
    expect(html).toContain("border-line-divider");
    expect(html).toContain("[border-bottom-width:var(--border-width-workbench)]");
    expect(html).toContain('aria-label="Close Mara onboarding"');
    expect(html).toContain('aria-label="Add page tab"');
    expect(html).toContain('data-testid="page-add-tab"');
    const pageAddTabClass = html.match(/class="([^"]*)" data-testid="page-add-tab"/)?.[1];
    expect(pageAddTabClass).toContain("border-b");
    expect(pageAddTabClass).toContain("[border-bottom-width:var(--border-width-workbench)]");
    expect(html).toContain("bg-surface-base");
    expect(html).toContain('data-testid="page-document"');
    expect(html).toContain('data-testid="agent-rail-scroll"');
    const agentRailClass = html.match(/class="([^"]*)" data-testid="agent-rail"/)?.[1];
    expect(agentRailClass).toContain("bg-surface-page");
    expect(html).toContain("bg-surface-page min-h-0 overflow-y-auto");
    expect(html).toContain("px-4 py-5");
    expect(html).toContain("text-content-strong");
    const pageSurfaceClasses = Array.from(
      html.matchAll(/class="([^"]*)" data-testid="page-(?:header|document|editor)"/g),
      (match) => match[1],
    );
    expect(pageSurfaceClasses.length).toBeGreaterThan(0);
    for (const className of pageSurfaceClasses) {
      expect(className).not.toContain("shadow-");
    }
    expect(html).toContain('data-slot="sidebar-wrapper"');
    expect(html).toContain('data-slot="sidebar-inset"');
    const shellInsetClass = html.match(/class="([^"]*)" data-testid="sidebar-inset"/)?.[1];
    expect(shellInsetClass).toContain("border-[var(--line-soft)]");
    expect(shellInsetClass).toContain("[border-width:var(--border-width-workbench)]");
    expect(html).toContain("lg:grid-rows-[auto_minmax(0,1fr)]");
    const shellHeaderClass = html.match(
      /<header class="([^"]*)"><div class="flex min-w-0 items-center gap-3"><p class="[^"]*">Notes/,
    )?.[1];
    expect(shellHeaderClass).toContain("bg-surface-base");
    expect(shellHeaderClass).toContain("border-[var(--line-soft)]");
    expect(shellHeaderClass).toContain("[border-bottom-width:var(--border-width-workbench)]");
    expect(shellHeaderClass).not.toContain("shadow-");
    expect(html).toContain("hidden min-h-12 items-center");
    expect(html).toContain('data-sidebar="sidebar"');
    expect(html).toContain('data-testid="agent-chat-messages"');
    expect(html).not.toContain('data-testid="agent-chat-message" data-message-role=');
    expect(html).not.toContain('data-testid="agent-task-card"');
    expect(html).not.toContain('data-testid="agent-timeline"');
    expect(html).not.toContain("Working context");
    expect(html).toContain('data-testid="docked-composer"');
    expect(html).toContain('data-composer-variant="chat"');
    expect(html).toContain("Today");
    expect(html).toContain("Mara onboarding");
    expect(html).toContain('data-testid="page-editor"');
    expect(html).toContain('data-testid="tiptap-editor"');
    expect(html).not.toContain('data-testid="page-paragraph"');
    expect(html).toContain("Send Mara the new onboarding sketch before Friday.");
    expect(html).not.toContain("Daily note");
    expect(html).not.toContain("Each paragraph will be analyzed");
    expect(html).not.toContain("Nudge will analyze each paragraph");
    expect(html).not.toContain("AI review queue");
    expect(html).toContain("Account menu");
    expect(html).toContain("bg-surface-sidebar");
    expect(html).not.toContain('data-testid="shell-leading-slot"');
    expect(html).not.toContain('data-testid="shell-trailing-slot"');
    expect(html).not.toContain("Notes workspace");
    expect(html).not.toContain("Search notes...");
    expect(html).not.toContain("Daily Operating Loop");
    expect(html).not.toContain("Daily activity");
    expect(html).not.toContain("Settings");
  });

  test("renders the target note sidebar without a bottom settings action", () => {
    const html = renderToStaticMarkup(
      <NudgeSidebarNavigationSurface signedInAs="Jane Smith" statusMessage="Synced" />,
    );

    expect(html).toContain("Today");
    expect(html).toContain("Inbox");
    expect(html).toContain("Notes");
    expect(html).toContain("Review");
    expect(html).toContain("Capture");
    expect(html).toContain("Jane Smith");
    expect(html).toContain('data-testid="sidebar-nav-item"');
    expect(html).toContain("mt-9 grid gap-1 px-2");
    expect(html).toContain("bg-surface-inset");
    expect(html).toContain("shadow-[inset_3px_0_0_var(--accent-primary)");
    expect(html).toContain('data-testid="sidebar-footer-divider"');
    expect(html).toContain("bg-line-sidebar h-px w-full");
    expect(html).not.toContain("shadow-[0_12px_28px");
    expect(html).not.toContain("3 follow ups");
    expect(html).not.toContain("2 sources updated");
    expect(html).not.toContain("Settings");
  });

  test("renders prop-driven workspace content instead of static sample copy", () => {
    const html = renderToStaticMarkup(
      <NoteFirstWorkspaceSurface
        askPanel={{
          assistantInitial: "A",
          assistantName: "Abel",
          header: {
            ariaLabel: "Ask Abel panel",
            closeLabel: "Dismiss Abel",
            expandLabel: "Open Abel",
            title: "Ask Abel",
          },
          prompt: "What changed in today's note?",
          responseBullets: ["Pipeline risk moved to finance.", "Draft the customer note next."],
          responseIntro: "Current readout from the workspace.",
          sources: [{ label: "roadmap.md", meta: "Just now", tone: "blue" }],
        }}
        composerSlot={
          <NoteComposerSurface
            bodyText="Add a launch paragraph"
            color="green"
            disabled={false}
            variant="chat"
            onBodyTextChange={() => {}}
            onChange={() => {}}
            onSubmit={() => {}}
          />
        }
        editor={{
          bodyText: "Customer launch notes are ready for review.",
          editorLabel: "Launch note editor",
          editorPlaceholder: "Write the launch note",
        }}
        header={{
          askLabel: "Ask Abel",
          searchPlaceholder: "Search daily notes",
          searchShortcut: "/",
          statusMessage: "Live",
          title: "Daily Notes",
        }}
        notes={[
          {
            bodyText: "List preview copy",
            id: "note-1",
            metaText: "Jul 5",
            title: "Launch review",
          },
        ]}
        notesList={{
          filterLabel: "Jul 5",
          title: "Day notes",
        }}
        reviewRail={{
          followUpTitle: "Next",
          followUps: [{ label: "Send launch update", meta: "Comms", urgentLabel: "Today" }],
          sourcesTitle: "Evidence",
          summary: "Two workspace items changed.",
          summaryTitle: "Readout",
          title: "Nudge Review",
        }}
        signedInAs="Alex"
        statusMessage="Connected"
      />,
    );

    expect(html).toContain("Daily Notes");
    expect(html).toContain('data-testid="workbench-layout" data-layout="page-with-agent-rail"');
    expect(html).toContain('data-testid="workbench-page"');
    expect(html).toContain('data-testid="agent-rail"');
    expect(html).toContain('data-testid="agent-chat-messages"');
    expect(html).toContain('data-testid="agent-chat-message" data-message-role="user"');
    expect(html).toContain('data-testid="agent-chat-message" data-message-role="assistant"');
    expect(html).not.toContain('data-testid="agent-task-card"');
    expect(html).not.toContain('data-testid="agent-timeline"');
    expect(html).not.toContain("Working context");
    expect(html).toContain("Abel");
    expect(html).toContain('data-composer-variant="chat"');
    expect(html).toContain("What changed in today&#x27;s note?");
    expect(html).toContain("Current readout from the workspace.");
    expect(html).toContain("Pipeline risk moved to finance.");
    expect(html).toContain("Draft the customer note next.");
    expect(html).not.toContain("roadmap.md");
    expect(html).toContain("Day notes");
    expect(html).not.toContain("Mara Reed");
    expect(html).not.toContain("One note per day");
    expect(html).not.toContain("MR");
    expect(html).not.toContain("Jul 5");
    expect(html).toContain('data-testid="page-editor"');
    expect(html).toContain('data-testid="tiptap-editor"');
    expect(html).toContain("Customer launch notes are ready for review.");
    expect(html).not.toContain('data-testid="page-paragraph"');
    expect(html).not.toContain("Strong");
    expect(html).not.toContain("Two workspace items changed.");
    expect(html).not.toContain("Send launch update");
    expect(html).not.toContain("Search daily notes");
    expect(html).not.toContain('aria-label="Ask Abel panel"');
    expect(html).not.toContain('aria-label="Open Abel"');
    expect(html).not.toContain('aria-label="Dismiss Abel"');
    expect(html).not.toContain("Standard pricing increases");
    expect(html).not.toContain("What are the key takeaways from today");
  });

  test("renders a prose Ask Nudge answer without forcing bullets", () => {
    const html = renderToStaticMarkup(
      <NoteFirstWorkspaceSurface
        askPanel={{
          prompt: "Can you review the follow ups?",
          responseBullets: [],
          responseIntro: "I found one open follow-up and drafted it for review.",
          sources: [],
        }}
        composerSlot={
          <NoteComposerSurface
            bodyText=""
            color="yellow"
            disabled={false}
            variant="chat"
            onBodyTextChange={() => {}}
            onChange={() => {}}
            onSubmit={() => {}}
          />
        }
        notes={[]}
        signedInAs="Alex"
        statusMessage="Connected"
      />,
    );

    expect(html).toContain("Can you review the follow ups?");
    expect(html).toContain("I found one open follow-up and drafted it for review.");
    expect(html).toContain('data-testid="agent-chat-messages"');
    expect(html).toContain('data-testid="agent-chat-message" data-message-role="user"');
    expect(html).toContain('data-testid="agent-chat-message" data-message-role="assistant"');
    expect(html).not.toContain('data-testid="agent-timeline"');
    expect(html).not.toContain("marker:text-accent-primary");
  });

  test("renders prop-driven sidebar brand, tray, and profile content", () => {
    const html = renderToStaticMarkup(
      <NudgeSidebarNavigationSurface
        appInitial="S"
        appName="Nudge Staging"
        notificationItems={[
          {
            body: "Proposal needs review",
            id: "notification-1",
            title: "Review follow-up",
            tone: "orange",
          },
        ]}
        notificationTrayOpen
        notificationActive={false}
        profile={{ initials: "SR", name: "Sam Rivera", status: "Focus mode" }}
        signedInAs="Jane Smith"
        statusMessage="Synced"
        todayItems={[{ active: true, label: "9 review items", tone: "orange" }]}
        todayLabel="This day"
      />,
    );

    expect(html).toContain("Nudge Staging");
    expect(html).toContain("This day");
    expect(html).toContain("9 review items");
    expect(html).toContain('data-testid="sidebar-today-items"');
    expect(html).toContain('data-testid="notification-tray"');
    expect(html).toContain("Review follow-up");
    expect(html).toContain("Proposal needs review");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("shadow-[inset_0_0_0_1px_var(--overlay-slate-8)]");
    expect(html).toContain("Sam Rivera");
    expect(html).not.toContain("Focus mode");
    expect(html).not.toContain("shadow-[0_14px_34px");
    expect(html).not.toContain("backdrop-blur-xl");
    expect(html).not.toContain("3 follow ups");
    expect(html).not.toContain("2 sources updated");
  });

  test("renders a sidebar long logo without duplicate app text", () => {
    const html = renderToStaticMarkup(
      <NudgeSidebarNavigationSurface
        appName="Nudge"
        logoSrc="/icons/nudge-logo-lockup-blobby-n-transparent.svg"
        showAppName={false}
        signedInAs="Jane Smith"
        statusMessage="Synced"
      />,
    );

    expect(html).toContain("/icons/nudge-logo-lockup-blobby-n-transparent.svg");
    expect(html).toContain('alt="Nudge"');
    expect(html).not.toContain(">Nudge</p>");
  });

  test("renders sidebar profile settings as a Base UI popover trigger", () => {
    const html = renderToStaticMarkup(
      <NudgeSidebarNavigationSurface
        profile={{
          avatarAlt: "Sam Rivera profile photo",
          avatarSrc: "/avatars/sam.png",
          name: "Sam Rivera",
          status: "Sam's workspace",
        }}
        profileActions={[
          {
            description: "Account and workspace preferences",
            label: "Settings",
          },
        ]}
        signedInAs="Sam Rivera"
        statusMessage="Connected"
      />,
    );

    expect(html).toContain('data-testid="user-settings-trigger"');
    expect(html).toContain('aria-label="Open user settings"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("/avatars/sam.png");
    expect(html).toContain("Sam Rivera profile photo");
    expect(html).not.toContain("Sam&#x27;s workspace");
  });

  test("renders a shared workspace shell for route pages", () => {
    const html = renderToStaticMarkup(
      <NudgeWorkspaceShellSurface
        header={{
          askLabel: "Ask Nudge",
          refreshLabel: "Refresh workspace",
          searchPlaceholder: "Search daily notes",
          searchShortcut: "/",
          title: "Review",
        }}
        navigationSlot={
          <NudgeSidebarNavigationSurface
            appName="Nudge"
            logoSrc="/icons/nudge-app-icon-transparent.svg"
            notificationActive={false}
            signedInAs="Alex"
            statusMessage="Connected"
            todayItems={[{ id: "review", label: "2 review items", tone: "orange" }]}
          />
        }
        signedInAs="Alex"
        statusMessage="Connected"
      >
        <section aria-label="Route content">Review queue</section>
      </NudgeWorkspaceShellSurface>,
    );

    expect(html).toContain('aria-label="Nudge workspace shell"');
    expect(html).toContain("/icons/nudge-app-icon-transparent.svg");
    expect(html).toContain('data-slot="sidebar-wrapper"');
    expect(html).toContain('data-slot="sidebar-inset"');
    expect(html).not.toContain("Search daily notes");
    expect(html).toContain("Review queue");
    expect(html).toContain("2 review items");
    expect(html).not.toContain("Connected");
    expect(html).not.toContain("Ask Nudge");
    expect(html).not.toContain('aria-label="Refresh workspace"');
    expect(html).not.toContain("3 follow ups");
    expect(html).not.toContain("2 sources updated");
  });

  test("renders the desktop sidebar with shadcn-style width variables and rail", () => {
    const html = renderToStaticMarkup(
      <NudgeWorkspaceShellSurface signedInAs="Alex" statusMessage="Connected">
        <section>Workspace</section>
      </NudgeWorkspaceShellSurface>,
    );

    expect(html).toContain("--sidebar-current-width:16rem");
    expect(html).toContain("--sidebar-width:16rem");
    expect(html).toContain('data-slot="sidebar-wrapper"');
    expect(html).toContain('data-slot="sidebar-inset"');
    expect(html).toContain('data-sidebar="sidebar"');
    expect(html).toContain('data-variant="inset"');
    expect(html).toContain("rounded-xl");
    expect(html).toContain('data-testid="sidebar-rail"');
    expect(html).toContain('aria-label="Toggle sidebar"');
  });

  test("renders the desktop sidebar as a hidden panel with a left edge reveal target", () => {
    const html = renderToStaticMarkup(
      <NudgeWorkspaceShellSurface sidebarCollapsed signedInAs="Alex" statusMessage="Connected">
        <section>Workspace</section>
      </NudgeWorkspaceShellSurface>,
    );

    expect(html).toContain("--sidebar-current-width:0rem");
    expect(html).toContain("--sidebar-panel-width:16rem");
    expect(html).toContain('data-sidebar-collapsed="true"');
    expect(html).toContain('data-testid="sidebar-edge-reveal"');
    expect(html).toContain('data-sidebar-inset-state="collapsed"');
    expect(html).toContain('class="m-2 flex min-w-0 flex-1');
    expect(html).not.toContain('class="m-2 ml-0 flex min-w-0 flex-1');
    expect(html).toContain('aria-label="Toggle sidebar"');
  });

  test("renders reusable workspace shell slots around route content", () => {
    const html = renderToStaticMarkup(
      <NudgeWorkspaceShellSurface
        leadingSlot={<section aria-label="Reusable assistant">Assistant slot</section>}
        trailingSlot={<aside aria-label="Reusable context rail">Context rail</aside>}
        signedInAs="Alex"
        statusMessage="Connected"
      >
        <section aria-label="Route main content">Route content</section>
      </NudgeWorkspaceShellSurface>,
    );

    expect(html).toContain('data-testid="shell-layout" data-layout="slotted"');
    expect(html).toContain('data-testid="shell-leading-slot"');
    expect(html).toContain('data-testid="shell-main-slot"');
    expect(html).toContain('data-testid="shell-trailing-slot"');
    expect(html).toContain("Assistant slot");
    expect(html).toContain("Route content");
    expect(html).toContain("Context rail");
  });

  test("renders note workspace state controls and agent command receipts", () => {
    const html = renderToStaticMarkup(
      <NoteFirstWorkspaceSurface
        askPanel={{
          messages: [
            {
              body: "Turn the launch paragraph into a task.",
              id: "message-1",
              label: "Alex",
              role: "user",
            },
            {
              body: "I drafted a review proposal.",
              commands: [
                {
                  id: "command-1",
                  label: "Create task from note block",
                  status: "proposed",
                },
              ],
              id: "message-2",
              label: "Nudge",
              role: "assistant",
            },
            {
              body: "Thinking...",
              id: "message-3",
              kind: "thinking",
              role: "assistant",
            },
          ],
        }}
        composerSlot={
          <NoteComposerSurface
            bodyText=""
            color="yellow"
            disabled={false}
            variant="chat"
            onBodyTextChange={() => {}}
            onChange={() => {}}
            onSubmit={() => {}}
          />
        }
        editor={{
          bodyText: "Launch paragraph.",
          editorLabel: "Launch editor",
          saveStatus: "Unsaved",
          title: "Launch note",
          titleEditable: true,
          onAddTab: () => {},
          onClose: () => {},
          onTitleChange: () => {},
        }}
        notes={[]}
        signedInAs="Alex"
        statusMessage="Connected"
      />,
    );

    expect(html).toContain('data-testid="page-title-input"');
    expect(html).toContain('value="Launch note"');
    expect(html).toContain("Unsaved");
    expect(html).toContain("Turn the launch paragraph into a task.");
    expect(html).toContain("I drafted a review proposal.");
    expect(html).toContain('data-testid="agent-command-receipt"');
    expect(html).toContain("Create task from note block");
    expect(html).toContain("proposed");
    expect(html).toContain('data-testid="agent-thinking-indicator"');
    expect(html).toContain("Thinking");
  });

  test("renders multiple note tabs with select and close controls", () => {
    const html = renderToStaticMarkup(
      <NoteFirstWorkspaceSurface
        composerSlot={
          <NoteComposerSurface
            bodyText=""
            color="yellow"
            disabled={false}
            variant="chat"
            onBodyTextChange={() => {}}
            onChange={() => {}}
            onSubmit={() => {}}
          />
        }
        editor={{
          bodyText: "Second note body.",
          editorLabel: "Second note editor",
          saveStatus: "Unsaved",
          tabs: [
            {
              id: "note:today",
              title: "Today",
              onClose: () => {},
              onSelect: () => {},
            },
            {
              active: true,
              id: "note:second",
              saveStatus: "Unsaved",
              title: "Second note",
              titleEditable: true,
              onClose: () => {},
              onSelect: () => {},
              onTitleChange: () => {},
            },
          ],
          title: "Second note",
          titleEditable: true,
          onAddTab: () => {},
          onClose: () => {},
          onTitleChange: () => {},
        }}
        notes={[]}
        signedInAs="Alex"
        statusMessage="Connected"
      />,
    );

    expect(html).toContain('data-testid="page-tab-strip"');
    expect(html.match(/data-testid="page-tab"/g)?.length).toBe(2);
    expect(html).toContain('data-active="true"');
    expect(html).toContain('aria-label="Open Today"');
    expect(html).toContain('aria-label="Close Today"');
    expect(html).toContain('aria-label="Open Second note"');
    expect(html).toContain('aria-label="Close Second note"');
    expect(html).toContain('data-testid="page-title-input"');
    expect(html).toContain('value="Second note"');
  });

  test("renders only the agent chat when the notes page is closed", () => {
    const html = renderToStaticMarkup(
      <NoteFirstWorkspaceSurface
        composerSlot={
          <NoteComposerSurface
            bodyText=""
            color="yellow"
            disabled={false}
            variant="chat"
            onBodyTextChange={() => {}}
            onChange={() => {}}
            onSubmit={() => {}}
          />
        }
        editor={{
          bodyText: "Today's note body.",
          pageOpen: false,
          title: "Today's note",
        }}
        notes={[]}
        signedInAs="Alex"
        statusMessage="Connected"
      />,
    );

    expect(html).toContain('data-testid="workbench-layout"');
    expect(html).toContain('data-layout="agent-only"');
    expect(html).toContain('data-testid="agent-rail"');
    expect(html).toContain('data-testid="agent-chat-messages"');
    expect(html).toContain("mx-auto flex min-h-full w-full max-w-[48rem]");
    expect(html).toContain("mx-auto w-full max-w-[48rem]");
    expect(html).not.toContain('data-testid="workbench-page"');
    expect(html).not.toContain('data-testid="page-tab-strip"');
    expect(html).not.toContain('data-testid="page-add-tab"');
    expect(html).not.toContain('data-testid="page-editor"');
  });

  test("renders a console Daily Operating Loop shell with sidebar navigation", () => {
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
    expect(html).toContain("Inbox");
    expect(html).toContain("Notes");
    expect(html).toContain("Capture");
    expect(html).toContain("bg-surface-inverse-canvas");
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
    expect(html).not.toContain("Settings");
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
    expect(html).toContain("Daily activity");
    expect(html).toContain("Activity mix");
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

  test("renders the shared note composer as a docked chat composer", () => {
    const html = renderToStaticMarkup(
      <NoteComposerSurface
        bodyText="Ask what changed"
        color="rose"
        disabled={false}
        variant="chat"
        onBodyTextChange={() => {}}
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('data-composer-variant="chat"');
    expect(html).toContain('data-testid="chat-composer-shell"');
    expect(html).toContain("rounded-[1.5rem]");
    expect(html).toContain("min-h-16");
    expect(html).toContain("Ask for follow-up changes");
    expect(html).toContain('aria-label="Add context"');
    expect(html).not.toContain('aria-label="Review agent guardrails"');
    expect(html).toContain('aria-label="Context window"');
    expect(html).toContain('aria-label="Select AI model"');
    expect(html).toContain('aria-label="Voice input"');
    expect(html).toContain('aria-label="Send message"');
    expect(html).toContain("5.5");
    expect(html).toContain("Ask what changed");
    expect(html).not.toContain('aria-label="Note color"');
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

  test("renders a console settings surface", () => {
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
    expect(html).toContain("bg-surface-inverse-canvas");
    expect(html).not.toContain("bg-surface-capture-canvas");
  });

  test("normalizes unknown stored colors to yellow", () => {
    expect(stickyColorFrom("blue")).toBe("blue");
    expect(stickyColorFrom("legacy-purple")).toBe("yellow");
  });
});
