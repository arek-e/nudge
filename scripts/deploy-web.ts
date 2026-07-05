import {
  parseWranglerSecretNames,
  requiredDeploySecretNames,
  validateDeployVersion,
  wranglerDeployArgs,
} from "./deploy-web-config";
import { uploadSentrySourcemaps } from "./sentry-artifacts";

const root = new URL("..", import.meta.url).pathname;
const web = new URL("../apps/web", import.meta.url).pathname;
const webClientDist = new URL("../apps/web/dist/client", import.meta.url).pathname;

const args = new Set(process.argv.slice(2));
const allowDirty = args.has("--allow-dirty");
const dryRun = args.has("--dry-run");
const envArg = process.argv.find((arg) => arg.startsWith("--env="));
const env = envArg?.slice("--env=".length);
const versionArg = process.argv.find((arg) => arg.startsWith("--version="));
const requestedVersion = versionArg
  ? validateDeployVersion(versionArg.slice("--version=".length))
  : undefined;

const run = (
  command: readonly string[],
  options: {
    readonly cwd?: string;
    readonly env?: Record<string, string>;
    readonly processEnv?: NodeJS.ProcessEnv;
  } = {},
) => {
  const result = Bun.spawnSync(command, {
    cwd: options.cwd ?? root,
    env: { ...(options.processEnv ?? process.env), ...options.env },
    stderr: "inherit",
    stdout: "inherit",
  });

  if (!result.success) {
    process.exit(result.exitCode ?? 1);
  }
};

const output = (command: readonly string[], options: { readonly cwd?: string } = {}) => {
  const result = Bun.spawnSync(command, {
    cwd: options.cwd ?? root,
    stderr: "pipe",
    stdout: "pipe",
  });

  if (!result.success) {
    process.stderr.write(result.stderr);
    process.exit(result.exitCode ?? 1);
  }

  return result.stdout.toString().trim();
};

const status = output(["git", "status", "--porcelain"]);
if (status && !allowDirty) {
  console.error("Refusing to deploy with uncommitted changes.");
  console.error(
    "Commit or stash changes first, or rerun with --allow-dirty for an explicit prototype deploy.",
  );
  process.exit(1);
}

const commit = validateDeployVersion(output(["git", "rev-parse", "--short", "HEAD"]));
const version = validateDeployVersion(
  requestedVersion || (allowDirty && status ? `${commit}-dirty` : commit),
);
const deployEnvironment = env ?? "production";
const clientEnvironmentByDeployTarget: Record<string, Record<string, string>> = {
  production: {
    VITE_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuYXBwLmV4cGxvcmVudWRnZS5jb20k",
    VITE_CLERK_PROXY_URL: "/__clerk",
    VITE_CONVEX_URL: "https://friendly-lion-904.eu-west-1.convex.cloud",
    VITE_SENTRY_DSN:
      "https://3fe4af305fc498b5a216f68af4e898ab@o4510926758150144.ingest.de.sentry.io/4510926760312912",
    VITE_SENTRY_ENVIRONMENT: "production",
    VITE_SENTRY_TRACES_SAMPLE_RATE: "0.05",
  },
  staging: {
    VITE_CLERK_PUBLISHABLE_KEY: "pk_test_cmVuZXdlZC1zZWFzbmFpbC0zOC5jbGVyay5hY2NvdW50cy5kZXYk",
    VITE_CONVEX_URL: "https://abundant-retriever-130.eu-west-1.convex.cloud",
    VITE_NUDGE_LOGO_LONG_SRC: "/icons/nudge-logo-lockup-blobby-n-transparent.svg",
    VITE_SENTRY_DSN:
      "https://3fe4af305fc498b5a216f68af4e898ab@o4510926758150144.ingest.de.sentry.io/4510926760312912",
    VITE_SENTRY_ENVIRONMENT: "staging",
    VITE_SENTRY_TRACES_SAMPLE_RATE: "0.05",
  },
};
const aiProviderByDeployTarget: Record<string, string | undefined> = {
  production: "braintrust-gateway",
  staging: "braintrust-gateway",
};
const clientEnvironment = clientEnvironmentByDeployTarget[deployEnvironment];
if (!clientEnvironment) {
  console.error(`Unknown deploy environment: ${deployEnvironment}`);
  process.exit(1);
}
const serverConvexUrl = clientEnvironment.VITE_CONVEX_URL;
const deployArgs = wranglerDeployArgs({ deployEnvironment, dryRun, serverConvexUrl, version });

if (!dryRun) {
  const secretNames = parseWranglerSecretNames(
    output(["bunx", "wrangler", "secret", "list", "--env", deployEnvironment], { cwd: web }),
  );
  const missingSecretNames = requiredDeploySecretNames({
    aiProvider: aiProviderByDeployTarget[deployEnvironment],
    secretNames,
  });
  if (missingSecretNames.length > 0) {
    console.error(
      `Refusing to deploy ${deployEnvironment}: missing Cloudflare secret(s) ${missingSecretNames.join(
        ", ",
      )}.`,
    );
    console.error(
      `Set it with: bunx wrangler secret put ${missingSecretNames[0]} --env ${deployEnvironment}`,
    );
    process.exit(1);
  }
}

run(["mise", "exec", "--", "bun", "run", "check"], {
  processEnv: processEnvWithoutDeploySecrets(process.env),
});
run(["mise", "exec", "--", "bun", "run", "build"], {
  cwd: web,
  env: { ...clientEnvironment, VITE_APP_VERSION: version },
  processEnv: processEnvWithoutDeploySecrets(process.env),
});
await uploadSentrySourcemaps({
  directory: webClientDist,
  env: dryRun ? { ...process.env, SENTRY_UPLOAD_ARTIFACTS: "false" } : process.env,
  project: "nudge-web-client",
  release: `nudge-web-client@${version}`,
});
run(["mise", "exec", "--", "bunx", "wrangler", "deploy", ...deployArgs], { cwd: web });

console.log(
  `${dryRun ? "Dry-run verified" : "Deployed"} nudge-web ${deployEnvironment} at ${version}`,
);

function processEnvWithoutDeploySecrets(sourceEnv: NodeJS.ProcessEnv) {
  const safeEnv: Record<string, string> = {};
  for (const [name, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue;
    if (name === "CLOUDFLARE_API_TOKEN" || name === "CLOUDFLARE_ACCOUNT_ID") continue;
    if (name === "SENTRY_AUTH_TOKEN") continue;
    safeEnv[name] = value;
  }
  return safeEnv;
}
