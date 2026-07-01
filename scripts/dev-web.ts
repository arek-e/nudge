import { mkdir } from "node:fs/promises";
import {
  findAvailablePort,
  localDevUrl,
  preferredDevPort,
  preferredInspectorPort,
  wranglerPersistTo,
} from "./dev-ports";

const repoRoot = new URL("..", import.meta.url).pathname;
const logDir = `${repoRoot}tmp/logs/${new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replace(/\.\d{3}Z$/, "Z")}`;
const port = await findAvailablePort({ preferredPort: preferredDevPort() });
const inspectorPort = await findAvailablePort({ preferredPort: preferredInspectorPort(port) });
const ip = "0.0.0.0";
const url = `http://${ip}:${port}`;
const authUrl = process.env.BETTER_AUTH_URL ?? localDevUrl(port);
const persistTo = wranglerPersistTo(repoRoot);
const braintrustEnvFile = `${repoRoot}.env.braintrust`;
const braintrustEnvArgs = (await Bun.file(braintrustEnvFile).exists())
  ? ["--env-file", braintrustEnvFile]
  : [];

await mkdir(logDir, { recursive: true });

console.log(`Lares dev server: ${url}`);
console.log(`Lares local auth URL: ${authUrl}`);
console.log(`Lares Wrangler state: ${persistTo}`);
console.log(`Lares local logs: ${logDir}`);

await run(["bun", "run", "--cwd", "apps/web", "build"], "build.log");
await run(
  [
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--cwd",
    "apps/web",
    "--persist-to",
    persistTo,
  ],
  "d1-migrations.log",
);
await run(
  [
    "wrangler",
    "dev",
    "--cwd",
    "apps/web",
    "--ip",
    ip,
    "--port",
    String(port),
    "--inspector-port",
    String(inspectorPort),
    "--persist-to",
    persistTo,
    "--var",
    `BETTER_AUTH_URL:${authUrl}`,
    ...braintrustEnvArgs,
    ...process.argv.slice(2),
  ],
  "wrangler-dev.log",
);

async function run(command: readonly string[], logName: string) {
  const [cmd, ...args] = command;
  const log = Bun.file(`${logDir}/${logName}`).writer();
  const proc = Bun.spawn([cmd, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdin: "inherit",
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode] = await Promise.all([
    proc.exited,
    tee(proc.stdout, log, process.stdout),
    tee(proc.stderr, log, process.stderr),
  ]);
  log.end();
  if (exitCode !== 0) process.exit(exitCode);
}

async function tee(
  stream: ReadableStream<Uint8Array>,
  log: Bun.FileSink,
  output: NodeJS.WriteStream,
) {
  await stream.pipeTo(
    new WritableStream<Uint8Array>({
      write(chunk) {
        output.write(chunk);
        log.write(chunk);
      },
    }),
  );
}
