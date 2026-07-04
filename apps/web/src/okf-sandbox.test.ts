import { describe, expect, test } from "bun:test";
import { buildOkfProjection } from "@nudge/effect-services";
import { smokeTestOkfProjection, type OkfSandbox } from "./okf-sandbox";

describe("OKF sandbox smoke", () => {
  test("mounts projected OKF files from an R2 prefix when bucket mounting is available", async () => {
    const anonymousUserId = "anon_550e8400-e29b-41d4-a716-446655440000";
    const bucket = new Map<string, string>([
      [`okf/${anonymousUserId}/daily/stale.md`, "old"],
      ["other/keep.md", "keep"],
    ]);
    const calls: string[] = [];
    const sandbox = {
      deletePrefix: async (prefix) => {
        calls.push(`deletePrefix ${prefix}`);
        for (const key of [...bucket.keys()]) {
          if (key.startsWith(prefix)) bucket.delete(key);
        }
      },
      exec: async (command, options) => {
        calls.push(`exec ${options?.cwd ?? ""} ${command}`);
        return {
          exitCode: 0,
          stderr: "",
          stdout: [...bucket.keys()].sort().join("\n"),
          success: true,
        };
      },
      mkdir: async (path) => {
        calls.push(`mkdir ${path}`);
      },
      mountBucket: async (bucketName, mountPath, options) => {
        calls.push(
          `mountBucket ${bucketName} ${mountPath} ${options.prefix} ${String(options.readOnly)}`,
        );
      },
      putObject: async (key, content) => {
        bucket.set(key, content);
      },
      writeFile: async () => {
        throw new Error("mounted OKF should not write files directly");
      },
    } satisfies OkfSandbox;
    const projection = buildOkfProjection({
      user: { id: anonymousUserId, displayName: "Anonymous User" },
      dailyNotes: [
        {
          id: "note-1",
          userId: anonymousUserId,
          localDate: "2026-06-29",
          title: "June 29",
          bodyText: "Mounted through R2.",
          createdAt: "2026-06-29T08:00:00.000Z",
          updatedAt: "2026-06-29T09:00:00.000Z",
        },
      ],
      extractedItems: [],
      memoryDocuments: [],
      summaryDocuments: [],
    });

    await smokeTestOkfProjection(sandbox, projection);

    expect(bucket.has(`okf/${anonymousUserId}/daily/stale.md`)).toBe(false);
    expect(bucket.get(`okf/${anonymousUserId}/daily/2026-06-29.md`)).toContain(
      "Mounted through R2.",
    );
    expect(bucket.get("other/keep.md")).toBe("keep");
    expect(calls).toContain(`deletePrefix okf/${anonymousUserId}/`);
    expect(calls).toContain(`mountBucket OKF_FILES /workspace/okf /okf/${anonymousUserId}/ true`);
  });

  test("clears stale OKF files before materializing the current projection", async () => {
    const files = new Map<string, string>([
      ["/workspace/okf/daily/stale.md", "old"],
      ["/workspace/other/keep.md", "keep"],
    ]);
    const sandbox = {
      exec: async (command, options) => {
        if (command.includes("shutil.rmtree") && options?.cwd === "/workspace/okf") {
          for (const path of [...files.keys()]) {
            if (path.startsWith("/workspace/okf/")) files.delete(path);
          }
          return { exitCode: 0, stderr: "", stdout: "", success: true };
        }
        return {
          exitCode: 0,
          stderr: "",
          stdout: [...files.keys()].sort().join("\n"),
          success: true,
        };
      },
      mkdir: async () => {},
      writeFile: async (path, content) => {
        files.set(path, content);
      },
    } satisfies OkfSandbox;
    const projection = buildOkfProjection({
      user: { id: "user-1", displayName: "Alex" },
      dailyNotes: [
        {
          id: "note-1",
          userId: "user-1",
          localDate: "2026-06-29",
          title: "June 29",
          bodyText: "Fresh OKF file.",
          createdAt: "2026-06-29T08:00:00.000Z",
          updatedAt: "2026-06-29T09:00:00.000Z",
        },
      ],
      extractedItems: [],
      memoryDocuments: [],
      summaryDocuments: [],
    });

    await smokeTestOkfProjection(sandbox, projection);

    expect(files.has("/workspace/okf/daily/stale.md")).toBe(false);
    expect(files.get("/workspace/okf/daily/2026-06-29.md")).toContain("Fresh OKF file.");
    expect(files.get("/workspace/other/keep.md")).toBe("keep");
  });

  test("materializes projected OKF files where sandbox shell commands can inspect them", async () => {
    const calls: string[] = [];
    const files = new Map<string, string>();
    const sandbox = {
      exec: async (command, options) => {
        calls.push(`exec ${options?.cwd ?? ""} ${command}`);
        return {
          exitCode: 0,
          stderr: "",
          stdout: [...files.keys()].sort().join("\n"),
          success: true,
        };
      },
      mkdir: async (path) => {
        calls.push(`mkdir ${path}`);
      },
      writeFile: async (path, content) => {
        files.set(path, content);
      },
    } satisfies OkfSandbox;
    const projection = buildOkfProjection({
      user: { id: "user-1", displayName: "Alex" },
      dailyNotes: [
        {
          id: "note-1",
          userId: "user-1",
          localDate: "2026-06-29",
          title: "June 29",
          bodyText: "OKF mounted memory.",
          createdAt: "2026-06-29T08:00:00.000Z",
          updatedAt: "2026-06-29T09:00:00.000Z",
        },
      ],
      extractedItems: [],
      memoryDocuments: [],
      summaryDocuments: [],
    });

    const result = await smokeTestOkfProjection(sandbox, projection);

    expect(result.success).toBe(true);
    expect(files.get("/workspace/okf/daily/2026-06-29.md")).toContain("OKF mounted memory.");
    expect(calls).toContain("mkdir /workspace/okf/daily");
    expect(calls.at(-1)).toBe(
      'exec /workspace/okf find . -type f | sort && grep -R "type:" daily memory',
    );
  });
});
