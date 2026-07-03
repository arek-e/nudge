import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ReleasePackageVersion {
  readonly name: string;
  readonly path: string;
  readonly releaseDriver: boolean;
  readonly version: string;
}

export interface ReleaseVersionCheckInput {
  readonly packages: ReadonlyArray<ReleasePackageVersion>;
  readonly tag?: string;
}

export interface ReleaseVersionCheckResult {
  readonly errors: ReadonlyArray<string>;
  readonly ok: boolean;
  readonly version?: string;
}

const releasePackages = [
  { path: "apps/desktop/package.json", releaseDriver: true },
  { path: "apps/raycast/package.json", releaseDriver: false },
];
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function checkReleaseVersions(input: ReleaseVersionCheckInput): ReleaseVersionCheckResult {
  const errors: string[] = [];
  const releaseDrivers = input.packages.filter((packageVersion) => packageVersion.releaseDriver);
  const releaseDriver = releaseDrivers[0];
  const releaseVersion = releaseDriver?.version;

  if (!releaseVersion) {
    errors.push("No release driver package version was provided.");
    return { errors, ok: false };
  }

  if (releaseDrivers.length > 1) {
    errors.push("Only one app package can drive the GitHub release tag.");
  }

  for (const packageVersion of input.packages) {
    if (!semanticVersionPattern.test(packageVersion.version)) {
      errors.push(
        `${packageVersion.name} version ${packageVersion.version} is not a valid semantic version.`,
      );
    }
  }

  if (input.tag) {
    const tagVersion = normalizeReleaseTag(input.tag);
    if (!tagVersion) {
      errors.push(`Release tag ${input.tag} must use vX.Y.Z format.`);
    } else if (tagVersion !== releaseVersion) {
      errors.push(`Release tag ${input.tag} does not match app package version ${releaseVersion}.`);
    }
  }

  return {
    errors,
    ok: errors.length === 0,
    version: releaseVersion,
  };
}

export function normalizeReleaseTag(tag: string) {
  const normalized = tag.trim().replace(/^refs\/tags\//, "");
  if (!normalized.startsWith("v")) return undefined;
  const version = normalized.slice(1);
  return semanticVersionPattern.test(version) ? version : undefined;
}

function readReleasePackageVersions(root: string): ReleasePackageVersion[] {
  return releasePackages.map((releasePackage) => {
    const manifest = readJsonObject(join(root, releasePackage.path));
    return {
      name: readStringField(manifest, "name") ?? releasePackage.path,
      path: releasePackage.path,
      releaseDriver: releasePackage.releaseDriver,
      version: readStringField(manifest, "version") ?? "",
    };
  });
}

function readJsonObject(path: string) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return typeof parsed === "object" && parsed !== null ? parsed : {};
}

function readStringField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return undefined;
  const field = Reflect.get(value, key);
  return typeof field === "string" ? field : undefined;
}

function tagFromArguments(values: ReadonlyArray<string>) {
  const tagIndex = values.indexOf("--tag");
  const tagValue = tagIndex >= 0 ? values[tagIndex + 1] : undefined;
  if (tagValue) return tagValue;
  if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }
  return process.env.NUDGE_RELEASE_TAG;
}

if (import.meta.main) {
  const packages = readReleasePackageVersions(process.cwd());
  const result = checkReleaseVersions({
    packages,
    tag: tagFromArguments(Bun.argv.slice(2)),
  });

  if (result.ok) {
    const companionVersions = packages
      .filter((packageVersion) => !packageVersion.releaseDriver)
      .map((packageVersion) => `${packageVersion.name}@${packageVersion.version}`);
    const companionSummary =
      companionVersions.length > 0 ? ` Companion packages: ${companionVersions.join(", ")}.` : "";
    console.log(
      `Desktop release version ${result.version} matches the release tag.${companionSummary}`,
    );
  } else {
    console.error("Release version check failed.");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}
