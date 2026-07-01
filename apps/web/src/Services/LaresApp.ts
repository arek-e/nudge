import { Context, Effect, ManagedRuntime } from "effect";
import type { Db, DbService } from "@lares/db";
import type { AuthSessionResolver } from "../auth";
import type { Env } from "../env";
import type { OkfSandbox } from "../okf-sandbox";

export interface LaresUser {
  readonly displayName: string;
  readonly id: string;
}

export interface LaresOkfSandboxFactoryInput {
  readonly env: Env;
  readonly user: LaresUser;
}

export type LaresOkfSandboxFactory = (
  input: LaresOkfSandboxFactoryInput,
) => Promise<OkfSandbox | null> | OkfSandbox | null;

export type RunEffect = <A, E>(effect: Effect.Effect<A, E, Db>) => Promise<A>;

export interface LaresAppService {
  readonly agentSessions: DurableObjectNamespace;
  readonly agentInternalSecret?: string;
  readonly aiModel: string;
  readonly dailyAnalysisWorkflow: Workflow;
  readonly db: DbService;
  readonly devUser: LaresUser;
  readonly env: Env;
  readonly googleAuthConfigured: boolean;
  readonly okfSandboxFor: (user: LaresUser) => Promise<OkfSandbox | null>;
  readonly resolveSession: AuthSessionResolver;
  readonly traceDb: D1Database;
  readonly turbopuffer?: {
    readonly apiKey: string;
    readonly region: string;
  };
  readonly version: string;
}

export class LaresApp extends Context.Service<LaresApp, LaresAppService>()(
  "lares/web/Services/LaresApp",
) {}

export type LaresAppRuntime = ManagedRuntime.ManagedRuntime<LaresApp, never>;
