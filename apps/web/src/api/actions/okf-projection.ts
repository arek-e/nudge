import { Effect } from "effect";
import { buildOkfProjection, type OkfProjection } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readUserDataExport } from "../db/read-user-data-export";

export interface ReadOkfProjectionInput {
  readonly context: ApiContext;
}

export type ReadOkfProjectionResult = OkfProjection;

export function readOkfProjection(
  input: ReadOkfProjectionInput,
): ApiAction<ReadOkfProjectionResult> {
  return readUserDataExport({
    db: input.context.db,
    user: input.context.user,
  }).pipe(Effect.map(buildOkfProjection));
}
