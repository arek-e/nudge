const deployVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
export const braintrustGatewaySecretName = "BRAINTRUST_API_KEY";

export function validateDeployVersion(value: string) {
  const version = value.trim();
  if (!deployVersionPattern.test(version)) {
    throw new Error(
      "Deploy version may only contain letters, numbers, dots, underscores, or hyphens",
    );
  }
  return version;
}

export function wranglerDeployArgs(input: {
  readonly deployEnvironment: string;
  readonly dryRun: boolean;
  readonly serverConvexUrl: string;
  readonly version: string;
}) {
  return [
    "--env",
    input.deployEnvironment,
    ...(input.dryRun ? ["--dry-run"] : []),
    "--var",
    `ENVIRONMENT:${input.deployEnvironment}`,
    "--var",
    `APP_VERSION:${input.version}`,
    "--var",
    `CONVEX_URL:${input.serverConvexUrl}`,
    "--containers-rollout",
    "none",
    "--tag",
    input.version,
    "--message",
    `Deploy ${input.version}`,
  ];
}

export function parseWranglerSecretNames(stdout: string) {
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) throw new Error("Wrangler secret list did not return an array");

  return new Set(
    parsed.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const name = Reflect.get(item, "name");
      return typeof name === "string" ? [name] : [];
    }),
  );
}

export function requiredDeploySecretNames(input: {
  readonly aiProvider?: string;
  readonly secretNames: ReadonlySet<string>;
}) {
  if (
    input.aiProvider === "braintrust-gateway" &&
    !input.secretNames.has(braintrustGatewaySecretName)
  ) {
    return [braintrustGatewaySecretName];
  }
  return [];
}
