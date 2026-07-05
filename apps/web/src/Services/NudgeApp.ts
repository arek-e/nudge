import { Context, Effect, ManagedRuntime } from "effect";
import type { Db, DbService } from "@nudge/db";
import type { AuthSessionResolver } from "../auth";
import type { Env } from "../env";
import type { OkfSandbox } from "../okf-sandbox";

export interface NudgeUser {
  readonly displayName: string;
  readonly id: string;
}

export interface NudgeOkfSandboxFactoryInput {
  readonly env: Env;
  readonly user: NudgeUser;
}

export type NudgeOkfSandboxFactory = (
  input: NudgeOkfSandboxFactoryInput,
) => Promise<OkfSandbox | null> | OkfSandbox | null;

export type RunEffect = <A, E>(effect: Effect.Effect<A, E, Db>) => Promise<A>;

export interface NudgeAppService {
  readonly agentSessions: DurableObjectNamespace;
  readonly agentInternalSecret?: string;
  readonly aiModel: string;
  readonly aiProvider: string;
  readonly dailyAnalysisWorkflow: Workflow;
  readonly db: DbService;
  readonly env: Env;
  readonly mediaFiles?: R2Bucket;
  readonly okfSandboxFor: (user: NudgeUser) => Promise<OkfSandbox | null>;
  readonly resolveSession: AuthSessionResolver;
  readonly turbopuffer?: {
    readonly apiKey: string;
    readonly region: string;
  };
  readonly version: string;
}

export class NudgeApp extends Context.Service<NudgeApp, NudgeAppService>()(
  "nudge/web/Services/NudgeApp",
) {}

export type NudgeAppRuntime = ManagedRuntime.ManagedRuntime<NudgeApp, never>;
