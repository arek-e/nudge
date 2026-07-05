import type { EventRecord, UserDataExport } from "@nudge/db";

interface AgentReceiptPayload {
  readonly action: string;
  readonly changed: Readonly<Record<string, unknown>>;
  readonly signalIds: ReadonlyArray<string>;
  readonly why: string;
}

export const agentReceiptType = "agent.receipt";
export const agentReceiptSource = "nudge_engine";

export interface ListReceiptResponsesInput {
  readonly exported: Pick<UserDataExport, "events">;
  readonly limit: number;
}

export interface AgentReceiptResponse {
  readonly id: string;
  readonly action: string;
  readonly changed: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly signalIds: string[];
  readonly why: string;
}

export type ListReceiptResponsesResult = AgentReceiptResponse[];

function readReceiptPayload(value: unknown): AgentReceiptPayload | null {
  if (!value || typeof value !== "object") return null;
  const action = Reflect.get(value, "action");
  const changed = Reflect.get(value, "changed");
  const signalIds = Reflect.get(value, "signalIds");
  const why = Reflect.get(value, "why");
  if (
    typeof action !== "string" ||
    !changed ||
    typeof changed !== "object" ||
    !Array.isArray(signalIds) ||
    !signalIds.every((signalId) => typeof signalId === "string") ||
    typeof why !== "string"
  ) {
    return null;
  }
  return {
    action,
    changed: Object.fromEntries(Object.entries(changed)),
    signalIds,
    why,
  };
}

function toReceiptResponse(event: EventRecord): AgentReceiptResponse | null {
  const payload = readReceiptPayload(event.payload);
  if (!payload) return null;
  return {
    id: event.id,
    action: payload.action,
    changed: payload.changed,
    createdAt: event.createdAt,
    signalIds: [...payload.signalIds],
    why: payload.why,
  };
}

export function listReceiptResponses(input: ListReceiptResponsesInput): ListReceiptResponsesResult {
  return input.exported.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === agentReceiptType)
    .sort(
      (left, right) =>
        right.event.createdAt.localeCompare(left.event.createdAt) || right.index - left.index,
    )
    .flatMap(({ event }) => {
      const receipt = toReceiptResponse(event);
      return receipt ? [receipt] : [];
    })
    .slice(0, input.limit);
}
