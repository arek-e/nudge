import { Effect } from "effect";
import type { DbService, JournalDocumentRecord } from "@nudge/db";

export interface ReadJournalDocumentInput {
  readonly db: DbService;
  readonly localDate: string;
  readonly userId: string;
}

export type ReadJournalDocumentResult = JournalDocumentRecord | null;

export function readJournalDocument(
  input: ReadJournalDocumentInput,
): Effect.Effect<ReadJournalDocumentResult> {
  return input.db.getJournalDocument({ localDate: input.localDate, userId: input.userId });
}
