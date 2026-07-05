import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDebugFileUploadCommands,
  buildSourcemapUploadCommands,
  cleanSourcemapArtifacts,
  parseSentryArtifactArgs,
  shouldUploadSentryArtifacts,
} from "./sentry-artifacts";

describe("sentry artifacts", () => {
  test("builds source map inject and upload commands with scoped Sentry env", () => {
    const commands = buildSourcemapUploadCommands({
      directory: "apps/web/dist/client",
      org: "teampitch-m7",
      project: "nudge-web-client",
      release: "nudge-web-client@abc123",
    });

    expect(commands).toEqual([
      {
        command: ["bunx", "--bun", "@sentry/cli", "sourcemaps", "inject", "apps/web/dist/client"],
        env: {
          SENTRY_ORG: "teampitch-m7",
          SENTRY_PROJECT: "nudge-web-client",
          SENTRY_RELEASE: "nudge-web-client@abc123",
        },
      },
      {
        command: [
          "bunx",
          "--bun",
          "@sentry/cli",
          "sourcemaps",
          "upload",
          "--release=nudge-web-client@abc123",
          "apps/web/dist/client",
        ],
        env: {
          SENTRY_ORG: "teampitch-m7",
          SENTRY_PROJECT: "nudge-web-client",
          SENTRY_RELEASE: "nudge-web-client@abc123",
        },
      },
    ]);
  });

  test("builds debug file upload commands for native symbols", () => {
    const commands = buildDebugFileUploadCommands({
      org: "teampitch-m7",
      paths: ["apps/ios/build/Nudge.xcarchive/dSYMs"],
      project: "nudge-ios",
    });

    expect(commands).toEqual([
      {
        command: [
          "bunx",
          "--bun",
          "@sentry/cli",
          "debug-files",
          "upload",
          "apps/ios/build/Nudge.xcarchive/dSYMs",
        ],
        env: {
          SENTRY_ORG: "teampitch-m7",
          SENTRY_PROJECT: "nudge-ios",
        },
      },
    ]);
  });

  test("requires an explicit upload flag and token before running Sentry CLI", () => {
    expect(
      shouldUploadSentryArtifacts({
        SENTRY_AUTH_TOKEN: "token",
        SENTRY_UPLOAD_ARTIFACTS: "true",
      }),
    ).toBe(true);
    expect(
      shouldUploadSentryArtifacts({
        SENTRY_AUTH_TOKEN: "token",
        SENTRY_UPLOAD_ARTIFACTS: "1",
      }),
    ).toBe(true);
    expect(shouldUploadSentryArtifacts({ SENTRY_AUTH_TOKEN: "token" })).toBe(false);
    expect(shouldUploadSentryArtifacts({ SENTRY_UPLOAD_ARTIFACTS: "true" })).toBe(false);
  });

  test("parses source map and debug-file CLI arguments", () => {
    expect(
      parseSentryArtifactArgs([
        "sourcemaps",
        "--project",
        "nudge-web-client",
        "--path",
        "apps/web/dist/client",
        "--release",
        "nudge-web-client@abc123",
      ]),
    ).toEqual({
      directory: "apps/web/dist/client",
      kind: "sourcemaps",
      org: "teampitch-m7",
      project: "nudge-web-client",
      release: "nudge-web-client@abc123",
    });

    expect(
      parseSentryArtifactArgs([
        "debug-files",
        "--project",
        "nudge-ios",
        "--path",
        "apps/ios/build/Nudge.xcarchive/dSYMs",
      ]),
    ).toEqual({
      kind: "debug-files",
      org: "teampitch-m7",
      paths: ["apps/ios/build/Nudge.xcarchive/dSYMs"],
      project: "nudge-ios",
    });
  });

  test("removes source map files and references from deployable output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nudge-sentry-artifacts-"));
    const browserBundle = join(directory, "bundle.js");
    const desktopBundle = join(directory, "preload.cjs");
    await writeFile(browserBundle, "console.log('browser')\n//# sourceMappingURL=bundle.js.map");
    await writeFile(desktopBundle, "console.log('desktop')\n//# sourceMappingURL=preload.cjs.map");
    await writeFile(join(directory, "bundle.js.map"), "{}");
    await writeFile(join(directory, "preload.cjs.map"), "{}");

    try {
      const removed = await cleanSourcemapArtifacts(directory);

      expect(removed.map((file) => file.split("/").at(-1)).sort()).toEqual([
        "bundle.js.map",
        "preload.cjs.map",
      ]);
      expect(await readFile(browserBundle, "utf8")).not.toContain("sourceMappingURL");
      expect(await readFile(desktopBundle, "utf8")).not.toContain("sourceMappingURL");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
