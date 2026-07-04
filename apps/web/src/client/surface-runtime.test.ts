import { describe, expect, test } from "bun:test";
import {
  anonymousUiEnabled,
  resolveAppSurface,
  surfaceContextRefetchInterval,
} from "./surface-runtime";

describe("web App Surface runtime", () => {
  test("defaults to web and lets the desktop preload identify the mounted web app", () => {
    expect(resolveAppSurface()).toBe("web");
    expect(resolveAppSurface({ envSurface: "raycast" })).toBe("raycast");
    expect(resolveAppSurface({ desktopSurface: "desktop", envSurface: "web" })).toBe("desktop");
    expect(resolveAppSurface({ desktopSurface: "unexpected", envSurface: "unknown" })).toBe("web");
  });

  test("polls while AI review is still processing like the iOS app", () => {
    for (const status of ["pending", "queued", "running", "processing", "in_progress"]) {
      expect(surfaceContextRefetchInterval({ actions: { latestRun: { status } } })).toBe(2_000);
    }

    expect(surfaceContextRefetchInterval({ actions: { latestRun: { status: "completed" } } })).toBe(
      false,
    );
    expect(surfaceContextRefetchInterval({ actions: { latestRun: { status: "failed" } } })).toBe(
      false,
    );
    expect(surfaceContextRefetchInterval(undefined)).toBe(false);
  });

  test("enables anonymous UI only for explicit e2e and desktop runtime opt-in", () => {
    expect(anonymousUiEnabled()).toBe(false);
    expect(anonymousUiEnabled({ anonymousUi: "1" })).toBe(true);
    expect(anonymousUiEnabled({ anonymousUi: "true" })).toBe(true);
    expect(anonymousUiEnabled({ anonymousUi: "0" })).toBe(false);
  });
});
