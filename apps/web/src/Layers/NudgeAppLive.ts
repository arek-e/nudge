import { Effect, Layer, ManagedRuntime } from "effect";
import { resolveNudgeAiModelConfig } from "@nudge/ai";
import { Db } from "@nudge/db";
import type { AuthSessionResolver } from "../auth";
import type { Env } from "../env";
import { NudgeApp, type NudgeAppRuntime, type NudgeOkfSandboxFactory } from "../Services/NudgeApp";

export type NudgeAppDbLayer = Layer.Layer<Db>;

interface MakeNudgeAppLayerInput {
  readonly dbLayer: NudgeAppDbLayer;
  readonly env: Env;
  readonly okfSandboxFactory: NudgeOkfSandboxFactory;
  readonly resolveSession: AuthSessionResolver;
}

interface MakeNudgeAppRuntimeInput extends MakeNudgeAppLayerInput {
  readonly memoMap: Layer.MemoMap;
}

export function makeNudgeAppLayer(input: MakeNudgeAppLayerInput) {
  return Layer.effect(
    NudgeApp,
    Effect.gen(function* () {
      const db = yield* Db;
      const env = input.env;
      const agentInternalSecret = env.AGENT_INTERNAL_SECRET;
      const aiConfig = resolveNudgeAiModelConfig({
        braintrustApiKey: env.BRAINTRUST_API_KEY,
        extractionModel: env.EXTRACTION_MODEL,
        provider: env.AI_PROVIDER,
        thinkModel: env.THINK_MODEL,
      });

      return NudgeApp.of({
        agentSessions: env.USER_AGENT_SESSION,
        ...(agentInternalSecret ? { agentInternalSecret } : {}),
        aiModel: aiConfig.extractionModelName,
        aiProvider: aiConfig.provider,
        dailyAnalysisWorkflow: env.DAILY_DIGEST_WORKFLOW,
        db,
        env,
        ...(env.MEDIA_FILES ? { mediaFiles: env.MEDIA_FILES } : {}),
        okfSandboxFor: async (user) => input.okfSandboxFactory({ env, user }),
        resolveSession: input.resolveSession,
        ...(env.TURBOPUFFER_API_KEY
          ? {
              turbopuffer: {
                apiKey: env.TURBOPUFFER_API_KEY,
                region: env.TURBOPUFFER_REGION ?? "aws-eu-west-1",
              },
            }
          : {}),
        version: env.APP_VERSION ?? "0.0.0",
      });
    }),
  ).pipe(Layer.provide(input.dbLayer));
}

export function makeNudgeAppRuntime(input: MakeNudgeAppRuntimeInput): NudgeAppRuntime {
  return ManagedRuntime.make(makeNudgeAppLayer(input), { memoMap: input.memoMap });
}

export function resolveNudgeApp(runtime: NudgeAppRuntime) {
  return runtime.runPromise(
    Effect.gen(function* () {
      return yield* NudgeApp;
    }),
  );
}

export function runNudgeAppDbEffect<A, E>(
  runtime: NudgeAppRuntime,
  effect: Effect.Effect<A, E, Db>,
) {
  return runtime.runPromise(
    Effect.gen(function* () {
      const app = yield* NudgeApp;
      return yield* Effect.provideService(effect, Db, app.db);
    }),
  );
}
