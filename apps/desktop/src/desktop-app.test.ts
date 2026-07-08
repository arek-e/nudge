import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canOpenExternalUrl,
  defaultDesktopSettings,
  desktopAuthCallbackUrl,
  desktopSettingsFromUnknown,
  desktopSettingsUpdateFromUnknown,
  desktopAuthTicketFromCallbackUrl,
  desktopProtocol,
  desktopWebAppUrlForAuthTicket,
  defaultNudgeWebAppUrl,
  isDesktopAuthCallbackUrl,
  normalizeDesktopShortcut,
  resolveDesktopAutoUpdatesEnabled,
  resolveDesktopE2eReadyFile,
  resolveNudgeWebAppUrl,
} from "./config";
import { desktopSurfaceTokens } from "./window-theme";

const root = import.meta.dir.replace(/\/src$/, "");

describe("Desktop app", () => {
  test("mounts the shared Nudge web app by default and allows local override", () => {
    expect(defaultNudgeWebAppUrl).toBe("https://app.explorenudge.com/");
    expect(resolveNudgeWebAppUrl({})).toBe(defaultNudgeWebAppUrl);
    expect(resolveNudgeWebAppUrl({ NUDGE_WEB_APP_URL: " http://localhost:8787 " })).toBe(
      "http://localhost:8787",
    );
  });

  test("only hands web URLs to the operating system", () => {
    expect(canOpenExternalUrl("https://app.explorenudge.com/")).toBe(true);
    expect(canOpenExternalUrl("http://localhost:8787")).toBe(true);
    expect(canOpenExternalUrl("javascript:alert(1)")).toBe(false);
    expect(canOpenExternalUrl("not a url")).toBe(false);
  });

  test("recognizes only Nudge desktop auth callback URLs", () => {
    expect(desktopProtocol).toBe("nudge");
    expect(desktopAuthCallbackUrl).toBe("nudge://auth/callback");
    expect(isDesktopAuthCallbackUrl("nudge://auth/callback?ticket=test-ticket")).toBe(true);
    expect(isDesktopAuthCallbackUrl("https://explorenudge.com/auth/callback")).toBe(false);
    expect(desktopAuthTicketFromCallbackUrl("nudge://auth/callback?ticket=test-ticket")).toBe(
      "test-ticket",
    );
    expect(desktopWebAppUrlForAuthTicket("https://explorenudge.com/app", "test-ticket")).toBe(
      "https://explorenudge.com/app?desktop_ticket=test-ticket",
    );
  });

  test("resolves an explicit e2e ready receipt file for desktop smoke tests", () => {
    expect(resolveDesktopE2eReadyFile({})).toBeUndefined();
    expect(resolveDesktopE2eReadyFile({ NUDGE_DESKTOP_E2E_READY_FILE: " /tmp/ready.json " })).toBe(
      "/tmp/ready.json",
    );
  });

  test("enables desktop auto updates only for packaged apps unless explicitly overridden", () => {
    expect(resolveDesktopAutoUpdatesEnabled({ env: {}, isPackaged: false })).toBe(false);
    expect(resolveDesktopAutoUpdatesEnabled({ env: {}, isPackaged: true })).toBe(true);
    expect(
      resolveDesktopAutoUpdatesEnabled({
        env: { NUDGE_DESKTOP_AUTO_UPDATE: "false" },
        isPackaged: true,
      }),
    ).toBe(false);
    expect(
      resolveDesktopAutoUpdatesEnabled({
        env: { NUDGE_DESKTOP_AUTO_UPDATE: "true" },
        isPackaged: false,
      }),
    ).toBe(true);
  });

  test("normalizes desktop settings for the quick capture shortcut", () => {
    expect(defaultDesktopSettings.quickCaptureShortcut).toBe("CommandOrControl+Shift+N");
    expect(normalizeDesktopShortcut(" cmd + shift + space ")).toBe("Command+Shift+Space");
    expect(normalizeDesktopShortcut("mod+alt+k")).toBe("CommandOrControl+Alt+K");
    expect(normalizeDesktopShortcut("n")).toBeNull();
    expect(normalizeDesktopShortcut("hyper+shift+n")).toBeNull();
    expect(desktopSettingsFromUnknown({ quickCaptureShortcut: "ctrl+shift+j" })).toEqual({
      quickCaptureShortcut: "Control+Shift+J",
    });
    expect(desktopSettingsFromUnknown({ quickCaptureShortcut: "n" })).toEqual(
      defaultDesktopSettings,
    );
    expect(desktopSettingsUpdateFromUnknown({ quickCaptureShortcut: "n" })).toBeNull();
  });

  test("defines a desktop package with macOS release artifacts", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

    expect(manifest).toMatchObject({
      main: "dist/main.js",
      scripts: {
        build: "tsc -b tsconfig.json --force",
        "dist:mac":
          "bun run build && bun ../../scripts/sentry-artifacts.ts sourcemaps --project nudge-desktop --path dist && electron-builder --mac --publish never",
        dev: "bun run build && electron .",
      },
      devDependencies: {
        electron: "catalog:",
        "electron-builder": "catalog:",
      },
      dependencies: {
        effect: "catalog:",
        "electron-updater": "^6.8.9",
      },
      build: {
        appId: "app.nudge.desktop",
        artifactName: "Nudge-${version}-${arch}.${ext}",
        protocols: [
          {
            name: "Nudge",
            schemes: ["nudge"],
          },
        ],
        mac: {
          hardenedRuntime: true,
          icon: "build/icon.png",
          notarize: true,
          x64ArchFiles: "**/node_modules/@msgpackr-extract/**/*.node",
          target: [
            {
              arch: ["universal"],
              target: "dmg",
            },
            {
              arch: ["universal"],
              target: "zip",
            },
          ],
        },
      },
    });
  });

  test("uploads Electron updater metadata with macOS release downloads", () => {
    const workflow = readFileSync(join(root, "../../.github/workflows/release-apps.yml"), "utf8");

    expect(workflow).toContain(
      'bun run release:version:check -- --tag "${{ steps.release.outputs.tag }}"',
    );
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('tag="${{ inputs.tag }}"');
    expect(workflow).not.toContain("GITHUB_REF_TYPE");
    expect(workflow).not.toContain("push:\n    tags:");
    expect(workflow).toContain("cp apps/desktop/release/*.yml release-assets/");
    expect(workflow).toContain("cp apps/desktop/release/*.blockmap release-assets/");
  });

  test("uses a secure preload bridge to mark the mounted web app as desktop", () => {
    const mainSource = readFileSync(join(root, "src/main.ts"), "utf8");
    const preloadSource = readFileSync(join(root, "src/preload.cts"), "utf8");

    expect(mainSource).toContain("contextIsolation: true");
    expect(mainSource).toContain("nodeIntegration: false");
    expect(mainSource).toContain("globalShortcut.register");
    expect(mainSource).toContain('"desktop-settings.json"');
    expect(mainSource).toContain("desktopSettingsFromUnknown");
    expect(mainSource).toContain(
      "registerQuickCaptureShortcut(desktopSettings.quickCaptureShortcut)",
    );
    expect(mainSource).toContain("globalShortcut.unregister(registeredQuickCaptureShortcut)");
    expect(mainSource).toContain('title: "Quick Capture"');
    expect(mainSource).toContain('desktopWebAppRouteUrl("/quick-capture")');
    expect(mainSource).toContain(
      "additionalArguments: [`--nudge-app-version=${app.getVersion()}`]",
    );
    expect(mainSource).toContain('preload: join(currentDirectory, "preload.cjs")');
    expect(mainSource).toContain("backgroundColor: desktopSurfaceTokens.warm.value");
    expect(mainSource).toContain("app.setAsDefaultProtocolClient(desktopProtocol");
    expect(mainSource).toContain('ipcMain.handle("nudge:open-external-auth"');
    expect(mainSource).toContain('ipcMain.handle("nudge:update-get-state"');
    expect(mainSource).toContain('ipcMain.handle("nudge:update-check"');
    expect(mainSource).toContain('ipcMain.handle("nudge:update-download"');
    expect(mainSource).toContain('ipcMain.handle("nudge:update-install"');
    expect(mainSource).toContain('ipcMain.handle("nudge:quick-capture-close"');
    expect(mainSource).toContain('ipcMain.handle("nudge:quick-capture-submitted"');
    expect(mainSource).toContain('ipcMain.handle("nudge:desktop-settings-get"');
    expect(mainSource).toContain('ipcMain.handle("nudge:desktop-settings-set"');
    expect(mainSource).toContain('app.on("open-url"');
    expect(mainSource).toContain('app.on("second-instance"');
    expect(mainSource).toContain('app.on("will-quit"');
    expect(mainSource).toContain("desktopWebAppUrlForAuthTicket");
    expect(mainSource).toContain("makeDesktopUpdatesLayer");
    expect(mainSource).toContain("resolveDesktopAutoUpdatesEnabled");
    expect(mainSource).toContain('webContents.send("nudge:update-state"');
    expect(mainSource).toContain("canOpenExternalUrl(url)");
    expect(mainSource).toContain("writeDesktopE2eReceipt");
    expect(mainSource).toContain("nudgeDesktopE2E");
    expect(mainSource).toContain("browserWindow.loadURL(resolveNudgeWebAppUrl(process.env))");
    expect(preloadSource).toContain('surface: "desktop"');
    expect(preloadSource).toContain("authCallbackUrl: desktopAuthCallbackUrl");
    expect(preloadSource).toContain("desktopAppVersionFromArguments()");
    expect(preloadSource).not.toContain('appVersion: "0.1.0"');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:open-external-auth", url)');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:update-get-state")');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:update-check")');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:update-download")');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:update-install")');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:desktop-settings-get")');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:desktop-settings-set", settings)');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:quick-capture-close")');
    expect(preloadSource).toContain('ipcRenderer.invoke("nudge:quick-capture-submitted")');
    expect(preloadSource).toContain("nudgeDesktopQuickCapture");
    expect(preloadSource).toContain('ipcRenderer.on("nudge:update-state"');
    expect(preloadSource).toContain("contextBridge.exposeInMainWorld");
  });

  test("uses purpose-named design tokens for native window backgrounds", () => {
    const mainSource = readFileSync(join(root, "src/main.ts"), "utf8");
    const webStyles = readFileSync(join(root, "../web/src/client/styles.css"), "utf8");

    expect(mainSource).toContain("backgroundColor: desktopSurfaceTokens.warm.value");
    expect(mainSource).toContain("backgroundColor: desktopSurfaceTokens.captureCanvas.value");
    expect(mainSource).not.toContain('backgroundColor: "#');
    expect(cssVariableValue(webStyles, desktopSurfaceTokens.warm.cssVariable)).toBe(
      desktopSurfaceTokens.warm.value,
    );
    expect(cssVariableValue(webStyles, desktopSurfaceTokens.captureCanvas.cssVariable)).toBe(
      desktopSurfaceTokens.captureCanvas.value,
    );
  });
});

function cssVariableValue(source: string, variableName: string) {
  const line = source
    .split("\n")
    .find((candidate) => candidate.trim().startsWith(`${variableName}:`));
  if (line === undefined) return undefined;

  return line
    .slice(line.indexOf(":") + 1)
    .trim()
    .replace(/;$/, "");
}
