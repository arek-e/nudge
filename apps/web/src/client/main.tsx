import type { FunctionReturnType } from "convex/server";
import { ClerkProvider, SignIn, UserButton, useAuth, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ConvexReactClient, useConvex, useConvexAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
  createContext,
  type ReactNode,
  StrictMode,
  useEffect,
  useState,
  useTransition,
} from "react";
import { createRoot } from "react-dom/client";
import {
  AddActionSheet,
  BottomNav,
  buildSignalCalendarData,
  deriveJourneyDayGroups,
  HomeDashboard,
  JourneyTimeline,
  plainTextToRichTextDocument,
  type RichTextDocument,
  Surface,
  VestaAppShell,
  VestaChat,
  type VestaChatAttachment,
  type VestaChatMessage,
  WritingDrawer,
} from "@vesta/ui";
import { api } from "../../../../convex/_generated/api";
import { apiClient, setSessionTokenResolver, streamConversationMessage } from "./api-client";
import { dailyNoteDrawerText } from "./daily-note-drawer";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const queryClient = new QueryClient();
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud";
const convexClient = new ConvexReactClient(convexUrl);
const clerkPublishableKey = requiredClerkPublishableKey();
const logoLongSrc =
  import.meta.env.VITE_VESTA_LOGO_LONG_SRC ??
  "/icons/nudge-logo-lockup-blobby-n-transparent.svg";

type ConvexDailyNoteState = FunctionReturnType<typeof api.documents.getDailyNote>;

interface CaptureContextValue {
  readonly status: string;
  readonly saving: boolean;
  readonly openCapture: () => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

const todayLocalDate = () => new Date().toISOString().slice(0, 10);

const simplePayloadHash = (value: string) => `${value.length}:${value}`;

const noteTextFromPayload = (payload: unknown) => {
  if (payload && typeof payload === "object" && "note" in payload) {
    return String(payload.note);
  }
  if (payload && typeof payload === "object" && "changedText" in payload) {
    return String(payload.changedText);
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload);
};

function requiredClerkPublishableKey() {
  const value = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? import.meta.env.CLERK_PUBLISHABLE_KEY;
  if (typeof value === "string" && value.startsWith("pk_")) return value;
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Vesta");
}

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TodayScreen,
});
const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/journey",
  component: JourneyScreen,
});
const actionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/actions",
  component: ActionsScreen,
});
const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insights",
  component: InsightsScreen,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsScreen,
});
const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatScreen,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    eventsRoute,
    actionsRoute,
    insightsRoute,
    settingsRoute,
    chatRoute,
  ]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AppShell() {
  const auth = useAuth();
  if (!auth.isLoaded) {
    return <main className="min-h-dvh bg-[#111]" aria-label="Loading Vesta" />;
  }
  if (!auth.isSignedIn) return <ClerkSignInScreen />;
  return <AuthenticatedAppShell />;
}

function ClerkSignInScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#111] px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <SignIn routing="hash" />
    </main>
  );
}

function AuthenticatedAppShell() {
  const convex = useConvex();
  const convexAuth = useConvexAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const session = useSession();
  const [note, setNote] = useState("");
  const [noteDocument, setNoteDocument] = useState<RichTextDocument>(
    plainTextToRichTextDocument(""),
  );
  const [noteDirty, setNoteDirty] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const localDate = todayLocalDate();
  const dailyNoteState = useConvexDailyNote(localDate);
  const dailyNoteDocument = dailyNoteState?.document;

  useEffect(() => {
    const nextNote = dailyNoteDrawerText({
      currentText: note,
      dirty: noteDirty,
      remoteBodyText: dailyNoteDocument?.bodyText,
    });
    if (nextNote === note) return;
    setNote(nextNote);
    setNoteDocument(plainTextToRichTextDocument(nextNote));
  }, [dailyNoteDocument?.bodyText, note, noteDirty]);

  const saveDailyNote = useMutation({
    mutationFn: async (value: string) => {
      if (!convexAuth.isAuthenticated) {
        throw new Error("Sign in with Clerk to sync daily notes.");
      }
      const result = await convex.mutation(api.documents.patchDailyNote, {
        bodyDocument: noteDocument,
        bodyText: value,
        idempotencyKey: crypto.randomUUID(),
        localDate,
        payloadHash: simplePayloadHash(value),
        title: localDate,
        ...(dailyNoteDocument?.serverRevision
          ? { baseServerRevision: dailyNoteDocument.serverRevision }
          : {}),
      });
      if (!result.ok) {
        throw new Error(result.error?.code ?? "Convex note save failed");
      }
    },
    onSuccess: () => {
      setNoteDirty(false);
      setCaptureOpen(false);
      setStatus("Saved to Convex");
    },
    onError: (error) => {
      setStatus(error instanceof Error ? error.message : "Could not save to Convex.");
    },
  });

  if (!session.data) {
    return <main className="min-h-dvh bg-[#111]" aria-label="Loading Vesta" />;
  }

  return (
    <CaptureContext.Provider
      value={{
        status,
        saving: saveDailyNote.isPending || isPending,
        openCapture: () => setCaptureOpen(true),
      }}
    >
      <Outlet />
      <AddActionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCaptureNote={() => {
          setAddOpen(false);
          setCaptureOpen(true);
        }}
        onOpenChat={() => {
          setAddOpen(false);
          void navigate({ to: "/chat" });
        }}
      />
      <WritingDrawer
        eyebrow="Today"
        drawerTitle="Daily note"
        description=""
        bodyLabel="Daily journal"
        submitLabel="Save journal"
        open={captureOpen}
        body={note}
        bodyDocument={noteDocument}
        onBodyChange={(value) => {
          setNote(value);
          setNoteDirty(true);
        }}
        onBodyDocumentChange={setNoteDocument}
        onAiDraft={() => {
          const draft = "Today I need to clarify priorities, constraints, and the next follow-up.";
          setNote(draft);
          setNoteDocument(plainTextToRichTextDocument(draft));
          setNoteDirty(true);
        }}
        onCancel={() => setCaptureOpen(false)}
        onCommit={() => {
          const value = note.trim();
          if (!value) {
            setStatus("Write a short check-in first.");
            return;
          }
          setStatus("Saving...");
          startTransition(() => saveDailyNote.mutate(value));
        }}
      />
      {addOpen || captureOpen || pathname.startsWith("/chat") ? null : (
        <BottomNav
          active={
            pathname === "/actions"
              ? "loop"
              : pathname === "/journey"
                ? "journey"
                : pathname === "/insights"
                  ? "insights"
                  : "today"
          }
          onCapture={() => setAddOpen(true)}
          onNavigate={(to) => {
            void navigate({ to });
          }}
        />
      )}
    </CaptureContext.Provider>
  );
}

const chatMessageId = () => crypto.randomUUID();

function ChatScreen() {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ReadonlyArray<VestaChatAttachment>>([]);
  const [messages, setMessages] = useState<ReadonlyArray<VestaChatMessage>>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const sendStreamingMessage = async (message: string) => {
    const assistantId = chatMessageId();
    setSending(true);
    setError("");
    setMessages((current) => [
      ...current,
      { content: "", id: assistantId, role: "assistant", streaming: true },
    ]);

    try {
      const stream = await streamConversationMessage({ conversationId: "default", message });
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        // oxlint-disable-next-line no-await-in-loop -- ReadableStream chunks are sequential.
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, content: reply } : item)),
        );
      }
      reply += decoder.decode();
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId ? { ...item, content: reply, streaming: false } : item,
        ),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["actions"] }),
        queryClient.invalidateQueries({ queryKey: ["summaries"] }),
      ]);
    } catch {
      setError("Could not reach Vesta. Try again.");
      setMessages((current) => current.filter((item) => item.id !== assistantId));
    } finally {
      setSending(false);
    }
  };

  return (
    <VestaChat
      attachments={attachments}
      error={error}
      input={input}
      messages={messages}
      sending={sending}
      onAttachmentsAdd={(files) =>
        setAttachments((current) => [
          ...current,
          ...files.map((file) => ({
            id: chatMessageId(),
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        ])
      }
      onAttachmentRemove={(id) =>
        setAttachments((current) => current.filter((attachment) => attachment.id !== id))
      }
      onInputChange={setInput}
      onSubmit={() => {
        const message = input.trim();
        if (!message || sending) return;
        setInput("");
        setError("");
        setMessages((current) => [
          ...current,
          {
            content: message,
            id: chatMessageId(),
            role: "user",
          },
        ]);
        void sendStreamingMessage(message);
      }}
    />
  );
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function ActionsScreen() {
  const actions = useActions();
  const summaries = useSummaries();
  const latestRun = actions.data?.latestRun;
  const metadataItemCount = readObjectProperty(latestRun?.metadata, "itemCount");
  const itemCount = typeof metadataItemCount === "number" ? metadataItemCount : undefined;
  const metadataProvider = readObjectProperty(latestRun?.metadata, "provider");
  const provider = typeof metadataProvider === "string" ? metadataProvider : "cloudflare-think";
  const updateStatus = useMutation({
    mutationFn: async (input: {
      readonly itemId: string;
      readonly status: "accepted" | "dismissed" | "completed";
    }) => {
      await apiClient.actions.updateStatus(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["actions"] });
    },
  });

  return (
    <VestaAppShell>
      <Surface eyebrow="AI" title="Actions" primary>
        <div className="mt-4 grid gap-3">
          {latestRun ? (
            <article className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/8">
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                AI analysis · {latestRun.status}
              </p>
              <h2 className="mt-1 mb-0 text-base font-semibold text-white">
                {latestRun.status === "completed"
                  ? itemCount === 0
                    ? "Analyzed, no actions found"
                    : `Analyzed ${itemCount ?? actions.data?.actions.length ?? 0} item${(itemCount ?? actions.data?.actions.length ?? 0) === 1 ? "" : "s"}`
                  : latestRun.status === "failed"
                    ? "Analysis failed"
                    : "Analyzing daily note"}
              </h2>
              <p className="mt-2 mb-0 text-xs leading-5 text-neutral-400">
                {provider} · {latestRun.model ?? "model pending"}
              </p>
            </article>
          ) : null}
          {(actions.data?.actions ?? []).length > 0 ? (
            actions.data?.actions.map((action) => (
              <article className="rounded-2xl bg-white/5 p-4" key={action.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                      {action.kind} · {action.status}
                    </p>
                    <h2 className="mt-1 mb-0 text-base font-semibold text-white">{action.title}</h2>
                    <p className="mt-2 mb-0 text-sm leading-6 text-neutral-300">{action.body}</p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {Math.round(action.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    className="min-h-10 rounded-full bg-[#f4f1eb] px-3 text-xs font-semibold text-[#080808]"
                    type="button"
                    onClick={() => updateStatus.mutate({ itemId: action.id, status: "accepted" })}
                  >
                    Accept
                  </button>
                  <button
                    className="min-h-10 rounded-full bg-white/5 px-3 text-xs font-semibold text-neutral-100"
                    type="button"
                    onClick={() => updateStatus.mutate({ itemId: action.id, status: "completed" })}
                  >
                    Done
                  </button>
                  <button
                    className="min-h-10 rounded-full bg-white/5 px-3 text-xs font-semibold text-neutral-100"
                    type="button"
                    onClick={() => updateStatus.mutate({ itemId: action.id, status: "dismissed" })}
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="m-0 text-sm text-neutral-400">No actions.</p>
          )}
        </div>
      </Surface>
      <Surface eyebrow="Summaries" title="Latest">
        <div className="mt-4 grid gap-3">
          {(summaries.data?.summaries ?? []).slice(0, 3).map((summary) => (
            <article className="rounded-2xl bg-white/5 p-4" key={summary.id}>
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                {summary.periodType} · {summary.periodStart}
              </p>
              <h2 className="mt-1 mb-0 text-base font-semibold text-white">{summary.title}</h2>
              <p className="mt-2 mb-0 line-clamp-4 text-sm leading-6 text-neutral-300">
                {summary.body}
              </p>
            </article>
          ))}
        </div>
      </Surface>
    </VestaAppShell>
  );
}

function SettingsScreen() {
  const session = useSession();
  const sessionUser = session.data?.user;
  const workspace = session.data?.workspace;
  const exportData = useMutation({
    mutationFn: async () => apiClient.dataExport(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vesta-export-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
  const deleteData = useMutation({
    mutationFn: async () => apiClient.account.delete(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
  return (
    <VestaAppShell>
      <Surface eyebrow="Workspace" title={workspace?.label ?? "Workspace"}>
        <p className="summary">{sessionUser ? sessionUser.displayName : "Loading..."}</p>
      </Surface>
      <Surface eyebrow="Security" title="Clerk account">
        <div className="mt-4 flex items-center">
          <UserButton />
        </div>
      </Surface>
      <Surface eyebrow="Data controls" title="Your data">
        <div className="mt-4 grid gap-2">
          <button
            className="min-h-12 rounded-full bg-[#f4f1eb] px-4 text-sm font-semibold text-[#080808]"
            type="button"
            onClick={() => exportData.mutate()}
          >
            Export data
          </button>
          <button
            className="min-h-12 rounded-full bg-white/5 px-4 text-sm font-semibold text-neutral-100"
            type="button"
            onClick={() => deleteData.mutate()}
          >
            Delete local data
          </button>
        </div>
      </Surface>
    </VestaAppShell>
  );
}

function TodayScreen() {
  const navigate = useNavigate();
  const clerk = useClerk();
  const localDate = todayLocalDate();
  const convexDailyNote = useConvexDailyNote(localDate);
  const events = useEvents();
  const actions = useActions();
  const recentNotes = (events.data?.events ?? []).slice(0, 4);
  const weeklyActivity = buildSignalCalendarData(events.data?.events ?? []);
  const openLoopCount =
    actions.data?.actions.filter(
      (action) => action.status === "proposed" || action.status === "accepted",
    ).length ?? 0;
  const signOut = useMutation({
    mutationFn: async () => {
      await clerk.signOut();
    },
    onSettled: () => {
      setSessionTokenResolver(null);
      queryClient.clear();
    },
  });

  return (
    <VestaAppShell>
      <HomeDashboard
        eventCount={events.data?.events.length ?? 0}
        hasJournalEntry={(convexDailyNote?.document?.bodyText.trim().length ?? 0) > 0}
        loading={events.isLoading}
        onOpenSettings={() => navigate({ to: "/settings" })}
        onSignOut={() => signOut.mutate()}
        openLoopCount={openLoopCount}
        weeklyActivity={weeklyActivity}
      />

      <ConvexSyncSpikePanel localDate={localDate} />

      <Surface id="recent-notes-title" eyebrow="Notes" title="Recent notes" primary>
        <div className="mt-4 grid gap-2">
          {recentNotes.length > 0 ? (
            recentNotes.map((event) => (
              <article className="rounded-2xl bg-white/5 p-4" key={event.id}>
                <p className="m-0 text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                  {event.occurredAt ? new Date(event.occurredAt).toLocaleDateString() : "Saved"}
                </p>
                <p className="mt-1 mb-0 line-clamp-3 text-sm leading-6 text-neutral-200">
                  {noteTextFromPayload(event.payload)}
                </p>
              </article>
            ))
          ) : (
            <p className="m-0 text-sm leading-6 text-neutral-400">No notes yet.</p>
          )}
        </div>
      </Surface>
    </VestaAppShell>
  );
}

function ConvexSyncSpikePanel(props: { readonly localDate: string }) {
  const convex = useConvex();
  const convexAuth = useConvexAuth();
  const noteState = useConvexDailyNote(props.localDate);
  const [bodyText, setBodyText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [lastStatusMutationId, setLastStatusMutationId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const document = noteState?.document;
  const paragraphStatuses = noteState?.statuses ?? [];
  const agentStatus = paragraphStatuses.slice(-1)[0] ?? noteState?.status;

  useEffect(() => {
    if (!dirty) {
      setBodyText(document?.bodyText ?? "");
    }
  }, [dirty, document?.bodyText]);

  const saveNote = useMutation({
    mutationFn: async () => {
      if (!convexAuth.isAuthenticated) {
        throw new Error("Sign in with Clerk to sync daily notes.");
      }
      const nextBodyText = bodyText.trim();
      const idempotencyKey = crypto.randomUUID();
      const result = await convex.mutation(api.documents.patchDailyNote, {
        bodyDocument: plainTextToRichTextDocument(nextBodyText),
        bodyText: nextBodyText,
        idempotencyKey,
        localDate: props.localDate,
        payloadHash: simplePayloadHash(nextBodyText),
        title: props.localDate,
        ...(document?.serverRevision ? { baseServerRevision: document.serverRevision } : {}),
      });
      if (!result.ok) {
        throw new Error(result.error?.code ?? "Convex note save failed");
      }
      return { idempotencyKey };
    },
    onError: (error) =>
      setStatusMessage(error instanceof Error ? error.message : "Could not save to Convex."),
    onSuccess: (result) => {
      setDirty(false);
      setLastStatusMutationId(result.idempotencyKey);
      setStatusMessage("Synced through Convex.");
    },
  });
  const updateAgentStatus = useMutation({
    mutationFn: async (status: "queued" | "running" | "ready" | "failed") => {
      if (!convexAuth.isAuthenticated) {
        throw new Error("Sign in with Clerk to sync daily notes.");
      }
      const idempotencyKey = lastStatusMutationId ?? agentStatus?.idempotencyKey;
      if (!idempotencyKey) {
        throw new Error("Save a paragraph before setting AI status.");
      }
      const result = await convex.mutation(api.documents.setAgentStatus, {
        idempotencyKey,
        localDate: props.localDate,
        status,
      });
      if (!result.ok) {
        throw new Error(result.error?.code ?? "Convex status update failed");
      }
    },
    onError: (error) =>
      setStatusMessage(
        error instanceof Error ? error.message : "Create a Convex note before setting AI status.",
      ),
    onSuccess: () => setStatusMessage("AI status updated through Convex."),
  });

  return (
    <Surface eyebrow="Convex spike" title="Realtime daily note" primary>
      <div className="mt-4 grid gap-3">
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 text-xs text-neutral-300">
          <span>
            {convexAuth.isLoading
              ? "Checking Clerk session"
              : convexAuth.isAuthenticated
                ? "Clerk session connected"
                : "Sign in to sync through Convex"}
          </span>
          {convexAuth.isAuthenticated ? <UserButton /> : null}
        </div>
        <textarea
          className="min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-100 outline-none focus:border-white/25"
          placeholder="Write the Convex spike note..."
          value={bodyText}
          onChange={(event) => {
            setBodyText(event.target.value);
            setDirty(true);
          }}
        />
        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400">
          <span>Revision {document?.serverRevision ?? "local"}</span>
          <span className="text-right">AI {agentStatus?.status ?? "not queued"}</span>
        </div>
        {statusMessage ? <p className="m-0 text-sm text-neutral-300">{statusMessage}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            className="min-h-11 rounded-full bg-[#f4f1eb] px-4 text-sm font-semibold text-[#080808] disabled:opacity-60"
            disabled={saveNote.isPending || !bodyText.trim() || !convexAuth.isAuthenticated}
            type="button"
            onClick={() => saveNote.mutate()}
          >
            {saveNote.isPending ? "Syncing..." : "Save via Convex"}
          </button>
          <button
            className="min-h-11 rounded-full bg-white/5 px-4 text-sm font-semibold text-neutral-100 disabled:opacity-60"
            disabled={updateAgentStatus.isPending || !convexAuth.isAuthenticated}
            type="button"
            onClick={() =>
              updateAgentStatus.mutate(agentStatus?.status === "running" ? "ready" : "running")
            }
          >
            {agentStatus?.status === "running" ? "Mark ready" : "Simulate AI"}
          </button>
        </div>
      </div>
    </Surface>
  );
}

function useConvexDailyNote(localDate: string) {
  const convex = useConvex();
  const [state, setState] = useState<ConvexDailyNoteState | undefined>();

  useEffect(() => {
    const watch = convex.watchQuery(api.documents.getDailyNote, {
      localDate,
    });
    const refresh = () => setState(watch.localQueryResult());
    refresh();
    return watch.onUpdate(refresh);
  }, [convex, localDate]);

  return state;
}

function JourneyScreen() {
  const events = useEvents();
  const groups = events.data ? deriveJourneyDayGroups(events.data.events) : undefined;

  return (
    <VestaAppShell>
      <Surface id="events-title" eyebrow="Loop history" title="Journey timeline">
        <JourneyTimeline groups={groups} loading={events.isLoading} error={events.isError} />
      </Surface>
    </VestaAppShell>
  );
}

function InsightsScreen() {
  const summaries = useSummaries();

  return (
    <VestaAppShell>
      <Surface id="insights-title" eyebrow="Archive" title="Summaries">
        <div className="mt-4 grid gap-3">
          {(summaries.data?.summaries ?? []).map((summary) => (
            <article className="rounded-2xl bg-white/5 p-4" key={summary.id}>
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                {summary.periodType} · {summary.periodStart}
              </p>
              <h2 className="mt-1 mb-0 text-base font-semibold text-white">{summary.title}</h2>
              <p className="mt-2 mb-0 text-sm leading-6 text-neutral-300">{summary.body}</p>
            </article>
          ))}
        </div>
      </Surface>
    </VestaAppShell>
  );
}

function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const body = await apiClient.signals.list({ limit: 50 });
      return { events: body.signals };
    },
  });
}

function useActions() {
  return useQuery({
    queryKey: ["actions"],
    queryFn: async () => apiClient.actions.list({ limit: 100 }),
  });
}

function useSummaries() {
  return useQuery({
    queryKey: ["summaries"],
    queryFn: async () => apiClient.summaries.list({ limit: 20 }),
  });
}

function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => apiClient.session(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

function VestaConvexProvider(props: { readonly children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <ClerkTokenBridge>
          <ConvexUserMaterializer>{props.children}</ConvexUserMaterializer>
        </ClerkTokenBridge>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function ClerkTokenBridge(props: { readonly children: ReactNode }) {
  const auth = useAuth();
  const expectedState = auth.isSignedIn ? "signed-in" : "signed-out";
  const [readyState, setReadyState] = useState<"loading" | "signed-in" | "signed-out">("loading");

  useEffect(() => {
    if (!auth.isLoaded) {
      setReadyState("loading");
      return;
    }

    if (!auth.isSignedIn) {
      setSessionTokenResolver(null);
      setReadyState("signed-out");
      return;
    }

    setSessionTokenResolver(async () => auth.getToken());
    setReadyState("signed-in");
    return () => setSessionTokenResolver(null);
  }, [auth.getToken, auth.isLoaded, auth.isSignedIn]);

  if (!auth.isLoaded || readyState !== expectedState) {
    return <main className="min-h-dvh bg-[#111]" aria-label="Loading Vesta" />;
  }

  return <>{props.children}</>;
}

function ConvexUserMaterializer(props: { readonly children: ReactNode }) {
  const convex = useConvex();
  const convexAuth = useConvexAuth();

  useEffect(() => {
    if (convexAuth.isLoading || !convexAuth.isAuthenticated) return;

    void convex.mutation(api.users.store, {}).catch(() => undefined);
  }, [convex, convexAuth.isAuthenticated, convexAuth.isLoading]);

  return <>{props.children}</>;
}

createRoot(rootElement).render(
  <StrictMode>
    <VestaConvexProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </VestaConvexProvider>
  </StrictMode>,
);
