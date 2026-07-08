import { createServer } from "node:net";

const defaultDevPort = 8787;
const defaultHost = "127.0.0.1";

export function preferredDevPort(env: NodeJS.ProcessEnv = process.env) {
  return parsePort(env.NUDGE_DEV_PORT) ?? parsePort(env.PORT) ?? defaultDevPort;
}

export function preferredInspectorPort(devPort: number, env: NodeJS.ProcessEnv = process.env) {
  return parsePort(env.NUDGE_WRANGLER_INSPECTOR_PORT) ?? devPort + 1;
}

export function preferredWorkerPort(devPort: number, env: NodeJS.ProcessEnv = process.env) {
  return parsePort(env.NUDGE_WORKER_DEV_PORT) ?? devPort + 100;
}

export function localDevUrl(devPort: number, env: NodeJS.ProcessEnv = process.env) {
  return env.NUDGE_DEV_URL ?? `http://localhost:${devPort}`;
}

export function wranglerPersistTo(repoRoot: string, env: NodeJS.ProcessEnv = process.env) {
  return (
    env.NUDGE_WRANGLER_PERSIST_TO ?? `${repoRoot.replace(/\/+$/, "")}/apps/engine/.wrangler/state`
  );
}

export async function findAvailablePort(options: {
  readonly host?: string;
  readonly preferredPort?: number;
  readonly reservedPorts?: ReadonlyArray<number>;
}) {
  const host = options.host ?? defaultHost;
  const port = options.preferredPort ?? defaultDevPort;
  const reservedPorts = new Set(options.reservedPorts ?? []);

  return isPortAvailable(host, port).then((available) =>
    available && !reservedPorts.has(port)
      ? port
      : findAvailablePort({
          host,
          preferredPort: port + 1,
          reservedPorts: options.reservedPorts,
        }),
  );
}

function parsePort(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
}

async function isPortAvailable(host: string, port: number) {
  const hosts = host === "0.0.0.0" ? ["0.0.0.0", defaultHost, "::1"] : [host];
  const availability = await Promise.all(
    hosts.map((candidateHost) => isPortAvailableOnHost(candidateHost, port)),
  );
  return availability.every(Boolean);
}

async function isPortAvailableOnHost(host: string, port: number) {
  const server = createServer();
  return await new Promise<boolean>((resolve) => {
    server.once("error", (error) => {
      const code = Reflect.get(error, "code");
      resolve(code !== "EADDRINUSE" && code !== "EACCES");
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}
