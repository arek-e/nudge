import type { SurfaceEngineClient, SurfaceRefreshContext } from "@nudge/surface";

export interface RaycastCurrentContextInput {
  readonly actionLimit?: number;
  readonly date?: Date;
  readonly signalLimit?: number;
  readonly timeZone?: string;
}

export type RaycastContextClient = Pick<SurfaceEngineClient, "refreshContext">;
export type RaycastContextClientFactory = () => Promise<RaycastContextClient>;

export async function refreshRaycastCurrentContext(
  clientFactory: RaycastContextClientFactory,
  input: RaycastCurrentContextInput = {},
): Promise<SurfaceRefreshContext> {
  const timeZone = input.timeZone ?? raycastTimeZone();
  const client = await clientFactory();
  return await client.refreshContext({
    actionLimit: input.actionLimit ?? 24,
    localDate: raycastLocalDate(input.date ?? new Date(), timeZone),
    signalLimit: input.signalLimit ?? 24,
    timeZone,
  });
}

export function raycastTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function raycastLocalDate(date: Date = new Date(), timeZone: string = raycastTimeZone()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(date);
}
