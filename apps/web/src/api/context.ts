import type { DbService } from "@nudge/db";
import type { OkfSandbox } from "../okf-sandbox";
import type { RequestSession } from "../request-context";
import type { RunEffect } from "../Services/NudgeApp";

export interface ApiContext {
  readonly addWideEvent: (fields: Record<string, unknown>) => void;
  readonly agentSessions: DurableObjectNamespace;
  readonly agentInternalSecret?: string;
  readonly aiModel: string;
  readonly aiProvider: string;
  readonly clientSurface?: string;
  readonly dailyAnalysisWorkflow: Workflow;
  readonly db: DbService;
  readonly getOkfSandbox: () => Promise<OkfSandbox | null>;
  readonly mediaFiles?: R2Bucket;
  readonly recordSpan: <A>(
    name: string,
    input: {
      readonly attributes?: Readonly<Record<string, unknown>>;
      readonly kind?: "client" | "internal";
    },
    task: () => Promise<A>,
  ) => Promise<A>;
  readonly runEffect: RunEffect;
  readonly traceArtifacts?: R2Bucket;
  readonly traceDb?: D1Database;
  readonly traceHeaders?: Readonly<Record<string, string>>;
  readonly turbopuffer?: {
    readonly apiKey: string;
    readonly region: string;
  };
  readonly session: RequestSession;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  };
}
