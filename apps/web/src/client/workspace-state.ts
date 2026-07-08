export type WorkspaceNotificationDomain = "review" | "source" | "system";

export interface WorkspaceNotificationItem {
  readonly body: string;
  readonly domain: WorkspaceNotificationDomain;
  readonly id: string;
  readonly title: string;
}

export type WorkspaceContextDomain = "memory" | "note" | "source" | "task";

export interface WorkspaceContextItem {
  readonly domain: WorkspaceContextDomain;
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
}

export interface WorkspaceNoteProjection {
  readonly bodyText: string;
  readonly id: string;
  readonly revision: string;
  readonly title: string;
}

export interface WorkspaceNoteTabState {
  readonly bodyText: string;
  readonly dirty: boolean;
  readonly id: string;
  readonly revision: string;
  readonly saveStatus: WorkspaceNoteSaveStatus;
  readonly title: string;
}

export type WorkspaceNoteSaveStatus = "Conflict" | "Saved" | "Saving" | "Unsaved";

export interface WorkspaceNoteState {
  readonly activeTabId: string;
  readonly dirty: boolean;
  readonly draftBodyText: string;
  readonly pageOpen: boolean;
  readonly saveStatus: WorkspaceNoteSaveStatus;
  readonly tabs: ReadonlyArray<WorkspaceNoteTabState>;
}

export type WorkspaceTodayFilter = "all" | "review" | "sources";

export interface WorkspaceNavigationState {
  readonly activeTodayFilter: WorkspaceTodayFilter;
}

export interface WorkspaceShellState {
  readonly sidebarCollapsed: boolean;
}

export interface WorkspaceNotificationState {
  readonly items: ReadonlyArray<WorkspaceNotificationItem>;
  readonly open: boolean;
  readonly selectedId: string | null;
}

export type WorkspaceAgentMessageRole = "assistant" | "user";

export type WorkspaceAgentCommandKind =
  | "appendNoteBlock"
  | "createReviewProposal"
  | "createTaskFromNoteBlock"
  | "focusNoteBlock"
  | "openPanel"
  | "renameNote"
  | "summarizeNote"
  | "updateNoteBlock";

export type WorkspaceAgentCommandStatus = "applied" | "failed" | "pending" | "proposed";

export interface WorkspaceAgentCommand {
  readonly id: string;
  readonly kind: WorkspaceAgentCommandKind;
  readonly label: string;
  readonly status: WorkspaceAgentCommandStatus;
  readonly sourceNoteId?: string;
  readonly target?: "agent" | "context" | "editor" | "notifications" | "review";
}

export interface WorkspaceAgentMessage {
  readonly body: string;
  readonly id: string;
  readonly role: WorkspaceAgentMessageRole;
  readonly kind?: "error" | "thinking";
  readonly commands?: ReadonlyArray<WorkspaceAgentCommand>;
}

export type WorkspaceAgentVoiceState = "idle" | "listening" | "unavailable";

export interface WorkspaceAgentState {
  readonly contextItems: ReadonlyArray<WorkspaceContextItem>;
  readonly contextWindowOpen: boolean;
  readonly messages: ReadonlyArray<WorkspaceAgentMessage>;
  readonly modelPickerOpen: boolean;
  readonly pendingCommands: ReadonlyArray<WorkspaceAgentCommand>;
  readonly sending: boolean;
  readonly selectedModel: string;
  readonly statusMessage: string;
  readonly voiceState: WorkspaceAgentVoiceState;
}

export interface WorkspaceFrontendState {
  readonly agent: WorkspaceAgentState;
  readonly localDate: string;
  readonly navigation: WorkspaceNavigationState;
  readonly note: WorkspaceNoteState;
  readonly notifications: WorkspaceNotificationState;
  readonly shell: WorkspaceShellState;
}

export interface CreateWorkspaceFrontendStateInput {
  readonly contextItems?: ReadonlyArray<WorkspaceContextItem>;
  readonly localDate: string;
  readonly note: WorkspaceNoteProjection;
  readonly notifications?: ReadonlyArray<WorkspaceNotificationItem>;
  readonly selectedModel?: string;
}

export type WorkspaceFrontendStateEvent =
  | {
      readonly type: "agentAssistantMessageReceived";
      readonly body: string;
      readonly messageId: string;
      readonly commands?: ReadonlyArray<WorkspaceAgentCommand>;
    }
  | { readonly type: "agentCommandApplied"; readonly command: WorkspaceAgentCommand }
  | { readonly type: "agentContextItemToggled"; readonly itemId: string }
  | { readonly type: "agentContextWindowClosed" }
  | { readonly type: "agentContextWindowOpened" }
  | { readonly type: "agentModelPickerClosed" }
  | { readonly type: "agentModelPickerOpened" }
  | { readonly type: "agentModelSelected"; readonly model: string }
  | { readonly type: "agentSendFailed"; readonly message: string; readonly messageId: string }
  | { readonly type: "agentSendStarted" }
  | { readonly type: "agentUserMessageQueued"; readonly body: string; readonly messageId: string }
  | { readonly type: "agentVoiceStateChanged"; readonly state: WorkspaceAgentVoiceState }
  | { readonly type: "notificationSelected"; readonly notificationId: string }
  | { readonly type: "notificationTrayClosed" }
  | { readonly type: "notificationTrayOpened" }
  | { readonly type: "noteDraftChanged"; readonly bodyText: string }
  | { readonly type: "noteDraftEditingStarted" }
  | { readonly type: "noteSaved"; readonly revision: string }
  | { readonly type: "noteSaving" }
  | { readonly type: "noteTabAdded"; readonly tab: WorkspaceNoteTabState }
  | { readonly type: "noteTabClosed"; readonly tabId: string }
  | { readonly type: "noteTabSelected"; readonly tabId: string }
  | { readonly type: "noteTitleChanged"; readonly title: string }
  | { readonly type: "noteTitleEditingStarted" }
  | { readonly type: "sidebarCollapsedChanged"; readonly collapsed: boolean }
  | { readonly type: "todayFilterSelected"; readonly filter: WorkspaceTodayFilter }
  | {
      readonly type: "workspaceProjectionRefreshed";
      readonly input: CreateWorkspaceFrontendStateInput;
    };

export function createWorkspaceFrontendState(
  input: CreateWorkspaceFrontendStateInput,
): WorkspaceFrontendState {
  const noteTab = noteTabFromProjection(input.note);
  return {
    agent: {
      contextItems: input.contextItems ?? [],
      contextWindowOpen: false,
      messages: [],
      modelPickerOpen: false,
      pendingCommands: [],
      sending: false,
      selectedModel: input.selectedModel ?? "nudge-5.5",
      statusMessage: "",
      voiceState: "idle",
    },
    localDate: input.localDate,
    navigation: {
      activeTodayFilter: "all",
    },
    note: {
      activeTabId: noteTab.id,
      dirty: false,
      draftBodyText: noteTab.bodyText,
      pageOpen: true,
      saveStatus: "Saved",
      tabs: [noteTab],
    },
    notifications: {
      items: input.notifications ?? [],
      open: false,
      selectedId: null,
    },
    shell: {
      sidebarCollapsed: false,
    },
  };
}

export function workspaceFrontendStateReducer(
  state: WorkspaceFrontendState,
  event: WorkspaceFrontendStateEvent,
): WorkspaceFrontendState {
  switch (event.type) {
    case "agentAssistantMessageReceived":
      return receiveAssistantMessage(state, event);
    case "agentCommandApplied":
      return applyAgentCommand(state, event.command);
    case "agentContextItemToggled":
      return {
        ...state,
        agent: {
          ...state.agent,
          contextItems: state.agent.contextItems.map((item) =>
            item.id === event.itemId ? { ...item, selected: !item.selected } : item,
          ),
          contextWindowOpen: true,
        },
      };
    case "agentContextWindowClosed":
      return {
        ...state,
        agent: { ...state.agent, contextWindowOpen: false },
      };
    case "agentContextWindowOpened":
      return {
        ...state,
        agent: { ...state.agent, contextWindowOpen: true },
      };
    case "agentModelPickerClosed":
      return {
        ...state,
        agent: { ...state.agent, modelPickerOpen: false },
      };
    case "agentModelPickerOpened":
      return {
        ...state,
        agent: { ...state.agent, modelPickerOpen: true },
      };
    case "agentModelSelected":
      return {
        ...state,
        agent: {
          ...state.agent,
          modelPickerOpen: false,
          selectedModel: event.model,
          statusMessage: `Using ${event.model}`,
        },
      };
    case "agentSendFailed":
      return receiveAgentSendFailure(state, event);
    case "agentSendStarted":
      return {
        ...state,
        agent: {
          ...state.agent,
          sending: true,
          statusMessage: "Nudge is thinking...",
        },
      };
    case "agentUserMessageQueued":
      return queueUserMessage(state, event);
    case "agentVoiceStateChanged":
      return {
        ...state,
        agent: {
          ...state.agent,
          statusMessage: agentVoiceStatusMessage(event.state),
          voiceState: event.state,
        },
      };
    case "notificationSelected":
      return {
        ...state,
        notifications: { ...state.notifications, open: true, selectedId: event.notificationId },
      };
    case "notificationTrayClosed":
      return {
        ...state,
        notifications: { ...state.notifications, open: false },
      };
    case "notificationTrayOpened":
      return {
        ...state,
        notifications: { ...state.notifications, open: true },
      };
    case "noteDraftChanged":
      return {
        ...state,
        note: updateActiveNoteTab(state.note, (tab) => ({
          ...tab,
          bodyText: event.bodyText,
          dirty: true,
          saveStatus: "Unsaved",
        })),
      };
    case "noteDraftEditingStarted":
      return markNoteEditingStarted(state);
    case "noteSaved":
      return markActiveNoteSaved(state, event.revision);
    case "noteSaving":
      return {
        ...state,
        note: updateActiveNoteTab(state.note, (tab) => ({
          ...tab,
          saveStatus: "Saving",
        })),
      };
    case "noteTabAdded":
      return addNoteTab(state, event.tab);
    case "noteTabClosed":
      return closeNoteTab(state, event.tabId);
    case "noteTabSelected":
      return selectNoteTab(state, event.tabId);
    case "noteTitleChanged":
      return renameActiveNote(state, event.title);
    case "noteTitleEditingStarted":
      return markNoteEditingStarted(state);
    case "sidebarCollapsedChanged":
      return {
        ...state,
        shell: { ...state.shell, sidebarCollapsed: event.collapsed },
      };
    case "todayFilterSelected":
      return {
        ...state,
        navigation: { ...state.navigation, activeTodayFilter: event.filter },
      };
    case "workspaceProjectionRefreshed":
      return refreshWorkspaceProjection(state, event.input);
  }
}

const agentThinkingMessageId = "message:assistant:thinking";

function receiveAgentSendFailure(
  state: WorkspaceFrontendState,
  event: Extract<WorkspaceFrontendStateEvent, { readonly type: "agentSendFailed" }>,
): WorkspaceFrontendState {
  return {
    ...state,
    agent: {
      ...state.agent,
      messages: [
        ...withoutAgentThinkingMessage(state.agent.messages),
        {
          body: event.message,
          id: event.messageId,
          kind: "error",
          role: "assistant",
        },
      ],
      sending: false,
      statusMessage: "Reply failed",
    },
  };
}

function noteTabFromProjection(note: WorkspaceNoteProjection): WorkspaceNoteTabState {
  return {
    bodyText: note.bodyText,
    dirty: false,
    id: note.id,
    revision: note.revision,
    saveStatus: "Saved",
    title: note.title,
  };
}

function queueUserMessage(
  state: WorkspaceFrontendState,
  event: Extract<WorkspaceFrontendStateEvent, { readonly type: "agentUserMessageQueued" }>,
): WorkspaceFrontendState {
  const text = event.body.trim();
  if (text.length === 0) return state;
  const userMessage: WorkspaceAgentMessage = {
    body: text,
    id: event.messageId,
    role: "user",
  };
  const messages: ReadonlyArray<WorkspaceAgentMessage> = [
    ...withoutAgentThinkingMessage(state.agent.messages),
    userMessage,
  ];
  return {
    ...state,
    agent: {
      ...state.agent,
      messages: state.agent.sending ? appendAgentThinkingMessage(messages) : messages,
      statusMessage: state.agent.sending ? "Nudge is thinking..." : state.agent.statusMessage,
    },
  };
}

function receiveAssistantMessage(
  state: WorkspaceFrontendState,
  event: Extract<WorkspaceFrontendStateEvent, { readonly type: "agentAssistantMessageReceived" }>,
): WorkspaceFrontendState {
  const commands = event.commands ?? [];
  return {
    ...state,
    agent: {
      ...state.agent,
      messages: [
        ...withoutAgentThinkingMessage(state.agent.messages),
        {
          body: event.body,
          ...(commands.length > 0 ? { commands } : {}),
          id: event.messageId,
          role: "assistant",
        },
      ],
      pendingCommands: [
        ...state.agent.pendingCommands,
        ...commands.filter(
          (command) => command.status === "pending" || command.status === "proposed",
        ),
      ],
      sending: false,
      statusMessage: "Reply ready",
    },
  };
}

function appendAgentThinkingMessage(
  messages: ReadonlyArray<WorkspaceAgentMessage>,
): ReadonlyArray<WorkspaceAgentMessage> {
  return [
    ...messages,
    {
      body: "Thinking...",
      id: agentThinkingMessageId,
      kind: "thinking",
      role: "assistant",
    },
  ];
}

function withoutAgentThinkingMessage(
  messages: ReadonlyArray<WorkspaceAgentMessage>,
): ReadonlyArray<WorkspaceAgentMessage> {
  return messages.filter((message) => message.kind !== "thinking");
}

function applyAgentCommand(
  state: WorkspaceFrontendState,
  command: WorkspaceAgentCommand,
): WorkspaceFrontendState {
  const agent = {
    ...state.agent,
    pendingCommands: state.agent.pendingCommands.filter((item) => item.id !== command.id),
  };
  if (command.kind !== "openPanel") {
    return { ...state, agent };
  }
  if (command.target === "notifications") {
    return {
      ...state,
      agent,
      notifications: { ...state.notifications, open: true },
    };
  }
  if (command.target === "context") {
    return {
      ...state,
      agent: { ...agent, contextWindowOpen: true },
    };
  }
  return { ...state, agent };
}

function markActiveNoteSaved(
  state: WorkspaceFrontendState,
  revision: string,
): WorkspaceFrontendState {
  return {
    ...state,
    note: updateActiveNoteTab(state.note, (tab) => ({
      ...tab,
      bodyText: state.note.draftBodyText,
      dirty: false,
      revision,
      saveStatus: "Saved",
    })),
  };
}

function renameActiveNote(state: WorkspaceFrontendState, title: string): WorkspaceFrontendState {
  return {
    ...state,
    note: updateActiveNoteTab(state.note, (tab) => ({
      ...tab,
      dirty: true,
      saveStatus: "Unsaved",
      title,
    })),
  };
}

function markNoteEditingStarted(state: WorkspaceFrontendState): WorkspaceFrontendState {
  if (state.note.dirty && state.note.saveStatus === "Unsaved") return state;

  return {
    ...state,
    note: updateActiveNoteTab(state.note, (tab) => ({
      ...tab,
      dirty: true,
      saveStatus: "Unsaved",
    })),
  };
}

function addNoteTab(
  state: WorkspaceFrontendState,
  tab: WorkspaceNoteTabState,
): WorkspaceFrontendState {
  const syncedNote = syncActiveNoteTab(state.note);
  return {
    ...state,
    note: {
      ...syncedNote,
      activeTabId: tab.id,
      dirty: tab.dirty,
      draftBodyText: tab.bodyText,
      pageOpen: true,
      saveStatus: tab.saveStatus,
      tabs: [...syncedNote.tabs, tab],
    },
  };
}

function selectNoteTab(state: WorkspaceFrontendState, tabId: string): WorkspaceFrontendState {
  if (state.note.activeTabId === tabId) return state;

  const syncedNote = syncActiveNoteTab(state.note);
  const activeTab = syncedNote.tabs.find((tab) => tab.id === tabId);
  if (!activeTab) return state;

  return {
    ...state,
    note: activeNoteStateFromTab({ ...syncedNote, pageOpen: true }, activeTab),
  };
}

function closeNoteTab(state: WorkspaceFrontendState, tabId: string): WorkspaceFrontendState {
  const syncedNote = syncActiveNoteTab(state.note);
  if (syncedNote.tabs.length <= 1) {
    const onlyTab = syncedNote.tabs[0];
    if (!onlyTab || onlyTab.id !== tabId) return state;

    return {
      ...state,
      note: {
        ...syncedNote,
        pageOpen: false,
      },
    };
  }

  const closingIndex = syncedNote.tabs.findIndex((tab) => tab.id === tabId);
  if (closingIndex === -1) return state;

  const tabs = syncedNote.tabs.filter((tab) => tab.id !== tabId);
  const activeTab =
    tabId === syncedNote.activeTabId
      ? tabs[Math.min(closingIndex, tabs.length - 1)]
      : tabs.find((tab) => tab.id === syncedNote.activeTabId);
  if (!activeTab) return state;

  return {
    ...state,
    note: activeNoteStateFromTab({ ...syncedNote, tabs }, activeTab),
  };
}

function syncActiveNoteTab(note: WorkspaceNoteState): WorkspaceNoteState {
  return {
    ...note,
    tabs: note.tabs.map((tab) =>
      tab.id === note.activeTabId
        ? {
            ...tab,
            bodyText: note.draftBodyText,
            dirty: note.dirty,
            saveStatus: note.saveStatus,
          }
        : tab,
    ),
  };
}

function updateActiveNoteTab(
  note: WorkspaceNoteState,
  update: (tab: WorkspaceNoteTabState) => WorkspaceNoteTabState,
): WorkspaceNoteState {
  const currentTab = note.tabs.find((tab) => tab.id === note.activeTabId);
  if (!currentTab) return note;

  const activeTab = update(currentTab);
  return activeNoteStateFromTab(
    {
      ...note,
      tabs: note.tabs.map((tab) => (tab.id === activeTab.id ? activeTab : tab)),
    },
    activeTab,
  );
}

function activeNoteStateFromTab(
  note: WorkspaceNoteState,
  activeTab: WorkspaceNoteTabState,
): WorkspaceNoteState {
  return {
    ...note,
    activeTabId: activeTab.id,
    dirty: activeTab.dirty,
    draftBodyText: activeTab.bodyText,
    saveStatus: activeTab.saveStatus,
  };
}

function agentVoiceStatusMessage(state: WorkspaceAgentVoiceState) {
  switch (state) {
    case "idle":
      return "";
    case "listening":
      return "Listening...";
    case "unavailable":
      return "Voice capture is not connected yet.";
  }
}

function refreshWorkspaceProjection(
  state: WorkspaceFrontendState,
  input: CreateWorkspaceFrontendStateInput,
): WorkspaceFrontendState {
  const nextTab = noteTabFromProjection(input.note);
  const syncedNote = syncActiveNoteTab(state.note);
  const refreshedTabs = syncedNote.tabs.some((tab) => tab.id === nextTab.id)
    ? syncedNote.tabs.map((tab) =>
        tab.id === nextTab.id ? refreshNoteTabFromProjection(tab, nextTab) : tab,
      )
    : [nextTab, ...syncedNote.tabs];
  const activeTab =
    refreshedTabs.find((tab) => tab.id === syncedNote.activeTabId) ?? refreshedTabs[0] ?? nextTab;
  return {
    ...state,
    agent: {
      ...state.agent,
      contextItems: input.contextItems ?? state.agent.contextItems,
      selectedModel: input.selectedModel ?? state.agent.selectedModel,
    },
    localDate: input.localDate,
    note: activeNoteStateFromTab({ ...syncedNote, tabs: refreshedTabs }, activeTab),
    notifications: {
      ...state.notifications,
      items: input.notifications ?? [],
    },
  };
}

function refreshNoteTabFromProjection(
  tab: WorkspaceNoteTabState,
  nextTab: WorkspaceNoteTabState,
): WorkspaceNoteTabState {
  return {
    ...tab,
    bodyText: tab.dirty ? tab.bodyText : nextTab.bodyText,
    dirty: tab.dirty,
    revision: nextTab.revision,
    saveStatus: refreshedNoteTabSaveStatus(tab),
    title: nextTab.title,
  };
}

function refreshedNoteTabSaveStatus(tab: WorkspaceNoteTabState): WorkspaceNoteSaveStatus {
  return tab.dirty ? "Conflict" : "Saved";
}
