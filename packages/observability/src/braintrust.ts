import { flush, initLogger, traced, wrapAISDK } from "braintrust";

let loggerInitialized = false;
let loggerApiKey: string | undefined;

export const ensureBraintrustTracing = (apiKey?: string) => {
  const normalizedApiKey = apiKey?.trim() || undefined;
  if (loggerInitialized && loggerApiKey === normalizedApiKey) return;
  initLogger({
    projectName: "Nudge",
    ...(normalizedApiKey ? { apiKey: normalizedApiKey } : {}),
  });
  loggerInitialized = true;
  loggerApiKey = normalizedApiKey;
};

export const wrapBraintrustAISDK = <T>(aiSDK: T): T => {
  return wrapAISDK(aiSDK);
};

export const runBraintrustSpan = <A>(
  input: {
    readonly attributes?: Readonly<Record<string, unknown>>;
    readonly name: string;
    readonly type?: "function" | "task";
  },
  task: () => Promise<A>,
) => {
  ensureBraintrustTracing();
  return traced(task, {
    name: input.name,
    type: input.type ?? "function",
    ...(input.attributes ? { spanAttributes: { ...input.attributes } } : {}),
  });
};

export const flushBraintrustTracing = async (apiKey?: string) => {
  ensureBraintrustTracing(apiKey);
  await flush();
};
