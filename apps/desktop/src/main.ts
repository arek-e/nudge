import { app, BrowserWindow, shell } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canOpenExternalUrl, resolveDesktopE2eReadyFile, resolveNudgeWebAppUrl } from "./config.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);

function createMainWindow() {
  const window = new BrowserWindow({
    backgroundColor: "#0c1118",
    height: 900,
    minHeight: 720,
    minWidth: 980,
    title: "Nudge",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDirectory, "preload.cjs"),
    },
    width: 1280,
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (canOpenExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  const e2eReadyFile = resolveDesktopE2eReadyFile(process.env);
  if (e2eReadyFile) {
    window.webContents.once("did-finish-load", () => {
      void writeDesktopE2eReceipt(window, e2eReadyFile).finally(() => app.quit());
    });
  }

  void window.loadURL(resolveNudgeWebAppUrl(process.env));
  return window;
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

void app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
