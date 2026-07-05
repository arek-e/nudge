import { Effect } from "effect";
import type { DbService, DbUser, UserDataExport } from "@nudge/db";

export interface ReadReviewInboxDataInput {
  readonly db: DbService;
  readonly user: DbUser;
}

export type ReadReviewInboxDataResult = UserDataExport;

export function readReviewInboxData(
  input: ReadReviewInboxDataInput,
): Effect.Effect<ReadReviewInboxDataResult> {
  return input.db.exportUserData(input.user);
}
