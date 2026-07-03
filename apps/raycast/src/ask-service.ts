import type { SurfaceConversationMessageResponse, SurfaceEngineClient } from "@nudge/surface";

export interface AskRaycastNudgeInput {
  readonly message: string;
  readonly conversationId?: string;
}

export type AskRaycastNudgeClient = Pick<SurfaceEngineClient, "sendConversationMessage">;
export type AskRaycastNudgeClientFactory = () => Promise<AskRaycastNudgeClient>;

export async function askRaycastNudge(
  input: AskRaycastNudgeInput,
  clientFactory: AskRaycastNudgeClientFactory,
): Promise<SurfaceConversationMessageResponse> {
  const message = input.message.trim();
  if (!message) throw new Error("Write a question first.");
  return await (
    await clientFactory()
  ).sendConversationMessage({
    ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
    message,
  });
}
