import { describe, expect, test } from "bun:test";
import { checkReleaseVersions, normalizeReleaseTag } from "./release-version";

describe("release version checks", () => {
  test("accepts a desktop release tag while companion packages version independently", () => {
    expect(
      checkReleaseVersions({
        packages: [
          {
            name: "@nudge/desktop",
            path: "apps/desktop/package.json",
            releaseDriver: true,
            version: "0.1.1",
          },
          {
            name: "@nudge/raycast",
            path: "apps/raycast/package.json",
            releaseDriver: false,
            version: "0.1.0",
          },
        ],
        tag: "v0.1.1",
      }),
    ).toEqual({
      errors: [],
      ok: true,
      version: "0.1.1",
    });
  });

  test("rejects invalid companion package versions without forcing them to match", () => {
    expect(
      checkReleaseVersions({
        packages: [
          {
            name: "@nudge/desktop",
            path: "apps/desktop/package.json",
            releaseDriver: true,
            version: "0.1.0",
          },
          {
            name: "@nudge/raycast",
            path: "apps/raycast/package.json",
            releaseDriver: false,
            version: "next",
          },
        ],
        tag: "v0.1.0",
      }).errors,
    ).toContain("@nudge/raycast version next is not a valid semantic version.");
  });

  test("rejects release tags that do not match the desktop app package version", () => {
    expect(
      checkReleaseVersions({
        packages: [
          {
            name: "@nudge/desktop",
            path: "apps/desktop/package.json",
            releaseDriver: true,
            version: "0.1.0",
          },
          {
            name: "@nudge/raycast",
            path: "apps/raycast/package.json",
            releaseDriver: false,
            version: "0.1.0",
          },
        ],
        tag: "v0.1.1",
      }).errors,
    ).toContain("Release tag v0.1.1 does not match app package version 0.1.0.");
  });

  test("normalizes GitHub ref tag names", () => {
    expect(normalizeReleaseTag("refs/tags/v0.2.0")).toBe("0.2.0");
    expect(normalizeReleaseTag("v0.2.0")).toBe("0.2.0");
    expect(normalizeReleaseTag("0.2.0")).toBeUndefined();
  });
});
