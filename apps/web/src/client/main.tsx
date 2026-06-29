import { passkeyClient } from "@better-auth/passkey/client";
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
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createContext, type FormEvent, StrictMode, useState, useTransition } from "react";
import { createRoot } from "react-dom/client";
import {
  AddActionSheet,
  BottomNav,
  buildSignalCalendarData,
  deriveJourneyDayGroups,
  HomeDashboard,
  JourneyTimeline,
  LaresAppShell,
  LoginCard,
  plainTextToRichTextDocument,
  type RichTextDocument,
  Surface,
  WritingDrawer,
} from "@lares/ui";
import { apiClient } from "./api-client";
import { loginAuthMethodsForView } from "./login-preview";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const queryClient = new QueryClient();
const authClient = createAuthClient({ plugins: [emailOTPClient(), passkeyClient()] });

interface CaptureContextValue {
  readonly status: string;
  readonly saving: boolean;
  readonly openCapture: () => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

const todayLocalDate = () => new Date().toISOString().slice(0, 10);

const noteTextFromPayload = (payload: unknown) => {
  if (payload && typeof payload === "object" && "note" in payload) {
    return String(payload.note);
  }
  if (payload && typeof payload === "object" && "changedText" in payload) {
    return String(payload.changedText);
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload);
};

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

const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    eventsRoute,
    actionsRoute,
    insightsRoute,
    settingsRoute,
  ]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const session = useSession();
  const [note, setNote] = useState("");
  const [noteDocument, setNoteDocument] = useState<RichTextDocument>(
    plainTextToRichTextDocument(""),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const saveDailyNote = useMutation({
    mutationFn: async (value: string) => {
      const localDate = todayLocalDate();
      await Promise.all([
        apiClient.journal.save({
          bodyDocument: noteDocument,
          bodyText: value,
          localDate,
          title: localDate,
        }),
        apiClient.captures.append({
          type: "manual_check_in_submitted",
          source: "today_app",
          occurredAt: new Date().toISOString(),
          schemaVersion: 1,
          payload: { note: value },
        }),
      ]);
    },
    onSuccess: async () => {
      const localDate = todayLocalDate();
      setNote("");
      setNoteDocument(plainTextToRichTextDocument(""));
      setCaptureOpen(false);
      setStatus("Saved");
      await queryClient.invalidateQueries({ queryKey: ["journal", localDate] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["actions"] });
      await queryClient.invalidateQueries({ queryKey: ["summaries"] });
    },
    onError: () => {
      setStatus("Could not save. Check the deployment logs.");
    },
  });

  if (!session.data) {
    return <main className="min-h-dvh bg-[#111]" aria-label="Loading Lares" />;
  }

  const loginAuthMethods = loginAuthMethodsForView(session.data, window.location.search);
  if (loginAuthMethods) {
    return <LoginScreen authMethods={loginAuthMethods} />;
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
        onBodyChange={setNote}
        onBodyDocumentChange={setNoteDocument}
        onAiDraft={() => {
          const draft = "Today I need to clarify priorities, constraints, and the next follow-up.";
          setNote(draft);
          setNoteDocument(plainTextToRichTextDocument(draft));
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
      {addOpen || captureOpen ? null : (
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

function LoginScreen(props: {
  readonly authMethods: {
    readonly emailOtp: boolean;
    readonly google: boolean;
    readonly passkey: boolean;
  };
}) {
  const [email, setEmail] = useState("alek@teampitch.app");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const continueWithEmail = useMutation({
    mutationFn: async () => {
      if (sentTo) {
        const result = await authClient.signIn.emailOtp({
          email,
          name: email,
          otp,
        });
        if (result.error) throw new Error("Could not verify sign-in code");
        return "signed-in" as const;
      }

      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (result.error) throw new Error("Could not send sign-in code");
      return "sent" as const;
    },
    onError: () =>
      setError(
        sentTo ? "Code is incorrect or expired." : "Could not send a sign-in code. Try again.",
      ),
    onSuccess: async (result) => {
      setError("");
      if (result === "signed-in") {
        await queryClient.invalidateQueries({ queryKey: ["session"] });
        return;
      }
      setSentTo(email);
    },
  });
  const continueWithGoogle = async () => {
    await authClient.signIn.social({ callbackURL: "/", provider: "google" });
  };
  const continueWithPasskey = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.passkey();
      if (result.error) throw new Error("Could not sign in with passkey");
    },
    onError: () => setError("Could not sign in with passkey."),
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    continueWithEmail.mutate();
  };

  return (
    <LoginCard
      email={email}
      emailOtpEnabled={props.authMethods.emailOtp}
      error={error}
      googleEnabled={props.authMethods.google}
      passkeyEnabled={props.authMethods.passkey}
      pendingEmail={continueWithEmail.isPending}
      pendingPasskey={continueWithPasskey.isPending}
      sentTo={sentTo}
      otp={otp}
      onEmailChange={setEmail}
      onGoogle={continueWithGoogle}
      onOtpChange={setOtp}
      onPasskey={() => continueWithPasskey.mutate()}
      onSubmit={submit}
    />
  );
}

function ActionsScreen() {
  const actions = useActions();
  const summaries = useSummaries();
  const latestRun = actions.data?.latestRun;
  const runMetadata = latestRun?.metadata as
    | { readonly itemCount?: unknown; readonly provider?: unknown }
    | undefined;
  const itemCount = typeof runMetadata?.itemCount === "number" ? runMetadata.itemCount : undefined;
  const provider =
    typeof runMetadata?.provider === "string" ? runMetadata.provider : "cloudflare-think";
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
    <LaresAppShell>
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
    </LaresAppShell>
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
      link.download = `lares-export-${new Date().toISOString()}.json`;
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
  const addPasskey = useMutation({
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey({ name: "Lares passkey" });
      if (result.error) throw new Error("Could not add passkey");
    },
  });
  return (
    <LaresAppShell>
      <Surface eyebrow="Workspace" title={workspace?.label ?? "Workspace"}>
        <p className="summary">{sessionUser ? sessionUser.displayName : "Loading..."}</p>
      </Surface>
      {session.data?.authMethods.passkey ? (
        <Surface eyebrow="Security" title="Passkeys">
          <p className="summary">
            Add a passkey to sign in with Face ID, Touch ID, your device PIN, or a security key.
          </p>
          <button
            className="mt-4 min-h-12 rounded-full bg-[#f4f1eb] px-4 text-sm font-semibold text-[#080808] disabled:opacity-60"
            disabled={addPasskey.isPending}
            type="button"
            onClick={() => addPasskey.mutate()}
          >
            {addPasskey.isPending ? "Opening passkey..." : "Add passkey"}
          </button>
          {addPasskey.isError ? (
            <p className="m-0 mt-3 text-sm text-red-300">Could not add a passkey.</p>
          ) : null}
          {addPasskey.isSuccess ? (
            <p className="m-0 mt-3 text-sm text-emerald-300">Passkey added.</p>
          ) : null}
        </Surface>
      ) : null}
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
    </LaresAppShell>
  );
}

function TodayScreen() {
  const navigate = useNavigate();
  const localDate = todayLocalDate();
  const journal = useQuery({
    queryKey: ["journal", localDate],
    queryFn: async () => apiClient.journal.get({ localDate }),
  });
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
      const response = await fetch("/api/auth/sign-out", {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not sign out");
    },
    onSettled: () => {
      queryClient.setQueryData(["session"], {
        authMethods: { emailOtp: true, google: false, passkey: true },
        authMode: "unauthenticated",
        user: null,
        workspace: null,
      });
    },
  });

  return (
    <LaresAppShell>
      <HomeDashboard
        eventCount={events.data?.events.length ?? 0}
        hasJournalEntry={(journal.data?.document?.bodyText.trim().length ?? 0) > 0}
        loading={events.isLoading}
        onOpenSettings={() => navigate({ to: "/settings" })}
        onSignOut={() => signOut.mutate()}
        openLoopCount={openLoopCount}
        weeklyActivity={weeklyActivity}
      />

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
    </LaresAppShell>
  );
}

function JourneyScreen() {
  const events = useEvents();
  const groups = events.data ? deriveJourneyDayGroups(events.data.events) : undefined;

  return (
    <LaresAppShell>
      <Surface id="events-title" eyebrow="Loop history" title="Journey timeline">
        <JourneyTimeline groups={groups} loading={events.isLoading} error={events.isError} />
      </Surface>
    </LaresAppShell>
  );
}

function InsightsScreen() {
  const summaries = useSummaries();

  return (
    <LaresAppShell>
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
    </LaresAppShell>
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
