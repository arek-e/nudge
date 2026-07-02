import { describe, expect, test } from "bun:test";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

describe("worktree direnv environment", () => {
  test("assigns a stable high-band dev environment for a worktree", () => {
    const first = loadWorktreeEnv("/tmp/vesta-alpha");
    const second = loadWorktreeEnv("/tmp/vesta-alpha");

    expect(second).toEqual(first);

    const devPort = Number(first.VESTA_DEV_PORT);
    expect(devPort).toBeGreaterThanOrEqual(40000);
    expect(devPort).toBeLessThanOrEqual(60999);
    expect(Number(first.VESTA_WRANGLER_INSPECTOR_PORT)).toBe(devPort + 1);
    expect(first.VESTA_DEV_URL).toBe(`http://localhost:${devPort}`);
    expect(first.CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")).toBe(true);
    expect(first.VITE_CLERK_PUBLISHABLE_KEY).toBe(first.CLERK_PUBLISHABLE_KEY);
    expect(first.VESTA_WORKTREE_ROOT).toBe("/tmp/vesta-alpha");
    expect(first.VESTA_WRANGLER_PERSIST_TO).toBe("/tmp/vesta-alpha/apps/engine/.wrangler/state");
  });

  test("keeps explicit local overrides while deriving dependent defaults", () => {
    const env = loadWorktreeEnv("/tmp/vesta-alpha", {
      CLERK_PUBLISHABLE_KEY: "pk_test_override",
      VESTA_DEV_PORT: "45555",
    });

    expect(env.VESTA_DEV_PORT).toBe("45555");
    expect(env.VESTA_DEV_URL).toBe("http://localhost:45555");
    expect(env.CLERK_PUBLISHABLE_KEY).toBe("pk_test_override");
    expect(env.VITE_CLERK_PUBLISHABLE_KEY).toBe("pk_test_override");
    expect(env.VESTA_WRANGLER_INSPECTOR_PORT).toBe("45556");
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
    vesta_export_worktree_env ${shellQuote(root)}
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
          line.startsWith("VESTA_") ||
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
