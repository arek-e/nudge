import type { SurfaceEventRecord, SurfaceJournalDocument } from "@nudge/surface";
import { DailyJournalSurface, EmptyNotesStateSurface, RecentSignalsSurface } from "@nudge/ui";

export function JournalStack(props: {
  readonly journal: SurfaceJournalDocument | null | undefined;
  readonly signedInAs: string;
  readonly signals: ReadonlyArray<SurfaceEventRecord>;
}) {
  const recentSignals = props.signals.slice(0, 8).map((signal) => ({
    id: signal.id,
    noteText: eventNoteText(signal),
    occurredAt: signal.occurredAt,
    source: signalSourceLabel(signal.source),
  }));
  const hasJournal = props.journal !== null && props.journal !== undefined;
  const hasSignals = recentSignals.length > 0;

  return (
    <div className="grid gap-3">
      {props.journal ? (
        <DailyJournalSurface
          bodyText={props.journal.bodyText}
          localDate={props.journal.localDate}
          title={props.journal.title}
          updatedAt={props.journal.updatedAt}
        />
      ) : null}
      {hasSignals ? <RecentSignalsSurface signals={recentSignals} /> : null}
      {hasJournal || hasSignals ? null : <EmptyNotesStateSurface signedInAs={props.signedInAs} />}
    </div>
  );
}

function eventNoteText(signal: SurfaceEventRecord) {
  const payloadText = payloadTextValue(signal.payload);
  return payloadText || signal.type;
}

function payloadTextValue(payload: unknown) {
  if (typeof payload === "string") return payload.trim();
  if (typeof payload !== "object" || payload === null) return "";

  for (const key of ["note", "text", "changedText"]) {
    const value = Reflect.get(payload, key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function signalSourceLabel(source: string) {
  switch (source) {
    case "desktop_app":
      return "Desktop";
    case "ios_app":
      return "iOS";
    case "raycast":
    case "raycast_extension":
      return "Raycast";
    case "web_app":
      return "Web";
    default:
      return source;
  }
}
