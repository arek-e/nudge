import { flush, initLogger, traced, wrapAISDK } from "braintrust";
import type { Env } from "./env";

let loggerInitialized = false;
let loggerApiKey: string | undefined;

export const ensureBraintrustTracing = (apiKey?: string) => {
  const normalizedApiKey = apiKey?.trim() || undefined;
  if (!normalizedApiKey) return false;
  if (loggerInitialized && loggerApiKey === normalizedApiKey) return true;
  initLogger({
    projectName: "Nudge",
    apiKey: normalizedApiKey,
  });
  loggerInitialized = true;
  loggerApiKey = normalizedApiKey;
  return true;
};

export const braintrustRawAiTelemetryEnabled = (
  env: Pick<Env, "BRAINTRUST_API_KEY" | "BRAINTRUST_RAW_AI_TELEMETRY">,
) => env.BRAINTRUST_RAW_AI_TELEMETRY === "true" && Boolean(env.BRAINTRUST_API_KEY?.trim());

export const wrapBraintrustAISDK = <T>(aiSDK: T, input: { readonly rawTelemetry: boolean }): T => {
  if (!input.rawTelemetry) return aiSDK;
  return wrapAISDK(aiSDK);
};

export const runBraintrustSpan = <A>(
  input: {
    readonly apiKey?: string | undefined;
    readonly attributes?: Readonly<Record<string, unknown>>;
    readonly name: string;
    readonly type?: "function" | "task";
  },
  task: () => Promise<A>,
) => {
  if (!ensureBraintrustTracing(input.apiKey)) return task();
  return traced(task, {
    name: input.name,
    type: input.type ?? "function",
    ...(input.attributes ? { spanAttributes: { ...input.attributes } } : {}),
  });
};

export const flushBraintrustTracing = async (apiKey?: string) => {
  if (!ensureBraintrustTracing(apiKey)) return;
  await flush();
};
