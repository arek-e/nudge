import { Effect } from "effect";
import { MemoryIndex } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { deleteUserMedia } from "../../media-storage";
import { deleteUserData } from "../db/delete-user-data";
import { type ApiAction, runMemoryIndex } from "./effect-helpers";

export interface DeleteAccountInput {
  readonly context: ApiContext;
}

export interface DeleteAccountResult {
  readonly deleted: true;
}

export function deleteAccount(input: DeleteAccountInput): ApiAction<DeleteAccountResult> {
  return Effect.gen(function* () {
    const mediaFiles = input.context.mediaFiles;
    if (mediaFiles) {
      yield* Effect.tryPromise({
        try: () => deleteUserMedia({ bucket: mediaFiles, userId: input.context.user.id }),
        catch: (cause) => cause,
      });
    }
    const turbopuffer = input.context.turbopuffer;
    if (turbopuffer) {
      yield* runMemoryIndex({
        turbopuffer,
        workflow: Effect.gen(function* () {
          const memoryIndex = yield* MemoryIndex;
          return yield* memoryIndex.deleteUserNamespace({ user: input.context.user });
        }),
      });
    }
    yield* deleteUserData({
      db: input.context.db,
      userId: input.context.user.id,
    });
    const result: DeleteAccountResult = { deleted: true };
    return result;
  });
}
