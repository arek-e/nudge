import {
  findAvailablePort,
  localDevUrl,
  preferredDevPort,
  preferredInspectorPort,
  wranglerPersistTo,
} from "./dev-ports";

const repoRoot = new URL("..", import.meta.url).pathname;
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

console.log(`Lares dev server: ${url}`);
console.log(`Lares local auth URL: ${authUrl}`);
console.log(`Lares Wrangler state: ${persistTo}`);

await run(["bun", "run", "--cwd", "apps/web", "build"]);
await run([
  "wrangler",
  "d1",
  "migrations",
  "apply",
  "DB",
  "--local",
  "--cwd",
  "apps/engine",
  "--persist-to",
  persistTo,
]);
await run([
  "wrangler",
  "dev",
  "--cwd",
  "apps/engine",
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
]);

async function run(command: readonly string[]) {
  const [cmd, ...args] = command;
  const proc = Bun.spawn([cmd, ...args], {
    cwd: repoRoot,
    env: process.env,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) process.exit(exitCode);
}
