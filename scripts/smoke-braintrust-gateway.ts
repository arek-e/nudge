import { generateObject, generateText } from "ai";
import { braintrustGatewayProvider, resolveNudgeAiModels } from "@nudge/ai";
import { dailyNoteExtractionPrompt } from "../apps/web/src/agent-prompts";
import { dailyNoteExtractionObjectSchema } from "../apps/web/src/daily-note-analysis";

const braintrustApiKey = process.env.BRAINTRUST_API_KEY?.trim();
if (!braintrustApiKey) {
  console.error("BRAINTRUST_API_KEY is required to smoke test Braintrust Gateway.");
  process.exit(1);
}

const thinkModel = process.env.THINK_MODEL?.trim() || "glm-5.2";
const extractionModel = process.env.EXTRACTION_MODEL?.trim() || thinkModel;
const gatewayUrl = process.env.BRAINTRUST_GATEWAY_URL?.trim() || undefined;

const models = resolveNudgeAiModels({
  braintrustApiKey,
  braintrustGatewayUrl: gatewayUrl,
  braintrustOrgName: process.env.BRAINTRUST_ORG_NAME,
  braintrustProjectId: process.env.BRAINTRUST_PROJECT_ID,
  extractionModel,
  provider: braintrustGatewayProvider,
  thinkModel,
});

const textResult = await generateText({
  maxOutputTokens: 8,
  model: models.thinkModel,
  prompt: "Reply with exactly: ok",
  timeout: 15_000,
});

const extractionResult = await generateObject({
  maxOutputTokens: 256,
  model: models.extractionModel,
  prompt: dailyNoteExtractionPrompt({
    changedText: "Follow up with Maya tomorrow.",
    localDate: "2026-07-05",
  }),
  schema: dailyNoteExtractionObjectSchema,
  timeout: 15_000,
});

const textOk = textResult.text.trim().toLowerCase().includes("ok");
const objectOk = extractionResult.object.items.some((task) =>
  task.title.toLowerCase().includes("maya"),
);

console.log(
  JSON.stringify({
    ok: textOk && objectOk,
    textOk,
    objectOk,
    provider: models.provider,
    thinkModel: models.thinkModelName,
    extractionModel: models.extractionModelName,
  }),
);
