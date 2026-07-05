import { Effect } from "effect";
import { readOkfFile } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readOkfProjection } from "./okf-projection";

export interface ReadOkfFileActionInput {
  readonly context: ApiContext;
  readonly path: string;
}

export interface ReadOkfFileActionResult {
  readonly content: string;
  readonly path: string;
}

export function readOkfFileAction(
  input: ReadOkfFileActionInput,
): ApiAction<ReadOkfFileActionResult> {
  return readOkfProjection({ context: input.context }).pipe(
    Effect.map((projection) => ({
      content: readOkfFile(projection, input.path),
      path: input.path,
    })),
  );
}
