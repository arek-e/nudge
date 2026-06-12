export type UserId = string;

export type ReviewQueueItemType =
  | "memory_proposal"
  | "action_point"
  | "calendar_draft"
  | "relationship_memory_update"
  | "routine_change"
  | "consent_grant";

export interface DevUser {
  id: UserId;
  displayName: string;
}
