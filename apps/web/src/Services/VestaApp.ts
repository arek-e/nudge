import { Context, Effect, ManagedRuntime } from "effect";
import type { Db, DbService } from "@vesta/db";
import type { AuthSessionResolver } from "../auth";
import type { Env } from "../env";
import type { OkfSandbox } from "../okf-sandbox";

export interface VestaUser {
  readonly displayName: string;
  readonly id: string;
}

export interface VestaOkfSandboxFactoryInput {
  readonly env: Env;
  readonly user: VestaUser;
}

export type VestaOkfSandboxFactory = (
  input: VestaOkfSandboxFactoryInput,
) => Promise<OkfSandbox | null> | OkfSandbox | null;

export type RunEffect = <A, E>(effect: Effect.Effect<A, E, Db>) => Promise<A>;

export interface VestaAppService {
  readonly agentSessions: DurableObjectNamespace;
  readonly agentInternalSecret?: string;
  readonly aiModel: string;
  readonly dailyAnalysisWorkflow: Workflow;
  readonly db: DbService;
  readonly devUser: VestaUser;
  readonly env: Env;
  readonly googleAuthConfigured: boolean;
  readonly okfSandboxFor: (user: VestaUser) => Promise<OkfSandbox | null>;
  readonly resolveSession: AuthSessionResolver;
  readonly traceDb: D1Database;
  readonly turbopuffer?: {
    readonly apiKey: string;
    readonly region: string;
  };
  readonly version: string;
}

export class VestaApp extends Context.Service<VestaApp, VestaAppService>()(
  "vesta/web/Services/VestaApp",
) {}

export type VestaAppRuntime = ManagedRuntime.ManagedRuntime<VestaApp, never>;
