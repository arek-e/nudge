import { Effect } from "effect";
import { searchOkfFiles, type OkfSearchResult } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readOkfProjection } from "./okf-projection";

export interface SearchOkfFilesActionInput {
  readonly context: ApiContext;
  readonly limit: number;
  readonly query: string;
}

export interface SearchOkfFilesActionResult {
  readonly results: OkfSearchResult[];
}

export function searchOkfFilesAction(
  input: SearchOkfFilesActionInput,
): ApiAction<SearchOkfFilesActionResult> {
  return readOkfProjection({ context: input.context }).pipe(
    Effect.map((projection) => ({
      results: [...searchOkfFiles(projection, input.query, input.limit)],
    })),
  );
}
