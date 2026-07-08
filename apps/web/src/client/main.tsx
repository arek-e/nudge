import { scan } from "react-scan";
import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  SignIn,
  useAuth,
  useUser,
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
import {
  type ReactNode,
  StrictMode,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type AppSurface,
  type SurfaceActionItem,
  type SurfaceAgentRun,
  type SurfaceRefreshContext,
  noteTextFromPayload,
  stickyNoteTitleFromText,
  todayLocalDate,
} from "@nudge/surface";
import {
  NoteComposerSurface,
  NoteFirstWorkspaceSurface,
  type NoteWorkspaceAskPanelContent,
  type NoteWorkspaceChatMessage,
  type NoteWorkspaceEditorContent,
  type NoteWorkspaceHeaderContent,
  type NoteWorkspaceItem,
  type NoteWorkspaceReviewRailContent,
  type NoteWorkspaceSourceItem,
  NudgeSidebarNavigationSurface,
  type NudgeSidebarNavigationItem,
  type NudgeSidebarNotificationItem,
  type NudgeSidebarTodayItem,
  NudgeWorkspaceShellSurface,
} from "@nudge/ui";
import { api } from "../../../../convex/_generated/api";
import {
  apiClient,
  createWebSurfaceEngineClient,
  setSessionTokenResolver,
  streamConversationMessage,
} from "./api-client";
import { DesktopSettingsSurface } from "./DesktopSettingsSurface";
import { restoreReactScanToolbarHitTargets } from "./react-scan-devtools";
import { initializeWebClientSentry } from "./sentry";
import { sidebarProfileDisplayName } from "./sidebar-profile";
import {
  anonymousUiEnabled,
  currentAppSurface,
  surfaceContextRefetchInterval,
} from "./surface-runtime";
import {
  createWorkspaceFrontendState,
  type CreateWorkspaceFrontendStateInput,
  type WorkspaceAgentState,
  type WorkspaceContextItem,
  workspaceFrontendStateReducer,
  type WorkspaceFrontendStateEvent,
  type WorkspaceNotificationItem,
  type WorkspaceNoteProjection,
} from "./workspace-state";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const reactScanEnabled =
  (import.meta.env.DEV && import.meta.env.VITE_NUDGE_REACT_SCAN !== "0") ||
  import.meta.env.VITE_NUDGE_REACT_SCAN === "1";
const reactGrabEnabled =
  (import.meta.env.DEV && import.meta.env.VITE_NUDGE_REACT_GRAB !== "0") ||
  import.meta.env.VITE_NUDGE_REACT_GRAB === "1";

scan({
  animationSpeed: "fast",
  enabled: reactScanEnabled,
  log: false,
  showToolbar: true,
});

if (reactScanEnabled) {
  restoreReactScanToolbarHitTargets();
}

if (reactGrabEnabled) {
  void import("react-grab");
}

initializeWebClientSentry();

const queryClient = new QueryClient();
const convexClient = anonymousUiEnabled() ? null : new ConvexReactClient(requiredConvexUrl());
const productionAppHostname = "app.explorenudge.com";
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
const raycastOAuthAuthorizePath = "/raycast/oauth/authorize";
const defaultDesktopQuickCaptureShortcut = "CommandOrControl+Shift+N";
const authCallbackRecoveryStorageKey = "nudge.authCallbackRecoveryUrl";

function requiredClerkPublishableKey() {
  const value = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (typeof value === "string" && value.startsWith("pk_")) {
    if (window.location.hostname === productionAppHostname && value.startsWith("pk_test_")) {
      throw new Error("Production Nudge cannot use a test Clerk publishable key");
    }
    return value;
  }
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Nudge");
}

function requiredConvexUrl() {
  const value = import.meta.env.VITE_CONVEX_URL;
  if (typeof value === "string" && value.startsWith("https://")) return value;

  throw new Error("VITE_CONVEX_URL is required to run Nudge");
}

function optionalEnvString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isAuthCallbackInfrastructurePath(pathname = window.location.pathname) {
  return pathname.startsWith("/__clerk/") || pathname === "/v1/oauth_callback";
}

function recoverStaleAuthCallbackNavigation() {
  if (!isAuthCallbackInfrastructurePath()) {
    clearAuthCallbackRecoveryUrl();
    return false;
  }

  const currentUrl = window.location.href;
  if (readAuthCallbackRecoveryUrl() === currentUrl) return false;
  writeAuthCallbackRecoveryUrl(currentUrl);

  document.body.innerHTML =
    '<main class="min-h-dvh bg-surface-inverse-canvas" aria-label="Finishing sign-in"></main>';

  const serviceWorkerCleanup =
    "serviceWorker" in navigator
      ? navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister())),
          )
      : Promise.resolve([]);
  const cacheCleanup =
    "caches" in window
      ? caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
      : Promise.resolve([]);

  void Promise.allSettled([serviceWorkerCleanup, cacheCleanup]).finally(() =>
    window.location.reload(),
  );
  return true;
}

function readAuthCallbackRecoveryUrl() {
  try {
    return window.sessionStorage.getItem(authCallbackRecoveryStorageKey);
  } catch {
    return null;
  }
}

function writeAuthCallbackRecoveryUrl(value: string) {
  try {
    window.sessionStorage.setItem(authCallbackRecoveryStorageKey, value);
  } catch {
    // Ignore storage failures; the reload still gives the network a chance to handle the callback.
  }
}

function clearAuthCallbackRecoveryUrl() {
  try {
    window.sessionStorage.removeItem(authCallbackRecoveryStorageKey);
  } catch {
    // Some embedded browsers can restrict storage on callback URLs.
  }
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
    return <main className="bg-surface-inverse-canvas min-h-dvh" aria-label="Loading Nudge" />;
  }

  const desktopTicket = desktopTicketFromLocation();
  if (desktopTicket && !auth.isSignedIn)
    return <DesktopTicketSignInScreen ticket={desktopTicket} />;

  if (isRaycastOAuthRequest()) {
    if (!auth.isSignedIn) return <ClerkSignInScreen forceRedirectUrl={window.location.href} />;
    return <RaycastOAuthBridge />;
  }

  if (isDesktopBrowserAuthRequest()) {
    if (!auth.isSignedIn) return <ClerkSignInScreen forceRedirectUrl={window.location.href} />;
    return <DesktopBrowserAuthBridge />;
  }

  if (!auth.isSignedIn) return isDesktopSurface() ? <DesktopSignInScreen /> : <ClerkSignInScreen />;
  return <AuthenticatedAppShell />;
}

function ClerkSignInScreen(props: { readonly forceRedirectUrl?: string }) {
  const redirectUrl = props.forceRedirectUrl ?? currentBrowserReturnUrl();
  return (
    <main className="bg-surface-inverse-canvas flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      {props.forceRedirectUrl ? (
        <SignIn
          routing="hash"
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
          signUpFallbackRedirectUrl={redirectUrl}
        />
      ) : (
        <SignIn routing="hash" fallbackRedirectUrl={redirectUrl} signUpFallbackRedirectUrl="/" />
      )}
    </main>
  );
}

function currentBrowserReturnUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}

function ClerkUnavailableScreen() {
  return (
    <main className="bg-surface-inverse-canvas text-content-inverse flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="bg-surface-inverse-panel grid w-full max-w-md gap-4 rounded-lg p-6 text-center shadow-[0_0_0_1px_var(--overlay-surface-8),0_16px_42px_var(--overlay-scrim-28)]">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Sign-in unavailable</h1>
        <p className="text-content-inverse-subtle m-0 text-sm leading-6">
          Nudge could not reach the authentication service. Check the Clerk production DNS setup and
          try again.
        </p>
        <button
          className="bg-surface-inverse-action text-content-inverse-bright min-h-12 rounded-lg px-4 text-sm font-semibold shadow-[0_10px_24px_var(--overlay-inverse-action-18)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
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
    <main className="bg-surface-inverse-canvas text-content-inverse flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="bg-surface-inverse-panel grid w-full max-w-md gap-5 rounded-lg p-6 shadow-[0_0_0_1px_var(--overlay-surface-8),0_16px_42px_var(--overlay-scrim-28)]">
        <div className="grid gap-2 text-center">
          <h1 className="m-0 text-2xl font-semibold tracking-normal">Sign in to Nudge</h1>
          <p className="text-content-inverse-subtle m-0 text-sm leading-6">
            We will open your default browser so you can use your existing Apple or Google login.
          </p>
        </div>
        <button
          className="bg-surface-inverse-action text-content-inverse-bright min-h-12 rounded-lg px-4 text-sm font-semibold shadow-[0_10px_24px_var(--overlay-inverse-action-18)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
          disabled={status === "opening"}
          type="button"
          onClick={openBrowserSignIn}
        >
          {status === "opening" ? "Opening browser..." : "Open browser"}
        </button>
        {status === "opened" ? (
          <p className="text-content-inverse-subtle m-0 text-center text-sm leading-6">
            Finish sign-in in your browser. Nudge will reopen automatically.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-status-danger-content m-0 text-center text-sm leading-6">
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
    <main className="bg-surface-inverse-canvas text-content-inverse flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="bg-surface-inverse-panel grid w-full max-w-md gap-3 rounded-lg p-6 text-center shadow-[0_0_0_1px_var(--overlay-surface-8),0_16px_42px_var(--overlay-scrim-28)]">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Opening Nudge</h1>
        <p className="text-content-inverse-subtle m-0 text-sm leading-6">
          {errorMessage ?? "Returning your signed-in session to the desktop app."}
        </p>
      </section>
    </main>
  );
}

function RaycastOAuthBridge() {
  const auth = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const connectRaycast = async () => {
      const request = raycastOAuthRequestFromLocation();
      if (!request) {
        if (!cancelled) setErrorMessage("The Raycast authorization request is invalid.");
        return;
      }

      try {
        const token = await auth.getToken();
        if (!token) throw new Error("Signed-in Nudge session was unavailable.");

        const response = await fetch("/api/auth/raycast-code", {
          body: JSON.stringify(request),
          credentials: "same-origin",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          method: "POST",
        });
        if (!response.ok) throw new Error("Could not create a Raycast authorization code");

        const payload = await response.json().catch(() => null);
        const code = stringProperty(payload, "code");
        if (!code) throw new Error("Raycast authorization response was invalid");

        const redirectUrl = new URL(request.redirectUri);
        redirectUrl.searchParams.set("code", code);
        if (request.state) redirectUrl.searchParams.set("state", request.state);
        window.location.href = redirectUrl.toString();
      } catch (error) {
        if (!cancelled) setErrorMessage(errorMessageFrom(error, "Raycast sign-in failed."));
      }
    };

    void connectRaycast();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return (
    <main className="bg-surface-inverse-canvas text-content-inverse flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="bg-surface-inverse-panel grid w-full max-w-md gap-3 rounded-lg p-6 text-center shadow-[0_0_0_1px_var(--overlay-surface-8),0_16px_42px_var(--overlay-scrim-28)]">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Opening Raycast</h1>
        <p className="text-content-inverse-subtle m-0 text-sm leading-6">
          {errorMessage ?? "Returning your signed-in session to Raycast."}
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
    <main className="bg-surface-inverse-canvas text-content-inverse flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="bg-surface-inverse-panel grid w-full max-w-md gap-3 rounded-lg p-6 text-center shadow-[0_0_0_1px_var(--overlay-surface-8),0_16px_42px_var(--overlay-scrim-28)]">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Signing in</h1>
        <p className="text-content-inverse-subtle m-0 text-sm leading-6">
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

function isRaycastOAuthRequest() {
  return new URL(window.location.href).pathname === raycastOAuthAuthorizePath;
}

function raycastOAuthRequestFromLocation() {
  const url = new URL(window.location.href);
  if (url.pathname !== raycastOAuthAuthorizePath) return null;

  const clientId = requiredSearchParam(url, "client_id");
  const codeChallenge = requiredSearchParam(url, "code_challenge");
  const redirectUri = requiredSearchParam(url, "redirect_uri");
  const scope = requiredSearchParam(url, "scope");
  if (!clientId || !codeChallenge || !redirectUri || !scope) return null;

  return {
    clientId,
    codeChallenge,
    redirectUri,
    scope,
    ...(url.searchParams.get("state") ? { state: url.searchParams.get("state") ?? "" } : {}),
  };
}

function requiredSearchParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value && value.length > 0 ? value : null;
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
  if (!session.data && !anonymousUiEnabled()) {
    return <main className="bg-surface-inverse-canvas min-h-dvh" aria-label="Loading Nudge" />;
  }
  if (!anonymousUiEnabled() && session.data?.authMode !== "clerk") {
    return <BackendSessionUnavailableScreen />;
  }

  return (
    <>
      <Outlet />
      <DesktopUpdateToast />
    </>
  );
}

function BackendSessionUnavailableScreen() {
  return (
    <main className="bg-surface-inverse-canvas text-content-inverse flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <section className="bg-surface-inverse-panel grid w-full max-w-md gap-4 rounded-lg p-6 text-center shadow-[0_0_0_1px_var(--overlay-surface-8),0_16px_42px_var(--overlay-scrim-28)]">
        <h1 className="m-0 text-2xl font-semibold tracking-normal">Session unavailable</h1>
        <p className="text-content-inverse-subtle m-0 text-sm leading-6">
          Nudge could not verify your signed-in session. Check the local Clerk secret and reload.
        </p>
        <button
          className="bg-surface-inverse-action text-content-inverse-bright min-h-12 rounded-lg px-4 text-sm font-semibold shadow-[0_10px_24px_var(--overlay-inverse-action-18)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
          type="button"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </section>
    </main>
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
      className="bg-surface-inverse-panel text-content-inverse fixed right-4 bottom-4 z-50 grid w-[calc(100%-2rem)] max-w-sm gap-3 rounded-lg p-4 shadow-[0_0_0_1px_var(--overlay-surface-8),0_18px_52px_var(--overlay-scrim-32)]"
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold">{desktopUpdateTitle(state)}</p>
          <p className="text-content-inverse-subtle m-0 mt-1 text-sm leading-5">{detail}</p>
        </div>
        <span
          className={`mt-1 size-2.5 shrink-0 rounded-full ${desktopUpdateIndicatorClassName(
            state.status,
          )}`}
          aria-hidden="true"
        />
      </div>
      {state.status === "downloading" ? (
        <div className="bg-surface-progress-track h-1.5 overflow-hidden rounded-full">
          <div className="bg-accent-vivid h-full rounded-full" style={{ width: progressWidth }} />
        </div>
      ) : null}
      {action ? (
        <button
          className="bg-surface-inverse-action text-content-inverse-bright min-h-10 rounded-lg px-3 text-sm font-semibold shadow-[0_10px_24px_var(--overlay-inverse-action-18)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-60"
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
  if (status === "downloaded") return "bg-status-downloaded";
  if (status === "error") return "bg-status-danger";
  if (status === "downloading") return "bg-accent-vivid";
  return "bg-status-info";
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
  const [reviewRailOpen, setReviewRailOpen] = useState(true);
  const signedInAs =
    surfaceContext.data?.session.user?.displayName ?? session.data?.user?.displayName ?? "You";
  const profileStatus = session.data?.workspace?.label ?? "Workspace";
  const pendingActions = pendingActionItems(surfaceContext.data?.actions.actions ?? []);
  const latestRun = surfaceContext.data?.actions.latestRun;
  const statusMessage = surfaceContext.isLoading
    ? "Updating context"
    : latestRun
      ? agentRunText(latestRun)
      : "Connected";
  const notes = notesFromSurfaceContext(surfaceContext.data);
  const signalCount = surfaceContext.data?.signals.length ?? 0;
  const workspaceProjection = useMemo(
    () =>
      workspaceFrontendProjection({
        context: surfaceContext.data,
        localDate,
        note: notes[0],
        pendingActions,
      }),
    [localDate, surfaceContext.data],
  );
  const [workspaceState, dispatchWorkspaceState] = useReducer(
    workspaceFrontendStateReducer,
    workspaceProjection,
    createWorkspaceFrontendState,
  );
  useEffect(() => {
    dispatchWorkspaceState({
      input: workspaceProjection,
      type: "workspaceProjectionRefreshed",
    });
  }, [workspaceProjection]);
  const headerContent = noteWorkspaceHeaderContent(statusMessage, {
    onAsk: () =>
      dispatchWorkspaceState({
        command: {
          id: `command:open-agent:${Date.now()}`,
          kind: "openPanel",
          label: "Open agent panel",
          status: "applied",
          target: "agent",
        },
        type: "agentCommandApplied",
      }),
    onRefresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["surface-context", localDate] });
    },
  });
  const editorContent = noteWorkspaceEditorContent(workspaceState, dispatchWorkspaceState);

  return (
    <NoteFirstWorkspaceSurface
      askPanel={noteWorkspaceAskPanelContent(workspaceState.agent)}
      composerSlot={
        <WorkspaceAskComposerDock agent={workspaceState.agent} dispatch={dispatchWorkspaceState} />
      }
      editor={editorContent}
      header={headerContent}
      navigationSlot={
        <MainSidebarNavigation
          active="overview"
          activeTodayFilter={workspaceState.navigation.activeTodayFilter}
          inboxCount={signalCount}
          notificationItems={sidebarNotificationItems({
            dispatch: dispatchWorkspaceState,
            items: workspaceState.notifications.items,
            onNavigate: navigate,
          })}
          notificationTrayOpen={workspaceState.notifications.open}
          pendingActionCount={pendingActions.length}
          profileStatus={profileStatus}
          signedInAs={signedInAs}
          sourceUpdateCount={signalCount}
          statusMessage={statusMessage}
          onNotificationTrayToggle={() =>
            dispatchWorkspaceState({
              type: workspaceState.notifications.open
                ? "notificationTrayClosed"
                : "notificationTrayOpened",
            })
          }
          onNavigate={navigate}
          onTodayFilterSelect={(filter) =>
            dispatchWorkspaceState({ filter, type: "todayFilterSelected" })
          }
        />
      }
      notes={notes}
      notesList={noteWorkspaceNotesListContent(localDate)}
      reviewRail={noteWorkspaceReviewRailContent({
        context: surfaceContext.data,
        onClose: () => setReviewRailOpen(false),
        pendingActions,
        statusMessage,
      })}
      reviewRailOpen={reviewRailOpen}
      reviewSlot={
        <NotesActionReviewPanel context={surfaceContext.data} loading={surfaceContext.isLoading} />
      }
      sidebarCollapsed={workspaceState.shell.sidebarCollapsed}
      signedInAs={signedInAs}
      statusMessage={statusMessage}
      onSidebarCollapsedChange={(collapsed) =>
        dispatchWorkspaceState({ collapsed, type: "sidebarCollapsedChanged" })
      }
      utilitySlot={
        <MobileNoteWorkspaceUtilities
          pendingActionCount={pendingActions.length}
          onNavigate={navigate}
        />
      }
    />
  );
}

function MobileNoteWorkspaceUtilities(props: {
  readonly pendingActionCount: number;
  readonly onNavigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {props.pendingActionCount > 0 ? (
        <button
          className="bg-surface-inverse-action text-content-inverse-bright min-h-10 rounded-lg px-3 text-sm font-semibold shadow-[0_10px_24px_var(--overlay-inverse-action-18)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
          type="button"
          onClick={() => props.onNavigate({ to: "/review" })}
        >
          {props.pendingActionCount} to review
        </button>
      ) : null}
      {anonymousUiEnabled() ? <AnonymousSessionPill /> : null}
    </div>
  );
}

function WorkspaceRouteShell(props: {
  readonly active: NudgeSidebarNavigationItem["key"];
  readonly children: ReactNode;
  readonly title: string;
  readonly leadingSlot?: ReactNode;
  readonly searchPlaceholder?: string;
  readonly trailingSlot?: ReactNode;
}) {
  const navigate = useNavigate();
  const session = useSession();
  const localDate = todayLocalDate();
  const surfaceContext = useSurfaceContext(localDate);
  const signedInAs =
    surfaceContext.data?.session.user?.displayName ?? session.data?.user?.displayName ?? "You";
  const profileStatus = session.data?.workspace?.label ?? "Workspace";
  const pendingActions = pendingActionItems(surfaceContext.data?.actions.actions ?? []);
  const latestRun = surfaceContext.data?.actions.latestRun;
  const statusMessage = surfaceContext.isLoading
    ? "Updating context"
    : latestRun
      ? agentRunText(latestRun)
      : "Connected";
  const signalCount = surfaceContext.data?.signals.length ?? 0;
  const header = {
    ...noteWorkspaceHeaderContent(statusMessage, {
      onAsk: () => navigate({ to: "/ask" }),
      onRefresh: () => {
        void queryClient.invalidateQueries({ queryKey: ["surface-context", localDate] });
      },
    }),
    ...(props.searchPlaceholder ? { searchPlaceholder: props.searchPlaceholder } : {}),
    title: props.title,
  } satisfies NoteWorkspaceHeaderContent;

  return (
    <NudgeWorkspaceShellSurface
      contentClassName="min-h-0 overflow-y-auto px-4 pb-4 lg:px-3 lg:pb-3"
      header={header}
      {...(props.leadingSlot !== undefined ? { leadingSlot: props.leadingSlot } : {})}
      navigationSlot={
        <MainSidebarNavigation
          active={props.active}
          inboxCount={signalCount}
          pendingActionCount={pendingActions.length}
          profileStatus={profileStatus}
          signedInAs={signedInAs}
          sourceUpdateCount={signalCount}
          statusMessage={statusMessage}
          onNavigate={navigate}
        />
      }
      signedInAs={signedInAs}
      statusMessage={statusMessage}
      {...(props.trailingSlot !== undefined ? { trailingSlot: props.trailingSlot } : {})}
      utilitySlot={
        <MobileNoteWorkspaceUtilities
          pendingActionCount={pendingActions.length}
          onNavigate={navigate}
        />
      }
    >
      {props.children}
    </NudgeWorkspaceShellSurface>
  );
}

function noteWorkspaceHeaderContent(
  statusMessage: string,
  actions: {
    readonly onAsk?: () => void;
    readonly onRefresh?: () => void;
  } = {},
): NoteWorkspaceHeaderContent {
  return {
    askLabel: "Ask Nudge",
    refreshLabel: "Refresh workspace",
    searchPlaceholder: "Search notes...",
    searchShortcut: "⌘ K",
    statusMessage,
    title: "Notes",
    ...actions,
  };
}

function noteWorkspaceNotesListContent(localDate: string) {
  return {
    emptyBody: "Capture a note and Nudge will turn each paragraph into reviewable context.",
    emptyTitle: "No notes captured.",
    filterLabel: formatLocalDateLabel(localDate),
    title: "Notes",
    viewLabel: "Notes view",
  };
}

type WorkspaceFrontendDispatch = (event: WorkspaceFrontendStateEvent) => void;

function workspaceFrontendProjection(input: {
  readonly context: SurfaceRefreshContext | undefined;
  readonly localDate: string;
  readonly note: NoteWorkspaceItem | undefined;
  readonly pendingActions: ReadonlyArray<SurfaceActionItem>;
}): CreateWorkspaceFrontendStateInput {
  const note = noteProjectionFromWorkspaceItem(input.note, input.localDate);
  return {
    contextItems: workspaceContextItems({
      context: input.context,
      note,
    }),
    localDate: input.localDate,
    note,
    notifications: workspaceNotifications({
      context: input.context,
      pendingActions: input.pendingActions,
    }),
  };
}

function noteProjectionFromWorkspaceItem(
  note: NoteWorkspaceItem | undefined,
  localDate: string,
): WorkspaceNoteProjection {
  return {
    bodyText: note?.bodyText ?? "",
    id: note?.id ?? `daily-note:${localDate}`,
    revision: note?.id ?? `local:${localDate}`,
    title: note?.title ?? "Today's note",
  };
}

function workspaceContextItems(input: {
  readonly context: SurfaceRefreshContext | undefined;
  readonly note: WorkspaceNoteProjection;
}): ReadonlyArray<WorkspaceContextItem> {
  const items: WorkspaceContextItem[] = [
    {
      domain: "note",
      id: input.note.id,
      label: input.note.title,
      selected: true,
    },
  ];
  for (const signal of input.context?.signals.slice(0, 6) ?? []) {
    items.push({
      domain: "source",
      id: `source:${signal.id}`,
      label: labelFromIdentifier(signal.source),
      selected: false,
    });
  }
  return items;
}

function workspaceNotifications(input: {
  readonly context: SurfaceRefreshContext | undefined;
  readonly pendingActions: ReadonlyArray<SurfaceActionItem>;
}): ReadonlyArray<WorkspaceNotificationItem> {
  const reviewNotifications: WorkspaceNotificationItem[] = input.pendingActions
    .slice(0, 4)
    .map((action) => ({
      body: action.dueAt
        ? `Due ${formatShortDateTime(action.dueAt)}`
        : labelFromIdentifier(action.kind),
      domain: "review",
      id: `review:${action.id}`,
      title: action.title,
    }));
  const sourceNotifications: WorkspaceNotificationItem[] =
    input.context?.signals.slice(0, 4).map((signal) => ({
      body: formatShortDateTime(signal.occurredAt),
      domain: "source",
      id: `source:${signal.id}`,
      title: `${labelFromIdentifier(signal.source)} updated`,
    })) ?? [];
  return [...reviewNotifications, ...sourceNotifications];
}

function noteWorkspaceAskPanelContent(agent: WorkspaceAgentState): NoteWorkspaceAskPanelContent {
  return {
    assistantInitial: "N",
    assistantName: "Nudge",
    header: {
      ariaLabel: "Ask Nudge",
      closeLabel: "Close Ask Nudge",
      expandLabel: "Expand Ask Nudge",
      showClose: true,
      showExpand: true,
      title: "Ask Nudge",
    },
    messages: agent.messages.map(agentMessageToWorkspaceMessage),
    prompt: "",
    responseBullets: [],
    responseIntro: "",
    sources: [],
    userLabel: "You",
  };
}

function agentMessageToWorkspaceMessage(
  message: WorkspaceAgentState["messages"][number],
): NoteWorkspaceChatMessage {
  return {
    body: message.body,
    ...(message.commands
      ? {
          commands: message.commands.map((command) => ({
            id: command.id,
            label: command.label,
            status: command.status,
          })),
        }
      : {}),
    id: message.id,
    ...(message.kind ? { kind: message.kind } : {}),
    label: message.role === "assistant" ? "Nudge" : "You",
    role: message.role,
  };
}

function noteWorkspaceEditorContent(
  state: ReturnType<typeof createWorkspaceFrontendState>,
  dispatch: WorkspaceFrontendDispatch,
): NoteWorkspaceEditorContent {
  const activeTab = state.note.tabs.find((tab) => tab.id === state.note.activeTabId);
  const title = activeTab?.title ?? "Today's note";
  return {
    bodyText: state.note.draftBodyText,
    editorLabel: "Today's note editor",
    editorPlaceholder: "Start today's note...",
    fallbackTitle: "Today's note",
    pageOpen: state.note.pageOpen,
    saveStatus: state.note.saveStatus,
    tabs: state.note.tabs.map((tab) => {
      const active = tab.id === state.note.activeTabId;
      return {
        active,
        id: tab.id,
        title: tab.title,
        titleEditable: active,
        onClose: () => dispatch({ tabId: tab.id, type: "noteTabClosed" }),
        onSelect: () => dispatch({ tabId: tab.id, type: "noteTabSelected" }),
        ...(active
          ? {
              saveStatus: tab.saveStatus,
              onTitleChange: (nextTitle: string) =>
                dispatch({ title: nextTitle, type: "noteTitleChanged" }),
              onTitleDirty: () => dispatch({ type: "noteTitleEditingStarted" }),
            }
          : {}),
      };
    }),
    title,
    titleEditable: true,
    onAddTab: () =>
      dispatch({
        tab: {
          bodyText: "",
          dirty: false,
          id: `local-note:${crypto.randomUUID()}`,
          revision: "local",
          saveStatus: "Saved",
          title: "Untitled note",
        },
        type: "noteTabAdded",
      }),
    onBodyTextChange: (bodyText) => dispatch({ bodyText, type: "noteDraftChanged" }),
    onBodyTextDirty: () => dispatch({ type: "noteDraftEditingStarted" }),
    onClose: () => dispatch({ tabId: state.note.activeTabId, type: "noteTabClosed" }),
    onTitleChange: (nextTitle) => dispatch({ title: nextTitle, type: "noteTitleChanged" }),
    onTitleDirty: () => dispatch({ type: "noteTitleEditingStarted" }),
  };
}

function noteWorkspaceReviewRailContent(input: {
  readonly context: SurfaceRefreshContext | undefined;
  readonly onClose?: () => void;
  readonly pendingActions: ReadonlyArray<SurfaceActionItem>;
  readonly statusMessage: string;
}): NoteWorkspaceReviewRailContent {
  return {
    collapseLabel: "Collapse AI review",
    followUps: input.pendingActions.slice(0, 4).map(followUpFromAction),
    followUpTitle: "Follow up",
    sources: sourcesFromSurfaceContext(input.context),
    sourcesTitle: "Sources",
    summary:
      input.pendingActions.length > 0
        ? `${countLabel(input.pendingActions.length, "item", "items")} need review.`
        : "No follow ups need review.",
    summaryTitle: "Summary",
    title: "AI Review",
    ...(input.onClose ? { onClose: input.onClose } : {}),
  };
}

type MainSidebarNavigationProps = {
  readonly active: NudgeSidebarNavigationItem["key"];
  readonly activeTodayFilter?: "all" | "review" | "sources";
  readonly inboxCount: number;
  readonly notificationItems?: ReadonlyArray<NudgeSidebarNotificationItem>;
  readonly notificationTrayOpen?: boolean;
  readonly pendingActionCount: number;
  readonly profileStatus: string;
  readonly signedInAs: string;
  readonly sourceUpdateCount: number;
  readonly statusMessage: string;
  readonly onNotificationTrayToggle?: () => void;
  readonly onNavigate: ReturnType<typeof useNavigate>;
  readonly onTodayFilterSelect?: (filter: "all" | "review" | "sources") => void;
};

function MainSidebarNavigation(props: MainSidebarNavigationProps) {
  if (anonymousUiEnabled()) return <MainSidebarNavigationSurface {...props} />;
  return <AuthenticatedMainSidebarNavigation {...props} />;
}

function AuthenticatedMainSidebarNavigation(props: MainSidebarNavigationProps) {
  const clerkUser = useUser();
  const profileAvatarSrc = clerkUser.user?.imageUrl;
  const profileDisplayName = sidebarProfileDisplayName(clerkUser.user, props.signedInAs);
  const profileAvatarAlt = `${profileDisplayName} profile photo`;
  return (
    <MainSidebarNavigationSurface
      {...props}
      signedInAs={profileDisplayName}
      {...(profileAvatarSrc ? { profileAvatarAlt, profileAvatarSrc } : {})}
    />
  );
}

function MainSidebarNavigationSurface(
  props: MainSidebarNavigationProps & {
    readonly profileAvatarAlt?: string;
    readonly profileAvatarSrc?: string;
  },
) {
  const items: ReadonlyArray<NudgeSidebarNavigationItem> = [
    {
      group: "Workspace",
      key: "inbox",
      label: "Inbox",
      onSelect: () => props.onNavigate({ to: "/" }),
      ...(props.inboxCount > 0 ? { badge: props.inboxCount } : {}),
    },
    {
      active: props.active === "overview",
      group: "Workspace",
      key: "overview",
      label: "Notes",
      onSelect: () => props.onNavigate({ to: "/" }),
    },
    {
      active: props.active === "review",
      group: "Workspace",
      key: "review",
      label: "Review",
      onSelect: () => props.onNavigate({ to: "/review" }),
      ...(props.pendingActionCount > 0 ? { badge: props.pendingActionCount } : {}),
    },
    {
      active: props.active === "capture",
      group: "Workspace",
      key: "capture",
      label: "Capture",
      onSelect: () => props.onNavigate({ to: "/quick-capture" }),
    },
  ];

  return (
    <NudgeSidebarNavigationSurface
      items={items}
      logoSrc={logoLongSrc}
      showAppName={false}
      notificationActive={props.pendingActionCount > 0 || props.sourceUpdateCount > 0}
      {...(props.notificationItems !== undefined
        ? { notificationItems: props.notificationItems }
        : {})}
      {...(props.notificationTrayOpen !== undefined
        ? { notificationTrayOpen: props.notificationTrayOpen }
        : {})}
      {...(props.onNotificationTrayToggle !== undefined
        ? { onNotificationTrayToggle: props.onNotificationTrayToggle }
        : {})}
      profile={{
        name: props.signedInAs,
        status: props.profileStatus,
        ...(props.profileAvatarSrc
          ? {
              avatarAlt: props.profileAvatarAlt ?? `${props.signedInAs} profile photo`,
              avatarSrc: props.profileAvatarSrc,
            }
          : {}),
      }}
      profileActions={[
        {
          description: "Account, workspace, and desktop preferences",
          id: "settings",
          label: "Settings",
          onSelect: () => props.onNavigate({ to: "/settings" }),
        },
      ]}
      profileMenuDescription={props.profileStatus}
      profileMenuTitle="User settings"
      signedInAs={props.signedInAs}
      statusMessage={props.statusMessage}
      todayItems={sidebarTodayItems({
        activeTodayFilter: props.activeTodayFilter ?? "all",
        pendingActionCount: props.pendingActionCount,
        sourceUpdateCount: props.sourceUpdateCount,
        ...(props.onTodayFilterSelect !== undefined
          ? { onTodayFilterSelect: props.onTodayFilterSelect }
          : {}),
      })}
    />
  );
}

function followUpFromAction(action: SurfaceActionItem) {
  return {
    id: action.id,
    label: action.title,
    meta: action.dueAt
      ? `Due ${formatShortDateTime(action.dueAt)}`
      : labelFromIdentifier(action.kind),
    urgent: action.status === "proposed",
    urgentLabel: action.dueAt ? "Due" : "Review",
  };
}

function sourcesFromSurfaceContext(
  context: SurfaceRefreshContext | undefined,
): ReadonlyArray<NoteWorkspaceSourceItem> {
  return (
    context?.signals.slice(0, 4).map((signal) => ({
      id: signal.id,
      label: labelFromIdentifier(signal.source),
      meta: formatShortDateTime(signal.occurredAt),
      tone: "blue",
    })) ?? []
  );
}

function sidebarNotificationItems(input: {
  readonly dispatch: WorkspaceFrontendDispatch;
  readonly items: ReadonlyArray<WorkspaceNotificationItem>;
  readonly onNavigate: ReturnType<typeof useNavigate>;
}): ReadonlyArray<NudgeSidebarNotificationItem> {
  return input.items.map((item) => ({
    body: item.body,
    id: item.id,
    onSelect: () => {
      input.dispatch({ notificationId: item.id, type: "notificationSelected" });
      if (item.domain === "review") {
        input.onNavigate({ to: "/review" });
        return;
      }
      if (item.domain === "source") {
        input.dispatch({ filter: "sources", type: "todayFilterSelected" });
      }
    },
    title: item.title,
    tone: item.domain === "review" ? "orange" : "blue",
  }));
}

function sidebarTodayItems(input: {
  readonly activeTodayFilter: "all" | "review" | "sources";
  readonly onTodayFilterSelect?: (filter: "all" | "review" | "sources") => void;
  readonly pendingActionCount: number;
  readonly sourceUpdateCount: number;
}): ReadonlyArray<NudgeSidebarTodayItem> {
  return [
    {
      active: input.activeTodayFilter === "review",
      id: "follow-ups",
      label:
        input.pendingActionCount > 0
          ? countLabel(input.pendingActionCount, "follow up", "follow ups")
          : "No follow ups",
      onSelect: () => input.onTodayFilterSelect?.("review"),
      tone: "orange",
    },
    {
      active: input.activeTodayFilter === "sources",
      id: "sources",
      label:
        input.sourceUpdateCount > 0
          ? `${countLabel(input.sourceUpdateCount, "source", "sources")} updated`
          : "No sources updated",
      onSelect: () => input.onTodayFilterSelect?.("sources"),
      tone: "blue",
    },
  ];
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatLocalDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

const agentModelOptions = [
  { id: "nudge-5.5", label: "5.5" },
  { id: "nudge-5.5-thinking", label: "5.5 thinking" },
] satisfies ReadonlyArray<{
  readonly id: string;
  readonly label: string;
}>;

function WorkspaceAskComposerDock(props: {
  readonly agent: WorkspaceAgentState;
  readonly dispatch: WorkspaceFrontendDispatch;
}) {
  return (
    <div className="grid gap-2">
      <WorkspaceAgentContextPanel agent={props.agent} dispatch={props.dispatch} />
      <WorkspaceAgentModelPanel agent={props.agent} dispatch={props.dispatch} />
      <WorkspaceAskComposer agent={props.agent} dispatch={props.dispatch} />
    </div>
  );
}

function WorkspaceAgentContextPanel(props: {
  readonly agent: WorkspaceAgentState;
  readonly dispatch: WorkspaceFrontendDispatch;
}) {
  if (!props.agent.contextWindowOpen) return null;
  const selectedCount = props.agent.contextItems.filter((item) => item.selected).length;
  return (
    <section
      className="bg-surface-base/68 rounded-2xl p-3 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]"
      data-testid="context-window"
      aria-label="Agent context window"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
            Context
          </p>
          <p className="text-content-primary m-0 mt-1 text-sm font-medium">
            {selectedCount} selected for this ask
          </p>
        </div>
        <button
          className="text-content-muted hover:bg-content-primary/6 grid size-8 place-items-center rounded-lg transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
          type="button"
          onClick={() => props.dispatch({ type: "agentContextWindowClosed" })}
          aria-label="Close context window"
        >
          x
        </button>
      </div>
      <div className="mt-3 grid gap-1.5">
        {props.agent.contextItems.map((item) => (
          <button
            aria-pressed={item.selected}
            className={`flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-[scale,background-color] duration-150 ease-out active:scale-[0.98] ${
              item.selected
                ? "bg-surface-base/78 text-content-primary"
                : "text-content-muted hover:bg-surface-base/46"
            }`}
            key={item.id}
            type="button"
            onClick={() => props.dispatch({ itemId: item.id, type: "agentContextItemToggled" })}
          >
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 text-xs font-medium">{labelFromIdentifier(item.domain)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WorkspaceAgentModelPanel(props: {
  readonly agent: WorkspaceAgentState;
  readonly dispatch: WorkspaceFrontendDispatch;
}) {
  if (!props.agent.modelPickerOpen) return null;
  return (
    <section
      className="bg-surface-base/68 rounded-2xl p-3 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]"
      data-testid="model-picker"
      aria-label="Agent model picker"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
          Model
        </p>
        <button
          className="text-content-muted text-xs font-semibold"
          type="button"
          onClick={() => props.dispatch({ type: "agentModelPickerClosed" })}
        >
          Close
        </button>
      </div>
      <div className="mt-2 grid gap-1">
        {agentModelOptions.map((model) => (
          <button
            aria-pressed={props.agent.selectedModel === model.id}
            className={`min-h-10 rounded-lg px-3 text-left text-sm font-semibold transition-[scale,background-color] duration-150 ease-out active:scale-[0.98] ${
              props.agent.selectedModel === model.id
                ? "bg-surface-base/78 text-content-primary"
                : "text-content-muted hover:bg-surface-base/46"
            }`}
            key={model.id}
            type="button"
            onClick={() => props.dispatch({ model: model.id, type: "agentModelSelected" })}
          >
            {model.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function agentModelDisplayName(model: string) {
  const option = agentModelOptions.find((item) => item.id === model);
  return option?.label ?? model;
}

function WorkspaceAskComposer(props: {
  readonly agent: WorkspaceAgentState;
  readonly dispatch: WorkspaceFrontendDispatch;
}) {
  const sending = props.agent.sending;
  const [draftMessage, setDraftMessage] = useState("");

  const submitMessage = async () => {
    const value = draftMessage.trim();
    if (!value || sending) return;

    props.dispatch({ type: "agentSendStarted" });
    props.dispatch({
      body: value,
      messageId: `message:user:${crypto.randomUUID()}`,
      type: "agentUserMessageQueued",
    });
    setDraftMessage("");
    try {
      const stream = await streamConversationMessage({
        conversationId: "default",
        message: value,
      });
      const replyText = (await new Response(stream.body).text()).trim();
      props.dispatch({
        body: replyText || "Nudge completed the run without a text reply.",
        messageId: `message:assistant:${crypto.randomUUID()}`,
        type: "agentAssistantMessageReceived",
      });
      await queryClient.invalidateQueries({ queryKey: ["surface-context"] });
    } catch (error) {
      props.dispatch({
        message: errorMessageFrom(error, "Ask failed."),
        messageId: `message:error:${crypto.randomUUID()}`,
        type: "agentSendFailed",
      });
    }
  };

  return (
    <NoteComposerSurface
      addContextLabel="Add context"
      bodyText={draftMessage}
      color="yellow"
      contextWindowLabel="Context window"
      disabled={sending}
      modelPickerLabel="Select AI model"
      modelValue={agentModelDisplayName(props.agent.selectedModel)}
      placeholder={sending ? "Nudge is thinking..." : "Ask for follow-up changes"}
      statusMessage={props.agent.statusMessage}
      submitLabel={sending ? "Asking Nudge" : "Send Ask Nudge message"}
      variant="chat"
      voiceInputLabel="Start voice input"
      onAddContext={() => props.dispatch({ type: "agentContextWindowOpened" })}
      onBodyTextChange={setDraftMessage}
      onChange={() => {}}
      onOpenContextWindow={() => props.dispatch({ type: "agentContextWindowOpened" })}
      onOpenModelPicker={() => props.dispatch({ type: "agentModelPickerOpened" })}
      onSubmit={() => {
        void submitMessage();
      }}
      onVoiceInput={() => props.dispatch({ state: "unavailable", type: "agentVoiceStateChanged" })}
    />
  );
}

function notesFromSurfaceContext(
  context: SurfaceRefreshContext | undefined,
): ReadonlyArray<NoteWorkspaceItem> {
  const notes: NoteWorkspaceItem[] = [];
  const signals = context?.signals ?? [];
  for (const signal of signals) {
    const bodyText = noteTextFromPayload(signal.payload).trim();
    if (!bodyText) continue;
    notes.push({
      bodyText,
      id: signal.id,
      metaText: noteMetaText(signal.occurredAt, signal.source),
      title: stickyNoteTitleFromText(bodyText),
    });
  }

  const journalText = context?.journal?.bodyText.trim();
  if (notes.length === 0 && journalText) {
    notes.push({
      bodyText: journalText,
      id: context?.journal?.id ?? "journal-note",
      metaText: context?.journal?.localDate ?? "Today",
      title: stickyNoteTitleFromText(journalText),
    });
  }

  return notes.slice(0, 12);
}

function noteMetaText(occurredAt: string, source: string) {
  return `${formatShortDateTime(occurredAt)} · ${labelFromIdentifier(source)}`;
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString([], {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function labelFromIdentifier(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function AnonymousSessionPill() {
  return (
    <div className="bg-surface-success-dark text-status-success-bright flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--overlay-success-18)]">
      Local
    </div>
  );
}

function NotesActionReviewPanel(props: {
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
    <section className="grid gap-3">
      <p className="text-content-note-muted m-0 text-sm leading-6 text-pretty">
        {latestRun
          ? agentRunText(latestRun)
          : props.loading
            ? "Loading review queue."
            : "Nudge is watching for useful follow-through."}
      </p>
      {pendingActions.length > 0 ? (
        pendingActions.map((action) => (
          <NoteReviewActionCard
            action={action}
            disabled={updateStatus.isPending}
            key={action.id}
            onAccept={() => updateStatus.mutate({ itemId: action.id, status: "accepted" })}
            onComplete={() => updateStatus.mutate({ itemId: action.id, status: "completed" })}
            onDismiss={() => updateStatus.mutate({ itemId: action.id, status: "dismissed" })}
          />
        ))
      ) : (
        <section className="bg-surface-base/72 rounded-lg p-4 shadow-[0_10px_26px_var(--overlay-ink-7),inset_0_0_0_1px_var(--overlay-ink-6)]">
          <p className="text-content-primary m-0 text-sm font-semibold">No suggestions waiting.</p>
          <p className="text-content-muted m-0 mt-2 text-sm leading-6 text-pretty">
            Add notes with commitments, reminders, or follow-ups. Suggested actions will appear here
            for approval.
          </p>
        </section>
      )}
    </section>
  );
}

function NoteReviewActionCard(props: {
  readonly action: SurfaceActionItem;
  readonly disabled: boolean;
  readonly onAccept: () => void;
  readonly onComplete: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <article className="bg-surface-base/72 rounded-lg p-4 shadow-[0_10px_26px_var(--overlay-ink-7),inset_0_0_0_1px_var(--overlay-ink-6)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
            {labelFromIdentifier(props.action.kind)} · {props.action.status}
          </p>
          <h3 className="text-content-primary m-0 mt-1 text-base font-semibold text-balance">
            {props.action.title}
          </h3>
        </div>
        <p className="bg-surface-success text-status-success-content m-0 rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums">
          {Math.round(props.action.confidence * 100)}%
        </p>
      </div>
      <p className="text-content-body m-0 mt-3 text-sm leading-6 text-pretty">
        {props.action.body}
      </p>
      <p className="bg-surface-warm text-content-muted m-0 mt-3 rounded-lg px-3 py-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--overlay-ink-6)]">
        {followThroughText(props.action)}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="bg-accent-primary text-content-on-strong min-h-10 rounded-lg px-2 text-xs font-semibold transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onAccept}
        >
          Accept
        </button>
        <button
          className="bg-surface-base text-content-primary min-h-10 rounded-lg px-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--overlay-ink-10)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onComplete}
        >
          Done
        </button>
        <button
          className="bg-surface-base text-content-primary min-h-10 rounded-lg px-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--overlay-ink-10)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onDismiss}
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

type ReviewInboxResponse = Awaited<ReturnType<typeof apiClient.reviewInbox.list>>;
type ReviewInboxItem = ReviewInboxResponse["items"][number];
type AgentReceipt = ReviewInboxResponse["receipts"][number];

function AskScreen() {
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
    <WorkspaceRouteShell active="ask" title="Ask Nudge">
      <section className="mx-auto grid h-full max-w-4xl grid-rows-[minmax(0,1fr)_auto] gap-3">
        <article className="bg-surface-base/64 min-h-0 overflow-y-auto rounded-xl p-6 shadow-[0_22px_64px_var(--overlay-ink-10),inset_0_0_0_1px_var(--overlay-ink-7)] backdrop-blur-xl">
          <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
            Agent chat
          </p>
          <h1 className="text-content-primary m-0 mt-2 text-3xl leading-tight font-semibold tracking-[-0.02em]">
            Ask Nudge
          </h1>
          <div className="mt-6 grid gap-4">
            {reply ? (
              <section className="bg-surface-base/72 rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]">
                <p className="text-content-body m-0 text-sm leading-7 text-pretty whitespace-pre-wrap">
                  {reply}
                </p>
              </section>
            ) : (
              <section className="bg-surface-base/54 rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--overlay-ink-6)]">
                <p className="text-content-muted m-0 text-sm leading-6 text-pretty">
                  Ask about today&apos;s note, open follow-ups, or context Nudge has already seen.
                </p>
              </section>
            )}
          </div>
        </article>

        <NoteComposerSurface
          bodyText={message}
          color="yellow"
          disabled={sending}
          placeholder={sending ? "Nudge is thinking..." : "Ask about your workspace"}
          statusMessage={statusMessage}
          submitLabel={sending ? "Running Nudge" : "Send Ask Nudge message"}
          variant="chat"
          onAddContext={() => setStatusMessage("Using daily notes and recent signals.")}
          onBodyTextChange={setMessage}
          onChange={() => {}}
          onOpenContextWindow={() => setStatusMessage("Context window is coming next.")}
          onOpenModelPicker={() => setStatusMessage("Using the configured Nudge model.")}
          onSubmit={() => {
            void submitMessage();
          }}
          onVoiceInput={() => setStatusMessage("Voice input belongs in Capture for now.")}
        />
      </section>
    </WorkspaceRouteShell>
  );
}

function ReviewScreen() {
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
    <WorkspaceRouteShell active="review" title="Review">
      <section className="mx-auto grid h-full max-w-6xl gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="bg-surface-base/64 min-h-0 overflow-y-auto rounded-xl p-4 shadow-[0_22px_64px_var(--overlay-ink-10),inset_0_0_0_1px_var(--overlay-ink-7)] backdrop-blur-xl">
          <div className="grid content-start gap-3">
            <div>
              <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
                Review Inbox
              </p>
              <h1 className="text-content-primary m-0 mt-1 text-2xl font-semibold text-balance">
                Proposals
              </h1>
            </div>
            {inbox.isLoading ? (
              <section className="bg-surface-base/72 rounded-lg p-4 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]">
                <p className="text-content-muted m-0 text-sm font-medium">Loading.</p>
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
              <section className="bg-surface-base/72 rounded-lg p-4 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]">
                <p className="text-content-muted m-0 text-sm font-medium">No proposals waiting.</p>
              </section>
            )}
          </div>
        </div>

        <aside className="bg-surface-base/62 min-h-0 overflow-y-auto rounded-xl p-4 shadow-[0_20px_54px_var(--overlay-ink-10),inset_0_0_0_1px_var(--overlay-ink-7)] backdrop-blur-xl">
          <div className="grid content-start gap-3">
            <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
              Receipts
            </p>
            {receipts.length > 0 ? (
              receipts.map((item) => <ReviewReceiptCard key={item.id} receipt={item} />)
            ) : (
              <section className="bg-surface-base/72 rounded-lg p-4 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]">
                <p className="text-content-muted m-0 text-sm font-medium">No receipts yet.</p>
              </section>
            )}
          </div>
        </aside>
      </section>
    </WorkspaceRouteShell>
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
    <article className="bg-surface-base/76 rounded-lg p-4 shadow-[0_10px_26px_var(--overlay-ink-7),inset_0_0_0_1px_var(--overlay-ink-6)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
            {proposal.kind.replace("_", " ")}
          </p>
          <h2 className="text-content-primary m-0 mt-1 text-lg font-semibold text-balance">
            {proposal.title}
          </h2>
        </div>
        <p className="bg-surface-success text-status-success-content m-0 rounded-lg px-2.5 py-1 text-xs font-semibold">
          {Math.round(explanation.confidence * 100)}%
        </p>
      </div>
      <p className="text-content-body m-0 mt-3 text-sm leading-6 text-pretty">{proposal.body}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReviewFact label="Source" value={explanation.source.label} />
        <ReviewFact label="Reason" value={explanation.reason} />
        <ReviewFact label="Confidence" value={`${Math.round(explanation.confidence * 100)}%`} />
        <ReviewFact label="Next action" value={explanation.nextAction} />
      </dl>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          className="bg-surface-base text-content-primary min-h-10 rounded-lg px-3 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--overlay-ink-10)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={() => props.onReview({ decision: "rejected", proposalId: proposal.id })}
        >
          Reject
        </button>
        <button
          className="bg-accent-primary text-content-on-strong min-h-10 rounded-lg px-3 text-sm font-semibold shadow-[0_12px_24px_var(--overlay-accent-24)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
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
    <div className="bg-surface-warm rounded-lg p-3 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]">
      <dt className="text-content-muted text-xs font-semibold tracking-[0.12em] uppercase">
        {props.label}
      </dt>
      <dd className="text-content-body m-0 mt-1 text-sm leading-5 text-pretty">{props.value}</dd>
    </div>
  );
}

function ReviewReceiptCard(props: { readonly receipt: AgentReceipt }) {
  return (
    <article className="bg-surface-base/76 rounded-lg p-4 shadow-[0_10px_26px_var(--overlay-ink-7),inset_0_0_0_1px_var(--overlay-ink-6)]">
      <p className="text-content-primary m-0 text-sm font-semibold">{props.receipt.action}</p>
      <p className="text-content-body m-0 mt-2 text-sm leading-6 text-pretty">
        {props.receipt.why}
      </p>
      <p className="text-content-muted m-0 mt-2 text-xs">
        {formatDateTime(props.receipt.createdAt)}
      </p>
    </article>
  );
}

function QuickCaptureScreen() {
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const closeQuickCapture = async () => {
    const bridge = window.nudgeDesktopQuickCapture;
    if (bridge) {
      await bridge.close();
      return;
    }
    navigate({ to: "/" });
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
    <WorkspaceRouteShell active="capture" title="Capture">
      <section className="mx-auto grid h-full max-w-3xl content-start gap-4">
        <form
          className="bg-surface-base/72 grid gap-4 rounded-xl p-5 shadow-[0_22px_64px_var(--overlay-ink-10),inset_0_0_0_1px_var(--overlay-ink-7)] backdrop-blur-xl"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuickCapture.mutate();
          }}
        >
          <header className="flex min-h-10 items-start justify-between gap-3">
            <div>
              <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
                Quick capture
              </p>
              <h1 className="text-content-primary m-0 mt-1 text-2xl font-semibold tracking-[-0.02em]">
                Add to today
              </h1>
            </div>
            <button
              className="text-content-body hover:bg-content-primary/6 grid size-9 place-items-center rounded-lg transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
              type="button"
              onClick={() => {
                void closeQuickCapture();
              }}
              aria-label="Close capture"
            >
              x
            </button>
          </header>
          <textarea
            autoFocus
            className="bg-surface-base/72 text-content-primary placeholder:text-content-placeholder min-h-44 resize-y rounded-xl p-4 text-base leading-7 shadow-[inset_0_0_0_1px_var(--overlay-ink-7)] outline-none focus:shadow-[inset_0_0_0_1px_var(--overlay-accent-72),0_0_0_3px_var(--overlay-accent-12)]"
            disabled={submitQuickCapture.isPending}
            placeholder="What should Nudge process?"
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <footer className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            <p className="text-content-muted m-0 min-w-0 text-sm font-medium" role="status">
              {statusMessage}
            </p>
            <button
              className="bg-accent-primary text-content-on-strong min-h-10 rounded-lg px-4 text-sm font-semibold shadow-[0_12px_24px_var(--overlay-accent-24)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
              disabled={submitQuickCapture.isPending || !note.trim()}
              type="submit"
            >
              {submitQuickCapture.isPending ? "Capturing" : "Capture"}
            </button>
          </footer>
        </form>
      </section>
    </WorkspaceRouteShell>
  );
}

function SettingsScreen() {
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
    <WorkspaceRouteShell active="settings" title="Settings">
      <section className="mx-auto grid max-w-4xl gap-4">
        <section className="bg-surface-base/72 rounded-xl p-5 shadow-[0_22px_64px_var(--overlay-ink-10),inset_0_0_0_1px_var(--overlay-ink-7)] backdrop-blur-xl">
          <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
            Account
          </p>
          <h1 className="text-content-primary m-0 mt-2 text-3xl leading-tight font-semibold tracking-[-0.02em]">
            {sessionUser?.displayName ?? "You"}
          </h1>
          <p className="text-content-muted m-0 mt-2 text-sm font-medium">
            {workspace?.label ?? "Workspace"} / {surfaceDisplayName(currentAppSurface())}
          </p>
        </section>

        <section className="bg-surface-base/64 grid gap-3 rounded-xl p-4 shadow-[0_18px_46px_var(--overlay-ink-9),inset_0_0_0_1px_var(--overlay-ink-6)] backdrop-blur-xl">
          <SettingsWorkspaceRow label="Name" value={sessionUser?.displayName ?? "You"} />
          <SettingsWorkspaceRow label="Workspace" value={workspace?.label ?? "Workspace"} />
          <SettingsWorkspaceRow label="Session" value={session.data?.authMode ?? "Loading"} />
          <SettingsWorkspaceRow label="Surface" value={surfaceDisplayName(currentAppSurface())} />
          <SettingsWorkspaceRow label="Engine" value={window.location.origin} />
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

        <section className="bg-surface-base/64 grid gap-3 rounded-xl p-4 shadow-[0_18px_46px_var(--overlay-ink-9),inset_0_0_0_1px_var(--overlay-ink-6)] backdrop-blur-xl sm:grid-cols-2">
          <button
            className="bg-accent-primary text-content-on-strong min-h-11 rounded-lg px-4 text-sm font-semibold shadow-[0_12px_24px_var(--overlay-accent-24)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
            disabled={exportData.isPending}
            type="button"
            onClick={() => exportData.mutate()}
          >
            Export data
          </button>
          <button
            className="bg-surface-base text-content-primary min-h-11 rounded-lg px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--overlay-ink-10)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
            disabled={deleteData.isPending}
            type="button"
            onClick={() => deleteData.mutate()}
          >
            Delete local data
          </button>
        </section>
      </section>
    </WorkspaceRouteShell>
  );
}

function SettingsWorkspaceRow(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-surface-base/62 grid min-h-12 gap-2 rounded-lg px-3 py-3 shadow-[inset_0_0_0_1px_var(--overlay-ink-6)] sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
      <p className="text-content-muted m-0 text-xs font-semibold tracking-[0.12em] uppercase">
        {props.label}
      </p>
      <p className="text-content-primary m-0 min-w-0 text-sm font-semibold break-words">
        {props.value}
      </p>
    </div>
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

function NudgeConvexProvider(props: { readonly children: ReactNode }) {
  if (anonymousUiEnabled()) return <>{props.children}</>;
  if (!clerkPublishableKey) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Nudge");
  if (!convexClient) throw new Error("VITE_CONVEX_URL is required to run Nudge");

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/"
      signInFallbackRedirectUrl={currentBrowserReturnUrl()}
      signUpFallbackRedirectUrl="/"
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
    >
      <ClerkLoading>
        <main className="bg-surface-inverse-canvas min-h-dvh" aria-label="Loading Nudge" />
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
    return <main className="bg-surface-inverse-canvas min-h-dvh" aria-label="Loading Nudge" />;
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

const reactRootProperty = "__nudgeReactRoot";

if (!recoverStaleAuthCallbackNavigation()) {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Missing #root element");

  getOrCreateReactRoot(rootElement).render(
    <StrictMode>
      <NudgeConvexProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </NudgeConvexProvider>
    </StrictMode>,
  );
}

function getOrCreateReactRoot(rootElement: HTMLElement) {
  const existingRoot = Reflect.get(rootElement, reactRootProperty);
  if (isReactRoot(existingRoot)) return existingRoot;

  const hotRoot = hotReactRoot();
  if (isReactRoot(hotRoot)) {
    rememberReactRoot(rootElement, hotRoot);
    return hotRoot;
  }

  if (import.meta.env.DEV && hasExistingReactRootMarker(rootElement)) {
    window.location.reload();
    return dormantReactRoot;
  }

  const root = createRoot(rootElement);
  rememberReactRoot(rootElement, root);
  return root;
}

const dormantReactRoot: Root = {
  render: () => undefined,
  unmount: () => undefined,
};

function rememberReactRoot(rootElement: HTMLElement, root: Root) {
  Reflect.set(rootElement, reactRootProperty, root);
  if (import.meta.hot) {
    Reflect.set(import.meta.hot.data, reactRootProperty, root);
  }
}

function hotReactRoot() {
  if (!import.meta.hot) return undefined;

  return Reflect.get(import.meta.hot.data, reactRootProperty);
}

function hasExistingReactRootMarker(rootElement: HTMLElement) {
  return Object.keys(rootElement).some((key) => key.startsWith("__reactContainer$"));
}

function isReactRoot(value: unknown): value is Root {
  if (typeof value !== "object" || value === null) return false;

  return typeof Reflect.get(value, "render") === "function";
}
