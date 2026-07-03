import type { SurfaceEngineClient, SurfaceEventRecord } from "@nudge/surface";

export interface RaycastCaptureInput {
  readonly note: string;
}

export type RaycastCaptureClient = Pick<SurfaceEngineClient, "appendManualCapture">;
export type RaycastCaptureClientFactory = () => Promise<RaycastCaptureClient>;

export async function appendRaycastCapture(
  input: RaycastCaptureInput,
  clientFactory: RaycastCaptureClientFactory,
): Promise<SurfaceEventRecord> {
  const note = input.note.trim();
  if (!note) throw new Error("Write a note first.");

  const client = await clientFactory();
  return await client.appendManualCapture({
    idempotencyKey: `raycast:${crypto.randomUUID()}`,
    note,
  });
}
