import { describe, expect, test } from "bun:test";
import { devLogDir, devLogFile, devLogTimestamp, latestDevLogDir } from "./dev-logs";

describe("dev logs", () => {
  test("formats log directories with a filesystem-safe timestamp", () => {
    const date = new Date("2026-07-08T10:11:12.123Z");

    expect(devLogTimestamp(date)).toBe("2026-07-08T10-11-12Z");
    expect(devLogDir("/worktrees/nudge/", date)).toBe(
      "/worktrees/nudge/tmp/logs/2026-07-08T10-11-12Z",
    );
  });

  test("exposes stable current-run paths for agents", () => {
    expect(latestDevLogDir("/worktrees/nudge/")).toBe("/worktrees/nudge/tmp/logs/latest");
    expect(devLogFile("/worktrees/nudge/tmp/logs/latest/")).toBe(
      "/worktrees/nudge/tmp/logs/latest/dev.log",
    );
  });
});
