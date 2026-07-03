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
} from "@tanstack/react-router";
import { ConvexReactClient, useConvex, useConvexAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  buildStickyNoteCreateInput,
  buildStickyNotePatchInput,
  stickyNoteTitleFromText,
  surfacePayloadHash,
  todayLocalDate,
} from "@nudge/surface";
import {
  EmptyNotesStateSurface,
  NoteComposerSurface,
  ReviewActionSurface,
  StickyNoteSurface,
  stickyColorFrom,
  type StickyColor,
} from "@nudge/ui";
import { api } from "../../../../convex/_generated/api";
import { apiClient, setSessionTokenResolver } from "./api-client";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const queryClient = new QueryClient();
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud";
const convexClient = new ConvexReactClient(convexUrl);
const clerkPublishableKey = requiredClerkPublishableKey();
const logoLongSrc =
  import.meta.env.VITE_NUDGE_LOGO_LONG_SRC ?? "/icons/nudge-logo-lockup-blobby-n-transparent.svg";

type ConvexStickyNotesState = FunctionReturnType<typeof api.stickyNotes.list>;
type StickyNote = ConvexStickyNotesState["notes"][number];

function requiredClerkPublishableKey() {
  const value = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? import.meta.env.CLERK_PUBLISHABLE_KEY;
  if (typeof value === "string" && value.startsWith("pk_")) return value;
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Nudge");
}

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: NotesScreen,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsScreen,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, settingsRoute]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AppShell() {
  const auth = useAuth();
  if (!auth.isLoaded) {
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
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
  const session = useSession();
  if (!session.data) {
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
  }

  return <Outlet />;
}

function NotesScreen() {
  const clerk = useClerk();
  const navigate = useNavigate();
  const notesState = useStickyNotes();
  const session = useSession();
  const signOut = useMutation({
    mutationFn: async () => {
      await clerk.signOut();
    },
    onSettled: () => {
      setSessionTokenResolver(null);
      queryClient.clear();
    },
  });
  const notes = notesState?.notes ?? [];
  const signedInAs = session.data?.user?.displayName ?? "You";

  return (
    <main className="min-h-dvh bg-[#eef1f5] text-[#111827]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[#cbd5df] pb-4">
          <button
            className="flex items-center gap-3 text-left"
            type="button"
            onClick={() => navigate({ to: "/" })}
          >
            <img className="h-8 w-auto" src={logoLongSrc} alt="Nudge" />
          </button>
          <div className="flex items-center gap-2">
            <button
              className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] shadow-sm"
              type="button"
              onClick={() => navigate({ to: "/settings" })}
            >
              Settings
            </button>
            <button
              className="min-h-10 rounded-md bg-[#111827] px-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              disabled={signOut.isPending}
              type="button"
              onClick={() => signOut.mutate()}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4">
            <div>
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#5b6472] uppercase">
                {todayLocalDate()}
              </p>
              <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal text-[#111827]">
                Notes
              </h1>
            </div>

            <NewNoteComposer />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {notes.length > 0 ? (
                notes.map((note) => <StickyNoteCard key={note._id} note={note} />)
              ) : (
                <EmptyNotesStateSurface signedInAs={signedInAs} />
              )}
            </div>
          </div>

          <ActionReviewPanel />
        </section>
      </div>
    </main>
  );
}

function NewNoteComposer() {
  const convex = useConvex();
  const convexAuth = useConvexAuth();
  const [bodyText, setBodyText] = useState("");
  const [color, setColor] = useState<StickyColor>("yellow");
  const [statusMessage, setStatusMessage] = useState("");
  const createNote = useMutation({
    mutationFn: async () => {
      if (!convexAuth.isAuthenticated) {
        throw new Error("Sign in with Clerk to sync notes.");
      }
      const value = bodyText.trim();
      if (!value) throw new Error("Write a note first.");
      const result = await convex.mutation(
        api.stickyNotes.create,
        buildStickyNoteCreateInput({
          bodyText: value,
          color,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      if (!result.ok) {
        throw new Error(result.error?.code ?? "Convex note create failed");
      }
    },
    onError: (error) =>
      setStatusMessage(error instanceof Error ? error.message : "Could not create note."),
    onSuccess: () => {
      setBodyText("");
      setStatusMessage("Saved");
    },
  });

  return (
    <NoteComposerSurface
      bodyText={bodyText}
      color={color}
      disabled={createNote.isPending || !convexAuth.isAuthenticated}
      statusMessage={statusMessage}
      onBodyTextChange={setBodyText}
      onChange={setColor}
      onSubmit={() => createNote.mutate()}
    />
  );
}

function StickyNoteCard(props: { readonly note: StickyNote }) {
  const convex = useConvex();
  const convexAuth = useConvexAuth();
  const [bodyText, setBodyText] = useState(props.note.bodyText);
  const [color, setColor] = useState<StickyColor>(stickyColorFrom(props.note.color));
  const [pinned, setPinned] = useState(props.note.pinned);
  const [dirty, setDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (dirty) return;
    setBodyText(props.note.bodyText);
    setColor(stickyColorFrom(props.note.color));
    setPinned(props.note.pinned);
  }, [dirty, props.note.bodyText, props.note.color, props.note.pinned]);

  const saveNote = useMutation({
    mutationFn: async () => {
      if (!convexAuth.isAuthenticated) {
        throw new Error("Sign in with Clerk to sync notes.");
      }
      const value = bodyText.trim();
      if (!value) throw new Error("Write a note first.");
      const result = await convex.mutation(
        api.stickyNotes.patch,
        buildStickyNotePatchInput({
          bodyText: value,
          color,
          idempotencyKey: crypto.randomUUID(),
          noteId: props.note._id,
          pinned,
          serverRevision: props.note.serverRevision,
          title: stickyNoteTitleFromText(value),
        }),
      );
      if (!result.ok) {
        throw new Error(result.error?.code ?? "Convex note save failed");
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not save note.";
      setStatusMessage(
        message === "revision_conflict"
          ? "Changed elsewhere. Latest version will reload."
          : message,
      );
      if (message === "revision_conflict") setDirty(false);
    },
    onSuccess: () => {
      setDirty(false);
      setStatusMessage("Saved");
    },
  });

  const archiveNote = useMutation({
    mutationFn: async () => {
      if (!convexAuth.isAuthenticated) {
        throw new Error("Sign in with Clerk to sync notes.");
      }
      const result = await convex.mutation(api.stickyNotes.archive, {
        idempotencyKey: crypto.randomUUID(),
        noteId: props.note._id,
        payloadHash: surfacePayloadHash(`archive:${props.note._id}:${props.note.serverRevision}`),
      });
      if (!result.ok) {
        throw new Error(result.error?.code ?? "Convex note archive failed");
      }
    },
    onError: (error) =>
      setStatusMessage(error instanceof Error ? error.message : "Could not archive note."),
  });

  return (
    <StickyNoteSurface
      archiving={archiveNote.isPending}
      bodyText={bodyText}
      color={color}
      dirty={dirty}
      pinned={pinned}
      saving={saveNote.isPending}
      serverRevision={props.note.serverRevision}
      statusMessage={statusMessage}
      title={stickyNoteTitleFromText(bodyText)}
      onArchive={() => archiveNote.mutate()}
      onBodyTextChange={(value) => {
        setBodyText(value);
        setDirty(true);
      }}
      onChange={(nextColor) => {
        setColor(nextColor);
        setDirty(true);
      }}
      onPinnedChange={(nextPinned) => {
        setPinned(nextPinned);
        setDirty(true);
      }}
      onSave={() => saveNote.mutate()}
    />
  );
}

function ActionReviewPanel() {
  const actions = useActions();
  const latestRun = actions.data?.latestRun;
  const pendingActions =
    actions.data?.actions.filter(
      (action) => action.status === "proposed" || action.status === "accepted",
    ) ?? [];
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
    <aside className="grid content-start gap-4">
      <section className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
        <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
          Agent
        </p>
        <h2 className="m-0 mt-1 text-lg font-semibold text-[#111827]">Review</h2>
        <p className="m-0 mt-2 text-sm leading-6 text-[#4b5563]">
          {latestRun ? agentRunText(latestRun) : "Idle"}
        </p>
      </section>

      <section className="grid gap-3">
        {pendingActions.length > 0 ? (
          pendingActions.map((action) => (
            <ReviewActionSurface
              body={action.body}
              confidencePercent={Math.round(action.confidence * 100)}
              disabled={updateStatus.isPending}
              followThroughText={followThroughText(action)}
              key={action.id}
              kind={action.kind}
              status={action.status}
              title={action.title}
              onAccept={() => updateStatus.mutate({ itemId: action.id, status: "accepted" })}
              onComplete={() => updateStatus.mutate({ itemId: action.id, status: "completed" })}
              onDismiss={() => updateStatus.mutate({ itemId: action.id, status: "dismissed" })}
            />
          ))
        ) : (
          <section className="rounded-lg border border-dashed border-[#b7c1cd] bg-white/70 p-4">
            <p className="m-0 text-sm font-medium text-[#596475]">No suggestions waiting.</p>
          </section>
        )}
      </section>
    </aside>
  );
}

function SettingsScreen() {
  const navigate = useNavigate();
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
      link.download = `nudge-export-${new Date().toISOString()}.json`;
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
    <main className="min-h-dvh bg-[#eef1f5] text-[#111827]">
      <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-4 sm:px-6">
        <header className="flex min-h-14 items-center justify-between border-b border-[#cbd5df] pb-4">
          <button
            className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] shadow-sm"
            type="button"
            onClick={() => navigate({ to: "/" })}
          >
            Notes
          </button>
          <UserButton />
        </header>

        <section className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
            Workspace
          </p>
          <h1 className="m-0 mt-1 text-xl font-semibold text-[#111827]">
            {workspace?.label ?? "Workspace"}
          </h1>
          <p className="m-0 mt-2 text-sm text-[#4b5563]">
            {sessionUser ? sessionUser.displayName : "Loading"}
          </p>
        </section>

        <section className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
            Data
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              className="min-h-11 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={exportData.isPending}
              type="button"
              onClick={() => exportData.mutate()}
            >
              Export
            </button>
            <button
              className="min-h-11 rounded-md border border-[#c3ccd7] bg-white px-4 text-sm font-semibold text-[#111827] disabled:opacity-50"
              disabled={deleteData.isPending}
              type="button"
              onClick={() => deleteData.mutate()}
            >
              Delete local data
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function useStickyNotes() {
  const convex = useConvex();
  const [state, setState] = useState<ConvexStickyNotesState | undefined>();

  useEffect(() => {
    const watch = convex.watchQuery(api.stickyNotes.list, {
      limit: 50,
    });
    const refresh = () => setState(watch.localQueryResult());
    refresh();
    return watch.onUpdate(refresh);
  }, [convex]);

  return state;
}

function useActions() {
  return useQuery({
    queryKey: ["actions"],
    queryFn: async () => apiClient.actions.list({ limit: 100 }),
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

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function agentRunText(
  run: NonNullable<Awaited<ReturnType<typeof apiClient.actions.list>>["latestRun"]>,
) {
  const itemCountValue = readObjectProperty(run.metadata, "itemCount");
  const itemCount = typeof itemCountValue === "number" ? itemCountValue : undefined;
  if (run.status === "completed") {
    return itemCount === 0
      ? "Last pass found no actions."
      : `Last pass found ${itemCount ?? "some"} item${itemCount === 1 ? "" : "s"}.`;
  }
  if (run.status === "failed") return "Last pass failed.";
  return "Analysis is running.";
}

function followThroughText(
  action: Awaited<ReturnType<typeof apiClient.actions.list>>["actions"][number],
) {
  if (action.kind === "event") {
    return action.eventStartsAt
      ? `Calendar proposal for ${formatDateTime(action.eventStartsAt)}.`
      : "Calendar proposal.";
  }
  if (action.kind === "reminder") {
    return action.remindAt
      ? `Reminder proposal for ${formatDateTime(action.remindAt)}.`
      : "Reminder proposal.";
  }
  if (action.kind === "task" || action.kind === "follow_up") return "Task proposal.";
  if (action.kind === "memory") return "Saved into user memory when accepted.";
  return "Review proposal.";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

function NudgeConvexProvider(props: { readonly children: ReactNode }) {
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
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
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
    <NudgeConvexProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </NudgeConvexProvider>
  </StrictMode>,
);
