import { app, BrowserWindow, globalShortcut, ipcMain, Notification, shell } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Layer, ManagedRuntime } from "effect";
import {
  canOpenExternalUrl,
  defaultDesktopSettings,
  desktopSettingsFromUnknown,
  desktopSettingsUpdateFromUnknown,
  desktopAuthTicketFromCallbackUrl,
  desktopProtocol,
  desktopWebAppUrlForAuthTicket,
  type DesktopSettings,
  isDesktopAuthCallbackUrl,
  resolveDesktopAutoUpdatesEnabled,
  resolveDesktopE2eReadyFile,
  resolveNudgeWebAppUrl,
} from "./config.js";
import { captureDesktopException, flushDesktopSentry, initializeDesktopSentry } from "./sentry.js";
import {
  DesktopUpdates,
  makeDesktopUpdatesLayer,
  type DesktopUpdateActionResult,
  type DesktopUpdateCheckReason,
  type DesktopUpdateState,
  type DesktopUpdatesService,
} from "./updates/DesktopUpdates.js";
import { ElectronUpdaterLive } from "./updates/ElectronUpdater.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const desktopUpdateStartupDelayMs = 10_000;
const desktopUpdatePollIntervalMs = 4 * 60 * 60 * 1000;

type DesktopUpdatesRuntime = ManagedRuntime.ManagedRuntime<DesktopUpdates, never>;

let mainWindow: BrowserWindow | undefined;
let quickCaptureWindow: BrowserWindow | undefined;
let desktopSettings: DesktopSettings = defaultDesktopSettings;
let registeredQuickCaptureShortcut: string | undefined;
let pendingDesktopAuthCallbackUrl: string | undefined;
let desktopUpdatesRuntime: DesktopUpdatesRuntime | undefined;
let desktopUpdateStartupTimer: NodeJS.Timeout | undefined;
let desktopUpdatePollTimer: NodeJS.Timeout | undefined;

initializeDesktopSentry({
  env: process.env,
  isPackaged: app.isPackaged,
  version: app.getVersion(),
});

function createMainWindow() {
  const browserWindow = new BrowserWindow({
    backgroundColor: "#0c1118",
    height: 900,
    minHeight: 720,
    minWidth: 980,
    title: "Nudge",
    webPreferences: {
      additionalArguments: [`--nudge-app-version=${app.getVersion()}`],
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, "preload.cjs"),
    },
    width: 1280,
  });
  mainWindow = browserWindow;

  browserWindow.on("closed", () => {
    if (mainWindow === browserWindow) mainWindow = undefined;
  });

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (canOpenExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  browserWindow.webContents.once("did-finish-load", () => {
    void sendDesktopUpdateStateToWindow(browserWindow);
  });

  const e2eReadyFile = resolveDesktopE2eReadyFile(process.env);
  if (e2eReadyFile) {
    browserWindow.webContents.once("did-finish-load", () => {
      void writeDesktopE2eReceipt(browserWindow, e2eReadyFile).finally(() => app.quit());
    });
  }

  void browserWindow.loadURL(resolveNudgeWebAppUrl(process.env));
  return browserWindow;
}

function createQuickCaptureWindow() {
  const browserWindow = new BrowserWindow({
    alwaysOnTop: true,
    backgroundColor: "#eef1f5",
    frame: false,
    height: 240,
    maxHeight: 260,
    maxWidth: 560,
    minHeight: 220,
    minWidth: 480,
    resizable: false,
    show: false,
    skipTaskbar: true,
    title: "Quick Capture",
    webPreferences: {
      additionalArguments: [`--nudge-app-version=${app.getVersion()}`],
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, "preload.cjs"),
    },
    width: 520,
  });
  quickCaptureWindow = browserWindow;

  browserWindow.on("blur", () => {
    if (!browserWindow.webContents.isDevToolsOpened()) browserWindow.hide();
  });

  browserWindow.on("closed", () => {
    if (quickCaptureWindow === browserWindow) quickCaptureWindow = undefined;
  });

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (canOpenExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  void browserWindow.loadURL(desktopWebAppRouteUrl("/quick-capture"));
  return browserWindow;
}

function desktopWebAppRouteUrl(pathname: string) {
  const url = new URL(resolveNudgeWebAppUrl(process.env));
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function desktopSettingsPath() {
  return join(app.getPath("userData"), "desktop-settings.json");
}

function isNodeErrorWithCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && Reflect.get(error, "code") === code;
}

async function loadDesktopSettings() {
  const settingsPath = desktopSettingsPath();
  try {
    desktopSettings = desktopSettingsFromUnknown(JSON.parse(await readFile(settingsPath, "utf8")));
  } catch (error) {
    if (!isNodeErrorWithCode(error, "ENOENT")) {
      captureDesktopException(error, { operation: "desktop_settings.load" });
      console.warn("[desktop-settings] could not read settings", error);
    }
    desktopSettings = defaultDesktopSettings;
  }
}

async function saveDesktopSettings(settings: DesktopSettings) {
  const settingsPath = desktopSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

async function updateDesktopSettings(value: unknown) {
  const nextSettings = desktopSettingsUpdateFromUnknown(value);
  if (!nextSettings) {
    return {
      error: "Enter a shortcut like CommandOrControl+Shift+N.",
      ok: false,
      settings: desktopSettings,
    };
  }

  desktopSettings = nextSettings;
  await saveDesktopSettings(desktopSettings);
  registerQuickCaptureShortcut(desktopSettings.quickCaptureShortcut);
  return { ok: true, settings: desktopSettings };
}

function registerDesktopAuthProtocolClient() {
  if (process.defaultApp) {
    const appEntryPoint = process.argv[1];
    if (appEntryPoint) {
      app.setAsDefaultProtocolClient(desktopProtocol, process.execPath, [appEntryPoint]);
      return;
    }
  }
  app.setAsDefaultProtocolClient(desktopProtocol);
}

function findDesktopAuthCallbackUrl(values: ReadonlyArray<string>) {
  return values.find(isDesktopAuthCallbackUrl);
}

function focusWindow(window: BrowserWindow) {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function focusQuickCaptureWindow(window: BrowserWindow) {
  if (window.isDestroyed()) return;
  window.center();
  window.show();
  window.focus();
  window.webContents.focus();
}

function openQuickCaptureWindow() {
  const window = quickCaptureWindow ?? createQuickCaptureWindow();
  if (window.isVisible()) {
    window.hide();
    return;
  }

  if (window.webContents.isLoading()) {
    window.once("ready-to-show", () => focusQuickCaptureWindow(window));
    return;
  }
  focusQuickCaptureWindow(window);
}

function hideQuickCaptureWindow() {
  const window = quickCaptureWindow;
  if (!window || window.isDestroyed()) return;
  window.hide();
}

function registerQuickCaptureShortcut(shortcut: string) {
  if (registeredQuickCaptureShortcut) {
    globalShortcut.unregister(registeredQuickCaptureShortcut);
  }
  registeredQuickCaptureShortcut = shortcut;
  const registered = globalShortcut.register(shortcut, openQuickCaptureWindow);
  if (!registered) {
    console.warn(`[quick-capture] failed to register ${shortcut}`);
  }
}

function handleDesktopAuthCallbackUrl(value: string) {
  if (!isDesktopAuthCallbackUrl(value)) return false;
  if (!app.isReady()) {
    pendingDesktopAuthCallbackUrl = value;
    return true;
  }

  const ticket = desktopAuthTicketFromCallbackUrl(value);
  const window = mainWindow ?? createMainWindow();
  focusWindow(window);
  if (ticket) {
    void window.loadURL(desktopWebAppUrlForAuthTicket(resolveNudgeWebAppUrl(process.env), ticket));
  }
  return true;
}

async function writeDesktopE2eReceipt(window: BrowserWindow, readyFile: string) {
  const surface = await window.webContents.executeJavaScript(
    "globalThis.window?.nudgeDesktop?.surface ?? null",
  );
  const appVersion = await window.webContents.executeJavaScript(
    "globalThis.window?.nudgeDesktop?.appVersion ?? null",
  );
  const appResult = await desktopE2eAppResult(window);
  const bodyText = await window.webContents.executeJavaScript(
    "globalThis.document?.body?.innerText ?? null",
  );
  await mkdir(dirname(readyFile), { recursive: true });
  await writeFile(
    readyFile,
    JSON.stringify(
      {
        appVersion: typeof appVersion === "string" ? appVersion : null,
        appResult,
        bodyText: typeof bodyText === "string" ? bodyText.trim() : null,
        surface: typeof surface === "string" ? surface : null,
        title: window.webContents.getTitle(),
        url: window.webContents.getURL(),
      },
      null,
      2,
    ),
  );
}

async function desktopE2eAppResult(window: BrowserWindow) {
  try {
    return await window.webContents.executeJavaScript(`
      (async () => {
        const result = globalThis.window?.nudgeDesktopE2E;
        if (!result) return null;
        const settled = Promise.resolve(result).catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        }));
        return await Promise.race([
          settled,
          new Promise((resolve) => setTimeout(() => resolve({ error: "desktop_e2e_timeout" }), 10000)),
        ]);
      })()
    `);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function setupDesktopUpdates() {
  const runtime = ManagedRuntime.make(
    makeDesktopUpdatesLayer({
      currentVersion: app.getVersion(),
      emitState: broadcastDesktopUpdateState,
      enabled: resolveDesktopAutoUpdatesEnabled({
        env: process.env,
        isPackaged: app.isPackaged,
      }),
    }).pipe(Layer.provide(ElectronUpdaterLive)),
  );
  desktopUpdatesRuntime = runtime;

  void runDesktopUpdatesEffect(
    Effect.gen(function* () {
      const updates = yield* DesktopUpdates;
      yield* updates.configure;
    }),
  )
    .then(scheduleDesktopUpdateChecks)
    .catch((error) => {
      captureDesktopException(error, { operation: "desktop_updates.setup" });
      console.error("[desktop-updates] setup failed", error);
    });
}

function scheduleDesktopUpdateChecks() {
  clearDesktopUpdateTimers();
  desktopUpdateStartupTimer = setTimeout(() => {
    void runDesktopUpdateCheck("startup");
  }, desktopUpdateStartupDelayMs);
  desktopUpdatePollTimer = setInterval(() => {
    void runDesktopUpdateCheck("periodic");
  }, desktopUpdatePollIntervalMs);
}

function clearDesktopUpdateTimers() {
  if (desktopUpdateStartupTimer) clearTimeout(desktopUpdateStartupTimer);
  if (desktopUpdatePollTimer) clearInterval(desktopUpdatePollTimer);
  desktopUpdateStartupTimer = undefined;
  desktopUpdatePollTimer = undefined;
}

async function runDesktopUpdateCheck(reason: DesktopUpdateCheckReason) {
  await runDesktopUpdatesAction((updates) => updates.check(reason));
}

async function sendDesktopUpdateStateToWindow(window: BrowserWindow) {
  const state = await getDesktopUpdateState();
  if (!window.isDestroyed()) window.webContents.send("nudge:update-state", state);
}

function broadcastDesktopUpdateState(state: DesktopUpdateState) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("nudge:update-state", state);
  }
}

async function getDesktopUpdateState() {
  const runtime = desktopUpdatesRuntime;
  if (!runtime) return disabledDesktopUpdateState(null);

  try {
    return await runtime.runPromise(
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates;
        return yield* updates.getState;
      }),
    );
  } catch (error) {
    captureDesktopException(error, { operation: "desktop_updates.state" });
    return disabledDesktopUpdateState(errorMessageFromUnknown(error));
  }
}

async function runDesktopUpdatesAction(
  buildEffect: (updates: DesktopUpdatesService) => Effect.Effect<DesktopUpdateActionResult>,
) {
  const runtime = desktopUpdatesRuntime;
  if (!runtime) return disabledDesktopUpdateActionResult(null);

  try {
    return await runtime.runPromise(
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates;
        return yield* buildEffect(updates);
      }),
    );
  } catch (error) {
    captureDesktopException(error, { operation: "desktop_updates.action" });
    return disabledDesktopUpdateActionResult(errorMessageFromUnknown(error));
  }
}

function disabledDesktopUpdateActionResult(message: string | null): DesktopUpdateActionResult {
  return {
    accepted: false,
    completed: false,
    state: disabledDesktopUpdateState(message),
  };
}

function disabledDesktopUpdateState(message: string | null): DesktopUpdateState {
  return {
    availableVersion: null,
    canRetry: false,
    currentVersion: app.getVersion(),
    downloadedVersion: null,
    downloadPercent: null,
    enabled: false,
    message,
    status: "disabled",
  };
}

function runDesktopUpdatesEffect<A, E>(effect: Effect.Effect<A, E, DesktopUpdates>) {
  const runtime = desktopUpdatesRuntime;
  if (!runtime) return Promise.reject(new Error("Desktop updates are not configured."));
  return runtime.runPromise(effect);
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error.trim();
  return "Desktop update failed.";
}

ipcMain.handle("nudge:open-external-auth", async (_event, url: unknown) => {
  if (typeof url !== "string" || !canOpenExternalUrl(url)) return { ok: false };
  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle("nudge:update-get-state", async () => getDesktopUpdateState());

ipcMain.handle("nudge:update-check", async () =>
  runDesktopUpdatesAction((updates) => updates.check("manual")),
);

ipcMain.handle("nudge:update-download", async () =>
  runDesktopUpdatesAction((updates) => updates.download()),
);

ipcMain.handle("nudge:update-install", async () =>
  runDesktopUpdatesAction((updates) => updates.install()),
);

ipcMain.handle("nudge:desktop-settings-get", () => ({ ok: true, settings: desktopSettings }));

ipcMain.handle("nudge:desktop-settings-set", async (_event, settings: unknown) =>
  updateDesktopSettings(settings),
);

ipcMain.handle("nudge:quick-capture-close", () => {
  hideQuickCaptureWindow();
  return { ok: true };
});

ipcMain.handle("nudge:quick-capture-submitted", () => {
  hideQuickCaptureWindow();
  if (Notification.isSupported()) {
    new Notification({ body: "Captured in Nudge.", title: "Quick Capture" }).show();
  }
  return { ok: true };
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDesktopAuthCallbackUrl(url);
});

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const callbackUrl = findDesktopAuthCallbackUrl(commandLine);
    if (callbackUrl) {
      handleDesktopAuthCallbackUrl(callbackUrl);
      return;
    }
    if (mainWindow) focusWindow(mainWindow);
  });

  void app.whenReady().then(async () => {
    await loadDesktopSettings();
    registerDesktopAuthProtocolClient();
    setupDesktopUpdates();
    createMainWindow();
    registerQuickCaptureShortcut(desktopSettings.quickCaptureShortcut);

    if (pendingDesktopAuthCallbackUrl) {
      const callbackUrl = pendingDesktopAuthCallbackUrl;
      pendingDesktopAuthCallbackUrl = undefined;
      handleDesktopAuthCallbackUrl(callbackUrl);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("before-quit", () => {
  clearDesktopUpdateTimers();
  void flushDesktopSentry();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
