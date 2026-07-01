import { Effect, Layer, ManagedRuntime } from "effect";
import { Db } from "@lares/db";
import { AuthService } from "@lares/effect-services";
import type { AuthSessionResolver } from "../auth";
import type { Env } from "../env";
import { LaresApp, type LaresAppRuntime, type LaresOkfSandboxFactory } from "../Services/LaresApp";

export type LaresAppDbLayer = Layer.Layer<Db>;

interface MakeLaresAppLayerInput {
  readonly dbLayer: LaresAppDbLayer;
  readonly env: Env;
  readonly okfSandboxFactory: LaresOkfSandboxFactory;
  readonly resolveSession: AuthSessionResolver;
}

interface MakeLaresAppRuntimeInput extends MakeLaresAppLayerInput {
  readonly memoMap: Layer.MemoMap;
}

const currentUser = Effect.gen(function* () {
  const auth = yield* AuthService;
  return yield* auth.currentUser;
});

export function makeLaresAppLayer(input: MakeLaresAppLayerInput) {
  return Layer.effect(
    LaresApp,
    Effect.gen(function* () {
      const db = yield* Db;
      const devUser = yield* Effect.provide(currentUser, AuthService.layerDev);
      const env = input.env;
      const agentInternalSecret = env.AGENT_INTERNAL_SECRET ?? env.BETTER_AUTH_SECRET;

      return LaresApp.of({
        agentSessions: env.USER_AGENT_SESSION,
        ...(agentInternalSecret ? { agentInternalSecret } : {}),
        aiModel: env.EXTRACTION_MODEL ?? env.THINK_MODEL,
        dailyAnalysisWorkflow: env.DAILY_DIGEST_WORKFLOW,
        db,
        devUser,
        env,
        googleAuthConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        okfSandboxFor: async (user) => input.okfSandboxFactory({ env, user }),
        resolveSession: input.resolveSession,
        traceDb: env.DB,
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

export function makeLaresAppRuntime(input: MakeLaresAppRuntimeInput): LaresAppRuntime {
  return ManagedRuntime.make(makeLaresAppLayer(input), { memoMap: input.memoMap });
}

export function resolveLaresApp(runtime: LaresAppRuntime) {
  return runtime.runPromise(
    Effect.gen(function* () {
      return yield* LaresApp;
    }),
  );
}

export function runLaresAppDbEffect<A, E>(
  runtime: LaresAppRuntime,
  effect: Effect.Effect<A, E, Db>,
) {
  return runtime.runPromise(
    Effect.gen(function* () {
      const app = yield* LaresApp;
      return yield* Effect.provideService(effect, Db, app.db);
    }),
  );
}
