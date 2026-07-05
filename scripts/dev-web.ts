import { mkdir, writeFile } from "node:fs/promises";
import {
  findAvailablePort,
  preferredDevPort,
  preferredInspectorPort,
  wranglerPersistTo,
} from "./dev-ports";
import {
  envFileContent,
  wranglerClerkEnvEntries,
  wranglerClerkEnvFileArgs,
  wranglerLocalConfigArgs,
} from "./dev-web-config";

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
const wranglerArgs = process.argv.slice(2);
const configArgs = wranglerLocalConfigArgs(wranglerArgs);
const clerkEnvEntries = wranglerClerkEnvEntries(process.env);
const clerkEnvFile = clerkEnvEntries.length ? `${logDir}/clerk.env` : null;
const clerkEnvArgs = wranglerClerkEnvFileArgs(clerkEnvFile);
const braintrustEnvFile = `${repoRoot}.env.braintrust`;
const braintrustEnvArgs = (await Bun.file(braintrustEnvFile).exists())
  ? ["--env-file", braintrustEnvFile]
  : [];

await mkdir(logDir, { recursive: true });
if (clerkEnvFile) {
  await writeFile(clerkEnvFile, envFileContent(clerkEnvEntries), { mode: 0o600 });
}

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
    ...clerkEnvArgs,
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
