import { Effect } from "effect";
import type { DbService } from "@nudge/db";

export interface DeleteUserDataInput {
  readonly db: DbService;
  readonly userId: string;
}

export type DeleteUserDataResult = void;

export function deleteUserData(input: DeleteUserDataInput): Effect.Effect<DeleteUserDataResult> {
  return input.db.deleteUserData({ userId: input.userId });
}
