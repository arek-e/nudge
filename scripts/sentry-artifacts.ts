import { existsSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

export type SentryArtifactKind = "debug-files" | "sourcemaps";

export interface SentryArtifactCommand {
  readonly command: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string>>;
}

export interface SentrySourcemapInput {
  readonly directory: string;
  readonly org?: string;
  readonly project: string;
  readonly release?: string;
}

export interface SentryDebugFileInput {
  readonly org?: string;
  readonly paths: ReadonlyArray<string>;
  readonly project: string;
}

export type SentryArtifactCliConfig =
  | {
      readonly directory: string;
      readonly kind: "sourcemaps";
      readonly org: string;
      readonly project: string;
      readonly release?: string;
    }
  | {
      readonly kind: "debug-files";
      readonly org: string;
      readonly paths: ReadonlyArray<string>;
      readonly project: string;
    };

const defaultOrg = "teampitch-m7";
const sentryCli = ["bunx", "--bun", "@sentry/cli"];

export function shouldUploadSentryArtifacts(env: Readonly<Record<string, string | undefined>>) {
  const flag = env.SENTRY_UPLOAD_ARTIFACTS?.toLowerCase();
  return Boolean(env.SENTRY_AUTH_TOKEN) && (flag === "true" || flag === "1" || flag === "yes");
}

export function buildSourcemapUploadCommands(
  input: SentrySourcemapInput,
): ReadonlyArray<SentryArtifactCommand> {
  const env = sentryCommandEnv(input);
  return [
    {
      command: [...sentryCli, "sourcemaps", "inject", input.directory],
      env,
    },
    {
      command: [
        ...sentryCli,
        "sourcemaps",
        "upload",
        ...(input.release ? [`--release=${input.release}`] : []),
        input.directory,
      ],
      env,
    },
  ];
}

export function buildDebugFileUploadCommands(
  input: SentryDebugFileInput,
): ReadonlyArray<SentryArtifactCommand> {
  return [
    {
      command: [...sentryCli, "debug-files", "upload", ...input.paths],
      env: sentryCommandEnv(input),
    },
  ];
}

export async function uploadSentrySourcemaps(input: {
  readonly directory: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly org?: string;
  readonly project: string;
  readonly release?: string;
}) {
  const sourceEnv = input.env ?? process.env;
  const uploadEnabled = shouldUploadSentryArtifacts(sourceEnv);
  if (uploadEnabled) {
    ensurePathExists(input.directory);
    runSentryArtifactCommands(
      buildSourcemapUploadCommands({
        directory: input.directory,
        org: input.org,
        project: input.project,
        release: input.release,
      }),
      sourceEnv,
    );
  } else {
    console.log(
      `Skipping Sentry source map upload for ${input.project}; set SENTRY_UPLOAD_ARTIFACTS=true and SENTRY_AUTH_TOKEN to enable it.`,
    );
  }

  const cleanedFiles = await cleanSourcemapArtifacts(input.directory);
  if (cleanedFiles.length > 0) {
    console.log(`Removed ${cleanedFiles.length} source map artifact(s) from ${input.directory}.`);
  }
  return { cleanedFiles, uploaded: uploadEnabled };
}

export function uploadSentryDebugFiles(input: {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly org?: string;
  readonly paths: ReadonlyArray<string>;
  readonly project: string;
}) {
  const sourceEnv = input.env ?? process.env;
  const uploadEnabled = shouldUploadSentryArtifacts(sourceEnv);
  if (!uploadEnabled) {
    console.log(
      `Skipping Sentry debug file upload for ${input.project}; set SENTRY_UPLOAD_ARTIFACTS=true and SENTRY_AUTH_TOKEN to enable it.`,
    );
    return { uploaded: false };
  }

  for (const path of input.paths) ensurePathExists(path);
  runSentryArtifactCommands(
    buildDebugFileUploadCommands({
      org: input.org,
      paths: input.paths,
      project: input.project,
    }),
    sourceEnv,
  );
  return { uploaded: true };
}

export async function cleanSourcemapArtifacts(directory: string) {
  if (!existsSync(directory)) return [];
  const files = await listFiles(directory);
  const sourceMapFiles = files.filter((file) => file.endsWith(".map"));
  await Promise.all(sourceMapFiles.map((file) => rm(file)));
  await Promise.all(files.filter(isJavascriptOutput).map((file) => stripSourceMapComment(file)));
  return sourceMapFiles;
}

export function parseSentryArtifactArgs(args: ReadonlyArray<string>): SentryArtifactCliConfig {
  const kind = args[0];
  if (kind !== "sourcemaps" && kind !== "debug-files") {
    throw new Error(
      "Usage: sentry-artifacts.ts sourcemaps|debug-files --project <slug> --path <path>",
    );
  }

  const options = readCliOptions(args.slice(1));
  const org = firstCliOption(options, "org") ?? defaultOrg;
  const project = requiredCliOption(options, "project");
  const paths = cliOptions(options, "path");

  if (kind === "sourcemaps") {
    const directory = paths[0];
    if (!directory || paths.length !== 1) {
      throw new Error("Source map upload requires exactly one --path value.");
    }
    return {
      directory,
      kind,
      org,
      project,
      release: firstCliOption(options, "release"),
    };
  }

  if (paths.length === 0) {
    throw new Error("Debug file upload requires at least one --path value.");
  }
  return {
    kind,
    org,
    paths,
    project,
  };
}

function sentryCommandEnv(input: {
  readonly org?: string;
  readonly project: string;
  readonly release?: string;
}) {
  const env: Record<string, string> = {
    SENTRY_ORG: input.org ?? defaultOrg,
    SENTRY_PROJECT: input.project,
  };
  if (input.release) env.SENTRY_RELEASE = input.release;
  return env;
}

function runSentryArtifactCommands(
  commands: ReadonlyArray<SentryArtifactCommand>,
  sourceEnv: Readonly<Record<string, string | undefined>>,
) {
  for (const command of commands) {
    console.log(command.command.join(" "));
    const result = Bun.spawnSync(command.command, {
      env: mergeEnv(sourceEnv, command.env),
      stderr: "inherit",
      stdout: "inherit",
    });
    if (!result.success) {
      throw new Error(`Sentry artifact command failed with exit code ${result.exitCode ?? 1}.`);
    }
  }
}

function ensurePathExists(path: string) {
  if (!existsSync(path)) throw new Error(`Sentry artifact path does not exist: ${path}`);
}

function mergeEnv(
  sourceEnv: Readonly<Record<string, string | undefined>>,
  updates: Readonly<Record<string, string>>,
) {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value !== undefined) merged[key] = value;
  }
  return { ...merged, ...updates };
}

async function listFiles(directory: string): Promise<ReadonlyArray<string>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const entryFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) return await listFiles(entryPath);
      if (entry.isFile()) return [entryPath];
      return [];
    }),
  );
  return entryFiles.flat();
}

async function stripSourceMapComment(file: string) {
  const source = await readFile(file, "utf8");
  const cleaned = source.replace(/(?:\r?\n)?\/\/# sourceMappingURL=.*?\.map\s*$/u, "\n");
  if (cleaned !== source) await writeFile(file, cleaned);
}

function isJavascriptOutput(file: string) {
  const extension = extname(file);
  return extension === ".js" || extension === ".mjs" || extension === ".cjs";
}

function readCliOptions(args: ReadonlyArray<string>) {
  const options = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid Sentry artifact argument near ${name ?? "<end>"}.`);
    }
    const optionName = name.slice(2);
    options.set(optionName, [...(options.get(optionName) ?? []), value]);
  }
  return options;
}

function cliOptions(options: ReadonlyMap<string, ReadonlyArray<string>>, name: string) {
  return options.get(name) ?? [];
}

function firstCliOption(options: ReadonlyMap<string, ReadonlyArray<string>>, name: string) {
  return cliOptions(options, name)[0];
}

function requiredCliOption(options: ReadonlyMap<string, ReadonlyArray<string>>, name: string) {
  const value = firstCliOption(options, name);
  if (!value) throw new Error(`Missing required --${name} value.`);
  return value;
}

if (import.meta.main) {
  try {
    const config = parseSentryArtifactArgs(Bun.argv.slice(2));
    if (config.kind === "sourcemaps") {
      await uploadSentrySourcemaps(config);
    } else {
      uploadSentryDebugFiles(config);
    }
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exitCode = 1;
  }
}
