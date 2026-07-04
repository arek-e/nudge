import { mkdir } from "node:fs/promises";
import {
  findAvailablePort,
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
const persistTo = wranglerPersistTo(repoRoot);
const clerkVarArgs = wranglerClerkVarArgs();
const wranglerArgs = process.argv.slice(2);
const configArgs = wranglerLocalConfigArgs(wranglerArgs);
const braintrustEnvFile = `${repoRoot}.env.braintrust`;
const braintrustEnvArgs = (await Bun.file(braintrustEnvFile).exists())
  ? ["--env-file", braintrustEnvFile]
  : [];

await mkdir(logDir, { recursive: true });

console.log(`Nudge dev server: ${url}`);
console.log(
  `Nudge Clerk publishable key: ${process.env.CLERK_PUBLISHABLE_KEY ? "configured" : "missing"}`,
);
console.log(`Nudge Convex URL: ${process.env.CONVEX_URL ? "configured" : "using config default"}`);
console.log(`Nudge Wrangler config: ${configArgs.length ? configArgs[1] : "wrangler.jsonc"}`);
console.log(`Nudge Wrangler state: ${persistTo}`);
console.log(`Nudge local logs: ${logDir}`);

await run(["bun", "run", "--cwd", "apps/web", "build"], "build.log");
await run(
  [
    "wrangler",
    "dev",
    "--cwd",
    "apps/web",
    ...configArgs,
    "--ip",
    ip,
    "--port",
    String(port),
    "--inspector-port",
    String(inspectorPort),
    "--persist-to",
    persistTo,
    ...clerkVarArgs,
    ...convexVarArgs(),
    ...braintrustEnvArgs,
    ...wranglerArgs,
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

function convexVarArgs() {
  const entries = [
    ["CONVEX_RUNTIME_SECRET", process.env.CONVEX_RUNTIME_SECRET],
    ["CONVEX_URL", process.env.CONVEX_URL],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return entries.flatMap(([name, value]) => ["--var", `${name}:${value}`]);
}

function wranglerClerkVarArgs() {
  const entries = [
    ["CLERK_AUTHORIZED_PARTIES", process.env.CLERK_AUTHORIZED_PARTIES],
    ["CLERK_PUBLISHABLE_KEY", process.env.CLERK_PUBLISHABLE_KEY],
    ["CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return entries.flatMap(([name, value]) => ["--var", `${name}:${value}`]);
}

function wranglerLocalConfigArgs(args: readonly string[]) {
  const hasExplicitConfig = args.some(
    (arg, index) =>
      arg === "--config" ||
      arg === "-c" ||
      arg.startsWith("--config=") ||
      args[index - 1] === "--config" ||
      args[index - 1] === "-c",
  );
  const usesRemoteDev = args.includes("--remote");

  return hasExplicitConfig || usesRemoteDev ? [] : ["--config", "wrangler.local.jsonc"];
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
