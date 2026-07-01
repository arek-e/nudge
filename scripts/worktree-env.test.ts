import { describe, expect, test } from "bun:test";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

describe("worktree direnv environment", () => {
  test("assigns a stable high-band dev environment for a worktree", () => {
    const first = loadWorktreeEnv("/tmp/lares-alpha");
    const second = loadWorktreeEnv("/tmp/lares-alpha");

    expect(second).toEqual(first);

    const devPort = Number(first.LARES_DEV_PORT);
    expect(devPort).toBeGreaterThanOrEqual(40000);
    expect(devPort).toBeLessThanOrEqual(60999);
    expect(Number(first.LARES_WRANGLER_INSPECTOR_PORT)).toBe(devPort + 1);
    expect(first.LARES_DEV_URL).toBe(`http://localhost:${devPort}`);
    expect(first.BETTER_AUTH_URL).toBe(first.LARES_DEV_URL);
    expect(first.LARES_WORKTREE_ROOT).toBe("/tmp/lares-alpha");
    expect(first.LARES_WRANGLER_PERSIST_TO).toBe("/tmp/lares-alpha/apps/engine/.wrangler/state");
  });

  test("keeps explicit local overrides while deriving dependent defaults", () => {
    const env = loadWorktreeEnv("/tmp/lares-alpha", {
      BETTER_AUTH_URL: "http://localhost:45557",
      LARES_DEV_PORT: "45555",
    });

    expect(env.LARES_DEV_PORT).toBe("45555");
    expect(env.LARES_DEV_URL).toBe("http://localhost:45555");
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:45557");
    expect(env.LARES_WRANGLER_INSPECTOR_PORT).toBe("45556");
  });
});

function loadWorktreeEnv(root: string, env: Record<string, string> = {}) {
  const assignments = Object.entries(env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
  const exportLine = Object.keys(env).length === 0 ? "" : `export ${Object.keys(env).join(" ")}`;
  const command = `
    set -eu
    ${assignments}
    ${exportLine}
    . ./scripts/worktree-env.sh
    lares_export_worktree_env ${shellQuote(root)}
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
      .filter((line) => line.startsWith("LARES_") || line.startsWith("BETTER_AUTH_URL="))
      .map((line) => {
        const equalsIndex = line.indexOf("=");
        return [line.slice(0, equalsIndex), line.slice(equalsIndex + 1)];
      }),
  );
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
