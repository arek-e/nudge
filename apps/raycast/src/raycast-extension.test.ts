import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dir.replace(/\/src$/, "");

describe("Raycast extension", () => {
  test("defines a capture command that can reach the Nudge Engine", () => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

    expect(manifest.title).toBe("Nudge");
    expect(manifest.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: "view",
          name: "capture",
          title: "Capture",
        }),
        expect.objectContaining({
          mode: "view",
          name: "current-context",
          title: "Current Context",
        }),
        expect.objectContaining({
          mode: "view",
          name: "ask",
          title: "Ask Nudge",
        }),
      ]),
    );
    expect(manifest.preferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "engineUrl", required: true }),
        expect.objectContaining({ name: "bearerToken", required: false }),
      ]),
    );
    expect(manifest.dependencies).toMatchObject({
      "@nudge/surface": "workspace:*",
      "@raycast/api": "1.104.21",
    });
  });

  test("uses the shared surface Engine client instead of local request logic", () => {
    const captureSource = readFileSync(join(root, "src/capture.tsx"), "utf8");
    const captureServiceSource = readFileSync(join(root, "src/capture-service.ts"), "utf8");
    const engineClientSource = readFileSync(join(root, "src/engine-client.ts"), "utf8");

    expect(captureSource).toContain("appendRaycastCapture");
    expect(captureSource).toContain("raycastEngineClient");
    expect(captureServiceSource).toContain("appendManualCapture");
    expect(captureSource).not.toContain("fetch(");
    expect(captureServiceSource).not.toContain("fetch(");
    expect(engineClientSource).toContain("createSurfaceEngineClient");
    expect(engineClientSource).toContain('surface: "raycast"');
    expect(engineClientSource).toContain("surfaceAnonymousUserStorageKey");
    expect(engineClientSource).not.toContain("fetch(");
  });

  test("defines a context command that uses the shared refresh service", () => {
    const source = readFileSync(join(root, "src/current-context.tsx"), "utf8");
    const actionServiceSource = readFileSync(join(root, "src/action-service.ts"), "utf8");
    const serviceSource = readFileSync(join(root, "src/context-service.ts"), "utf8");

    expect(source).toContain("refreshRaycastCurrentContext");
    expect(source).toContain("reviewRaycastAction");
    expect(source).toContain("raycastEngineClient");
    expect(serviceSource).toContain("refreshContext");
    expect(actionServiceSource).toContain("updateActionStatus");
    expect(source).toContain("buildRaycastContextSections");
    expect(source).not.toContain("fetch(");
    expect(actionServiceSource).not.toContain("fetch(");
    expect(serviceSource).not.toContain("fetch(");
  });

  test("defines an ask command that uses the shared conversation service", () => {
    const source = readFileSync(join(root, "src/ask.tsx"), "utf8");
    const serviceSource = readFileSync(join(root, "src/ask-service.ts"), "utf8");

    expect(source).toContain("askRaycastNudge");
    expect(source).toContain("raycastEngineClient");
    expect(serviceSource).toContain("sendConversationMessage");
    expect(source).not.toContain("fetch(");
    expect(serviceSource).not.toContain("fetch(");
  });
});
