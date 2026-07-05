import type { LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createWorkersAI } from "workers-ai-provider";

export type NudgeAiProvider = "braintrust-gateway" | "cloudflare-workers-ai";

export const braintrustGatewayProvider: NudgeAiProvider = "braintrust-gateway";
export const cloudflareWorkersAiProvider: NudgeAiProvider = "cloudflare-workers-ai";
export const defaultBraintrustGatewayUrl = "https://gateway.braintrust.dev";

export interface ResolveNudgeAiModelsInput {
  readonly braintrustApiKey?: string | undefined;
  readonly braintrustGatewayUrl?: string | undefined;
  readonly braintrustOrgName?: string | undefined;
  readonly braintrustProjectId?: string | undefined;
  readonly extractionModel?: string | undefined;
  readonly provider?: NudgeAiProvider | undefined;
  readonly thinkModel: string;
  readonly workersAi?: Ai | undefined;
}

export interface NudgeAiModelConfig {
  readonly extractionModelName: string;
  readonly provider: NudgeAiProvider;
  readonly thinkModelName: string;
}

export interface ResolvedNudgeAiModels {
  readonly extractionModel: LanguageModel;
  readonly extractionModelName: string;
  readonly provider: NudgeAiProvider;
  readonly thinkModel: LanguageModel;
  readonly thinkModelName: string;
}

export function resolveNudgeAiModels(input: ResolveNudgeAiModelsInput): ResolvedNudgeAiModels {
  const config = resolveNudgeAiModelConfig(input);

  if (config.provider === braintrustGatewayProvider) {
    const apiKey = input.braintrustApiKey?.trim();
    if (!apiKey) throw new Error("BRAINTRUST_API_KEY is required for Braintrust Gateway");
    const gateway = createOpenAICompatible({
      apiKey,
      baseURL: input.braintrustGatewayUrl?.trim() || defaultBraintrustGatewayUrl,
      headers: braintrustGatewayHeaders(input),
      name: "braintrust",
      supportsStructuredOutputs: true,
    });
    return {
      extractionModel: gateway.chatModel(config.extractionModelName),
      extractionModelName: config.extractionModelName,
      provider: config.provider,
      thinkModel: gateway.chatModel(config.thinkModelName),
      thinkModelName: config.thinkModelName,
    };
  }

  if (!input.workersAi) throw new Error("Cloudflare Workers AI binding is required");
  const workersAi = createWorkersAI({ binding: input.workersAi });
  return {
    extractionModel: workersAi(config.extractionModelName),
    extractionModelName: config.extractionModelName,
    provider: config.provider,
    thinkModel: workersAi(config.thinkModelName),
    thinkModelName: config.thinkModelName,
  };
}

export function resolveNudgeAiModelConfig(
  input: Pick<
    ResolveNudgeAiModelsInput,
    "braintrustApiKey" | "extractionModel" | "provider" | "thinkModel"
  >,
): NudgeAiModelConfig {
  const provider = resolveNudgeAiProvider(input);
  return {
    extractionModelName: input.extractionModel ?? input.thinkModel,
    provider,
    thinkModelName: input.thinkModel,
  };
}

function resolveNudgeAiProvider(
  input: Pick<ResolveNudgeAiModelsInput, "provider">,
): NudgeAiProvider {
  if (input.provider) return input.provider;
  return cloudflareWorkersAiProvider;
}

export function braintrustGatewayHeaders(
  input: Pick<ResolveNudgeAiModelsInput, "braintrustOrgName" | "braintrustProjectId">,
) {
  const headers: Record<string, string> = {};
  const projectId = input.braintrustProjectId?.trim();
  const orgName = input.braintrustOrgName?.trim();
  if (orgName) headers["x-bt-org-name"] = orgName;
  if (projectId) {
    headers["x-bt-parent"] = `project_id:${projectId}`;
    headers["x-bt-project-id"] = projectId;
  }
  return headers;
}
