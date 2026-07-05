import type { ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Database,
  Download,
  HardDrive,
  Inbox,
  ImagePlus,
  LayoutDashboard,
  Mic,
  PenLine,
  PanelLeftClose,
  Search,
  Server,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

export interface NoteWorkspaceItem {
  readonly bodyText: string;
  readonly id: string;
  readonly metaText?: string;
  readonly title: string;
}

export interface NoteFirstWorkspaceSurfaceProps {
  readonly composerSlot: ReactNode;
  readonly notes: ReadonlyArray<NoteWorkspaceItem>;
  readonly navigationSlot?: ReactNode;
  readonly reviewSlot?: ReactNode;
  readonly signedInAs: string;
  readonly statusMessage: string;
  readonly utilitySlot?: ReactNode;
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

export type NudgeSidebarNavigationKey =
  | "overview"
  | "journal"
  | "signals"
  | "actions"
  | "ask"
  | "review"
  | "settings";

export interface NudgeSidebarNavigationItem {
  readonly group: "Review" | "System" | "Workspace";
  readonly key: NudgeSidebarNavigationKey;
  readonly label: string;
  readonly active?: boolean;
  readonly onSelect?: () => void;
}

export interface NudgeSidebarNavigationSurfaceProps {
  readonly signedInAs: string;
  readonly statusMessage: string;
  readonly footerSlot?: ReactNode;
  readonly items?: ReadonlyArray<NudgeSidebarNavigationItem>;
}

export const stickyColors: ReadonlyArray<StickyColor> = ["yellow", "green", "blue", "rose"];

const defaultSidebarNavigationItems: ReadonlyArray<NudgeSidebarNavigationItem> = [
  { active: true, group: "Workspace", key: "overview", label: "Overview" },
  { group: "Workspace", key: "journal", label: "Journal" },
  { group: "Workspace", key: "signals", label: "Signals" },
  { group: "Workspace", key: "actions", label: "Actions" },
  { group: "Review", key: "ask", label: "Ask Nudge" },
  { group: "Review", key: "review", label: "Review" },
  { group: "System", key: "settings", label: "Settings" },
] satisfies ReadonlyArray<NudgeSidebarNavigationItem>;
const noteFirstSidebarNavigationItems: ReadonlyArray<NudgeSidebarNavigationItem> = [
  { active: true, group: "Workspace", key: "overview", label: "Notes" },
  { group: "Workspace", key: "actions", label: "AI Review" },
  { group: "Review", key: "ask", label: "Ask Nudge" },
  { group: "System", key: "settings", label: "Settings" },
] satisfies ReadonlyArray<NudgeSidebarNavigationItem>;
const sidebarNavigationGroups: ReadonlyArray<NudgeSidebarNavigationItem["group"]> = [
  "Workspace",
  "Review",
  "System",
];

const shellPanelClass =
  "rounded-lg bg-[#141615] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_42px_rgba(0,0,0,0.28)]";
const insetPanelClass = "rounded-lg bg-[#1d201e] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]";
const darkPanelClass =
  "rounded-lg bg-[#101312] text-[#f7fbf6] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_48px_rgba(0,0,0,0.34)]";
const eyebrowClass = "m-0 text-[0.68rem] font-semibold tracking-[0.14em] text-[#8d938f] uppercase";
const primaryButtonClass =
  "min-h-10 rounded-lg bg-[#f15a24] px-4 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_24px_rgba(241,90,36,0.2)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50";
const secondaryButtonClass =
  "min-h-10 rounded-lg bg-[#191c1a] px-3 text-sm font-semibold text-[#e7e9e4] shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_8px_18px_rgba(0,0,0,0.18)] transition-[scale,background-color,box-shadow] duration-150 ease-out hover:bg-[#202421] active:scale-[0.96] disabled:opacity-50";

export function DailyOperatingLoopSurface(props: DailyOperatingLoopSurfaceProps) {
  const sidebarSlot = props.navigationSlot ?? (
    <NudgeSidebarNavigationSurface
      signedInAs={props.signedInAs}
      statusMessage={props.statusMessage}
    />
  );
  return (
    <main className="min-h-dvh bg-[#0f1110] text-[#e7e9e4]">
      <div className="mx-auto grid w-full max-w-[112rem] lg:grid-cols-[20.25rem_minmax(0,1fr)]">
        <aside className="hidden min-h-dvh flex-col bg-[#0b0d0c] shadow-[inset_-1px_0_rgba(255,255,255,0.08)] lg:flex">
          {sidebarSlot}
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 bg-[#0b0d0c] px-4 py-3 shadow-[inset_0_-1px_rgba(255,255,255,0.08)] lg:hidden">
            <p className="m-0 text-sm font-semibold text-[#f4f5f1]">Nudge</p>
            <p className="m-0 rounded-full bg-[#12331f] px-3 py-1 text-xs font-semibold text-[#57d66d]">
              {props.statusMessage}
            </p>
          </div>

          <div className="grid gap-5 px-4 py-4 sm:px-6 lg:px-7">
            <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#8d938f]" aria-hidden />
                  <p className={eyebrowClass}>{props.signedInAs}</p>
                </div>
                <h1 className="m-0 mt-2 text-3xl leading-tight font-semibold tracking-normal text-balance text-[#f4f5f1] sm:text-4xl">
                  Daily Operating Loop
                </h1>
                <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-pretty text-[#a8aea9]">
                  Capture the signal, keep the journal current, and review the next useful action.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:min-w-[34rem]">
                <ChromeMetric label="Today" value={props.currentDate} tone="blue" />
                <ChromeMetric
                  label="Open loops"
                  value={loopCountText(props.actionCount)}
                  tone="green"
                />
                <ChromeMetric
                  label="Signals"
                  value={signalCountText(props.signalCount)}
                  tone="rose"
                />
              </div>
            </header>

            {props.activitySlot ? (
              <section aria-label="Calendar activity">{props.activitySlot}</section>
            ) : null}

            <section className="grid min-h-[calc(100dvh-170px)] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="grid content-start gap-5">
                <section
                  className={`${darkPanelClass} p-4 sm:p-5`}
                  aria-labelledby="nudge-capture-heading"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-[0.68rem] font-semibold tracking-[0.14em] text-[#8d938f] uppercase">
                        Today
                      </p>
                      <h2
                        className="m-0 mt-1 text-xl font-semibold text-balance text-[#f7fbf6]"
                        id="nudge-capture-heading"
                      >
                        Capture
                      </h2>
                    </div>
                    <div className="h-2 w-12 rounded-full bg-[#f15a24]" aria-hidden="true" />
                  </div>
                  {props.captureSlot}
                </section>

                <section className="grid content-start gap-3" aria-label="Daily note">
                  {props.journalSlot}
                </section>
              </div>

              <aside className="grid content-start gap-4" aria-labelledby="nudge-review-heading">
                <div className={`${shellPanelClass} p-4`}>
                  <p className={eyebrowClass}>Agent</p>
                  <h2
                    className="m-0 mt-1 text-lg font-semibold text-balance text-[#f4f5f1]"
                    id="nudge-review-heading"
                  >
                    Review
                  </h2>
                </div>
                {props.reviewSlot}
              </aside>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export function NoteFirstWorkspaceSurface(props: NoteFirstWorkspaceSurfaceProps) {
  const sidebarSlot = props.navigationSlot ?? (
    <NudgeSidebarNavigationSurface
      items={noteFirstSidebarNavigationItems}
      signedInAs={props.signedInAs}
      statusMessage={props.statusMessage}
    />
  );
  return (
    <main className="min-h-dvh bg-[#0f1110] text-[#e7e9e4]">
      <div className="mx-auto grid w-full max-w-[112rem] lg:grid-cols-[20.25rem_minmax(0,1fr)]">
        <aside className="hidden min-h-dvh flex-col bg-[#0b0d0c] shadow-[inset_-1px_0_rgba(255,255,255,0.08)] lg:flex">
          {sidebarSlot}
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 bg-[#0b0d0c] px-4 py-3 shadow-[inset_0_-1px_rgba(255,255,255,0.08)] lg:hidden">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-[#f4f5f1]">Nudge</p>
              <p className="m-0 truncate text-xs font-medium text-[#8d938f]">{props.signedInAs}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="m-0 rounded-full bg-[#12331f] px-3 py-1 text-xs font-semibold text-[#57d66d]">
                {props.statusMessage}
              </p>
              {props.utilitySlot}
            </div>
          </div>

          <div className="grid gap-5 px-4 py-4 sm:px-6 lg:px-7">
            <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-[#8d938f]" aria-hidden />
                  <p className={eyebrowClass}>{props.signedInAs}</p>
                </div>
                <h1 className="m-0 mt-2 text-3xl leading-tight font-semibold tracking-normal text-balance text-[#f4f5f1] sm:text-4xl">
                  Notes
                </h1>
                <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-pretty text-[#a8aea9]">
                  Write what happened, promised, or changed. Nudge reviews the notes and proposes
                  the next useful action.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:min-w-[34rem]">
                <ChromeMetric
                  label="Notes"
                  value={pluralCount(props.notes.length, "note")}
                  tone="blue"
                />
                <ChromeMetric label="AI review" value="On" tone="green" />
                <ChromeMetric label="Status" value={props.statusMessage} tone="rose" />
              </div>
            </header>

            <section className="grid min-h-[calc(100dvh-150px)] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="grid content-start gap-5">
                <section
                  className={`${darkPanelClass} p-4 sm:p-5`}
                  aria-labelledby="nudge-note-input-heading"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className={eyebrowClass}>Input</p>
                      <h2
                        className="m-0 mt-1 text-xl font-semibold text-balance text-[#f7fbf6]"
                        id="nudge-note-input-heading"
                      >
                        New note
                      </h2>
                    </div>
                    <div className="h-2 w-12 rounded-full bg-[#f15a24]" aria-hidden="true" />
                  </div>
                  {props.composerSlot}
                </section>

                <section className={`${shellPanelClass} p-4`} aria-labelledby="nudge-notes-heading">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={eyebrowClass}>Workspace</p>
                      <h2
                        className="m-0 mt-1 text-lg font-semibold text-balance text-[#f4f5f1]"
                        id="nudge-notes-heading"
                      >
                        Recent notes
                      </h2>
                    </div>
                    <p className="m-0 rounded-lg bg-[#1d201e] px-2 py-1 text-xs font-semibold text-[#a8aea9] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                      {pluralCount(props.notes.length, "note")}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {props.notes.length > 0 ? (
                      props.notes.map((note) => <NoteWorkspaceCard key={note.id} note={note} />)
                    ) : (
                      <EmptyNoteWorkspaceCard />
                    )}
                  </div>
                </section>
              </div>

              <aside className="grid content-start gap-4" aria-labelledby="nudge-review-heading">
                <div className={`${shellPanelClass} p-4`}>
                  <p className={eyebrowClass}>Agent</p>
                  <h2
                    className="m-0 mt-1 text-lg font-semibold text-balance text-[#f4f5f1]"
                    id="nudge-review-heading"
                  >
                    AI review
                  </h2>
                  <p className="m-0 mt-2 text-sm leading-6 text-pretty text-[#8d938f]">
                    Suggested tasks, reminders, calendar events, and memories stay here until you
                    approve them.
                  </p>
                </div>
                {props.reviewSlot}
              </aside>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function NoteWorkspaceCard(props: { readonly note: NoteWorkspaceItem }) {
  return (
    <article className="grid gap-2 rounded-lg bg-[#0f1110] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 min-w-0 text-base font-semibold text-balance text-[#f4f5f1]">
          {props.note.title}
        </h3>
        {props.note.metaText ? (
          <p className="m-0 text-xs font-semibold tracking-[0.12em] text-[#8d938f] uppercase">
            {props.note.metaText}
          </p>
        ) : null}
      </div>
      <p className="m-0 text-sm leading-6 text-pretty whitespace-pre-wrap text-[#d7dbd6]">
        {props.note.bodyText}
      </p>
    </article>
  );
}

function EmptyNoteWorkspaceCard() {
  return (
    <article className="rounded-lg bg-[#0f1110] px-3 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <p className="m-0 text-sm font-semibold text-[#f4f5f1]">No notes yet.</p>
      <p className="m-0 mt-2 text-sm leading-6 text-pretty text-[#8d938f]">
        Start with a quick note. Nudge will analyze it for follow-through.
      </p>
    </article>
  );
}

export function NudgeSidebarNavigationSurface(props: NudgeSidebarNavigationSurfaceProps) {
  const items = props.items ?? defaultSidebarNavigationItems;
  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0d0c]">
      <div className="flex h-[72px] shrink-0 items-center justify-between gap-3 px-6 shadow-[inset_0_-1px_rgba(255,255,255,0.08)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-[#f4f5f1] text-sm font-black text-[#f15a24] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_18px_rgba(0,0,0,0.22)]">
            N
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <p className="m-0 truncate text-base font-semibold text-[#f4f5f1]">Nudge</p>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#8d938f]" aria-hidden />
          </div>
        </div>
        <div className="grid size-9 place-items-center rounded-lg text-[#8d938f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)]">
          <PanelLeftClose className="h-4 w-4" aria-hidden />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
        <div className="flex min-h-11 items-center gap-3 rounded-[14px] bg-[#101111] px-4 text-[15px] text-[#8d938f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
          <Search className="h-5 w-5" aria-hidden />
          <span>Search</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-[#1d1e1e] px-2 text-xs font-semibold text-[#b4b4b2] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              ⌘
            </span>
            <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-[#1d1e1e] px-2 text-xs font-semibold text-[#b4b4b2] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              K
            </span>
          </span>
        </div>

        <nav className="mt-7 grid gap-7" aria-label="Nudge navigation">
          {sidebarNavigationGroups.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <SidebarNavGroup key={group} title={group}>
                {groupItems.map((item) => (
                  <SidebarNavItem
                    active={item.active === true}
                    icon={sidebarNavigationIcon(item.key)}
                    key={item.key}
                    onSelect={item.onSelect}
                  >
                    {item.label}
                  </SidebarNavItem>
                ))}
              </SidebarNavGroup>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-3">
          <div className="rounded-[14px] bg-[#101111] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)]">
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm font-medium text-[#8d938f]">Status</p>
              <p className="m-0 min-w-0 truncate text-right text-sm font-semibold text-[#f4f5f1]">
                {props.statusMessage}
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#1f211f]">
              <div className="h-full w-[52%] rounded-full bg-[#57d66d]" />
            </div>
          </div>
          {props.footerSlot}
        </div>
      </div>
    </div>
  );
}

function SidebarNavGroup(props: { readonly children: ReactNode; readonly title: string }) {
  return (
    <div className="-mx-3 grid gap-2">
      <p className="m-0 px-3 text-[15px] font-medium text-[#8d8d8a]">{props.title}</p>
      <div className="grid gap-1.5">{props.children}</div>
    </div>
  );
}

function SidebarNavItem(props: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly icon: ReactNode;
  readonly onSelect?: (() => void) | undefined;
}) {
  const className = `relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-[14px] px-4 text-left text-[15px] font-semibold transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.98] ${
    props.active
      ? "bg-[linear-gradient(90deg,#1a1b1b_0%,#1b1c1c_58%,rgba(83,75,178,0.66)_100%)] text-[#f4f5f1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]"
      : "text-[#c7c7c4] hover:bg-[#171817] hover:text-[#f4f5f1]"
  }`;
  const content = (
    <>
      <span className="grid size-5 place-items-center text-[#b8b8b5]">{props.icon}</span>
      <span className="min-w-0 truncate">{props.children}</span>
      {props.active ? (
        <span
          className="absolute top-1/2 right-0 h-6 w-[3px] -translate-y-1/2 rounded-l-full bg-[#6b63ff]"
          aria-hidden
        />
      ) : null}
    </>
  );
  if (props.onSelect) {
    return (
      <button
        aria-current={props.active ? "page" : undefined}
        className={className}
        type="button"
        onClick={props.onSelect}
      >
        {content}
      </button>
    );
  }
  return (
    <div aria-current={props.active ? "page" : undefined} className={className}>
      {content}
    </div>
  );
}

function sidebarNavigationIcon(key: NudgeSidebarNavigationKey) {
  switch (key) {
    case "overview":
      return <LayoutDashboard className="h-5 w-5" aria-hidden />;
    case "journal":
      return <CalendarDays className="h-5 w-5" aria-hidden />;
    case "signals":
      return <Zap className="h-5 w-5" aria-hidden />;
    case "actions":
      return <Inbox className="h-5 w-5" aria-hidden />;
    case "ask":
      return <Bot className="h-5 w-5" aria-hidden />;
    case "review":
      return <Sparkles className="h-5 w-5" aria-hidden />;
    case "settings":
      return <Server className="h-5 w-5" aria-hidden />;
  }
}

export function CalendarActivitySurface(props: CalendarActivitySurfaceProps) {
  const snapshot = calendarActivitySnapshot(props.days, props.currentDate);
  const chartData = activityChartData(snapshot.visibleDays);
  const mixData = selectedActivityMix(snapshot.selectedDay);
  return (
    <section className={`${shellPanelClass} p-4`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={eyebrowClass}>Activity</p>
              <h2 className="m-0 mt-1 text-lg font-semibold text-balance text-[#f4f5f1]">
                {snapshot.dayCountText}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActivityPill label="Active" value={snapshot.activeDaysText} tone="green" />
              <ActivityPill label="Notes" value={snapshot.totalNotesText} tone="blue" />
              <ActivityPill label="Signals" value={snapshot.totalSignalsText} tone="rose" />
            </div>
          </div>

          <div className="rounded-lg bg-[#0f1110] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold text-[#f4f5f1]">Daily activity</p>
              <p className="m-0 text-xs font-semibold text-[#8d938f]">Notes + signals</p>
            </div>
            <div className="mt-3 h-40">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 720, height: 160 }}
              >
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="nudgeNotesGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3ea4ff" stopOpacity={0.36} />
                      <stop offset="100%" stopColor="#3ea4ff" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="nudgeSignalsGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f15a24" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="#f15a24" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    tickLine={false}
                    tick={{ fill: "#8d938f", fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#8d938f", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#141615",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#f4f5f1",
                    }}
                    cursor={{ stroke: "rgba(255,255,255,0.12)" }}
                    labelStyle={{ color: "#f4f5f1" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="notes"
                    stroke="#3ea4ff"
                    fill="url(#nudgeNotesGradient)"
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="signals"
                    stroke="#f15a24"
                    fill="url(#nudgeSignalsGradient)"
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
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

        <div className={`${insetPanelClass} p-3`}>
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm font-semibold text-[#f4f5f1]">Selected day</p>
            <p className="m-0 text-xs font-semibold text-[#3ea4ff]">{props.currentDate}</p>
          </div>
          <div className="mt-3 rounded-lg bg-[#0f1110] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <p className="m-0 text-sm font-semibold text-[#f4f5f1]">Activity mix</p>
            <div className="mt-3 h-32">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 280, height: 128 }}
              >
                <BarChart
                  data={mixData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
                >
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    width={58}
                    tick={{ fill: "#c1c6c1", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#141615",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#f4f5f1",
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    labelStyle={{ color: "#f4f5f1" }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#57d66d"
                    isAnimationActive={false}
                    radius={[0, 6, 6, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
    <article className={`${shellPanelClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={eyebrowClass}>Journal</p>
          <h2 className="m-0 mt-1 truncate text-lg font-semibold text-[#f4f5f1]">
            {props.title || props.localDate}
          </h2>
        </div>
        <p className="m-0 rounded-lg bg-[#1d201e] px-2 py-1 text-xs font-semibold text-[#a8aea9] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
          Updated {formatJournalTime(props.updatedAt)}
        </p>
      </div>
      <p className="m-0 mt-1 text-sm font-medium text-[#8d938f]">{props.localDate}</p>
      <div className="mt-4 text-base leading-7 text-pretty whitespace-pre-wrap text-[#d7dbd6]">
        {props.bodyText.trim() || "No journal text yet."}
      </div>
    </article>
  );
}

export function RecentSignalsSurface(props: RecentSignalsSurfaceProps) {
  return (
    <section className={`${shellPanelClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={eyebrowClass}>Signals</p>
          <h2 className="m-0 mt-1 text-lg font-semibold text-balance text-[#f4f5f1]">
            Recent signals
          </h2>
        </div>
        <p className="m-0 rounded-lg bg-[#2b1b14] px-2 py-1 text-xs font-semibold text-[#ff8a5c] shadow-[inset_0_0_0_1px_rgba(241,90,36,0.2)]">
          {signalCountText(props.signals.length)}
        </p>
      </div>

      {props.signals.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {props.signals.map((signal) => (
            <article
              className="grid gap-2 rounded-lg bg-[#0f1110] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
              key={signal.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-xs font-semibold tracking-[0.12em] text-[#b74417] uppercase">
                  {signal.source}
                </p>
                <p className="m-0 text-xs font-semibold text-[#8d938f]">
                  {formatSignalTime(signal.occurredAt)}
                </p>
              </div>
              <p className="m-0 text-sm leading-6 text-pretty text-[#d7dbd6]">{signal.noteText}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="m-0 mt-4 text-sm font-medium text-[#8d938f]">No recent signals yet.</p>
      )}
    </section>
  );
}

export function CaptureResultSurface(props: CaptureResultSurfaceProps) {
  return (
    <article className={`${shellPanelClass} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={eyebrowClass}>Capture saved</p>
          <h3 className="m-0 mt-1 text-xl font-semibold text-balance text-[#f4f5f1]">
            {props.title}
          </h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#12331f] text-[#57d66d] shadow-[inset_0_0_0_1px_rgba(87,214,109,0.18)]">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg bg-[#0f1110] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <CaptureResultMetric label="Signals" value={String(props.signalCount)} tone="rose" />
        <CaptureResultMetric label="Open actions" value={String(props.actionCount)} tone="green" />
        <CaptureResultMetric label="References" value={String(props.sourceCount)} tone="blue" />
      </div>

      <div className="mt-4 grid gap-2">
        {props.items.map((item) => (
          <div
            className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-[#0f1110] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            key={`${item.title}:${item.value}`}
          >
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-[#f4f5f1]">{item.title}</p>
              <p className="m-0 mt-1 text-xs leading-5 text-[#8d938f]">{item.subtitle}</p>
            </div>
            <p
              className={`${captureResultToneClass(item.tone)} m-0 self-start rounded-lg px-2 py-1 text-xs font-semibold`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <p className="m-0 mt-4 text-sm leading-6 text-pretty text-[#a8aea9]">{props.summary}</p>

      {props.references.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.references.map((reference) => (
            <span
              className="rounded-lg bg-[#1d201e] px-2 py-1 text-xs font-semibold text-[#a8aea9] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
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
    <div className="min-h-16 px-3 py-3 shadow-[inset_-1px_0_rgba(255,255,255,0.08)] last:shadow-none">
      <p className="m-0 text-lg font-semibold text-[#f4f5f1] tabular-nums">{props.value}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.1em] text-[#8d938f] uppercase">
          {props.label}
        </p>
      </div>
    </div>
  );
}

export function SettingsSurface(props: SettingsSurfaceProps) {
  return (
    <main className="min-h-dvh bg-[#0f1110] text-[#e7e9e4]">
      <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-4 sm:px-6">
        <header className="flex min-h-12 items-center justify-between gap-3">
          <button
            className={`${secondaryButtonClass} inline-flex items-center gap-2`}
            type="button"
            onClick={props.onBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Notes
          </button>
          <p className="m-0 text-sm font-semibold text-[#f4f5f1]">Settings</p>
          {props.accountSlot ? <div className="min-h-10">{props.accountSlot}</div> : null}
        </header>

        <section className={`${shellPanelClass} p-5`}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#14283b] text-[#3ea4ff] shadow-[inset_0_0_0_1px_rgba(62,164,255,0.16)]">
            <CircleUserRound className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="m-0 mt-4 text-3xl font-semibold tracking-normal text-balance text-[#f4f5f1]">
            {props.accountName}
          </h1>
          <p className="m-0 mt-2 text-sm font-semibold text-[#8d938f]">
            {props.workspaceLabel} · {props.surfaceLabel}
          </p>
        </section>

        <SettingsSectionSurface title="Account">
          <SettingsRowSurface
            icon={<CircleUserRound className="h-4 w-4 text-[#2f80c6]" aria-hidden />}
            label="Name"
            value={props.accountName}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<HardDrive className="h-4 w-4 text-[#2a7251]" aria-hidden />}
            label="Workspace"
            value={props.workspaceLabel}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<Database className="h-4 w-4 text-[#f15a24]" aria-hidden />}
            label="Session"
            value={props.sessionLabel}
          />
        </SettingsSectionSurface>

        {props.desktopSlot ? props.desktopSlot : null}

        <SettingsSectionSurface title="Sync">
          <SettingsRowSurface
            icon={<Server className="h-4 w-4 text-[#2f80c6]" aria-hidden />}
            label="Surface"
            value={props.surfaceLabel}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<HardDrive className="h-4 w-4 text-[#2a7251]" aria-hidden />}
            label="Engine"
            value={props.engineLabel}
          />
        </SettingsSectionSurface>

        <SettingsSectionSurface title="Data">
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            <button
              className={`${primaryButtonClass} inline-flex items-center justify-center gap-2`}
              disabled={props.exportDisabled}
              type="button"
              onClick={props.onExportData}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
            <button
              className={`${secondaryButtonClass} inline-flex items-center justify-center gap-2`}
              disabled={props.deleteDisabled}
              type="button"
              onClick={props.onDeleteData}
            >
              <Trash2 className="h-4 w-4 text-[#f15a24]" aria-hidden />
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
      <p className={eyebrowClass}>{props.title}</p>
      <div className={`${shellPanelClass} overflow-hidden`}>{props.children}</div>
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
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f1110] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        {props.icon}
      </span>
      <p className="m-0 text-sm font-semibold text-[#f4f5f1]">{props.label}</p>
      <p className="m-0 min-w-0 text-right text-sm font-semibold break-words text-[#a8aea9]">
        {props.value}
      </p>
    </div>
  );
}

function SettingsDividerSurface() {
  return <div className="ml-[4.75rem] h-px bg-white/8" />;
}

function ActivityPill(props: {
  readonly label: string;
  readonly tone: "blue" | "green" | "rose";
  readonly value: string;
}) {
  return (
    <div className="min-h-10 rounded-lg bg-[#0f1110] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.12em] text-[#8d938f] uppercase">
          {props.label}
        </p>
      </div>
      <p className="m-0 mt-1 text-sm font-semibold text-[#f4f5f1]">{props.value}</p>
    </div>
  );
}

function CalendarDayCell(props: { readonly day: CalendarActivityDay; readonly selected: boolean }) {
  return (
    <div
      className={`min-h-20 rounded-lg px-2 py-2 ${
        props.selected
          ? "bg-[#14283b] shadow-[inset_0_0_0_1px_rgba(62,164,255,0.22)]"
          : "bg-[#0f1110] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      }`}
    >
      <p className="m-0 text-xs font-semibold text-[#a8aea9]">
        {shortCalendarDay(props.day.localDate)}
      </p>
      <div className="mt-3 flex items-end gap-1">
        <ActivityBar count={props.day.noteCount} tone="blue" />
        <ActivityBar count={props.day.signalCount} tone="rose" />
      </div>
      <p className="m-0 mt-2 text-[0.68rem] font-semibold text-[#8d938f]">
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
    <div className="min-h-16 rounded-lg bg-[#0f1110] p-2 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <p className="m-0 text-sm font-semibold text-[#f4f5f1]">{props.value}</p>
      <p className="m-0 mt-1 text-[0.68rem] font-semibold tracking-[0.1em] text-[#8d938f] uppercase">
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
    <div className="min-h-14 rounded-lg bg-[#141615] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.12em] text-[#8d938f] uppercase">
          {props.label}
        </p>
      </div>
      <p className="m-0 mt-1 truncate text-sm font-semibold text-[#f4f5f1] tabular-nums">
        {props.value}
      </p>
    </div>
  );
}

function metricToneClass(tone: "blue" | "green" | "rose") {
  switch (tone) {
    case "blue":
      return "bg-[#2f80c6]";
    case "green":
      return "bg-[#2a7251]";
    case "rose":
      return "bg-[#f15a24]";
  }
}

function captureResultToneClass(tone: "blue" | "green" | "orange" | "purple") {
  switch (tone) {
    case "blue":
      return "bg-[#14283b] text-[#8fc9ff]";
    case "green":
      return "bg-[#12331f] text-[#78e18c]";
    case "orange":
      return "bg-[#2b1b14] text-[#ff8a5c]";
    case "purple":
      return "bg-[#252047] text-[#b4a8ff]";
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

function activityChartData(days: ReadonlyArray<CalendarActivityDay>) {
  return days.map((day) => ({
    label: shortCalendarDay(day.localDate),
    notes: day.noteCount,
    signals: day.signalCount,
  }));
}

function selectedActivityMix(day: CalendarActivityDay) {
  return [
    { label: "Notes", value: day.noteCount },
    { label: "Signals", value: day.signalCount },
  ];
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
          className={`${colorSwatchClass(color)} h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18)] transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.96] ${
            props.color === color
              ? "ring-2 ring-[#f15a24] ring-offset-2 ring-offset-[#141615]"
              : "ring-0"
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
    <section className="rounded-lg bg-[#0f1916] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <textarea
        className="min-h-36 w-full resize-y border-0 bg-transparent p-1 text-2xl leading-9 font-semibold text-pretty text-[#f7fbf6] outline-none placeholder:text-[#75877f]"
        placeholder="What matters now?"
        value={props.bodyText}
        onChange={(event) => props.onBodyTextChange(event.target.value)}
      />
      {attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#192723] px-2 text-sm font-semibold text-[#f7fbf6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
              key={attachment.id}
            >
              <span className="rounded-md bg-[#233832] px-2 py-1 text-xs font-semibold text-[#9ad4bb]">
                {attachmentLabel(attachment.kind)}
              </span>
              <span>{attachment.label}</span>
              {props.onRemoveAttachment ? (
                <button
                  aria-label={`Remove ${attachment.label}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#9fb2aa] transition-[scale,background-color,color] duration-150 ease-out hover:bg-white/10 hover:text-[#f7fbf6] active:scale-[0.96]"
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
          className="mt-3 min-h-24 w-full resize-y rounded-lg bg-[#14211e] p-3 text-xl leading-8 font-semibold text-[#f7fbf6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] outline-none placeholder:text-[#75877f]"
          placeholder="Keep writing..."
          value={continuationText}
          onChange={(event) => props.onContinuationTextChange?.(event.target.value)}
        />
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 shadow-[inset_0_1px_rgba(255,255,255,0.08)]">
        <div className="flex flex-wrap items-center gap-2">
          <NoteColorPicker color={props.color} onChange={props.onChange} />
          {props.onAttachImage ? (
            <button
              aria-label="Attach photo"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#192723] px-3 text-xs font-semibold text-[#f7fbf6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-[scale,background-color] duration-150 ease-out hover:bg-[#20302b] active:scale-[0.96]"
              type="button"
              onClick={props.onAttachImage}
            >
              <ImagePlus className="h-4 w-4 text-[#9ec8ee]" aria-hidden />
              Photo
            </button>
          ) : null}
          {props.onAttachDrawing ? (
            <button
              aria-label="Attach drawing"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#192723] px-3 text-xs font-semibold text-[#f7fbf6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-[scale,background-color] duration-150 ease-out hover:bg-[#20302b] active:scale-[0.96]"
              type="button"
              onClick={props.onAttachDrawing}
            >
              <PenLine className="h-4 w-4 text-[#9ad4bb]" aria-hidden />
              Drawing
            </button>
          ) : null}
          {props.onAttachVoice ? (
            <button
              aria-label="Attach voice"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#192723] px-3 text-xs font-semibold text-[#f7fbf6] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-[scale,background-color] duration-150 ease-out hover:bg-[#20302b] active:scale-[0.96]"
              type="button"
              onClick={props.onAttachVoice}
            >
              <Mic className="h-4 w-4 text-[#ff9a72]" aria-hidden />
              Voice
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {props.statusMessage ? (
            <p className="m-0 text-sm font-medium text-[#9fb2aa]">{props.statusMessage}</p>
          ) : null}
          <button
            className="min-h-10 rounded-lg bg-[#f15a24] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(241,90,36,0.24)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
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
    <section className={`${shellPanelClass} flex min-h-48 flex-col justify-between p-5`}>
      <div>
        <p className={eyebrowClass}>{props.signedInAs}</p>
        <h2 className="m-0 mt-2 text-lg font-semibold text-[#f4f5f1]">No notes yet</h2>
      </div>
    </section>
  );
}

export function ReviewActionSurface(props: ReviewActionSurfaceProps) {
  return (
    <article className={`${shellPanelClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#8d938f] uppercase">
            {props.kind} · {props.status}
          </p>
          <h3 className="m-0 mt-1 text-base font-semibold text-balance text-[#f4f5f1]">
            {props.title}
          </h3>
        </div>
        <span className="rounded-lg bg-[#12331f] px-2 py-1 text-xs font-semibold text-[#78e18c] tabular-nums">
          {props.confidencePercent}%
        </span>
      </div>
      <p className="m-0 mt-2 text-sm leading-6 text-pretty text-[#d7dbd6]">{props.body}</p>
      <p className="m-0 mt-3 rounded-lg bg-[#0f1110] px-3 py-2 text-xs font-medium text-[#a8aea9] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        {props.followThroughText}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="min-h-9 rounded-lg bg-[#14211e] px-2 text-xs font-semibold text-[#f7fbf6] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onAccept}
        >
          Accept
        </button>
        <button
          className="min-h-9 rounded-lg bg-[#1d201e] px-2 text-xs font-semibold text-[#e7e9e4] shadow-[0_0_0_1px_rgba(255,255,255,0.09)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onComplete}
        >
          Done
        </button>
        <button
          className="min-h-9 rounded-lg bg-[#1d201e] px-2 text-xs font-semibold text-[#e7e9e4] shadow-[0_0_0_1px_rgba(255,255,255,0.09)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
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
