import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { DesktopSettingsSurface } from "./client/DesktopSettingsSurface";
import { QuickCaptureSurface } from "./client/QuickCaptureSurface";

const clientMainUrl = new URL("./client/main.tsx", import.meta.url);

describe("quick capture UI", () => {
  test("renders a compact capture-only surface", () => {
    const html = renderToStaticMarkup(
      <QuickCaptureSurface
        disabled={false}
        note="Follow up with Maya tomorrow"
        statusMessage="Captured"
        onClose={() => {}}
        onNoteChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("Quick Capture");
    expect(html).toContain("What should Nudge process?");
    expect(html).toContain("Follow up with Maya tomorrow");
    expect(html).toContain("Capture");
    expect(html).toContain("Captured");
    expect(html).not.toContain("Daily Operating Loop");
    expect(html).not.toContain("Ask");
  });

  test("routes /quick-capture to the submitQuickCapture flow", async () => {
    const source = await readFile(clientMainUrl, "utf8");

    expect(source).toContain('path: "/quick-capture"');
    expect(source).toContain("component: QuickCaptureScreen");
    expect(source).toContain("apiClient.quickCaptures.submit");
    expect(source).toContain("window.nudgeDesktopQuickCapture");
  });

  test("renders desktop quick capture shortcut settings", () => {
    const html = renderToStaticMarkup(
      <DesktopSettingsSurface
        disabled={false}
        isDesktop
        shortcut="CommandOrControl+Shift+N"
        statusMessage="Saved"
        onResetShortcut={() => {}}
        onSaveShortcut={() => {}}
        onShortcutChange={() => {}}
      />,
    );

    expect(html).toContain("Desktop");
    expect(html).toContain("Quick Capture");
    expect(html).toContain("Global shortcut");
    expect(html).toContain("CommandOrControl+Shift+N");
    expect(html).toContain("Save");
    expect(html).toContain("Reset");
    expect(html).toContain("Saved");
  });

  test("settings page loads and saves desktop settings through the preload bridge", async () => {
    const source = await readFile(clientMainUrl, "utf8");

    expect(source).toContain("DesktopSettingsSurface");
    expect(source).toContain(".getSettings()");
    expect(source).toContain("bridge.setSettings");
    expect(source).toContain("quickCaptureShortcut");
  });
});
