const deployVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

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
    "--tag",
    input.version,
    "--message",
    `Deploy ${input.version}`,
  ];
}
