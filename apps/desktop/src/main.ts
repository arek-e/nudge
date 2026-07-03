import { app, BrowserWindow, ipcMain, shell } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Layer, ManagedRuntime } from "effect";
import {
  canOpenExternalUrl,
  desktopAuthTicketFromCallbackUrl,
  desktopProtocol,
  desktopWebAppUrlForAuthTicket,
  isDesktopAuthCallbackUrl,
  resolveDesktopAutoUpdatesEnabled,
  resolveDesktopE2eReadyFile,
  resolveNudgeWebAppUrl,
} from "./config.js";
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
let pendingDesktopAuthCallbackUrl: string | undefined;
let desktopUpdatesRuntime: DesktopUpdatesRuntime | undefined;
let desktopUpdateStartupTimer: NodeJS.Timeout | undefined;
let desktopUpdatePollTimer: NodeJS.Timeout | undefined;

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

  void app.whenReady().then(() => {
    registerDesktopAuthProtocolClient();
    setupDesktopUpdates();
    createMainWindow();

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

app.on("before-quit", clearDesktopUpdateTimers);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
