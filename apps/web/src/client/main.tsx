import type { FunctionReturnType } from "convex/server";
import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  SignIn,
  UserButton,
  useAuth,
  useClerk,
} from "@clerk/react";
import { useSignIn } from "@clerk/react/legacy";
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
import { type ReactNode, StrictMode, useEffect, useRef, useState } from "react";
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
import { apiClient, setSessionTokenResolver, streamConversationMessage } from "./api-client";
import { DesktopSettingsSurface } from "./DesktopSettingsSurface";
import { QuickCaptureSurface } from "./QuickCaptureSurface";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const queryClient = new QueryClient();
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud";
const convexClient = new ConvexReactClient(convexUrl);
const clerkPublishableKey = requiredClerkPublishableKey();
const clerkProxyUrl = optionalEnvString(
  import.meta.env.VITE_CLERK_PROXY_URL ?? import.meta.env.CLERK_PROXY_URL,
);
const logoLongSrc =
  import.meta.env.VITE_NUDGE_LOGO_LONG_SRC ?? "/icons/nudge-logo-lockup-blobby-n-transparent.svg";
const desktopAuthRequestParam = "desktop_auth";
const desktopAuthRequestValue = "browser";
const desktopAuthCallbackParam = "desktop_callback";
const desktopTicketParam = "desktop_ticket";
const defaultDesktopAuthCallbackUrl = "nudge://auth/callback";
const defaultDesktopQuickCaptureShortcut = "CommandOrControl+Shift+N";

type ConvexStickyNotesState = FunctionReturnType<typeof api.stickyNotes.list>;
type StickyNote = ConvexStickyNotesState["notes"][number];

function requiredClerkPublishableKey() {
  const value = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? import.meta.env.CLERK_PUBLISHABLE_KEY;
  if (typeof value === "string" && value.startsWith("pk_")) return value;
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Nudge");
}

function optionalEnvString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: NotesScreen,
});
const askRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ask",
  component: AskScreen,
});
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: ReviewScreen,
});
const quickCaptureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quick-capture",
  component: QuickCaptureScreen,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsScreen,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    askRoute,
    reviewRoute,
    quickCaptureRoute,
    settingsRoute,
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
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
  }

  const desktopTicket = desktopTicketFromLocation();
  if (desktopTicket && !auth.isSignedIn)
    return <DesktopTicketSignInScreen ticket={desktopTicket} />;

  if (isDesktopBrowserAuthRequest()) {
    if (!auth.isSignedIn) return <ClerkSignInScreen forceRedirectUrl={window.location.href} />;
    return <DesktopBrowserAuthBridge />;
  }

  if (!auth.isSignedIn) return isDesktopSurface() ? <DesktopSignInScreen /> : <ClerkSignInScreen />;
  return <AuthenticatedAppShell />;
}

function ClerkSignInScreen(props: { readonly forceRedirectUrl?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#111] px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      {props.forceRedirectUrl ? (
        <SignIn routing="hash" forceRedirectUrl={props.forceRedirectUrl} />
      ) : (
        <SignIn routing="hash" />
      )}
    </main>
  );
}

function ClerkUnavailableScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#111] px-4 py-8 text-white">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="grid w-full max-w-md gap-4 rounded-lg border border-white/10 bg-[#1f2026] p-6 text-center shadow-2xl">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Sign-in unavailable</h1>
        <p className="m-0 text-sm leading-6 text-white/70">
          Nudge could not reach the authentication service. Check the Clerk production DNS setup and
          try again.
        </p>
        <button
          className="min-h-12 rounded-md bg-white px-4 text-sm font-semibold text-[#111] shadow-sm"
          type="button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </section>
    </main>
  );
}

function DesktopSignInScreen() {
  const [status, setStatus] = useState<"idle" | "opening" | "opened" | "error">("idle");
  const didOpenBrowserSignIn = useRef(false);

  const openBrowserSignIn = async () => {
    if (status === "opening") return;
    setStatus("opening");
    try {
      const url = desktopBrowserAuthUrl();
      const bridge = window.nudgeDesktop;
      if (bridge) {
        const result = await bridge.openExternalAuth(url);
        if (!result.ok) throw new Error("Could not open the default browser");
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      setStatus("opened");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (didOpenBrowserSignIn.current) return;
    didOpenBrowserSignIn.current = true;
    void openBrowserSignIn();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#111] px-4 py-8 text-white">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="grid w-full max-w-md gap-5 rounded-lg border border-white/10 bg-[#1f2026] p-6 shadow-2xl">
        <div className="grid gap-2 text-center">
          <h1 className="m-0 text-2xl font-semibold tracking-normal">Sign in to Nudge</h1>
          <p className="m-0 text-sm leading-6 text-white/70">
            We will open your default browser so you can use your existing Apple or Google login.
          </p>
        </div>
        <button
          className="min-h-12 rounded-md bg-white px-4 text-sm font-semibold text-[#111] shadow-sm disabled:opacity-60"
          disabled={status === "opening"}
          type="button"
          onClick={openBrowserSignIn}
        >
          {status === "opening" ? "Opening browser..." : "Open browser"}
        </button>
        {status === "opened" ? (
          <p className="m-0 text-center text-sm leading-6 text-white/70">
            Finish sign-in in your browser. Nudge will reopen automatically.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="m-0 text-center text-sm leading-6 text-[#ffb39e]">
            Browser sign-in could not be opened.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function DesktopBrowserAuthBridge() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const mintDesktopTicket = async () => {
      const callbackUrl = desktopCallbackUrlFromLocation();
      if (!callbackUrl || !isDesktopAuthCallbackUrl(callbackUrl)) {
        if (!cancelled) setErrorMessage("The desktop callback URL is missing or invalid.");
        return;
      }

      try {
        const response = await fetch("/api/auth/desktop-ticket", {
          credentials: "same-origin",
          headers: { accept: "application/json" },
          method: "POST",
        });
        if (!response.ok) throw new Error("Could not create a desktop sign-in ticket");

        const payload = await response.json().catch(() => null);
        const ticket = stringProperty(payload, "ticket");
        if (!ticket) throw new Error("Desktop sign-in ticket response was invalid");

        const redirectUrl = new URL(callbackUrl);
        redirectUrl.searchParams.set("ticket", ticket);
        window.location.href = redirectUrl.toString();
      } catch (error) {
        if (!cancelled) setErrorMessage(errorMessageFrom(error, "Desktop sign-in failed."));
      }
    };

    void mintDesktopTicket();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#111] px-4 py-8 text-white">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="grid w-full max-w-md gap-3 rounded-lg border border-white/10 bg-[#1f2026] p-6 text-center shadow-2xl">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Opening Nudge</h1>
        <p className="m-0 text-sm leading-6 text-white/70">
          {errorMessage ?? "Returning your signed-in session to the desktop app."}
        </p>
      </section>
    </main>
  );
}

function DesktopTicketSignInScreen(props: { readonly ticket: string }) {
  const { isLoaded, setActive, signIn } = useSignIn();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    const completeDesktopSignIn = async () => {
      try {
        const result = await signIn.create({
          strategy: "ticket",
          ticket: props.ticket,
        });
        if (result.status !== "complete" || !result.createdSessionId) {
          throw new Error("Desktop sign-in ticket did not create a complete session");
        }
        await setActive({ session: result.createdSessionId });
        removeDesktopTicketFromLocation();
      } catch (error) {
        if (!cancelled) setErrorMessage(errorMessageFrom(error, "Desktop sign-in failed."));
      }
    };

    void completeDesktopSignIn();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, props.ticket, setActive, signIn]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#111] px-4 py-8 text-white">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="grid w-full max-w-md gap-3 rounded-lg border border-white/10 bg-[#1f2026] p-6 text-center shadow-2xl">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Signing in</h1>
        <p className="m-0 text-sm leading-6 text-white/70">
          {errorMessage ?? "Completing your browser sign-in."}
        </p>
      </section>
    </main>
  );
}

function isDesktopSurface() {
  return window.nudgeDesktop?.surface === "desktop";
}

function isDesktopBrowserAuthRequest() {
  return (
    new URL(window.location.href).searchParams.get(desktopAuthRequestParam) ===
    desktopAuthRequestValue
  );
}

function desktopBrowserAuthUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete(desktopTicketParam);
  url.searchParams.set(desktopAuthRequestParam, desktopAuthRequestValue);
  url.searchParams.set(desktopAuthCallbackParam, desktopAuthCallbackUrl());
  return url.toString();
}

function desktopAuthCallbackUrl() {
  const callbackUrl = window.nudgeDesktop?.authCallbackUrl;
  return callbackUrl && isDesktopAuthCallbackUrl(callbackUrl)
    ? callbackUrl
    : defaultDesktopAuthCallbackUrl;
}

function desktopCallbackUrlFromLocation() {
  return new URL(window.location.href).searchParams.get(desktopAuthCallbackParam);
}

function desktopTicketFromLocation() {
  const ticket = new URL(window.location.href).searchParams.get(desktopTicketParam)?.trim();
  return ticket && ticket.length > 0 ? ticket : null;
}

function removeDesktopTicketFromLocation() {
  const url = new URL(window.location.href);
  url.searchParams.delete(desktopTicketParam);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function isDesktopAuthCallbackUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "nudge:" && url.hostname === "auth" && url.pathname === "/callback";
  } catch {
    return false;
  }
}

function stringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const property = Reflect.get(value, key);
  return typeof property === "string" && property.length > 0 ? property : null;
}

function errorMessageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AuthenticatedAppShell() {
  const session = useSession();
  if (!session.data) {
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
  }

  return (
    <>
      <Outlet />
      <DesktopUpdateToast />
    </>
  );
}

type DesktopUpdatePendingAction = "check" | "download" | "install";

interface DesktopUpdateControls {
  readonly actionMessage: string | null;
  readonly checkForUpdate: () => Promise<void>;
  readonly downloadUpdate: () => Promise<void>;
  readonly installUpdate: () => Promise<void>;
  readonly pendingAction: DesktopUpdatePendingAction | null;
  readonly state: NudgeDesktopUpdateState | null;
}

function DesktopUpdateToast() {
  const updates = useDesktopUpdateState();
  const state = updates.state;
  if (!state || !shouldShowDesktopUpdateToast(state)) return null;

  const action = desktopUpdateActionForState(state, updates);
  const progressWidth = `${Math.max(6, Math.min(100, state.downloadPercent ?? 6))}%`;
  const detail = desktopUpdateDetail(state, updates.actionMessage);

  return (
    <aside
      className="fixed right-4 bottom-4 z-50 grid w-[calc(100%-2rem)] max-w-sm gap-3 rounded-lg border border-[#cbd5df] bg-white p-4 text-[#111827] shadow-2xl"
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold">{desktopUpdateTitle(state)}</p>
          <p className="m-0 mt-1 text-sm leading-5 text-[#5b6472]">{detail}</p>
        </div>
        <span
          className={`mt-1 size-2.5 shrink-0 rounded-full ${desktopUpdateIndicatorClassName(
            state.status,
          )}`}
          aria-hidden="true"
        />
      </div>
      {state.status === "downloading" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e5eaf0]">
          <div className="h-full rounded-full bg-[#f14f23]" style={{ width: progressWidth }} />
        </div>
      ) : null}
      {action ? (
        <button
          className="min-h-10 rounded-md bg-[#111827] px-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          disabled={updates.pendingAction !== null}
          type="button"
          onClick={() => {
            void action.run();
          }}
        >
          {updates.pendingAction ? "Working" : action.label}
        </button>
      ) : null}
    </aside>
  );
}

function useDesktopUpdateState(): DesktopUpdateControls {
  const [state, setState] = useState<NudgeDesktopUpdateState | null>(null);
  const [pendingAction, setPendingAction] = useState<DesktopUpdatePendingAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const bridge = window.nudgeDesktop;
    if (!bridge) return;

    let cancelled = false;
    const applyState = (value: unknown) => {
      const nextState = parseDesktopUpdateState(value);
      if (!cancelled && nextState) setState(nextState);
    };

    const unsubscribe = bridge.onUpdateState(applyState);
    void bridge
      .getUpdateState()
      .then(applyState)
      .catch((error) => {
        if (!cancelled) setActionMessage(errorMessageFrom(error, "Update state unavailable."));
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const runDesktopUpdateAction = async (
    pending: DesktopUpdatePendingAction,
    command: (bridge: NudgeDesktopBridge) => Promise<unknown>,
  ) => {
    const bridge = window.nudgeDesktop;
    if (!bridge || pendingAction) return;

    setPendingAction(pending);
    setActionMessage(null);
    try {
      const result = parseDesktopUpdateActionResult(await command(bridge));
      if (!result) throw new Error("Desktop update command returned an invalid response.");
      setState(result.state);
      if (!result.accepted && result.state.message) setActionMessage(result.state.message);
    } catch (error) {
      setActionMessage(errorMessageFrom(error, "Desktop update failed."));
    } finally {
      setPendingAction(null);
    }
  };

  return {
    actionMessage,
    checkForUpdate: () => runDesktopUpdateAction("check", (bridge) => bridge.checkForUpdate()),
    downloadUpdate: () => runDesktopUpdateAction("download", (bridge) => bridge.downloadUpdate()),
    installUpdate: () => runDesktopUpdateAction("install", (bridge) => bridge.installUpdate()),
    pendingAction,
    state,
  };
}

function shouldShowDesktopUpdateToast(state: NudgeDesktopUpdateState) {
  return (
    state.enabled &&
    (state.status === "available" ||
      state.status === "downloaded" ||
      state.status === "downloading" ||
      state.status === "error")
  );
}

function desktopUpdateActionForState(
  state: NudgeDesktopUpdateState,
  updates: DesktopUpdateControls,
) {
  if (state.status === "available") return { label: "Download", run: updates.downloadUpdate };
  if (state.status === "downloaded") return { label: "Restart", run: updates.installUpdate };
  if (state.status === "error" && state.availableVersion)
    return { label: "Retry download", run: updates.downloadUpdate };
  if (state.status === "error" && state.canRetry)
    return { label: "Retry", run: updates.checkForUpdate };
  return null;
}

function desktopUpdateTitle(state: NudgeDesktopUpdateState) {
  switch (state.status) {
    case "available":
      return "Update available";
    case "downloaded":
      return "Update ready";
    case "downloading":
      return "Downloading update";
    case "error":
      return "Update failed";
    default:
      return "Nudge update";
  }
}

function desktopUpdateDetail(state: NudgeDesktopUpdateState, actionMessage: string | null) {
  if (state.status === "available") {
    const version = state.availableVersion ?? "a new version";
    return `Nudge ${version} is ready to download.`;
  }
  if (state.status === "downloaded") {
    const version = state.downloadedVersion ?? state.availableVersion ?? "the update";
    return `Restart Nudge to install ${version}.`;
  }
  if (state.status === "downloading") {
    return state.downloadPercent === null
      ? "Downloading the latest version."
      : `${state.downloadPercent}% downloaded.`;
  }
  return state.message ?? actionMessage ?? "Try again when you are back online.";
}

function desktopUpdateIndicatorClassName(status: NudgeDesktopUpdateStatus) {
  if (status === "downloaded") return "bg-[#138a46]";
  if (status === "error") return "bg-[#dc2626]";
  if (status === "downloading") return "bg-[#f14f23]";
  return "bg-[#2563eb]";
}

function parseDesktopUpdateActionResult(value: unknown): NudgeDesktopUpdateActionResult | null {
  if (!value || typeof value !== "object") return null;
  const accepted = readObjectProperty(value, "accepted");
  const completed = readObjectProperty(value, "completed");
  const state = parseDesktopUpdateState(readObjectProperty(value, "state"));
  if (typeof accepted !== "boolean" || typeof completed !== "boolean" || !state) return null;
  return { accepted, completed, state };
}

function parseDesktopUpdateState(value: unknown): NudgeDesktopUpdateState | null {
  if (!value || typeof value !== "object") return null;

  const availableVersion = readNullableStringProperty(value, "availableVersion");
  const canRetry = readObjectProperty(value, "canRetry");
  const currentVersion = readStringProperty(value, "currentVersion");
  const downloadedVersion = readNullableStringProperty(value, "downloadedVersion");
  const downloadPercent = readNullableNumberProperty(value, "downloadPercent");
  const enabled = readObjectProperty(value, "enabled");
  const message = readNullableStringProperty(value, "message");
  const status = readStringProperty(value, "status");

  if (
    typeof canRetry !== "boolean" ||
    !currentVersion ||
    typeof enabled !== "boolean" ||
    !isDesktopUpdateStatus(status)
  ) {
    return null;
  }

  return {
    availableVersion,
    canRetry,
    currentVersion,
    downloadedVersion,
    downloadPercent,
    enabled,
    message,
    status,
  };
}

function isDesktopUpdateStatus(value: unknown): value is NudgeDesktopUpdateStatus {
  return (
    value === "available" ||
    value === "checking" ||
    value === "disabled" ||
    value === "downloaded" ||
    value === "downloading" ||
    value === "error" ||
    value === "idle" ||
    value === "up-to-date"
  );
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
              onClick={() => navigate({ to: "/ask" })}
            >
              Ask
            </button>
            <button
              className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] shadow-sm"
              type="button"
              onClick={() => navigate({ to: "/review" })}
            >
              Review
            </button>
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

type AskActivityStatus = "active" | "complete" | "error";

interface AskActivity {
  readonly detail: string;
  readonly id: string;
  readonly label: string;
  readonly status: AskActivityStatus;
}

interface AskMemorySource {
  readonly sourceId: string;
  readonly sourceType: string;
}

interface AskSources {
  readonly memoryResults: ReadonlyArray<AskMemorySource>;
  readonly signalIds: ReadonlyArray<string>;
}

type ReviewInboxResponse = Awaited<ReturnType<typeof apiClient.reviewInbox.list>>;
type ReviewInboxItem = ReviewInboxResponse["items"][number];
type AgentReceipt = ReviewInboxResponse["receipts"][number];

function AskScreen() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [activities, setActivities] = useState<AskActivity[]>([]);
  const [sources, setSources] = useState<AskSources | null>(null);
  const [receipt, setReceipt] = useState<AgentReceipt | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submitMessage = async () => {
    const value = message.trim();
    if (!value || sending) return;

    setActivities([]);
    setReply("");
    setSources(null);
    setReceipt(null);
    setStatusMessage("");
    setSending(true);

    try {
      const stream = await streamConversationMessage({
        conversationId: "default",
        events: true,
        message: value,
      });
      if (isAgentEventStreamContentType(stream.contentType)) {
        await readAgentEventStream(stream.body, {
          onProgress: (activity) => {
            setActivities((current) => upsertActivity(current, activity));
          },
          onReceipt: setReceipt,
          onSources: setSources,
          onToken: (text) => setReply((current) => `${current}${text}`),
        });
      } else {
        setReply(await new Response(stream.body).text());
      }
      setMessage("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Ask failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#eef1f5] text-[#111827]">
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-4 sm:px-6">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#cbd5df] pb-4">
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
              onClick={() => navigate({ to: "/" })}
            >
              Notes
            </button>
            <button
              className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] shadow-sm"
              type="button"
              onClick={() => navigate({ to: "/review" })}
            >
              Review
            </button>
            <UserButton />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form
            className="grid gap-4 rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMessage();
            }}
          >
            <div>
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
                Ask Nudge
              </p>
              <h1 className="m-0 mt-1 text-xl font-semibold text-[#111827]">Agent</h1>
            </div>
            <textarea
              className="min-h-36 resize-y rounded-md border border-[#c3ccd7] bg-[#fbfcfd] px-3 py-3 text-base leading-6 outline-none focus:border-[#111827]"
              disabled={sending}
              placeholder="Ask about your notes, commitments, or next move."
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm text-[#667085]">{statusMessage}</p>
              <button
                className="min-h-11 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={sending || !message.trim()}
                type="submit"
              >
                {sending ? "Running" : "Ask"}
              </button>
            </div>
            {reply ? (
              <section className="rounded-md border border-[#d2d9e2] bg-[#f8fafc] p-4">
                <p className="m-0 text-sm leading-6 whitespace-pre-wrap text-[#1f2937]">{reply}</p>
              </section>
            ) : null}
          </form>

          <aside className="grid content-start gap-4">
            <AgentProgressCard activities={activities} sending={sending} />
            <AgentSourcesCard sources={sources} />
            <AgentReceiptCard receipt={receipt} />
          </aside>
        </section>
      </div>
    </main>
  );
}

function AgentProgressCard(props: {
  readonly activities: ReadonlyArray<AskActivity>;
  readonly sending: boolean;
}) {
  const fallbackActivity: AskActivity = {
    detail: "idle",
    id: "idle",
    label: props.sending ? "Starting" : "Idle",
    status: props.sending ? "active" : "complete",
  };
  const activities = props.activities.length ? props.activities : [fallbackActivity];

  return (
    <section className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
      <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
        Progress
      </p>
      <div className="mt-3 grid gap-2">
        {activities.map((activity) => (
          <div className="flex items-start gap-3" key={activity.id}>
            <span
              className={`mt-1 size-2.5 rounded-full ${activityStatusClassName(activity.status)}`}
              aria-hidden="true"
            />
            <div>
              <p className="m-0 text-sm font-semibold text-[#111827]">{activity.label}</p>
              <p className="m-0 text-xs text-[#667085]">{activity.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentSourcesCard(props: { readonly sources: AskSources | null }) {
  const sourceCount =
    (props.sources?.memoryResults.length ?? 0) + (props.sources?.signalIds.length ?? 0);
  return (
    <section className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
      <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
        Sources
      </p>
      <p className="m-0 mt-2 text-sm font-semibold text-[#111827]">
        {sourceCount === 0
          ? "None used yet"
          : `${sourceCount} source${sourceCount === 1 ? "" : "s"}`}
      </p>
      <div className="mt-3 grid gap-2">
        {props.sources?.memoryResults.map((source) => (
          <p
            className="m-0 rounded-md bg-[#f8fafc] px-3 py-2 text-xs text-[#4b5563]"
            key={source.sourceId}
          >
            {source.sourceType}: {source.sourceId}
          </p>
        ))}
        {props.sources?.signalIds.map((signalId) => (
          <p
            className="m-0 rounded-md bg-[#f8fafc] px-3 py-2 text-xs text-[#4b5563]"
            key={signalId}
          >
            signal: {signalId}
          </p>
        ))}
      </div>
    </section>
  );
}

function AgentReceiptCard(props: { readonly receipt: AgentReceipt | null }) {
  return (
    <section className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
      <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
        Receipt
      </p>
      {props.receipt ? (
        <div className="mt-3 grid gap-2 text-sm">
          <p className="m-0 font-semibold text-[#111827]">{props.receipt.action}</p>
          <p className="m-0 leading-6 text-[#4b5563]">{props.receipt.why}</p>
          <p className="m-0 text-xs text-[#667085]">
            {props.receipt.signalIds.length} signal
            {props.receipt.signalIds.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : (
        <p className="m-0 mt-2 text-sm text-[#667085]">No action yet.</p>
      )}
    </section>
  );
}

function ReviewScreen() {
  const navigate = useNavigate();
  const inbox = useReviewInbox();
  const reviewProposal = useMutation({
    mutationFn: async (input: {
      readonly decision: "accepted" | "rejected";
      readonly proposalId: string;
    }) => apiClient.reviews.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["review-inbox"] });
    },
  });
  const items = inbox.data?.items ?? [];
  const receipts = inbox.data?.receipts ?? [];

  return (
    <main className="min-h-dvh bg-[#eef1f5] text-[#111827]">
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 sm:px-6">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#cbd5df] pb-4">
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
              onClick={() => navigate({ to: "/ask" })}
            >
              Ask
            </button>
            <button
              className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] shadow-sm"
              type="button"
              onClick={() => navigate({ to: "/" })}
            >
              Notes
            </button>
            <UserButton />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-3">
            <div>
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
                Review Inbox
              </p>
              <h1 className="m-0 mt-1 text-xl font-semibold text-[#111827]">Proposals</h1>
            </div>
            {inbox.isLoading ? (
              <section className="rounded-lg border border-dashed border-[#b7c1cd] bg-white/70 p-4">
                <p className="m-0 text-sm font-medium text-[#596475]">Loading.</p>
              </section>
            ) : items.length > 0 ? (
              items.map((item) => (
                <ReviewInboxItemCard
                  disabled={reviewProposal.isPending}
                  item={item}
                  key={item.id}
                  onReview={(input) => reviewProposal.mutate(input)}
                />
              ))
            ) : (
              <section className="rounded-lg border border-dashed border-[#b7c1cd] bg-white/70 p-4">
                <p className="m-0 text-sm font-medium text-[#596475]">No proposals waiting.</p>
              </section>
            )}
          </div>

          <aside className="grid content-start gap-3">
            <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
              Receipts
            </p>
            {receipts.length > 0 ? (
              receipts.map((item) => <ReviewReceiptCard key={item.id} receipt={item} />)
            ) : (
              <section className="rounded-lg border border-dashed border-[#b7c1cd] bg-white/70 p-4">
                <p className="m-0 text-sm font-medium text-[#596475]">No receipts yet.</p>
              </section>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function ReviewInboxItemCard(props: {
  readonly disabled: boolean;
  readonly item: ReviewInboxItem;
  readonly onReview: (input: {
    readonly decision: "accepted" | "rejected";
    readonly proposalId: string;
  }) => void;
}) {
  const proposal = props.item.proposal;
  const explanation = proposal.explanation;
  return (
    <article className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
            {proposal.kind.replace("_", " ")}
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-[#111827]">{proposal.title}</h2>
        </div>
        <p className="m-0 rounded-md bg-[#ecfdf3] px-2 py-1 text-xs font-semibold text-[#027a48]">
          {Math.round(explanation.confidence * 100)}%
        </p>
      </div>
      <p className="m-0 mt-3 text-sm leading-6 text-[#374151]">{proposal.body}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReviewFact label="Source" value={explanation.source.label} />
        <ReviewFact label="Reason" value={explanation.reason} />
        <ReviewFact label="Confidence" value={`${Math.round(explanation.confidence * 100)}%`} />
        <ReviewFact label="Next action" value={explanation.nextAction} />
      </dl>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={() => props.onReview({ decision: "rejected", proposalId: proposal.id })}
        >
          Reject
        </button>
        <button
          className="min-h-10 rounded-md bg-[#111827] px-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={() => props.onReview({ decision: "accepted", proposalId: proposal.id })}
        >
          Accept
        </button>
      </div>
    </article>
  );
}

function ReviewFact(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md bg-[#f8fafc] p-3">
      <dt className="text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
        {props.label}
      </dt>
      <dd className="m-0 mt-1 text-sm leading-5 text-[#1f2937]">{props.value}</dd>
    </div>
  );
}

function ReviewReceiptCard(props: { readonly receipt: AgentReceipt }) {
  return (
    <article className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
      <p className="m-0 text-sm font-semibold text-[#111827]">{props.receipt.action}</p>
      <p className="m-0 mt-2 text-sm leading-6 text-[#4b5563]">{props.receipt.why}</p>
      <p className="m-0 mt-2 text-xs text-[#667085]">{formatDateTime(props.receipt.createdAt)}</p>
    </article>
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

function QuickCaptureScreen() {
  const [note, setNote] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const closeQuickCapture = async () => {
    const bridge = window.nudgeDesktopQuickCapture;
    if (bridge) {
      await bridge.close();
      return;
    }
    window.close();
  };
  const submitQuickCapture = useMutation({
    mutationFn: async () => {
      const value = note.trim();
      if (!value) throw new Error("Write a note first.");
      return await apiClient.quickCaptures.submit({
        idempotencyKey: `quick-capture:${crypto.randomUUID()}`,
        note: value,
      });
    },
    onError: (error) => {
      setStatusMessage(errorMessageFrom(error, "Capture failed."));
    },
    onSuccess: (result) => {
      setNote("");
      setStatusMessage(result.processingStatus === "drafted" ? "Drafted for review" : "Captured");
      const bridge = window.nudgeDesktopQuickCapture;
      if (bridge) void bridge.submitted();
    },
  });

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") void closeQuickCapture();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <QuickCaptureSurface
      disabled={submitQuickCapture.isPending}
      note={note}
      statusMessage={statusMessage}
      onClose={() => {
        void closeQuickCapture();
      }}
      onNoteChange={setNote}
      onSubmit={() => submitQuickCapture.mutate()}
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
  const desktopSettings = useDesktopSettingsControls();
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

        <DesktopSettingsSurface
          disabled={desktopSettings.isPending}
          isDesktop={desktopSettings.isDesktop}
          shortcut={desktopSettings.shortcut}
          statusMessage={desktopSettings.statusMessage}
          onResetShortcut={desktopSettings.resetQuickCaptureShortcut}
          onSaveShortcut={desktopSettings.saveQuickCaptureShortcut}
          onShortcutChange={desktopSettings.setShortcut}
        />

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

function useDesktopSettingsControls() {
  const isDesktop = isDesktopSurface();
  const [shortcut, setShortcut] = useState(defaultDesktopQuickCaptureShortcut);
  const [statusMessage, setStatusMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const bridge = window.nudgeDesktop;
    if (!bridge) return;

    let cancelled = false;
    void bridge
      .getSettings()
      .then((result) => {
        if (cancelled) return;
        setShortcut(result.settings.quickCaptureShortcut);
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusMessage(errorMessageFrom(error, "Desktop settings unavailable."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = async (nextShortcut: string) => {
    const bridge = window.nudgeDesktop;
    if (!bridge || isPending) return;

    setIsPending(true);
    setStatusMessage("");
    try {
      const result = await bridge.setSettings({ quickCaptureShortcut: nextShortcut });
      setShortcut(result.settings.quickCaptureShortcut);
      setStatusMessage(result.ok ? "Saved" : (result.error ?? "Shortcut could not be saved."));
    } catch (error) {
      setStatusMessage(errorMessageFrom(error, "Shortcut could not be saved."));
    } finally {
      setIsPending(false);
    }
  };

  return {
    isDesktop,
    isPending,
    resetQuickCaptureShortcut: () => {
      void saveSettings(defaultDesktopQuickCaptureShortcut);
    },
    saveQuickCaptureShortcut: () => {
      void saveSettings(shortcut);
    },
    setShortcut,
    shortcut,
    statusMessage,
  };
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

function useReviewInbox() {
  return useQuery({
    queryKey: ["review-inbox"],
    queryFn: async () => apiClient.reviewInbox.list({ limit: 50 }),
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

function readStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function readNullableStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : null;
}

function readNullableNumberProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "number" && Number.isFinite(property) ? property : null;
}

function readUnknownArrayProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return Array.isArray(property) ? property : [];
}

function isAgentEventStreamContentType(contentType: string) {
  return (
    contentType.includes("text/event-stream") ||
    contentType.includes("application/x-nudge-event-stream")
  );
}

async function readAgentEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    readonly onProgress: (activity: AskActivity) => void;
    readonly onReceipt: (receipt: AgentReceipt) => void;
    readonly onSources: (sources: AskSources) => void;
    readonly onToken: (text: string) => void;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- Streams need ordered chunk reads.
    const result = await reader.read();
    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      handleAgentEventFrame(frame, handlers);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleAgentEventFrame(buffer, handlers);
  }
}

function handleAgentEventFrame(
  frame: string,
  handlers: {
    readonly onProgress: (activity: AskActivity) => void;
    readonly onReceipt: (receipt: AgentReceipt) => void;
    readonly onSources: (sources: AskSources) => void;
    readonly onToken: (text: string) => void;
  },
) {
  const eventName = readSseEventName(frame);
  const data = readSseData(frame);
  if (!eventName || !data) return;
  const parsed = parseJson(data);
  if (eventName === "progress") {
    const activity = readAskActivity(parsed);
    if (activity) handlers.onProgress(activity);
  } else if (eventName === "sources") {
    handlers.onSources(readAskSources(parsed));
  } else if (eventName === "receipt") {
    const receipt = readAgentReceipt(parsed);
    if (receipt) handlers.onReceipt(receipt);
  } else if (eventName === "token") {
    const text = readStringProperty(parsed, "text");
    if (text) handlers.onToken(text);
  }
}

function readSseEventName(frame: string) {
  return frame
    .split("\n")
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
}

function readSseData(frame: string) {
  return frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readAskActivity(value: unknown): AskActivity | null {
  const id = readStringProperty(value, "id");
  const label = readStringProperty(value, "label");
  const statusValue = readStringProperty(value, "status");
  if (!id || !label || !isAskActivityStatus(statusValue)) return null;
  return {
    detail: readStringProperty(value, "kind") ?? "agent",
    id,
    label,
    status: statusValue,
  };
}

function isAskActivityStatus(value: string | undefined): value is AskActivityStatus {
  return value === "active" || value === "complete" || value === "error";
}

function readAskSources(value: unknown): AskSources {
  return {
    memoryResults: readUnknownArrayProperty(value, "memoryResults").flatMap(readAskMemorySource),
    signalIds: readUnknownArrayProperty(value, "signalIds").filter(isString),
  };
}

function readAskMemorySource(value: unknown): AskMemorySource[] {
  const sourceId = readStringProperty(value, "sourceId");
  const sourceType = readStringProperty(value, "sourceType");
  return sourceId && sourceType ? [{ sourceId, sourceType }] : [];
}

function readAgentReceipt(value: unknown): AgentReceipt | null {
  const id = readStringProperty(value, "id");
  const action = readStringProperty(value, "action");
  const createdAt = readStringProperty(value, "createdAt");
  const changedValue = readObjectProperty(value, "changed");
  const signalIds = readUnknownArrayProperty(value, "signalIds").filter(isString);
  const why = readStringProperty(value, "why");
  if (!id || !action || !createdAt || !changedValue || typeof changedValue !== "object" || !why) {
    return null;
  }
  return {
    action,
    changed: Object.fromEntries(Object.entries(changedValue)),
    createdAt,
    id,
    signalIds,
    why,
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function upsertActivity(
  current: ReadonlyArray<AskActivity>,
  nextActivity: AskActivity,
): AskActivity[] {
  const next = current.filter((activity) => activity.id !== nextActivity.id);
  return [...next, nextActivity];
}

function activityStatusClassName(status: AskActivityStatus) {
  if (status === "complete") return "bg-[#12b76a]";
  if (status === "error") return "bg-[#d92d20]";
  return "bg-[#f79009]";
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
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/"
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
    >
      <ClerkLoading>
        <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />
      </ClerkLoading>
      <ClerkFailed>
        <ClerkUnavailableScreen />
      </ClerkFailed>
      <ClerkLoaded>
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <ClerkTokenBridge>
            <ConvexUserMaterializer>{props.children}</ConvexUserMaterializer>
          </ClerkTokenBridge>
        </ConvexProviderWithClerk>
      </ClerkLoaded>
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
