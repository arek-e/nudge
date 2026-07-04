type EnvSource = Readonly<Record<string, string | undefined>>;
type ClerkEnvName = "CLERK_AUTHORIZED_PARTIES" | "CLERK_PUBLISHABLE_KEY" | "CLERK_SECRET_KEY";

const clerkEnvNames: readonly ClerkEnvName[] = [
  "CLERK_AUTHORIZED_PARTIES",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
];

export function wranglerClerkEnvEntries(env: EnvSource = process.env) {
  const entries: Array<readonly [ClerkEnvName, string]> = [];
  for (const name of clerkEnvNames) {
    const value = env[name];
    if (value) entries.push([name, value]);
  }
  return entries;
}

export function envFileContent(entries: ReadonlyArray<readonly [string, string]>) {
  if (entries.length === 0) return "";
  return `${entries.map(([name, value]) => `${name}=${JSON.stringify(value)}`).join("\n")}\n`;
}

export function wranglerClerkEnvFileArgs(envFile: string | null) {
  return envFile ? ["--env-file", envFile] : [];
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
