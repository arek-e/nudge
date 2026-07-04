import { describe, expect, test } from "bun:test";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

describe("worktree direnv environment", () => {
  test("assigns a stable high-band dev environment for a worktree", () => {
    const first = loadWorktreeEnv("/tmp/nudge-alpha");
    const second = loadWorktreeEnv("/tmp/nudge-alpha");

    expect(second).toEqual(first);

    const devPort = Number(first.NUDGE_DEV_PORT);
    expect(devPort).toBeGreaterThanOrEqual(40000);
    expect(devPort).toBeLessThanOrEqual(60999);
    expect(Number(first.NUDGE_WRANGLER_INSPECTOR_PORT)).toBe(devPort + 1);
    expect(first.NUDGE_DEV_URL).toBe(`http://localhost:${devPort}`);
    expect(first.CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")).toBe(true);
    expect(first.VITE_CLERK_PUBLISHABLE_KEY).toBe(first.CLERK_PUBLISHABLE_KEY);
    expect(first.NUDGE_WORKTREE_ROOT).toBe("/tmp/nudge-alpha");
    expect(first.NUDGE_WRANGLER_PERSIST_TO).toBe("/tmp/nudge-alpha/apps/engine/.wrangler/state");
  });

  test("keeps explicit local overrides while deriving dependent defaults", () => {
    const env = loadWorktreeEnv("/tmp/nudge-alpha", {
      CLERK_PUBLISHABLE_KEY: "pk_test_override",
      NUDGE_DEV_PORT: "45555",
    });

    expect(env.NUDGE_DEV_PORT).toBe("45555");
    expect(env.NUDGE_DEV_URL).toBe("http://localhost:45555");
    expect(env.CLERK_PUBLISHABLE_KEY).toBe("pk_test_override");
    expect(env.VITE_CLERK_PUBLISHABLE_KEY).toBe("pk_test_override");
    expect(env.NUDGE_WRANGLER_INSPECTOR_PORT).toBe("45556");
  });
});

function loadWorktreeEnv(root: string, env: Record<string, string> = {}) {
  const assignments = Object.entries(env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
  const exportLine = Object.keys(env).length === 0 ? "" : `export ${Object.keys(env).join(" ")}`;
  const command = `
    set -eu
    unset NUDGE_WORKTREE_ROOT NUDGE_DEV_PORT NUDGE_DEV_URL NUDGE_WRANGLER_INSPECTOR_PORT NUDGE_WRANGLER_PERSIST_TO CLERK_PUBLISHABLE_KEY VITE_CLERK_PUBLISHABLE_KEY
    ${assignments}
    ${exportLine}
    . ./scripts/worktree-env.sh
    nudge_export_worktree_env ${shellQuote(root)}
    env | sort
  `;
  const result = Bun.spawnSync({
    cmd: ["bash", "-c", command],
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  });

  expect(result.exitCode, result.stderr.toString()).toBe(0);

  return Object.fromEntries(
    result.stdout
      .toString()
      .split("\n")
      .filter(
        (line) =>
          line.startsWith("NUDGE_") ||
          line.startsWith("CLERK_PUBLISHABLE_KEY=") ||
          line.startsWith("VITE_CLERK_PUBLISHABLE_KEY="),
      )
      .map((line) => {
        const equalsIndex = line.indexOf("=");
        return [line.slice(0, equalsIndex), line.slice(equalsIndex + 1)];
      }),
  );
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
