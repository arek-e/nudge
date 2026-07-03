import type {
  SurfaceActionItem,
  SurfaceActionReviewStatus,
  SurfaceEngineClient,
} from "@nudge/surface";

export interface RaycastActionReviewInput {
  readonly itemId: string;
  readonly status: SurfaceActionReviewStatus;
}

export type RaycastActionReviewClient = Pick<SurfaceEngineClient, "updateActionStatus">;
export type RaycastActionReviewClientFactory = () => Promise<RaycastActionReviewClient>;

export async function reviewRaycastAction(
  input: RaycastActionReviewInput,
  clientFactory: RaycastActionReviewClientFactory,
): Promise<SurfaceActionItem> {
  return await (await clientFactory()).updateActionStatus(input);
}
