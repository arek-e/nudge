import { Effect } from "effect";
import { listOkfDirectory } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readOkfProjection } from "./okf-projection";

export interface ListOkfDirectoryActionInput {
  readonly context: ApiContext;
  readonly path: string;
}

export interface ListOkfDirectoryActionResult {
  readonly entries: string[];
  readonly path: string;
}

export function listOkfDirectoryAction(
  input: ListOkfDirectoryActionInput,
): ApiAction<ListOkfDirectoryActionResult> {
  return readOkfProjection({ context: input.context }).pipe(
    Effect.map((projection) => ({
      entries: listOkfDirectory(projection, input.path),
      path: input.path,
    })),
  );
}
