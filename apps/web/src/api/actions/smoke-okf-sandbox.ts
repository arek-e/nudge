import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { smokeTestOkfProjection } from "../../okf-sandbox";
import { readOkfProjection } from "./okf-projection";

export interface SmokeOkfSandboxInput {
  readonly context: ApiContext;
}

export interface SmokeOkfSandboxResult {
  readonly available: boolean;
  readonly exitCode: number | null;
  readonly fileCount: number;
  readonly root: string;
  readonly stderr: string;
  readonly stdout: string;
  readonly success: boolean;
}

function readSandboxSmokeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "OKF sandbox smoke failed";
}

export function smokeOkfSandbox(input: SmokeOkfSandboxInput): ApiAction<SmokeOkfSandboxResult> {
  return Effect.gen(function* () {
    const sandbox = yield* Effect.tryPromise({
      try: () => input.context.getOkfSandbox(),
      catch: (cause) => cause,
    });
    if (!sandbox) {
      return {
        available: false,
        exitCode: null,
        fileCount: 0,
        root: "/workspace/okf",
        stderr: "OKF sandbox is not configured",
        stdout: "",
        success: false,
      };
    }
    const projection = yield* readOkfProjection({ context: input.context });
    const root = "/workspace/okf";
    const smoke = yield* Effect.tryPromise({
      try: () => smokeTestOkfProjection(sandbox, projection),
      catch: (error) => error,
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed({
          exitCode: null,
          stderr: readSandboxSmokeError(error),
          stdout: "",
          success: false,
        }),
      ),
    );
    return {
      available: true,
      exitCode: smoke.exitCode,
      fileCount: projection.files.size,
      root,
      stderr: smoke.stderr,
      stdout: smoke.stdout,
      success: smoke.success,
    };
  });
}
