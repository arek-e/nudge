const root = new URL("..", import.meta.url).pathname;
const web = new URL("../apps/web", import.meta.url).pathname;
const wrangler = `${root}node_modules/.bin/wrangler`;

const args = new Set(process.argv.slice(2));
const allowDirty = args.has("--allow-dirty");
const dryRun = args.has("--dry-run");
const envArg = process.argv.find((arg) => arg.startsWith("--env="));
const env = envArg?.slice("--env=".length);
const containersRolloutArg = process.argv.find((arg) => arg.startsWith("--containers-rollout="));
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
const clientEnvironmentByDeployTarget: Record<string, Record<string, string>> = {
  production: {
    VITE_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuYXBwLmV4cGxvcmVudWRnZS5jb20k",
    VITE_CLERK_PROXY_URL: "/__clerk",
    VITE_CONVEX_URL: "https://friendly-lion-904.eu-west-1.convex.cloud",
  },
  staging: {
    VITE_CLERK_PUBLISHABLE_KEY: "pk_test_cmVuZXdlZC1zZWFzbmFpbC0zOC5jbGVyay5hY2NvdW50cy5kZXYk",
    VITE_CONVEX_URL: "https://abundant-retriever-130.eu-west-1.convex.cloud",
    VITE_NUDGE_LOGO_LONG_SRC: "/icons/nudge-logo-lockup-blobby-n-transparent.svg",
  },
};
const clientEnvironment = clientEnvironmentByDeployTarget[deployEnvironment];
if (!clientEnvironment) {
  console.error(`Unknown deploy environment: ${deployEnvironment}`);
  process.exit(1);
}
const deployTargetArgs = [`--env ${deployEnvironment}`];
const serverConvexUrl = clientEnvironment.VITE_CONVEX_URL;
const containersRollout =
  containersRolloutArg ?? (deployEnvironment === "production" ? "--containers-rollout=none" : "");
const deployArgs = [
  ...deployTargetArgs,
  containersRollout,
  dryRun ? "--dry-run" : "",
  `--var ENVIRONMENT:${deployEnvironment}`,
  `--var APP_VERSION:${version}`,
  `--var CONVEX_URL:${serverConvexUrl}`,
  `--tag ${version}`,
  `--message ${JSON.stringify(`Deploy ${version}`)}`,
]
  .filter(Boolean)
  .join(" ");

run("bun run build", { cwd: web, env: clientEnvironment });
run(`${wrangler} deploy ${deployArgs}`, { cwd: web });

console.log(
  `${dryRun ? "Dry-run verified" : "Deployed"} nudge-web ${deployEnvironment} at ${version}`,
);
