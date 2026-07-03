import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canOpenExternalUrl,
  defaultNudgeWebAppUrl,
  resolveDesktopE2eReadyFile,
  resolveNudgeWebAppUrl,
} from "./config";

const root = import.meta.dir.replace(/\/src$/, "");

describe("Desktop app", () => {
  test("mounts the shared Nudge web app by default and allows local override", () => {
    expect(defaultNudgeWebAppUrl).toBe("https://nudge-web.teampitch.workers.dev");
    expect(resolveNudgeWebAppUrl({})).toBe(defaultNudgeWebAppUrl);
    expect(resolveNudgeWebAppUrl({ NUDGE_WEB_APP_URL: " http://localhost:8787 " })).toBe(
      "http://localhost:8787",
    );
  });

  test("only hands web URLs to the operating system", () => {
    expect(canOpenExternalUrl("https://nudge-web.teampitch.workers.dev")).toBe(true);
    expect(canOpenExternalUrl("http://localhost:8787")).toBe(true);
    expect(canOpenExternalUrl("javascript:alert(1)")).toBe(false);
    expect(canOpenExternalUrl("not a url")).toBe(false);
  });

  test("resolves an explicit e2e ready receipt file for desktop smoke tests", () => {
    expect(resolveDesktopE2eReadyFile({})).toBeUndefined();
    expect(resolveDesktopE2eReadyFile({ NUDGE_DESKTOP_E2E_READY_FILE: " /tmp/ready.json " })).toBe(
      "/tmp/ready.json",
    );
  });

  test("defines a desktop package with macOS release artifacts", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

    expect(manifest).toMatchObject({
      main: "dist/main.js",
      scripts: {
        build: "tsc -p tsconfig.json",
        "dist:mac": "bun run build && electron-builder --mac --publish never",
        dev: "bun run build && electron .",
      },
      devDependencies: {
        electron: "catalog:",
        "electron-builder": "catalog:",
      },
      build: {
        appId: "app.nudge.desktop",
        artifactName: "Nudge-${version}-${arch}.${ext}",
        mac: {
          hardenedRuntime: true,
          icon: "build/icon.png",
          notarize: true,
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
    expect(manifest.dependencies).toBeUndefined();
  });

  test("uses a secure preload bridge to mark the mounted web app as desktop", () => {
    const mainSource = readFileSync(join(root, "src/main.ts"), "utf8");
    const preloadSource = readFileSync(join(root, "src/preload.cts"), "utf8");

    expect(mainSource).toContain("contextIsolation: true");
    expect(mainSource).toContain("nodeIntegration: false");
    expect(mainSource).toContain('preload: join(currentDirectory, "preload.cjs")');
    expect(mainSource).toContain("canOpenExternalUrl(url)");
    expect(mainSource).toContain("writeDesktopE2eReceipt");
    expect(mainSource).toContain("nudgeDesktopE2E");
    expect(mainSource).toContain("window.loadURL(resolveNudgeWebAppUrl(process.env))");
    expect(preloadSource).toContain('surface: "desktop"');
    expect(preloadSource).toContain("contextBridge.exposeInMainWorld");
  });
});
