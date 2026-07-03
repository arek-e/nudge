import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:net";
import {
  findAvailablePort,
  localDevUrl,
  preferredDevPort,
  preferredInspectorPort,
  wranglerPersistTo,
} from "./dev-ports";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  servers.length = 0;
});

describe("dev ports", () => {
  test("chooses the preferred port when it is available", async () => {
    await expect(findAvailablePort({ host: "127.0.0.1", preferredPort: 18887 })).resolves.toBe(
      18887,
    );
  });

  test("moves to the next port when the preferred port is busy", async () => {
    servers.push(await listen(18888));

    await expect(findAvailablePort({ host: "127.0.0.1", preferredPort: 18888 })).resolves.toBe(
      18889,
    );
  });

  test("uses environment override before the default dev port", () => {
    expect(preferredDevPort({ NUDGE_DEV_PORT: "18990", PORT: "18887" })).toBe(18990);
    expect(preferredDevPort({ PORT: "18887" })).toBe(18887);
    expect(preferredDevPort({})).toBe(8787);
  });

  test("derives related local dev settings from the selected port and worktree", () => {
    expect(preferredInspectorPort(45555, {})).toBe(45556);
    expect(preferredInspectorPort(45555, { NUDGE_WRANGLER_INSPECTOR_PORT: "46666" })).toBe(46666);
    expect(localDevUrl(45555, {})).toBe("http://localhost:45555");
    expect(localDevUrl(45555, { NUDGE_DEV_URL: "http://127.0.0.1:45555" })).toBe(
      "http://127.0.0.1:45555",
    );
    expect(wranglerPersistTo("/worktrees/nudge", {})).toBe(
      "/worktrees/nudge/apps/engine/.wrangler/state",
    );
    expect(wranglerPersistTo("/worktrees/nudge", { NUDGE_WRANGLER_PERSIST_TO: "/tmp/state" })).toBe(
      "/tmp/state",
    );
  });
});

async function listen(port: number) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}
