import { Effect } from "effect";
import type { EventRecord, JournalDocumentRecord } from "@nudge/db";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readCalendarDayActivity } from "../db/read-calendar-day-activity";

interface CalendarDayActivity {
  readonly localDate: string;
  readonly noteCount: number;
  readonly signalCount: number;
}

export interface ListCalendarDaysInput {
  readonly context: ApiContext;
  readonly timeZone: string;
}

export interface ListCalendarDaysResult {
  readonly days: CalendarDayActivity[];
}

function localDateInTimeZone(isoDate: string, timeZone: string) {
  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = formattedDatePart(parts, "year");
  const month = formattedDatePart(parts, "month");
  const day = formattedDatePart(parts, "day");
  return year && month && day ? `${year}-${month}-${day}` : isoDate.slice(0, 10);
}

function formattedDatePart(parts: ReadonlyArray<Intl.DateTimeFormatPart>, type: string) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function upsertCalendarDay(
  days: Map<string, CalendarDayActivity>,
  localDate: string,
  increment: { readonly notes?: number; readonly signals?: number },
) {
  const current = days.get(localDate) ?? { localDate, noteCount: 0, signalCount: 0 };
  days.set(localDate, {
    localDate,
    noteCount: current.noteCount + (increment.notes ?? 0),
    signalCount: current.signalCount + (increment.signals ?? 0),
  });
}

function buildCalendarDays(input: {
  readonly events: ReadonlyArray<EventRecord>;
  readonly journalDocuments: ReadonlyArray<JournalDocumentRecord>;
  readonly timeZone: string;
}) {
  const days = new Map<string, CalendarDayActivity>();
  for (const document of input.journalDocuments) {
    upsertCalendarDay(days, document.localDate, { notes: 1 });
  }
  for (const event of input.events) {
    upsertCalendarDay(days, localDateInTimeZone(event.occurredAt, input.timeZone), { signals: 1 });
  }
  return [...days.values()].sort((left, right) => left.localDate.localeCompare(right.localDate));
}

export function listCalendarDays(input: ListCalendarDaysInput): ApiAction<ListCalendarDaysResult> {
  return readCalendarDayActivity({
    db: input.context.db,
    userId: input.context.user.id,
  }).pipe(
    Effect.map((activity) => ({
      days: buildCalendarDays({
        events: activity.events,
        journalDocuments: activity.journalDocuments,
        timeZone: input.timeZone,
      }),
    })),
  );
}
