import { findAvailablePort, preferredDevPort } from "./dev-ports";

const repoRoot = new URL("..", import.meta.url).pathname;
const port = await findAvailablePort({ preferredPort: preferredDevPort() });
const url = `http://127.0.0.1:${port}`;

console.log(`Lares dev server: ${url}`);

await run(["bun", "run", "--cwd", "apps/web", "build"]);
await run(["bun", "run", "db:migrations:apply:local"]);
await run([
  "wrangler",
  "dev",
  "--cwd",
  "apps/web",
  "--port",
  String(port),
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
