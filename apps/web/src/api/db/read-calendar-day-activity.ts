import { Effect } from "effect";
import type { DbService, EventRecord, JournalDocumentRecord } from "@nudge/db";

export interface CalendarDayActivityData {
  readonly events: ReadonlyArray<EventRecord>;
  readonly journalDocuments: ReadonlyArray<JournalDocumentRecord>;
}

export interface ReadCalendarDayActivityInput {
  readonly db: DbService;
  readonly userId: string;
}

export type ReadCalendarDayActivityResult = CalendarDayActivityData;

export function readCalendarDayActivity(
  input: ReadCalendarDayActivityInput,
): Effect.Effect<ReadCalendarDayActivityResult> {
  return Effect.all([
    input.db.listRecentEvents({ limit: 100, userId: input.userId }),
    input.db.listJournalDocuments({ userId: input.userId }),
  ]).pipe(Effect.map(([events, journalDocuments]) => ({ events, journalDocuments })));
}
