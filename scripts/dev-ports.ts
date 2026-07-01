import { createServer } from "node:net";

const defaultDevPort = 8787;
const defaultHost = "127.0.0.1";

export function preferredDevPort(env: NodeJS.ProcessEnv = process.env) {
  return parsePort(env.LARES_DEV_PORT) ?? parsePort(env.PORT) ?? defaultDevPort;
}

export function preferredInspectorPort(devPort: number, env: NodeJS.ProcessEnv = process.env) {
  return parsePort(env.LARES_WRANGLER_INSPECTOR_PORT) ?? devPort + 1;
}

export function localDevUrl(devPort: number, env: NodeJS.ProcessEnv = process.env) {
  return env.LARES_DEV_URL ?? `http://localhost:${devPort}`;
}

export function wranglerPersistTo(repoRoot: string, env: NodeJS.ProcessEnv = process.env) {
  return (
    env.LARES_WRANGLER_PERSIST_TO ?? `${repoRoot.replace(/\/+$/, "")}/apps/engine/.wrangler/state`
  );
}

export async function findAvailablePort(options: {
  readonly host?: string;
  readonly preferredPort?: number;
}) {
  const host = options.host ?? defaultHost;
  const port = options.preferredPort ?? defaultDevPort;

  return isPortAvailable(host, port).then((available) =>
    available ? port : findAvailablePort({ host, preferredPort: port + 1 }),
  );
}

function parsePort(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
}

async function isPortAvailable(host: string, port: number) {
  const server = createServer();
  return await new Promise<boolean>((resolve) => {
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}
