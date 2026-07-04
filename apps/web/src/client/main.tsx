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
import { type PointerEvent, type ReactNode, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  type AppSurface,
  type SurfaceActionItem,
  type SurfaceAgentRun,
  type SurfaceRefreshContext,
  todayLocalDate,
} from "@nudge/surface";
import {
  CalendarActivitySurface,
  CaptureResultSurface,
  DailyOperatingLoopSurface,
  NoteComposerSurface,
  ReviewActionSurface,
  SettingsSurface,
  type StickyColor,
} from "@nudge/ui";
import { api } from "../../../../convex/_generated/api";
import {
  apiClient,
  createWebSurfaceEngineClient,
  setSessionTokenResolver,
  streamConversationMessage,
} from "./api-client";
import {
  normalizeWebMediaMimeType,
  preferredBrowserVoiceMimeType,
  webMediaAttachmentDraft,
} from "./browser-media";
import { DesktopSettingsSurface } from "./DesktopSettingsSurface";
import { JournalStack } from "./journal-stack";
import { QuickCaptureSurface } from "./QuickCaptureSurface";
import {
  anonymousUiEnabled,
  currentAppSurface,
  surfaceContextRefetchInterval,
} from "./surface-runtime";
import {
  captureResultFromSavedWebCapture,
  saveWebCapture,
  type WebMediaAttachmentDraft,
  type WebMediaMimeType,
  type WebCaptureResult,
} from "./web-capture";
import {
  clearWebLocalDraft,
  loadWebLocalDraft,
  saveWebLocalDraft,
  type WebDraftStorage,
} from "./web-draft";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const queryClient = new QueryClient();
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud";
const convexClient = new ConvexReactClient(convexUrl);
const clerkPublishableKey = anonymousUiEnabled() ? null : requiredClerkPublishableKey();
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
  if (anonymousUiEnabled()) return <AuthenticatedAppShell />;
  return <ClerkAppShell />;
}

function ClerkAppShell() {
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
  const navigate = useNavigate();
  const session = useSession();
  const localDate = todayLocalDate();
  const surfaceContext = useSurfaceContext(localDate);
  const signedInAs =
    surfaceContext.data?.session.user?.displayName ?? session.data?.user?.displayName ?? "You";
  const pendingActions = pendingActionItems(surfaceContext.data?.actions.actions ?? []);
  const latestRun = surfaceContext.data?.actions.latestRun;
  const statusMessage = surfaceContext.isLoading
    ? "Updating context"
    : latestRun
      ? agentRunText(latestRun)
      : "Connected";
  const signalCount = surfaceContext.data?.signals.length ?? 0;

  return (
    <DailyOperatingLoopSurface
      actionCount={pendingActions.length}
      activitySlot={
        <CalendarActivitySurface
          currentDate={localDate}
          days={surfaceContext.data?.calendarDays ?? []}
        />
      }
      captureSlot={
        <NewNoteComposer
          actionCount={pendingActions.length}
          existingJournalText={surfaceContext.data?.journal?.bodyText}
          localDate={localDate}
          signalCount={signalCount}
        />
      }
      currentDate={localDate}
      journalSlot={
        <JournalStack
          journal={surfaceContext.data?.journal}
          signedInAs={signedInAs}
          signals={surfaceContext.data?.signals ?? []}
        />
      }
      navigationSlot={
        <>
          <button
            className="flex min-h-10 items-center gap-3 rounded-md border border-white/7 bg-[#131518] px-3 text-left text-sm font-semibold text-[#edeae0] shadow-sm"
            type="button"
            onClick={() => navigate({ to: "/" })}
          >
            <img className="h-7 w-auto" src={logoLongSrc} alt="Nudge" />
          </button>
          <div className="flex items-center gap-2">
            <button
              className="min-h-10 rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0] shadow-sm"
              type="button"
              onClick={() => navigate({ to: "/settings" })}
            >
              Settings
            </button>
            {anonymousUiEnabled() ? <AnonymousSessionPill /> : <ClerkSignOutButton />}
          </div>
        </>
      }
      reviewSlot={
        <ActionReviewPanel context={surfaceContext.data} loading={surfaceContext.isLoading} />
      }
      signalCount={signalCount}
      signedInAs={signedInAs}
      statusMessage={statusMessage}
    />
  );
}

function AnonymousSessionPill() {
  return (
    <div className="flex min-h-10 items-center rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0] shadow-sm">
      Local
    </div>
  );
}

function ClerkSignOutButton() {
  const clerk = useClerk();
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
    <button
      className="min-h-10 rounded-md bg-[#579ef5] px-3 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-60"
      disabled={signOut.isPending}
      type="button"
      onClick={() => signOut.mutate()}
    >
      Sign out
    </button>
  );
}

function NewNoteComposer(props: {
  readonly actionCount: number;
  readonly existingJournalText: string | undefined;
  readonly localDate: string;
  readonly signalCount: number;
}) {
  const initialDraftRef = useRef<WebInitialLocalDraft | null>(null);
  if (initialDraftRef.current === null) {
    initialDraftRef.current = initialWebLocalDraft(props.localDate);
  }
  const initialDraft = initialDraftRef.current;
  const [bodyText, setBodyText] = useState(initialDraft.bodyText);
  const [color, setColor] = useState<StickyColor>("yellow");
  const [continuationText, setContinuationText] = useState(initialDraft.continuationText);
  const [captureResult, setCaptureResult] = useState<WebCaptureResult | null>(null);
  const [mediaAttachments, setMediaAttachments] = useState<ReadonlyArray<WebMediaAttachmentDraft>>(
    [],
  );
  const [statusMessage, setStatusMessage] = useState(
    initialDraft.restored ? "Saved on this device" : "",
  );
  const [drawingPadOpen, setDrawingPadOpen] = useState(false);
  const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const capture = useMutation({
    mutationFn: async () => {
      const leadingNote = bodyText.trim();
      const trailingNote = continuationText.trim();
      const attachmentNote = mediaAttachments.map((attachment) => attachment.label).join("\n");
      const noteText = leadingNote || (trailingNote ? "" : attachmentNote);
      const captureTitle =
        [leadingNote, trailingNote].filter((text) => text.length > 0).join("\n\n") ||
        attachmentNote;
      const saved = await saveWebCapture({
        attachments: { color },
        ...(props.existingJournalText !== undefined
          ? { existingJournalText: props.existingJournalText }
          : {}),
        localDate: props.localDate,
        mediaAttachments,
        note: noteText,
        ...(trailingNote ? { trailingNote } : {}),
      });
      return { noteText: captureTitle, saved };
    },
    onError: (error) =>
      setStatusMessage(error instanceof Error ? error.message : "Could not capture note."),
    onSuccess: (data) => {
      setCaptureResult(
        captureResultFromSavedWebCapture({
          actionCount: props.actionCount,
          noteText: data.noteText,
          saved: data.saved,
          signalCount: props.signalCount,
        }),
      );
      setBodyText("");
      setContinuationText("");
      setMediaAttachments([]);
      clearCurrentWebLocalDraft(props.localDate);
      setStatusMessage("Captured");
      void queryClient.invalidateQueries({ queryKey: ["surface-context"] });
    },
  });

  useEffect(() => {
    const draft = initialWebLocalDraft(props.localDate);
    setBodyText(draft.bodyText);
    setContinuationText(draft.continuationText);
    if (draft.restored) setStatusMessage("Saved on this device");
  }, [props.localDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const draft = saveCurrentWebLocalDraft({
        bodyText,
        continuationText,
        localDate: props.localDate,
      });
      if (draft) setStatusMessage("Saved on this device");
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [bodyText, continuationText, props.localDate]);

  return (
    <div className="grid gap-3">
      <input
        accept="image/jpeg,image/png"
        className="sr-only"
        ref={imageInputRef}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.item(0);
          event.currentTarget.value = "";
          if (!file) return;
          void appendMediaAttachment(
            file,
            {
              defaultLabel: "Photo",
              kind: "image",
              mimeTypes: ["image/jpeg", "image/png"],
              presentationKind: "photo",
              statusMessage: "Photo attached",
              unsupportedMessage: "Choose a JPEG or PNG image.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
        }}
      />
      <input
        accept="audio/mp4,audio/webm"
        className="sr-only"
        ref={voiceInputRef}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.item(0);
          event.currentTarget.value = "";
          if (!file) return;
          void appendMediaAttachment(
            file,
            {
              defaultLabel: "Voice recording",
              kind: "voice",
              mimeTypes: ["audio/mp4", "audio/webm"],
              presentationKind: "voice",
              statusMessage: "Voice attached",
              unsupportedMessage: "Choose an MP4 or WebM audio recording.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
          setVoiceRecorderOpen(false);
        }}
      />
      <NoteComposerSurface
        attachments={mediaAttachments.map((attachment) => ({
          id: attachment.id,
          kind: attachment.presentationKind ?? (attachment.kind === "voice" ? "voice" : "photo"),
          label: attachment.label,
        }))}
        bodyText={bodyText}
        color={color}
        continuationText={continuationText}
        disabled={capture.isPending}
        statusMessage={statusMessage}
        onAttachDrawing={() => setDrawingPadOpen(true)}
        onAttachImage={() => imageInputRef.current?.click()}
        onAttachVoice={() => setVoiceRecorderOpen(true)}
        onBodyTextChange={setBodyText}
        onChange={setColor}
        onContinuationTextChange={setContinuationText}
        onRemoveAttachment={(id) =>
          setMediaAttachments((attachments) =>
            attachments.filter((attachment) => attachment.id !== id),
          )
        }
        onSubmit={() => capture.mutate()}
      />
      <DrawingCaptureDialog
        open={drawingPadOpen}
        onAttach={(dataURL) => {
          appendPreparedMediaAttachment(
            {
              dataURL,
              id: crypto.randomUUID(),
              kind: "image",
              label: "Drawing",
              mimeType: "image/png",
              presentationKind: "drawing",
            },
            {
              defaultLabel: "Drawing",
              kind: "image",
              mimeTypes: ["image/png"],
              presentationKind: "drawing",
              statusMessage: "Drawing attached",
              unsupportedMessage: "Could not prepare drawing.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
        }}
        onClose={() => setDrawingPadOpen(false)}
      />
      <VoiceCaptureDialog
        open={voiceRecorderOpen}
        onAttach={(blob) => {
          void appendBlobMediaAttachment(
            blob,
            "Voice recording",
            {
              defaultLabel: "Voice recording",
              kind: "voice",
              mimeTypes: ["audio/mp4", "audio/webm"],
              presentationKind: "voice",
              statusMessage: "Voice attached",
              unsupportedMessage: "Could not prepare voice recording.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
          setVoiceRecorderOpen(false);
        }}
        onClose={() => setVoiceRecorderOpen(false)}
        onImportAudio={() => voiceInputRef.current?.click()}
      />
      {captureResult ? (
        <CaptureResultSurface
          actionCount={captureResult.actionCount}
          items={captureResult.items}
          references={captureResult.references}
          signalCount={captureResult.signalCount}
          sourceCount={captureResult.sourceCount}
          summary={captureResult.summary}
          title={captureResult.title}
        />
      ) : null}
    </div>
  );
}

interface WebInitialLocalDraft {
  readonly bodyText: string;
  readonly continuationText: string;
  readonly restored: boolean;
}

function initialWebLocalDraft(localDate: string) {
  const storage = browserDraftStorage();
  if (!storage) return { bodyText: "", continuationText: "", restored: false };
  const draft = loadWebLocalDraft({
    localDate,
    storage,
    surface: currentAppSurface(),
  });
  return draft
    ? {
        bodyText: draft.bodyText,
        continuationText: draft.continuationText,
        restored: true,
      }
    : { bodyText: "", continuationText: "", restored: false };
}

function saveCurrentWebLocalDraft(input: {
  readonly bodyText: string;
  readonly continuationText: string;
  readonly localDate: string;
}) {
  const storage = browserDraftStorage();
  if (!storage) return null;
  return saveWebLocalDraft({
    bodyText: input.bodyText,
    continuationText: input.continuationText,
    localDate: input.localDate,
    storage,
    surface: currentAppSurface(),
  });
}

function clearCurrentWebLocalDraft(localDate: string) {
  const storage = browserDraftStorage();
  if (!storage) return;
  clearWebLocalDraft({
    localDate,
    storage,
    surface: currentAppSurface(),
  });
}

function browserDraftStorage(): WebDraftStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

async function appendMediaAttachment(
  file: File,
  options: AppendMediaAttachmentOptions,
  setMediaAttachments: (
    updater: (
      attachments: ReadonlyArray<WebMediaAttachmentDraft>,
    ) => ReadonlyArray<WebMediaAttachmentDraft>,
  ) => void,
  setStatusMessage: (message: string) => void,
) {
  await appendBlobMediaAttachment(
    file,
    file.name.trim() || options.defaultLabel,
    options,
    setMediaAttachments,
    setStatusMessage,
  );
}

async function appendBlobMediaAttachment(
  blob: Blob,
  label: string,
  options: AppendMediaAttachmentOptions,
  setMediaAttachments: (
    updater: (
      attachments: ReadonlyArray<WebMediaAttachmentDraft>,
    ) => ReadonlyArray<WebMediaAttachmentDraft>,
  ) => void,
  setStatusMessage: (message: string) => void,
) {
  const mimeType = mediaAttachmentMimeType(blob.type, options.mimeTypes);
  if (!mimeType) {
    setStatusMessage(options.unsupportedMessage);
    return;
  }

  try {
    const dataURL = await blobDataURL(blob);
    appendPreparedMediaAttachment(
      {
        dataURL,
        id: crypto.randomUUID(),
        kind: options.kind,
        label,
        mimeType,
        presentationKind: options.presentationKind,
      },
      options,
      setMediaAttachments,
      setStatusMessage,
    );
  } catch {
    setStatusMessage("Could not read attachment.");
  }
}

function appendPreparedMediaAttachment(
  input: {
    readonly dataURL: string;
    readonly id: string;
    readonly kind: "image" | "voice";
    readonly label: string;
    readonly mimeType: string;
    readonly presentationKind: "drawing" | "photo" | "voice";
  },
  options: AppendMediaAttachmentOptions,
  setMediaAttachments: (
    updater: (
      attachments: ReadonlyArray<WebMediaAttachmentDraft>,
    ) => ReadonlyArray<WebMediaAttachmentDraft>,
  ) => void,
  setStatusMessage: (message: string) => void,
) {
  const draft = webMediaAttachmentDraft(input);
  if (!draft || !mediaAttachmentMimeType(draft.mimeType, options.mimeTypes)) {
    setStatusMessage(options.unsupportedMessage);
    return;
  }

  setMediaAttachments((attachments) => [...attachments, draft]);
  setStatusMessage(options.statusMessage);
}

interface AppendMediaAttachmentOptions {
  readonly defaultLabel: string;
  readonly kind: "image" | "voice";
  readonly mimeTypes: ReadonlyArray<WebMediaMimeType>;
  readonly presentationKind: "drawing" | "photo" | "voice";
  readonly statusMessage: string;
  readonly unsupportedMessage: string;
}

function mediaAttachmentMimeType(value: string, allowed: ReadonlyArray<WebMediaMimeType>) {
  const normalized = normalizeWebMediaMimeType(value);
  if (!normalized) return null;
  for (const mimeType of allowed) {
    if (normalized === mimeType) return mimeType;
  }
  return null;
}

async function blobDataURL(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read attachment."));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read attachment."));
    };
    reader.readAsDataURL(blob);
  });
}

function DrawingCaptureDialog(props: {
  readonly open: boolean;
  readonly onAttach: (dataURL: string) => void;
  readonly onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    prepareDrawingCanvas(canvasRef.current);
    drawingRef.current = false;
    pointerIdRef.current = null;
    setHasDrawing(false);
  }, [props.open]);

  if (!props.open) return null;

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    drawingRef.current = true;
    pointerIdRef.current = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const point = drawingCanvasPoint(canvas, event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setHasDrawing(true);
  };

  const continueDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || pointerIdRef.current !== event.pointerId) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    const point = drawingCanvasPoint(canvas, event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const finishDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    drawingRef.current = false;
    pointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearDrawing = () => {
    prepareDrawingCanvas(canvasRef.current);
    drawingRef.current = false;
    pointerIdRef.current = null;
    setHasDrawing(false);
  };

  const attachDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return;
    props.onAttach(canvas.toDataURL("image/png"));
    props.onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6">
      <section
        aria-label="Drawing"
        aria-modal="true"
        className="grid w-full max-w-3xl gap-4 rounded-lg border border-white/7 bg-[#131518] p-4 text-[#edeae0] shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold">Drawing</h2>
          <button
            className="min-h-9 rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={props.onClose}
          >
            Close
          </button>
        </header>
        <canvas
          aria-label="Drawing canvas"
          className="h-72 w-full touch-none rounded-md border border-white/10 bg-[#f5eecf]"
          height={540}
          ref={canvasRef}
          width={960}
          onPointerCancel={finishDrawing}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="min-h-10 rounded-md border border-white/7 bg-[#1f2125] px-4 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={clearDrawing}
          >
            Clear
          </button>
          <button
            className="min-h-10 rounded-md bg-[#579ef5] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
            disabled={!hasDrawing}
            type="button"
            onClick={attachDrawing}
          >
            Attach drawing
          </button>
        </div>
      </section>
    </div>
  );
}

type VoiceRecordingState = "idle" | "ready" | "recording";

function VoiceCaptureDialog(props: {
  readonly open: boolean;
  readonly onAttach: (blob: Blob) => void;
  readonly onClose: () => void;
  readonly onImportAudio: () => void;
}) {
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    return () => {
      cleanupVoiceResources(timerRef, streamRef, recorderRef);
    };
  }, []);

  useEffect(() => {
    if (!props.open) return;
    chunksRef.current = [];
    setElapsedSeconds(0);
    setRecordedBlob(null);
    setRecordingState("idle");
    setStatusMessage("");
  }, [props.open]);

  if (!props.open) return null;

  const startRecording = async () => {
    setStatusMessage("");
    setRecordedBlob(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatusMessage("Microphone unavailable.");
      return;
    }

    const preferredMimeType = preferredBrowserVoiceMimeType();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current = [...chunksRef.current, event.data];
        }
      };
      recorder.onstop = () => {
        const recorderMimeType = normalizeWebMediaMimeType(recorder.mimeType);
        const mimeType = recorderMimeType ?? preferredMimeType;
        const chunks = chunksRef.current;
        cleanupVoiceResources(timerRef, streamRef, recorderRef);
        if (!mimeType || chunks.length === 0) {
          setRecordingState("idle");
          setStatusMessage("No recording captured.");
          return;
        }
        setRecordedBlob(new Blob(chunks, { type: mimeType }));
        setRecordingState("ready");
        setStatusMessage("Recording ready");
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setRecordingState("recording");
      timerRef.current = window.setInterval(() => {
        const startedAt = startedAtRef.current;
        if (startedAt === null) return;
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch {
      cleanupVoiceResources(timerRef, streamRef, recorderRef);
      setRecordingState("idle");
      setStatusMessage("Microphone unavailable.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const close = () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    cleanupVoiceResources(timerRef, streamRef, recorderRef);
    chunksRef.current = [];
    props.onClose();
  };

  const attachRecording = () => {
    if (!recordedBlob) return;
    props.onAttach(recordedBlob);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6">
      <section
        aria-label="Voice"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-lg border border-white/7 bg-[#131518] p-4 text-[#edeae0] shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold">Voice</h2>
          <button
            className="min-h-9 rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={close}
          >
            Close
          </button>
        </header>
        <div className="grid min-h-28 place-items-center rounded-lg border border-white/7 bg-[#090a0b]/55 p-4">
          <p className="m-0 text-4xl font-semibold tabular-nums">
            {formatElapsedSeconds(elapsedSeconds)}
          </p>
          {statusMessage ? (
            <p className="m-0 mt-2 text-sm font-medium text-[#a1a6ad]">{statusMessage}</p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {recordingState === "recording" ? (
            <button
              className="min-h-10 rounded-md bg-[#d65f84] px-4 text-sm font-semibold text-white shadow-sm"
              type="button"
              onClick={stopRecording}
            >
              Stop
            </button>
          ) : (
            <button
              className="min-h-10 rounded-md bg-[#579ef5] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
              disabled={recordingState === "ready"}
              type="button"
              onClick={() => void startRecording()}
            >
              Record
            </button>
          )}
          <button
            className="min-h-10 rounded-md border border-white/7 bg-[#1f2125] px-4 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={props.onImportAudio}
          >
            Import audio
          </button>
        </div>
        <button
          className="min-h-10 rounded-md bg-[#40c792] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
          disabled={!recordedBlob}
          type="button"
          onClick={attachRecording}
        >
          Attach recording
        </button>
      </section>
    </div>
  );
}

function prepareDrawingCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#f5eecf";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 7;
  context.strokeStyle = "#15181d";
}

function drawingCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();
  const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * canvas.width : 0;
  const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * canvas.height : 0;
  return { x, y };
}

function cleanupVoiceResources(
  timerRef: { current: number | null },
  streamRef: { current: MediaStream | null },
  recorderRef: { current: MediaRecorder | null },
) {
  if (timerRef.current !== null) {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
  const stream = streamRef.current;
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    streamRef.current = null;
  }
  recorderRef.current = null;
}

function formatElapsedSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ActionReviewPanel(props: {
  readonly context: SurfaceRefreshContext | undefined;
  readonly loading: boolean;
}) {
  const latestRun = props.context?.actions.latestRun;
  const pendingActions = pendingActionItems(props.context?.actions.actions ?? []);
  const updateStatus = useMutation({
    mutationFn: async (input: {
      readonly itemId: string;
      readonly status: "accepted" | "dismissed" | "completed";
    }) => {
      const client = await createWebSurfaceEngineClient();
      await client.updateActionStatus(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["surface-context"] });
    },
  });

  return (
    <>
      <p className="m-0 text-sm leading-6 text-[#a1a6ad]">
        {latestRun ? agentRunText(latestRun) : props.loading ? "Loading review queue." : "Idle"}
      </p>
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
          <section className="rounded-lg border border-dashed border-white/12 bg-[#131518]/70 p-4">
            <p className="m-0 text-sm font-medium text-[#a1a6ad]">No suggestions waiting.</p>
          </section>
        )}
      </section>
    </>
  );
}

type ReviewInboxResponse = Awaited<ReturnType<typeof apiClient.reviewInbox.list>>;
type ReviewInboxItem = ReviewInboxResponse["items"][number];
type AgentReceipt = ReviewInboxResponse["receipts"][number];

function AskScreen() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submitMessage = async () => {
    const value = message.trim();
    if (!value || sending) return;

    setReply("");
    setStatusMessage("");
    setSending(true);
    try {
      const stream = await streamConversationMessage({
        conversationId: "default",
        message: value,
      });
      setReply(await new Response(stream.body).text());
      setMessage("");
    } catch (error) {
      setStatusMessage(errorMessageFrom(error, "Ask failed."));
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#eef1f5] text-[#111827]">
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-4 sm:px-6">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[#cbd5df] pb-4">
          <button
            className="flex items-center gap-3 text-left"
            type="button"
            onClick={() => navigate({ to: "/" })}
          >
            <img className="h-8 w-auto" src={logoLongSrc} alt="Nudge" />
          </button>
          <button
            className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] shadow-sm"
            type="button"
            onClick={() => navigate({ to: "/review" })}
          >
            Review
          </button>
        </header>

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
      </div>
    </main>
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
          <button
            className="min-h-10 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm font-semibold text-[#1f2937] shadow-sm"
            type="button"
            onClick={() => navigate({ to: "/ask" })}
          >
            Ask
          </button>
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
    <SettingsSurface
      accountName={sessionUser?.displayName ?? "You"}
      accountSlot={anonymousUiEnabled() ? undefined : <UserButton />}
      deleteDisabled={deleteData.isPending}
      desktopSlot={
        <DesktopSettingsSurface
          disabled={desktopSettings.isPending}
          isDesktop={desktopSettings.isDesktop}
          shortcut={desktopSettings.shortcut}
          statusMessage={desktopSettings.statusMessage}
          onResetShortcut={desktopSettings.resetQuickCaptureShortcut}
          onSaveShortcut={desktopSettings.saveQuickCaptureShortcut}
          onShortcutChange={desktopSettings.setShortcut}
        />
      }
      engineLabel={window.location.origin}
      exportDisabled={exportData.isPending}
      sessionLabel={session.data?.authMode ?? "Loading"}
      surfaceLabel={surfaceDisplayName(currentAppSurface())}
      workspaceLabel={workspace?.label ?? "Workspace"}
      onBack={() => navigate({ to: "/" })}
      onDeleteData={() => deleteData.mutate()}
      onExportData={() => exportData.mutate()}
    />
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

function useSurfaceContext(localDate: string) {
  return useQuery({
    queryKey: ["surface-context", localDate],
    queryFn: async () => {
      const client = await createWebSurfaceEngineClient();
      return await client.refreshContext({
        actionLimit: 100,
        localDate,
        signalLimit: 100,
        timeZone: currentTimeZone(),
      });
    },
    refetchInterval: (query) => surfaceContextRefetchInterval(query.state.data),
    staleTime: 30 * 1000,
  });
}

function currentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function pendingActionItems(actions: ReadonlyArray<SurfaceActionItem>) {
  return actions.filter((action) => action.status === "proposed" || action.status === "accepted");
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

function agentRunText(run: SurfaceAgentRun) {
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

function followThroughText(action: SurfaceActionItem) {
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

function surfaceDisplayName(surface: AppSurface) {
  switch (surface) {
    case "desktop":
      return "Desktop";
    case "ios":
      return "iOS";
    case "raycast":
      return "Raycast";
    case "web":
      return "Web";
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

function NudgeConvexProvider(props: { readonly children: ReactNode }) {
  if (anonymousUiEnabled()) return <>{props.children}</>;
  if (!clerkPublishableKey) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Nudge");

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
  if (anonymousUiEnabled()) {
    setSessionTokenResolver(null);
    return <>{props.children}</>;
  }

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
