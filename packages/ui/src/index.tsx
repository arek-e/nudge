import type { ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleUserRound,
  Database,
  Download,
  HardDrive,
  ImagePlus,
  Mic,
  PenLine,
  Server,
  Trash2,
  X,
} from "lucide-react";

export type StickyColor = "yellow" | "green" | "blue" | "rose";

export interface DailyOperatingLoopSurfaceProps {
  readonly actionCount: number;
  readonly activitySlot?: ReactNode;
  readonly captureSlot: ReactNode;
  readonly currentDate: string;
  readonly journalSlot: ReactNode;
  readonly navigationSlot?: ReactNode;
  readonly reviewSlot: ReactNode;
  readonly signalCount: number;
  readonly signedInAs: string;
  readonly statusMessage: string;
}

export interface DailyJournalSurfaceProps {
  readonly bodyText: string;
  readonly localDate: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface CalendarActivityDay {
  readonly localDate: string;
  readonly noteCount: number;
  readonly signalCount: number;
}

export interface CalendarActivitySurfaceProps {
  readonly currentDate: string;
  readonly days: ReadonlyArray<CalendarActivityDay>;
}

export interface RecentSignalSurfaceItem {
  readonly id: string;
  readonly noteText: string;
  readonly occurredAt: string;
  readonly source: string;
}

export interface RecentSignalsSurfaceProps {
  readonly signals: ReadonlyArray<RecentSignalSurfaceItem>;
}

export interface CaptureResultItem {
  readonly title: string;
  readonly value: string;
  readonly subtitle: string;
  readonly tone: "blue" | "green" | "orange" | "purple";
}

export interface CaptureResultSurfaceProps {
  readonly actionCount: number;
  readonly items: ReadonlyArray<CaptureResultItem>;
  readonly references: ReadonlyArray<string>;
  readonly signalCount: number;
  readonly sourceCount: number;
  readonly summary: string;
  readonly title: string;
}

export interface NoteColorPickerProps {
  readonly color: StickyColor;
  readonly onChange: (color: StickyColor) => void;
}

export interface NoteComposerAttachment {
  readonly id: string;
  readonly kind: "drawing" | "image" | "photo" | "voice";
  readonly label: string;
}

export interface NoteComposerSurfaceProps extends NoteColorPickerProps {
  readonly bodyText: string;
  readonly disabled: boolean;
  readonly attachments?: ReadonlyArray<NoteComposerAttachment>;
  readonly continuationText?: string;
  readonly statusMessage?: string;
  readonly onAttachDrawing?: () => void;
  readonly onAttachImage?: () => void;
  readonly onAttachVoice?: () => void;
  readonly onBodyTextChange: (value: string) => void;
  readonly onContinuationTextChange?: (value: string) => void;
  readonly onRemoveAttachment?: (id: string) => void;
  readonly onSubmit: () => void;
}

export interface StickyNoteSurfaceProps extends NoteColorPickerProps {
  readonly archiving: boolean;
  readonly bodyText: string;
  readonly dirty: boolean;
  readonly pinned: boolean;
  readonly saving: boolean;
  readonly serverRevision: string;
  readonly statusMessage?: string;
  readonly title: string;
  readonly onArchive: () => void;
  readonly onBodyTextChange: (value: string) => void;
  readonly onPinnedChange: (pinned: boolean) => void;
  readonly onSave: () => void;
}

export interface EmptyNotesStateSurfaceProps {
  readonly signedInAs: string;
}

export interface ReviewActionSurfaceProps {
  readonly body: string;
  readonly confidencePercent: number;
  readonly disabled: boolean;
  readonly followThroughText: string;
  readonly kind: string;
  readonly status: string;
  readonly title: string;
  readonly onAccept: () => void;
  readonly onComplete: () => void;
  readonly onDismiss: () => void;
}

export interface SettingsSurfaceProps {
  readonly accountName: string;
  readonly deleteDisabled: boolean;
  readonly desktopSlot?: ReactNode;
  readonly engineLabel: string;
  readonly exportDisabled: boolean;
  readonly sessionLabel: string;
  readonly surfaceLabel: string;
  readonly workspaceLabel: string;
  readonly accountSlot?: ReactNode;
  readonly onBack: () => void;
  readonly onDeleteData: () => void;
  readonly onExportData: () => void;
}

export const stickyColors: ReadonlyArray<StickyColor> = ["yellow", "green", "blue", "rose"];

export function DailyOperatingLoopSurface(props: DailyOperatingLoopSurfaceProps) {
  return (
    <main className="min-h-dvh bg-[#090a0b] text-[#edeae0]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <header className="grid gap-5 border-b border-white/7 pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
              {props.signedInAs}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
              <h1 className="m-0 text-3xl font-semibold tracking-normal text-[#edeae0] sm:text-4xl">
                Daily Operating Loop
              </h1>
              <p className="m-0 pb-1 text-sm font-medium text-[#7a8087]">{props.statusMessage}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <ChromeMetric label="Today" value={props.currentDate} tone="blue" />
            <ChromeMetric
              label="Open loops"
              value={loopCountText(props.actionCount)}
              tone="green"
            />
            <ChromeMetric label="Signals" value={signalCountText(props.signalCount)} tone="rose" />
          </div>

          {props.navigationSlot ? (
            <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
              {props.navigationSlot}
            </div>
          ) : null}
        </header>

        {props.activitySlot ? (
          <section aria-label="Calendar activity">{props.activitySlot}</section>
        ) : null}

        <section className="grid min-h-[calc(100dvh-150px)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid content-start gap-5">
            <section
              className="rounded-lg border border-white/7 bg-[#131518]/94 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
              aria-labelledby="nudge-capture-heading"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
                    Today
                  </p>
                  <h2
                    className="m-0 mt-1 text-xl font-semibold text-[#edeae0]"
                    id="nudge-capture-heading"
                  >
                    Capture
                  </h2>
                </div>
                <div className="h-2 w-10 rounded-sm bg-[#579ef5]" aria-hidden="true" />
              </div>
              {props.captureSlot}
            </section>

            <section className="grid content-start gap-3" aria-label="Daily note">
              {props.journalSlot}
            </section>
          </div>

          <aside className="grid content-start gap-4" aria-labelledby="nudge-review-heading">
            <div className="rounded-lg border border-white/7 bg-[#1f2125] p-4">
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
                Agent
              </p>
              <h2
                className="m-0 mt-1 text-lg font-semibold text-[#edeae0]"
                id="nudge-review-heading"
              >
                Review
              </h2>
            </div>
            {props.reviewSlot}
          </aside>
        </section>
      </div>
    </main>
  );
}

export function CalendarActivitySurface(props: CalendarActivitySurfaceProps) {
  const snapshot = calendarActivitySnapshot(props.days, props.currentDate);
  return (
    <section className="rounded-lg border border-white/7 bg-[#131518]/94 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
                Activity
              </p>
              <h2 className="m-0 mt-1 text-lg font-semibold text-[#edeae0]">
                {snapshot.dayCountText}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActivityPill label="Active" value={snapshot.activeDaysText} tone="green" />
              <ActivityPill label="Notes" value={snapshot.totalNotesText} tone="blue" />
              <ActivityPill label="Signals" value={snapshot.totalSignalsText} tone="rose" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
            {snapshot.visibleDays.map((day) => (
              <CalendarDayCell
                day={day}
                key={day.localDate}
                selected={day.localDate === props.currentDate}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/7 bg-[#090a0b]/55 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm font-semibold text-[#a1a6ad]">Selected day</p>
            <p className="m-0 text-xs font-semibold text-[#579ef5]">{props.currentDate}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <SelectedDayMetric
              label="Notes"
              value={pluralCount(snapshot.selectedDay.noteCount, "note")}
            />
            <SelectedDayMetric
              label="Signals"
              value={pluralCount(snapshot.selectedDay.signalCount, "signal")}
            />
            <SelectedDayMetric
              label="Logged"
              value={hasCalendarActivity(snapshot.selectedDay) ? "Logged" : "Open"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function DailyJournalSurface(props: DailyJournalSurfaceProps) {
  return (
    <article className="rounded-lg border border-white/7 bg-[#131518]/94 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
            Journal
          </p>
          <h2 className="m-0 mt-1 truncate text-lg font-semibold text-[#edeae0]">
            {props.title || props.localDate}
          </h2>
        </div>
        <p className="m-0 rounded-md border border-white/7 bg-[#090a0b]/55 px-2 py-1 text-xs font-semibold text-[#a1a6ad]">
          Updated {formatJournalTime(props.updatedAt)}
        </p>
      </div>
      <p className="m-0 mt-1 text-sm font-medium text-[#7a8087]">{props.localDate}</p>
      <div className="mt-4 text-base leading-7 whitespace-pre-wrap text-[#edeae0]">
        {props.bodyText.trim() || "No journal text yet."}
      </div>
    </article>
  );
}

export function RecentSignalsSurface(props: RecentSignalsSurfaceProps) {
  return (
    <section className="rounded-lg border border-white/7 bg-[#131518]/94 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
            Signals
          </p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-[#edeae0]">Recent signals</h2>
        </div>
        <p className="m-0 rounded-md border border-white/7 bg-[#090a0b]/55 px-2 py-1 text-xs font-semibold text-[#a1a6ad]">
          {signalCountText(props.signals.length)}
        </p>
      </div>

      {props.signals.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {props.signals.map((signal) => (
            <article
              className="rounded-md border border-white/7 bg-[#090a0b]/55 px-3 py-3"
              key={signal.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-xs font-semibold tracking-[0.12em] text-[#7a8087] uppercase">
                  {signal.source}
                </p>
                <p className="m-0 text-xs font-semibold text-[#a1a6ad]">
                  {formatSignalTime(signal.occurredAt)}
                </p>
              </div>
              <p className="m-0 mt-2 text-sm leading-6 text-[#edeae0]">{signal.noteText}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="m-0 mt-4 text-sm font-medium text-[#a1a6ad]">No recent signals yet.</p>
      )}
    </section>
  );
}

export function CaptureResultSurface(props: CaptureResultSurfaceProps) {
  return (
    <article className="rounded-lg border border-white/7 bg-[#131518]/94 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
            Capture saved
          </p>
          <h3 className="m-0 mt-1 text-xl font-semibold text-[#edeae0]">{props.title}</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/7 bg-[#090a0b]/55 text-[#40c792]">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-white/7 bg-[#090a0b]/55">
        <CaptureResultMetric label="Signals" value={String(props.signalCount)} tone="rose" />
        <CaptureResultMetric label="Open actions" value={String(props.actionCount)} tone="green" />
        <CaptureResultMetric label="References" value={String(props.sourceCount)} tone="blue" />
      </div>

      <div className="mt-4 grid gap-2">
        {props.items.map((item) => (
          <div
            className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-white/7 bg-[#090a0b]/55 px-3 py-3"
            key={`${item.title}:${item.value}`}
          >
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-[#edeae0]">{item.title}</p>
              <p className="m-0 mt-1 text-xs leading-5 text-[#a1a6ad]">{item.subtitle}</p>
            </div>
            <p
              className={`${captureResultToneClass(item.tone)} m-0 self-start rounded-md px-2 py-1 text-xs font-semibold`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <p className="m-0 mt-4 text-sm leading-6 text-[#a1a6ad]">{props.summary}</p>

      {props.references.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.references.map((reference) => (
            <span
              className="rounded-md border border-white/7 bg-[#090a0b]/55 px-2 py-1 text-xs font-semibold text-[#a1a6ad]"
              key={reference}
            >
              {reference}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CaptureResultMetric(props: {
  readonly label: string;
  readonly tone: "blue" | "green" | "rose";
  readonly value: string;
}) {
  return (
    <div className="min-h-16 border-r border-white/7 px-3 py-3 last:border-r-0">
      <p className="m-0 text-lg font-semibold text-[#edeae0] tabular-nums">{props.value}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.1em] text-[#7a8087] uppercase">
          {props.label}
        </p>
      </div>
    </div>
  );
}

export function SettingsSurface(props: SettingsSurfaceProps) {
  return (
    <main className="min-h-dvh bg-[#090a0b] text-[#edeae0]">
      <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-4 sm:px-6">
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-white/7 pb-4">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/7 bg-[#131518] px-3 text-sm font-semibold text-[#edeae0] shadow-sm"
            type="button"
            onClick={props.onBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Notes
          </button>
          <p className="m-0 text-sm font-semibold text-[#edeae0]">Settings</p>
          {props.accountSlot ? <div className="min-h-10">{props.accountSlot}</div> : null}
        </header>

        <section className="rounded-lg border border-white/7 bg-[#131518]/94 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/7 bg-[#1f2125] text-[#579ef5]">
            <CircleUserRound className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="m-0 mt-4 text-3xl font-semibold tracking-normal text-[#edeae0]">
            {props.accountName}
          </h1>
          <p className="m-0 mt-2 text-sm font-semibold text-[#a1a6ad]">
            {props.workspaceLabel} · {props.surfaceLabel}
          </p>
        </section>

        <SettingsSectionSurface title="Account">
          <SettingsRowSurface
            icon={<CircleUserRound className="h-4 w-4 text-[#579ef5]" aria-hidden />}
            label="Name"
            value={props.accountName}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<HardDrive className="h-4 w-4 text-[#40c792]" aria-hidden />}
            label="Workspace"
            value={props.workspaceLabel}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<Database className="h-4 w-4 text-[#d65f84]" aria-hidden />}
            label="Session"
            value={props.sessionLabel}
          />
        </SettingsSectionSurface>

        {props.desktopSlot ? props.desktopSlot : null}

        <SettingsSectionSurface title="Sync">
          <SettingsRowSurface
            icon={<Server className="h-4 w-4 text-[#579ef5]" aria-hidden />}
            label="Surface"
            value={props.surfaceLabel}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<HardDrive className="h-4 w-4 text-[#40c792]" aria-hidden />}
            label="Engine"
            value={props.engineLabel}
          />
        </SettingsSectionSurface>

        <SettingsSectionSurface title="Data">
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#579ef5] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
              disabled={props.exportDisabled}
              type="button"
              onClick={props.onExportData}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/7 bg-[#1f2125] px-4 text-sm font-semibold text-[#edeae0] disabled:opacity-50"
              disabled={props.deleteDisabled}
              type="button"
              onClick={props.onDeleteData}
            >
              <Trash2 className="h-4 w-4 text-[#d65f84]" aria-hidden />
              Delete local data
            </button>
          </div>
        </SettingsSectionSurface>
      </div>
    </main>
  );
}

function SettingsSectionSurface(props: { readonly children: ReactNode; readonly title: string }) {
  return (
    <section className="grid gap-2" aria-label={props.title}>
      <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#7a8087] uppercase">
        {props.title}
      </p>
      <div className="overflow-hidden rounded-lg border border-white/7 bg-[#131518]/94 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        {props.children}
      </div>
    </section>
  );
}

function SettingsRowSurface(props: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="grid min-h-14 grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#090a0b]/55">
        {props.icon}
      </span>
      <p className="m-0 text-sm font-semibold text-[#edeae0]">{props.label}</p>
      <p className="m-0 min-w-0 text-right text-sm font-semibold break-words text-[#a1a6ad]">
        {props.value}
      </p>
    </div>
  );
}

function SettingsDividerSurface() {
  return <div className="ml-[4.75rem] h-px bg-white/7" />;
}

function ActivityPill(props: {
  readonly label: string;
  readonly tone: "blue" | "green" | "rose";
  readonly value: string;
}) {
  return (
    <div className="min-h-10 rounded-md border border-white/7 bg-[#090a0b]/55 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.12em] text-[#7a8087] uppercase">
          {props.label}
        </p>
      </div>
      <p className="m-0 mt-1 text-sm font-semibold text-[#edeae0]">{props.value}</p>
    </div>
  );
}

function CalendarDayCell(props: { readonly day: CalendarActivityDay; readonly selected: boolean }) {
  return (
    <div
      className={`min-h-20 rounded-lg border px-2 py-2 ${
        props.selected ? "border-[#579ef5] bg-[#162337]" : "border-white/7 bg-[#090a0b]/55"
      }`}
    >
      <p className="m-0 text-xs font-semibold text-[#a1a6ad]">
        {shortCalendarDay(props.day.localDate)}
      </p>
      <div className="mt-3 flex items-end gap-1">
        <ActivityBar count={props.day.noteCount} tone="blue" />
        <ActivityBar count={props.day.signalCount} tone="rose" />
      </div>
      <p className="m-0 mt-2 text-[0.68rem] font-semibold text-[#7a8087]">
        {hasCalendarActivity(props.day)
          ? `${props.day.noteCount + props.day.signalCount} input${
              props.day.noteCount + props.day.signalCount === 1 ? "" : "s"
            }`
          : "Open"}
      </p>
    </div>
  );
}

function ActivityBar(props: { readonly count: number; readonly tone: "blue" | "rose" }) {
  return (
    <span
      className={`${metricToneClass(props.tone)} block w-2 rounded-sm`}
      style={{ height: `${Math.max(6, Math.min(32, 6 + props.count * 5))}px` }}
    />
  );
}

function SelectedDayMetric(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-h-16 rounded-md border border-white/7 bg-[#131518]/94 p-2 text-center">
      <p className="m-0 text-sm font-semibold text-[#edeae0]">{props.value}</p>
      <p className="m-0 mt-1 text-[0.68rem] font-semibold tracking-[0.1em] text-[#7a8087] uppercase">
        {props.label}
      </p>
    </div>
  );
}

function ChromeMetric(props: {
  readonly label: string;
  readonly tone: "blue" | "green" | "rose";
  readonly value: string;
}) {
  return (
    <div className="min-h-14 rounded-lg border border-white/7 bg-[#131518]/94 px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.12em] text-[#7a8087] uppercase">
          {props.label}
        </p>
      </div>
      <p className="m-0 mt-1 truncate text-sm font-semibold text-[#edeae0]">{props.value}</p>
    </div>
  );
}

function metricToneClass(tone: "blue" | "green" | "rose") {
  switch (tone) {
    case "blue":
      return "bg-[#579ef5]";
    case "green":
      return "bg-[#40c792]";
    case "rose":
      return "bg-[#d65f84]";
  }
}

function captureResultToneClass(tone: "blue" | "green" | "orange" | "purple") {
  switch (tone) {
    case "blue":
      return "bg-[#162337] text-[#579ef5]";
    case "green":
      return "bg-[#123226] text-[#40c792]";
    case "orange":
      return "bg-[#3a2514] text-[#ef9130]";
    case "purple":
      return "bg-[#251f3f] text-[#8c75eb]";
  }
}

function loopCountText(count: number) {
  return `${count} open loop${count === 1 ? "" : "s"}`;
}

function signalCountText(count: number) {
  return `${count} signal${count === 1 ? "" : "s"}`;
}

function pluralCount(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function hasCalendarActivity(day: CalendarActivityDay) {
  return day.noteCount > 0 || day.signalCount > 0;
}

function calendarActivitySnapshot(days: ReadonlyArray<CalendarActivityDay>, currentDate: string) {
  const sortedDays = [...days].sort((left, right) => left.localDate.localeCompare(right.localDate));
  const selectedDay =
    sortedDays.find((day) => day.localDate === currentDate) ??
    ({ localDate: currentDate, noteCount: 0, signalCount: 0 } satisfies CalendarActivityDay);
  const visibleDays = sortedDays.length > 0 ? sortedDays.slice(-7) : [selectedDay];
  const totalNotes = sortedDays.reduce((sum, day) => sum + day.noteCount, 0);
  const totalSignals = sortedDays.reduce((sum, day) => sum + day.signalCount, 0);
  const activeDays = sortedDays.filter(hasCalendarActivity).length;
  return {
    activeDaysText: `${activeDays} active`,
    dayCountText: pluralCount(sortedDays.length, "day"),
    selectedDay,
    totalNotesText: pluralCount(totalNotes, "note"),
    totalSignalsText: pluralCount(totalSignals, "signal"),
    visibleDays,
  };
}

function shortCalendarDay(localDate: string) {
  const date = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return localDate;
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function formatJournalTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSignalTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString([], {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function stickyColorFrom(value: string): StickyColor {
  switch (value) {
    case "green":
      return "green";
    case "blue":
      return "blue";
    case "rose":
      return "rose";
    default:
      return "yellow";
  }
}

export function NoteColorPicker(props: NoteColorPickerProps) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Note color">
      {stickyColors.map((color) => (
        <button
          aria-label={color}
          className={`${colorSwatchClass(color)} h-7 w-7 rounded-full border ${
            props.color === color ? "ring-2 ring-[#111827] ring-offset-2" : "ring-0"
          }`}
          key={color}
          type="button"
          onClick={() => props.onChange(color)}
        />
      ))}
    </div>
  );
}

export function NoteComposerSurface(props: NoteComposerSurfaceProps) {
  const attachments = props.attachments ?? [];
  const continuationText = props.continuationText ?? "";
  const showsContinuationDraft =
    props.onContinuationTextChange !== undefined &&
    (attachments.length > 0 || continuationText.trim().length > 0);
  const hasContent =
    props.bodyText.trim().length > 0 ||
    continuationText.trim().length > 0 ||
    attachments.length > 0;
  return (
    <section className="rounded-lg border border-white/7 bg-[#090a0b]/55 p-3">
      <textarea
        className="min-h-36 w-full resize-y border-0 bg-transparent p-1 text-2xl leading-9 font-semibold text-[#edeae0] outline-none placeholder:text-[#7a8087]"
        placeholder="What matters now?"
        value={props.bodyText}
        onChange={(event) => props.onBodyTextChange(event.target.value)}
      />
      {attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/7 bg-[#131518] px-2 text-sm font-semibold text-[#edeae0]"
              key={attachment.id}
            >
              <span className="rounded-sm bg-[#162337] px-2 py-1 text-xs font-semibold text-[#579ef5]">
                {attachmentLabel(attachment.kind)}
              </span>
              <span>{attachment.label}</span>
              {props.onRemoveAttachment ? (
                <button
                  aria-label={`Remove ${attachment.label}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#a1a6ad] hover:bg-white/7 hover:text-[#edeae0]"
                  type="button"
                  onClick={() => props.onRemoveAttachment?.(attachment.id)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {showsContinuationDraft ? (
        <textarea
          aria-label="Continuation note"
          className="mt-3 min-h-24 w-full resize-y rounded-md border border-white/7 bg-[#131518]/72 p-3 text-xl leading-8 font-semibold text-[#edeae0] outline-none placeholder:text-[#7a8087]"
          placeholder="Keep writing..."
          value={continuationText}
          onChange={(event) => props.onContinuationTextChange?.(event.target.value)}
        />
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/7 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <NoteColorPicker color={props.color} onChange={props.onChange} />
          {props.onAttachImage ? (
            <button
              aria-label="Attach photo"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/7 bg-[#131518] px-3 text-xs font-semibold text-[#edeae0] shadow-sm"
              type="button"
              onClick={props.onAttachImage}
            >
              <ImagePlus className="h-4 w-4 text-[#579ef5]" aria-hidden />
              Photo
            </button>
          ) : null}
          {props.onAttachDrawing ? (
            <button
              aria-label="Attach drawing"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/7 bg-[#131518] px-3 text-xs font-semibold text-[#edeae0] shadow-sm"
              type="button"
              onClick={props.onAttachDrawing}
            >
              <PenLine className="h-4 w-4 text-[#40c792]" aria-hidden />
              Drawing
            </button>
          ) : null}
          {props.onAttachVoice ? (
            <button
              aria-label="Attach voice"
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/7 bg-[#131518] px-3 text-xs font-semibold text-[#edeae0] shadow-sm"
              type="button"
              onClick={props.onAttachVoice}
            >
              <Mic className="h-4 w-4 text-[#d65f84]" aria-hidden />
              Voice
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {props.statusMessage ? (
            <p className="m-0 text-sm font-medium text-[#a1a6ad]">{props.statusMessage}</p>
          ) : null}
          <button
            className="min-h-10 rounded-md bg-[#579ef5] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
            disabled={props.disabled || !hasContent}
            type="button"
            onClick={props.onSubmit}
          >
            Capture
          </button>
        </div>
      </div>
    </section>
  );
}

function attachmentLabel(kind: NoteComposerAttachment["kind"]) {
  switch (kind) {
    case "drawing":
      return "Drawing";
    case "voice":
      return "Voice";
    case "image":
    case "photo":
      return "Photo";
  }
}

export function StickyNoteSurface(props: StickyNoteSurfaceProps) {
  return (
    <article
      className={`${stickyColorClass(props.color)} flex min-h-64 flex-col rounded-lg border p-4 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-base font-semibold text-[#111827]">{props.title}</h2>
          <p className="m-0 mt-1 text-xs font-medium text-[#667085]">
            Revision {props.serverRevision}
          </p>
        </div>
        <button
          className="min-h-9 rounded-md border border-black/10 bg-white/45 px-2 text-xs font-semibold text-[#111827]"
          type="button"
          onClick={() => props.onPinnedChange(!props.pinned)}
        >
          {props.pinned ? "Pinned" : "Pin"}
        </button>
      </div>

      <textarea
        className="mt-3 min-h-32 flex-1 resize-none border-0 bg-transparent text-sm leading-6 text-[#111827] outline-none placeholder:text-[#697386]"
        placeholder="Keep writing..."
        value={props.bodyText}
        onChange={(event) => props.onBodyTextChange(event.target.value)}
      />

      <div className="mt-4 grid gap-3">
        <NoteColorPicker color={props.color} onChange={props.onChange} />
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 min-h-5 text-xs font-medium text-[#596475]">
            {props.statusMessage || (props.dirty ? "Unsaved" : "")}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="min-h-9 rounded-md border border-black/10 bg-white/45 px-3 text-xs font-semibold text-[#111827] disabled:opacity-50"
              disabled={props.archiving}
              type="button"
              onClick={props.onArchive}
            >
              Archive
            </button>
            <button
              className="min-h-9 rounded-md bg-[#111827] px-3 text-xs font-semibold text-white disabled:opacity-50"
              disabled={props.saving || !props.dirty || !props.bodyText.trim()}
              type="button"
              onClick={props.onSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function EmptyNotesStateSurface(props: EmptyNotesStateSurfaceProps) {
  return (
    <section className="flex min-h-48 flex-col justify-between rounded-lg border border-dashed border-[#b7c1cd] bg-white/70 p-5">
      <div>
        <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
          {props.signedInAs}
        </p>
        <h2 className="m-0 mt-2 text-lg font-semibold text-[#111827]">No notes yet</h2>
      </div>
    </section>
  );
}

export function ReviewActionSurface(props: ReviewActionSurfaceProps) {
  return (
    <article className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
            {props.kind} · {props.status}
          </p>
          <h3 className="m-0 mt-1 text-base font-semibold text-[#111827]">{props.title}</h3>
        </div>
        <span className="text-xs font-semibold text-[#667085] tabular-nums">
          {props.confidencePercent}%
        </span>
      </div>
      <p className="m-0 mt-2 text-sm leading-6 text-[#4b5563]">{props.body}</p>
      <p className="m-0 mt-3 rounded-md bg-[#eef1f5] px-3 py-2 text-xs font-medium text-[#344054]">
        {props.followThroughText}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="min-h-9 rounded-md bg-[#111827] px-2 text-xs font-semibold text-white disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onAccept}
        >
          Accept
        </button>
        <button
          className="min-h-9 rounded-md border border-[#c3ccd7] bg-white px-2 text-xs font-semibold text-[#111827] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onComplete}
        >
          Done
        </button>
        <button
          className="min-h-9 rounded-md border border-[#c3ccd7] bg-white px-2 text-xs font-semibold text-[#111827] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onDismiss}
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

function stickyColorClass(color: StickyColor) {
  switch (color) {
    case "green":
      return "border-[#9bbf99] bg-[#dff0d8]";
    case "blue":
      return "border-[#9db9dc] bg-[#dce9f8]";
    case "rose":
      return "border-[#d4a0a9] bg-[#f8dce2]";
    case "yellow":
      return "border-[#d8c36a] bg-[#fff1a8]";
  }
}

function colorSwatchClass(color: StickyColor) {
  switch (color) {
    case "green":
      return "border-[#8dae8b] bg-[#bfe3b7]";
    case "blue":
      return "border-[#8fa9cb] bg-[#bcd6f5]";
    case "rose":
      return "border-[#c9909b] bg-[#f4b8c3]";
    case "yellow":
      return "border-[#c9b24d] bg-[#ffe56b]";
  }
}
