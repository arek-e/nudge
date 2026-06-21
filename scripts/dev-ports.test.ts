import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:net";
import { findAvailablePort, preferredDevPort } from "./dev-ports";

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
    expect(preferredDevPort({ LARES_DEV_PORT: "18990", PORT: "18887" })).toBe(18990);
    expect(preferredDevPort({ PORT: "18887" })).toBe(18887);
    expect(preferredDevPort({})).toBe(8787);
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
