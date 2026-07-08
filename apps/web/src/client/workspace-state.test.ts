import { describe, expect, test } from "bun:test";
import { createWorkspaceFrontendState, workspaceFrontendStateReducer } from "./workspace-state";

describe("workspace frontend state", () => {
  test("initializes note, agent, context, and notification state from product projections", () => {
    const state = createWorkspaceFrontendState({
      contextItems: [
        {
          domain: "note",
          id: "note:today",
          label: "Today's note",
          selected: true,
        },
        {
          domain: "source",
          id: "source:calendar",
          label: "Calendar",
          selected: false,
        },
      ],
      localDate: "2026-07-06",
      note: {
        bodyText: "First paragraph.",
        id: "note:today",
        revision: "rev-1",
        title: "Today's note",
      },
      notifications: [
        {
          body: "One proposal is waiting.",
          domain: "review",
          id: "review:1",
          title: "Review follow-up",
        },
        {
          body: "Calendar context changed.",
          domain: "source",
          id: "source:calendar",
          title: "Source updated",
        },
      ],
    });

    expect(state.note.activeTabId).toBe("note:today");
    expect(state.note.draftBodyText).toBe("First paragraph.");
    expect(state.note.saveStatus).toBe("Saved");
    expect(state.note.dirty).toBe(false);
    expect(state.agent.contextWindowOpen).toBe(false);
    expect(state.agent.contextItems.filter((item) => item.selected).map((item) => item.id)).toEqual(
      ["note:today"],
    );
    expect(state.notifications.items.map((item) => item.domain)).toEqual(["review", "source"]);
    expect(state.notifications.open).toBe(false);
  });

  test("turns shell, note, agent, and context interactions into explicit state updates", () => {
    let state = createWorkspaceFrontendState({
      contextItems: [
        {
          domain: "note",
          id: "note:today",
          label: "Today's note",
          selected: true,
        },
        {
          domain: "source",
          id: "source:pricing",
          label: "Pricing spreadsheet",
          selected: false,
        },
      ],
      localDate: "2026-07-06",
      note: {
        bodyText: "First paragraph.",
        id: "note:today",
        revision: "rev-1",
        title: "Today's note",
      },
      notifications: [
        {
          body: "One proposal is waiting.",
          domain: "review",
          id: "review:1",
          title: "Review follow-up",
        },
      ],
    });

    state = workspaceFrontendStateReducer(state, {
      type: "sidebarCollapsedChanged",
      collapsed: true,
    });
    state = workspaceFrontendStateReducer(state, { type: "notificationTrayOpened" });
    state = workspaceFrontendStateReducer(state, {
      filter: "review",
      type: "todayFilterSelected",
    });
    state = workspaceFrontendStateReducer(state, {
      title: "July planning",
      type: "noteTitleChanged",
    });
    state = workspaceFrontendStateReducer(state, {
      bodyText: "First paragraph.\n\nSecond paragraph.",
      type: "noteDraftChanged",
    });
    state = workspaceFrontendStateReducer(state, {
      itemId: "source:pricing",
      type: "agentContextItemToggled",
    });
    state = workspaceFrontendStateReducer(state, {
      model: "nudge-5.5-thinking",
      type: "agentModelSelected",
    });
    state = workspaceFrontendStateReducer(state, {
      body: "Turn the second paragraph into a task",
      messageId: "message:user:1",
      type: "agentUserMessageQueued",
    });
    state = workspaceFrontendStateReducer(state, {
      body: "I drafted a review proposal from the second paragraph.",
      commands: [
        {
          id: "command:1",
          kind: "createTaskFromNoteBlock",
          label: "Create task from note block",
          sourceNoteId: "note:today",
          status: "proposed",
        },
      ],
      messageId: "message:assistant:1",
      type: "agentAssistantMessageReceived",
    });
    state = workspaceFrontendStateReducer(state, {
      command: {
        id: "command:open-notifications",
        kind: "openPanel",
        label: "Open notification tray",
        status: "applied",
        target: "notifications",
      },
      type: "agentCommandApplied",
    });

    expect(state.shell.sidebarCollapsed).toBe(true);
    expect(state.notifications.open).toBe(true);
    expect(state.navigation.activeTodayFilter).toBe("review");
    expect(state.note.tabs[0]?.title).toBe("July planning");
    expect(state.note.draftBodyText).toContain("Second paragraph.");
    expect(state.note.dirty).toBe(true);
    expect(state.note.saveStatus).toBe("Unsaved");
    expect(state.agent.selectedModel).toBe("nudge-5.5-thinking");
    expect(state.agent.contextItems.filter((item) => item.selected).map((item) => item.id)).toEqual(
      ["note:today", "source:pricing"],
    );
    expect(state.agent.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(state.agent.pendingCommands.map((command) => command.kind)).toEqual([
      "createTaskFromNoteBlock",
    ]);
  });

  test("shows one transient assistant thinking message while a send is in flight", () => {
    let state = createWorkspaceFrontendState({
      localDate: "2026-07-06",
      note: {
        bodyText: "",
        id: "note:today",
        revision: "rev-1",
        title: "Today's note",
      },
    });

    state = workspaceFrontendStateReducer(state, { type: "agentSendStarted" });
    state = workspaceFrontendStateReducer(state, {
      body: "Can you review this?",
      messageId: "message:user:1",
      type: "agentUserMessageQueued",
    });

    expect(state.agent.sending).toBe(true);
    expect(state.agent.messages).toEqual([
      {
        body: "Can you review this?",
        id: "message:user:1",
        role: "user",
      },
      {
        body: "Thinking...",
        id: "message:assistant:thinking",
        kind: "thinking",
        role: "assistant",
      },
    ]);

    state = workspaceFrontendStateReducer(state, {
      body: "I found one paragraph to review.",
      messageId: "message:assistant:1",
      type: "agentAssistantMessageReceived",
    });

    expect(state.agent.sending).toBe(false);
    expect(state.agent.messages).toEqual([
      {
        body: "Can you review this?",
        id: "message:user:1",
        role: "user",
      },
      {
        body: "I found one paragraph to review.",
        id: "message:assistant:1",
        role: "assistant",
      },
    ]);
  });

  test("records failed agent sends as assistant chat messages", () => {
    let state = createWorkspaceFrontendState({
      localDate: "2026-07-06",
      note: {
        bodyText: "",
        id: "note:today",
        revision: "rev-1",
        title: "Today's note",
      },
    });

    state = workspaceFrontendStateReducer(state, { type: "agentSendStarted" });
    state = workspaceFrontendStateReducer(state, {
      body: "Can you review this?",
      messageId: "message:user:1",
      type: "agentUserMessageQueued",
    });
    state = workspaceFrontendStateReducer(state, {
      message: "Workers AI is unavailable",
      messageId: "message:error:1",
      type: "agentSendFailed",
    });

    expect(state.agent.sending).toBe(false);
    expect(state.agent.statusMessage).toBe("Reply failed");
    expect(state.agent.messages).toEqual([
      {
        body: "Can you review this?",
        id: "message:user:1",
        role: "user",
      },
      {
        body: "Workers AI is unavailable",
        id: "message:error:1",
        kind: "error",
        role: "assistant",
      },
    ]);
  });

  test("refreshes product projections without overwriting an unsaved note draft", () => {
    let state = createWorkspaceFrontendState({
      localDate: "2026-07-06",
      note: {
        bodyText: "Original note.",
        id: "note:today",
        revision: "rev-1",
        title: "Today's note",
      },
    });

    state = workspaceFrontendStateReducer(state, {
      bodyText: "Unsaved local draft.",
      type: "noteDraftChanged",
    });
    state = workspaceFrontendStateReducer(state, {
      input: {
        contextItems: [
          {
            domain: "source",
            id: "source:calendar",
            label: "Calendar",
            selected: true,
          },
        ],
        localDate: "2026-07-06",
        note: {
          bodyText: "Server note changed.",
          id: "note:today",
          revision: "rev-2",
          title: "Updated title",
        },
        notifications: [
          {
            body: "A new proposal is waiting.",
            domain: "review",
            id: "review:2",
            title: "Review proposal",
          },
        ],
      },
      type: "workspaceProjectionRefreshed",
    });

    expect(state.note.draftBodyText).toBe("Unsaved local draft.");
    expect(state.note.tabs[0]?.title).toBe("Updated title");
    expect(state.note.saveStatus).toBe("Conflict");
    expect(state.notifications.items.map((item) => item.id)).toEqual(["review:2"]);
    expect(state.agent.contextItems.map((item) => item.id)).toEqual(["source:calendar"]);
  });

  test("marks note editing as dirty without replacing the committed draft body", () => {
    let state = createWorkspaceFrontendState({
      localDate: "2026-07-06",
      note: {
        bodyText: "Original note.",
        id: "note:today",
        revision: "rev-1",
        title: "Today's note",
      },
    });

    state = workspaceFrontendStateReducer(state, { type: "noteDraftEditingStarted" });

    expect(state.note.draftBodyText).toBe("Original note.");
    expect(state.note.dirty).toBe(true);
    expect(state.note.saveStatus).toBe("Unsaved");

    const repeatedState = workspaceFrontendStateReducer(state, {
      type: "noteDraftEditingStarted",
    });

    expect(repeatedState).toBe(state);
  });

  test("marks title editing as dirty without replacing the committed tab title", () => {
    let state = createWorkspaceFrontendState({
      localDate: "2026-07-06",
      note: {
        bodyText: "Original note.",
        id: "note:today",
        revision: "rev-1",
        title: "Original title",
      },
    });

    state = workspaceFrontendStateReducer(state, { type: "noteTitleEditingStarted" });

    expect(state.note.tabs[0]?.title).toBe("Original title");
    expect(state.note.dirty).toBe(true);
    expect(state.note.saveStatus).toBe("Unsaved");

    const committedState = workspaceFrontendStateReducer(state, {
      title: "Committed title",
      type: "noteTitleChanged",
    });

    expect(committedState.note.tabs[0]?.title).toBe("Committed title");
  });

  test("creates, selects, and closes multiple note tabs without losing drafts", () => {
    let state = createWorkspaceFrontendState({
      localDate: "2026-07-06",
      note: {
        bodyText: "Original body.",
        id: "note:today",
        revision: "rev-1",
        title: "Original note",
      },
    });

    state = workspaceFrontendStateReducer(state, {
      bodyText: "Edited original body.",
      type: "noteDraftChanged",
    });
    state = workspaceFrontendStateReducer(state, {
      tab: {
        bodyText: "",
        dirty: false,
        id: "note:second",
        revision: "local",
        saveStatus: "Saved",
        title: "Second note",
      },
      type: "noteTabAdded",
    });
    state = workspaceFrontendStateReducer(state, {
      bodyText: "Second note body.",
      type: "noteDraftChanged",
    });
    state = workspaceFrontendStateReducer(state, {
      tabId: "note:today",
      type: "noteTabSelected",
    });

    expect(state.note.activeTabId).toBe("note:today");
    expect(state.note.draftBodyText).toBe("Edited original body.");
    expect(state.note.tabs.map((tab) => tab.bodyText)).toEqual([
      "Edited original body.",
      "Second note body.",
    ]);

    state = workspaceFrontendStateReducer(state, {
      tabId: "note:second",
      type: "noteTabClosed",
    });

    expect(state.note.activeTabId).toBe("note:today");
    expect(state.note.tabs.map((tab) => tab.id)).toEqual(["note:today"]);
    expect(state.note.draftBodyText).toBe("Edited original body.");
  });

  test("closes the notes page when the final note tab is closed", () => {
    let state = createWorkspaceFrontendState({
      localDate: "2026-07-06",
      note: {
        bodyText: "Today's note body.",
        id: "note:today",
        revision: "rev-1",
        title: "Today's note",
      },
    });

    state = workspaceFrontendStateReducer(state, {
      tabId: "note:today",
      type: "noteTabClosed",
    });

    expect(state.note.pageOpen).toBe(false);
    expect(state.note.activeTabId).toBe("note:today");
    expect(state.note.tabs.map((tab) => tab.id)).toEqual(["note:today"]);

    state = workspaceFrontendStateReducer(state, {
      tab: {
        bodyText: "",
        dirty: false,
        id: "note:second",
        revision: "local",
        saveStatus: "Saved",
        title: "Second note",
      },
      type: "noteTabAdded",
    });

    expect(state.note.pageOpen).toBe(true);
    expect(state.note.activeTabId).toBe("note:second");
  });
});
