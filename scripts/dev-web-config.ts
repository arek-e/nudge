type EnvSource = Readonly<Record<string, string | undefined>>;
type ClerkSecretName = "CLERK_SECRET_KEY";
type WranglerDevSecretName = ClerkSecretName | "CONVEX_RUNTIME_SECRET";
type WranglerDevVarName = "CLERK_AUTHORIZED_PARTIES";
type RequiredLocalDevSecretName = WranglerDevSecretName;

const clerkSecretNames: readonly ClerkSecretName[] = ["CLERK_SECRET_KEY"];
const wranglerDevSecretNames: readonly WranglerDevSecretName[] = [
  ...clerkSecretNames,
  "CONVEX_RUNTIME_SECRET",
];
const requiredLocalDevSecretNames: readonly RequiredLocalDevSecretName[] = [
  "CLERK_SECRET_KEY",
  "CONVEX_RUNTIME_SECRET",
];

export function wranglerClerkEnvEntries(env: EnvSource = process.env) {
  const entries: Array<readonly [ClerkSecretName, string]> = [];
  for (const name of clerkSecretNames) {
    const value = env[name];
    if (value) entries.push([name, value]);
  }
  return entries;
}

export function wranglerDevEnvEntries(env: EnvSource = process.env) {
  const entries: Array<readonly [WranglerDevSecretName, string]> = [];
  for (const name of wranglerDevSecretNames) {
    const value = env[name];
    if (value) entries.push([name, value]);
  }
  return entries;
}

export function envFileContent(entries: ReadonlyArray<readonly [string, string]>) {
  if (entries.length === 0) return "";
  return `${entries.map(([name, value]) => `${name}=${JSON.stringify(value)}`).join("\n")}\n`;
}

export function wranglerDevEnvFileArgs(envFile: string | null) {
  return envFile ? ["--env-file", envFile] : [];
}

export function wranglerDevVarArgs(entries: ReadonlyArray<readonly [WranglerDevVarName, string]>) {
  return entries.flatMap(([name, value]) => ["--var", `${name}:${value}`]);
}

export function missingRequiredLocalDevSecrets(env: EnvSource = process.env) {
  return requiredLocalDevSecretNames.filter((name) => !env[name]);
}

export function missingRequiredLocalDevSecretsMessage(
  missing: ReadonlyArray<RequiredLocalDevSecretName>,
) {
  if (missing.length === 0) return null;

  return [
    `Missing required local Worker secrets: ${missing.join(", ")}`,
    "Add them to .envrc.local or the current direnv environment, then restart bun dev.",
  ].join("\n");
}

export function wranglerLocalConfigArgs(args: readonly string[]) {
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
