import { Effect, Layer, ManagedRuntime } from "effect";
import { Db } from "@vesta/db";
import { AuthService } from "@vesta/effect-services";
import type { AuthSessionResolver } from "../auth";
import type { Env } from "../env";
import { VestaApp, type VestaAppRuntime, type VestaOkfSandboxFactory } from "../Services/VestaApp";

export type VestaAppDbLayer = Layer.Layer<Db>;

interface MakeVestaAppLayerInput {
  readonly dbLayer: VestaAppDbLayer;
  readonly env: Env;
  readonly okfSandboxFactory: VestaOkfSandboxFactory;
  readonly resolveSession: AuthSessionResolver;
}

interface MakeVestaAppRuntimeInput extends MakeVestaAppLayerInput {
  readonly memoMap: Layer.MemoMap;
}

const currentUser = Effect.gen(function* () {
  const auth = yield* AuthService;
  return yield* auth.currentUser;
});

export function makeVestaAppLayer(input: MakeVestaAppLayerInput) {
  return Layer.effect(
    VestaApp,
    Effect.gen(function* () {
      const db = yield* Db;
      const devUser = yield* Effect.provide(currentUser, AuthService.layerDev);
      const env = input.env;
      const agentInternalSecret = env.AGENT_INTERNAL_SECRET ?? env.BETTER_AUTH_SECRET;

      return VestaApp.of({
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

export function makeVestaAppRuntime(input: MakeVestaAppRuntimeInput): VestaAppRuntime {
  return ManagedRuntime.make(makeVestaAppLayer(input), { memoMap: input.memoMap });
}

export function resolveVestaApp(runtime: VestaAppRuntime) {
  return runtime.runPromise(
    Effect.gen(function* () {
      return yield* VestaApp;
    }),
  );
}

export function runVestaAppDbEffect<A, E>(
  runtime: VestaAppRuntime,
  effect: Effect.Effect<A, E, Db>,
) {
  return runtime.runPromise(
    Effect.gen(function* () {
      const app = yield* VestaApp;
      return yield* Effect.provideService(effect, Db, app.db);
    }),
  );
}
