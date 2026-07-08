import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { devLogDir, devLogFile, latestDevLogDir } from "./dev-logs";
import {
  findAvailablePort,
  preferredDevPort,
  preferredInspectorPort,
  preferredWorkerPort,
  wranglerPersistTo,
} from "./dev-ports";
import {
  envFileContent,
  missingRequiredLocalDevSecrets,
  missingRequiredLocalDevSecretsMessage,
  wranglerDevEnvFileArgs,
  wranglerDevEnvEntries,
  wranglerDevVarArgs,
  wranglerLocalConfigArgs,
} from "./dev-web-config";

const repoRoot = new URL("..", import.meta.url).pathname;
const logDir = devLogDir(repoRoot);
const latestLogDir = latestDevLogDir(repoRoot);
const devLogPath = devLogFile(logDir);
const scriptArgs = process.argv.slice(2);
const usesBuildPreview = scriptArgs.includes("--build-preview");
const wranglerArgs = scriptArgs.filter((arg) => arg !== "--build-preview");
const usesRemoteWorker = wranglerArgs.includes("--remote");
const wranglerEnvironment = wranglerEnvironmentFromArgs(wranglerArgs);
const bindHost = "0.0.0.0";
const port = await findAvailablePort({ host: bindHost, preferredPort: preferredDevPort() });
const workerPreferredPort = preferredWorkerPort(port);
const workerPort = usesBuildPreview
  ? port
  : await findAvailablePort({
      host: bindHost,
      preferredPort: workerPreferredPort === port ? workerPreferredPort + 1 : workerPreferredPort,
      reservedPorts: [port],
    });
const inspectorPreferredPort = preferredInspectorPort(workerPort);
const inspectorPort = await findAvailablePort({
  host: bindHost,
  preferredPort:
    inspectorPreferredPort === workerPort ? inspectorPreferredPort + 1 : inspectorPreferredPort,
  reservedPorts: [port, workerPort],
});
const url = `http://localhost:${port}`;
const workerUrl = `http://127.0.0.1:${workerPort}`;
const environmentClientEnv = viteClientEnvironmentFor(wranglerEnvironment);
const viteClientEnv = {
  ...process.env,
  ...environmentClientEnv,
  VITE_CLERK_PUBLISHABLE_KEY:
    process.env.VITE_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY ??
    environmentClientEnv.VITE_CLERK_PUBLISHABLE_KEY,
  VITE_CONVEX_URL:
    process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL ?? environmentClientEnv.VITE_CONVEX_URL,
  NUDGE_VITE_PROXY_TARGET: workerUrl,
};
const persistTo = wranglerPersistTo(repoRoot);
const configArgs = wranglerLocalConfigArgs(wranglerArgs);
const wranglerEnvEntries = wranglerDevEnvEntries(
  usesRemoteWorker ? remoteWorkerEnvSource(process.env) : localWorkerEnvSource(process.env),
);
const wranglerEnvFile = wranglerEnvEntries.length ? `${logDir}/worker.env` : null;
const wranglerEnvArgs = wranglerDevEnvFileArgs(wranglerEnvFile);
const wranglerVarArgs = usesRemoteWorker
  ? []
  : wranglerDevVarArgs([["CLERK_AUTHORIZED_PARTIES", localAuthorizedParties(process.env, port)]]);
const braintrustEnvFile = `${repoRoot}.env.braintrust`;
const braintrustEnvArgs = (await Bun.file(braintrustEnvFile).exists())
  ? ["--env-file", braintrustEnvFile]
  : [];

await resetDevLogDir(logDir);
const devLog = Bun.file(devLogPath).writer();
await refreshLatestLogDir(logDir, latestLogDir);
if (wranglerEnvFile) {
  await writeFile(wranglerEnvFile, envFileContent(wranglerEnvEntries), { mode: 0o600 });
}

logLine(`Nudge dev server: ${url}`);
logLine(
  `Nudge dev mode: ${
    usesBuildPreview
      ? "wrangler build preview"
      : usesRemoteWorker
        ? "vite hmr + remote worker"
        : "vite hmr + local worker"
  }`,
);
if (!usesBuildPreview) logLine(`Nudge Worker proxy: ${workerUrl}`);
logLine(
  `Nudge Clerk publishable key: ${
    viteClientEnv.VITE_CLERK_PUBLISHABLE_KEY ? "configured" : "missing"
  }`,
);
logLine(`Nudge Clerk secret key: ${process.env.CLERK_SECRET_KEY ? "configured" : "missing"}`);
logLine(
  `Nudge Convex runtime secret: ${process.env.CONVEX_RUNTIME_SECRET ? "configured" : "missing"}`,
);
logLine(`Nudge Convex URL: ${viteClientEnv.VITE_CONVEX_URL ? "configured" : "missing"}`);
logLine(`Nudge Wrangler config: ${configArgs.length ? configArgs[1] : "wrangler.jsonc"}`);
logLine(`Nudge Wrangler state: ${persistTo}`);
logLine(`Nudge local logs: ${logDir}`);
logLine(`Nudge latest logs: ${latestLogDir}`);
logLine(`Nudge dev log: ${devLogPath}`);

const missingRequiredSecrets = usesRemoteWorker ? [] : missingRequiredLocalDevSecrets(process.env);
const requiredSecretsMessage = missingRequiredLocalDevSecretsMessage(missingRequiredSecrets);
if (requiredSecretsMessage) {
  logLine(requiredSecretsMessage);
  devLog.end();
  process.exit(1);
}

const missingRequiredClientEnv = missingRequiredViteClientEnv(viteClientEnv);
if (missingRequiredClientEnv.length > 0) {
  logLine(
    [
      `Missing required local client env: ${missingRequiredClientEnv.join(", ")}`,
      "Load direnv or set these values in .envrc.local before running bun dev.",
    ].join("\n"),
  );
  devLog.end();
  process.exit(1);
}

const wranglerCommand = [
  "wrangler",
  "dev",
  "--cwd",
  "apps/web",
  ...configArgs,
  "--ip",
  bindHost,
  "--port",
  String(workerPort),
  "--inspector-port",
  String(inspectorPort),
  "--persist-to",
  persistTo,
  ...wranglerVarArgs,
  ...wranglerEnvArgs,
  ...braintrustEnvArgs,
  ...wranglerArgs,
];

const runningCommands = new Set<Bun.Subprocess<"ignore", "pipe", "pipe">>();
let cleanupStarted = false;
let exitCode = 0;
try {
  installShutdownHandlers([port, workerPort, inspectorPort]);
  if (usesBuildPreview) {
    exitCode = await run(["bun", "run", "--cwd", "apps/web", "build"], "build.log");
    if (exitCode === 0) exitCode = await run(wranglerCommand, "wrangler-dev.log");
  } else {
    exitCode = await runTogether([
      {
        command: wranglerCommand,
        logName: "wrangler-dev.log",
      },
      {
        command: ["bun", "x", "vite", "--host", bindHost, "--port", String(port), "--strictPort"],
        cwd: `${repoRoot}apps/web`,
        env: viteClientEnv,
        logName: "vite-dev.log",
      },
    ]);
  }
} finally {
  await cleanupRunningCommands([port, workerPort, inspectorPort]);
  devLog.end();
}

if (exitCode !== 0) process.exit(exitCode);

interface DevCommand {
  readonly command: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly logName: string;
}

interface RunningCommand {
  readonly output: Promise<unknown>;
  readonly proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
}

async function run(command: readonly string[], logName: string) {
  const running = start({ command, logName });
  const [commandExitCode] = await Promise.all([running.proc.exited, running.output]);
  return commandExitCode;
}

async function runTogether(commands: readonly DevCommand[]) {
  const running = commands.map((command) => start(command));
  const firstExit = await Promise.race(
    running.map(async (entry) => ({
      entry,
      exitCode: await entry.proc.exited,
    })),
  );

  for (const entry of running) {
    if (entry !== firstExit.entry) entry.proc.kill();
  }

  await Promise.allSettled(
    running.map(async (entry) => {
      await entry.proc.exited;
      await entry.output;
    }),
  );
  await cleanupRunningCommands([port, workerPort, inspectorPort]);

  return firstExit.exitCode;
}

function start(options: DevCommand): RunningCommand {
  const { args, cmd } = commandParts(options.command);
  logLine(`$ ${[cmd, ...args].join(" ")}`);
  const log = Bun.file(`${logDir}/${options.logName}`).writer();
  const proc = Bun.spawn([cmd, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    stdin: "inherit",
    stderr: "pipe",
    stdout: "pipe",
  });
  runningCommands.add(proc);
  const output = Promise.all([
    tee(proc.stdout, [log, devLog], process.stdout),
    tee(proc.stderr, [log, devLog], process.stderr),
  ]).finally(() => {
    runningCommands.delete(proc);
    log.end();
  });

  return { output, proc };
}

function installShutdownHandlers(ports: readonly number[]) {
  process.once("SIGINT", () => {
    void shutdownFromSignal(ports, 130);
  });
  process.once("SIGTERM", () => {
    void shutdownFromSignal(ports, 143);
  });
}

async function shutdownFromSignal(ports: readonly number[], signalExitCode: number) {
  await cleanupRunningCommands(ports);
  devLog.end();
  process.exit(signalExitCode);
}

async function cleanupRunningCommands(ports: readonly number[]) {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const commands = [...runningCommands];
  for (const command of commands) {
    command.kill();
  }

  await Promise.race([Promise.allSettled(commands.map((command) => command.exited)), sleep(750)]);

  for (const pid of await repoOwnedListenerPids(ports)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The process may have exited after lsof reported it.
    }
  }

  await sleep(250);
}

async function repoOwnedListenerPids(ports: readonly number[]) {
  const pidGroups = await Promise.all(ports.map((candidatePort) => listenerPids(candidatePort)));
  const uniquePids = [...new Set(pidGroups.flat())];
  const ownership = await Promise.all(
    uniquePids.map(async (pid) => ({
      owned: await isRepoOwnedPid(pid),
      pid,
    })),
  );
  return ownership.filter((entry) => entry.owned).map((entry) => entry.pid);
}

async function listenerPids(candidatePort: number) {
  const proc = Bun.spawn(["lsof", "-nP", `-tiTCP:${candidatePort}`, "-sTCP:LISTEN"], {
    stderr: "ignore",
    stdin: "ignore",
    stdout: "pipe",
  });
  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function isRepoOwnedPid(pid: number) {
  const proc = Bun.spawn(["ps", "-p", String(pid), "-o", "command="], {
    stderr: "ignore",
    stdin: "ignore",
    stdout: "pipe",
  });
  const command = await new Response(proc.stdout).text();
  await proc.exited;
  return command.includes(repoRoot.replace(/\/+$/, ""));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshLatestLogDir(target: string, link: string) {
  await rm(link, { force: true, recursive: true });
  await symlink(target, link, "dir");
}

async function resetDevLogDir(path: string) {
  await rm(path, { force: true, recursive: true });
  await mkdir(path, { recursive: true });
}

function logLine(message: string) {
  console.log(message);
  devLog.write(`${message}\n`);
}

function commandParts(command: readonly string[]) {
  const [cmd, ...args] = command;
  if (!cmd) throw new Error("Cannot run an empty command.");
  return { args, cmd };
}

function wranglerEnvironmentFromArgs(args: readonly string[]) {
  for (const [index, arg] of args.entries()) {
    if (arg === "--env") {
      const value = args[index + 1];
      return value && !value.startsWith("-") ? value : undefined;
    }
    if (arg.startsWith("--env=")) return arg.slice("--env=".length);
  }
  return undefined;
}

function viteClientEnvironmentFor(environment: string | undefined): NodeJS.ProcessEnv {
  if (environment === "staging") {
    return {
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_cmVuZXdlZC1zZWFzbmFpbC0zOC5jbGVyay5hY2NvdW50cy5kZXYk",
      VITE_CONVEX_URL: "https://abundant-retriever-130.eu-west-1.convex.cloud",
      VITE_NUDGE_LOGO_LONG_SRC: "/icons/nudge-logo-lockup-blobby-n-transparent.svg",
      VITE_SENTRY_DSN:
        "https://3fe4af305fc498b5a216f68af4e898ab@o4510926758150144.ingest.de.sentry.io/4510926760312912",
      VITE_SENTRY_ENVIRONMENT: "staging",
      VITE_SENTRY_TRACES_SAMPLE_RATE: "0.05",
    };
  }

  if (environment === "production") {
    return {
      VITE_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuYXBwLmV4cGxvcmVudWRnZS5jb20k",
      VITE_CLERK_PROXY_URL: "/__clerk",
      VITE_CONVEX_URL: "https://friendly-lion-904.eu-west-1.convex.cloud",
      VITE_SENTRY_DSN:
        "https://3fe4af305fc498b5a216f68af4e898ab@o4510926758150144.ingest.de.sentry.io/4510926760312912",
      VITE_SENTRY_ENVIRONMENT: "production",
      VITE_SENTRY_TRACES_SAMPLE_RATE: "0.05",
    };
  }

  return {};
}

function missingRequiredViteClientEnv(env: NodeJS.ProcessEnv) {
  const missing: string[] = [];
  if (!env.VITE_CLERK_PUBLISHABLE_KEY) missing.push("VITE_CLERK_PUBLISHABLE_KEY");
  if (!env.VITE_CONVEX_URL) missing.push("VITE_CONVEX_URL");
  return missing;
}

function localWorkerEnvSource(env: NodeJS.ProcessEnv) {
  const source: Record<string, string | undefined> = {};
  source.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
  source.CONVEX_RUNTIME_SECRET = env.CONVEX_RUNTIME_SECRET;
  return source;
}

function remoteWorkerEnvSource(env: NodeJS.ProcessEnv) {
  const source: Record<string, string | undefined> = {};
  source.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
  source.CONVEX_RUNTIME_SECRET = env.CONVEX_RUNTIME_SECRET;
  return source;
}

function localAuthorizedParties(env: NodeJS.ProcessEnv, clientPort: number) {
  return uniqueCsv([
    `http://localhost:${clientPort}`,
    `http://127.0.0.1:${clientPort}`,
    env.CLERK_AUTHORIZED_PARTIES,
    "https://app.explorenudge.com",
    "https://nudge-web.teampitch.workers.dev",
  ]);
}

function uniqueCsv(values: ReadonlyArray<string | undefined>) {
  const unique = new Set<string>();
  for (const value of values) {
    for (const entry of (value ?? "").split(",")) {
      const trimmed = entry.trim();
      if (trimmed.length > 0) unique.add(trimmed);
    }
  }
  return [...unique].join(",");
}

async function tee(
  stream: ReadableStream<Uint8Array>,
  logs: readonly Bun.FileSink[],
  output: NodeJS.WriteStream,
) {
  await stream.pipeTo(
    new WritableStream<Uint8Array>({
      write(chunk) {
        output.write(chunk);
        for (const log of logs) log.write(chunk);
      },
    }),
  );
}
