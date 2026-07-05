import { Effect } from "effect";
import type { JournalDocumentRecord } from "@nudge/db";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readJournalDocument } from "../db/read-journal-document";

export interface GetJournalDocumentInput {
  readonly context: ApiContext;
  readonly localDate: string;
}

export interface GetJournalDocumentResult {
  readonly document: JournalDocumentRecord | null;
}

export function getJournalDocument(
  input: GetJournalDocumentInput,
): ApiAction<GetJournalDocumentResult> {
  return readJournalDocument({
    db: input.context.db,
    localDate: input.localDate,
    userId: input.context.user.id,
  }).pipe(Effect.map((document) => ({ document })));
}
