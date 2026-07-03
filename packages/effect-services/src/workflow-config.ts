export interface DurableWorkflowStepConfig<Timeout extends number | string = number | string> {
  readonly retries?: {
    readonly limit: number;
    readonly delay: number | string;
    readonly backoff?: "constant" | "linear" | "exponential";
  };
  readonly timeout?: Timeout;
  readonly sensitive?: "output";
}

export const durableWorkflowStepConfig = {
  retries: {
    limit: 5,
    delay: 1_000,
    backoff: "exponential",
  },
  timeout: "10 minutes",
} satisfies DurableWorkflowStepConfig<"10 minutes">;

export const currentWorkflowVersion = 1;

export type WorkflowVersion = typeof currentWorkflowVersion;

export const workflowStepName = (version: WorkflowVersion, name: string) => `v${version}.${name}`;
