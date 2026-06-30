const root = new URL("..", import.meta.url).pathname;
const web = new URL("../apps/web", import.meta.url).pathname;

const args = new Set(process.argv.slice(2));
const allowDirty = args.has("--allow-dirty");
const dryRun = args.has("--dry-run");
const envArg = process.argv.find((arg) => arg.startsWith("--env="));
const env = envArg?.slice("--env=".length);
const versionArg = process.argv.find((arg) => arg.startsWith("--version="));
const requestedVersion = versionArg?.slice("--version=".length).trim();

const run = (
  command: string,
  options: { readonly cwd?: string; readonly env?: Record<string, string> } = {},
) => {
  const result = Bun.spawnSync(["bash", "-lc", command], {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stderr: "inherit",
    stdout: "inherit",
  });

  if (!result.success) {
    process.exit(result.exitCode ?? 1);
  }
};

const output = (command: string) => {
  const result = Bun.spawnSync(["bash", "-lc", command], {
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });

  if (!result.success) {
    process.stderr.write(result.stderr);
    process.exit(result.exitCode ?? 1);
  }

  return result.stdout.toString().trim();
};

const status = output("git status --porcelain");
if (status && !allowDirty) {
  console.error("Refusing to deploy with uncommitted changes.");
  console.error(
    "Commit or stash changes first, or rerun with --allow-dirty for an explicit prototype deploy.",
  );
  process.exit(1);
}

const commit = output("git rev-parse --short HEAD");
const version = requestedVersion || (allowDirty && status ? `${commit}-dirty` : commit);
const deployEnvironment = env ?? "production";
const deployArgs = [
  env ? `--env ${env}` : "",
  dryRun ? "--dry-run" : "",
  `--var ENVIRONMENT:${deployEnvironment}`,
  `--var APP_VERSION:${version}`,
  `--tag ${version}`,
  `--message ${JSON.stringify(`Deploy ${version}`)}`,
]
  .filter(Boolean)
  .join(" ");

run("mise exec -- bun run check");
run("mise exec -- bun run build", { cwd: web });
run(`mise exec -- bunx wrangler deploy ${deployArgs}`, { cwd: web });

console.log(`${dryRun ? "Dry-run verified" : "Deployed"} lares-web at ${version}`);
