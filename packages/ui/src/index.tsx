import type { CSSProperties, ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Placeholder } from "@tiptap/extensions/placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleUserRound,
  Database,
  Download,
  FileText,
  HardDrive,
  Inbox,
  ImagePlus,
  Mic,
  PenLine,
  Plus,
  SendHorizontal,
  Server,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  readonly addContextLabel?: string;
  readonly contextWindowLabel?: string;
  readonly continuationText?: string;
  readonly modelPickerLabel?: string;
  readonly modelValue?: string;
  readonly placeholder?: string;
  readonly sourceSearchLabel?: string;
  readonly statusMessage?: string;
  readonly submitLabel?: string;
  readonly voiceInputLabel?: string;
  readonly variant?: "chat" | "panel";
  readonly onAddContext?: () => void;
  readonly onAttachDrawing?: () => void;
  readonly onAttachImage?: () => void;
  readonly onAttachVoice?: () => void;
  readonly onBodyTextChange: (value: string) => void;
  readonly onContinuationTextChange?: (value: string) => void;
  readonly onOpenContextWindow?: () => void;
  readonly onOpenModelPicker?: () => void;
  readonly onRemoveAttachment?: (id: string) => void;
  readonly onSearchSources?: () => void;
  readonly onSubmit: () => void;
  readonly onVoiceInput?: () => void;
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

export type NoteWorkspaceSourceTone = "blue" | "green" | "ink" | "red";

export interface NoteWorkspaceSourceItem {
  readonly label: string;
  readonly meta: string;
  readonly id?: string;
  readonly tone?: NoteWorkspaceSourceTone;
}

export interface NoteWorkspaceFollowUpItem {
  readonly label: string;
  readonly meta: string;
  readonly id?: string;
  readonly urgent?: boolean;
  readonly urgentLabel?: string;
}

export interface NoteWorkspaceHeaderContent {
  readonly askLabel?: string;
  readonly refreshLabel?: string;
  readonly searchPlaceholder?: string;
  readonly searchShortcut?: string;
  readonly statusMessage?: string;
  readonly title?: string;
  readonly onAsk?: () => void;
  readonly onRefresh?: () => void;
}

export interface NoteWorkspaceAskPanelHeaderContent {
  readonly ariaLabel?: string;
  readonly closeLabel?: string;
  readonly expandLabel?: string;
  readonly showClose?: boolean;
  readonly showExpand?: boolean;
  readonly title?: string;
  readonly onClose?: () => void;
  readonly onExpand?: () => void;
}

export interface NoteWorkspaceAskPanelContent {
  readonly assistantInitial?: string;
  readonly assistantName?: string;
  readonly closeLabel?: string;
  readonly expandLabel?: string;
  readonly header?: NoteWorkspaceAskPanelHeaderContent;
  readonly messages?: ReadonlyArray<NoteWorkspaceChatMessage>;
  readonly prompt?: string;
  readonly responseBullets?: ReadonlyArray<string>;
  readonly responseIntro?: string;
  readonly sources?: ReadonlyArray<NoteWorkspaceSourceItem>;
  readonly sourcesTitle?: string;
  readonly title?: string;
  readonly userLabel?: string;
  readonly onClose?: () => void;
  readonly onExpand?: () => void;
}

export type NoteWorkspaceChatRole = "assistant" | "user";

export interface NoteWorkspaceChatCommandReceipt {
  readonly label: string;
  readonly status: string;
  readonly id?: string;
}

export interface NoteWorkspaceChatMessage {
  readonly body: string;
  readonly id?: string;
  readonly kind?: "error" | "thinking";
  readonly label?: string;
  readonly role: NoteWorkspaceChatRole;
  readonly bullets?: ReadonlyArray<string>;
  readonly commands?: ReadonlyArray<NoteWorkspaceChatCommandReceipt>;
}

export interface NoteWorkspaceNotesListContent {
  readonly emptyBody?: string;
  readonly emptyTitle?: string;
  readonly filterLabel?: string;
  readonly title?: string;
  readonly viewLabel?: string;
}

export interface NoteWorkspaceEditorTabContent {
  readonly active?: boolean;
  readonly id: string;
  readonly saveStatus?: string;
  readonly title: string;
  readonly titleEditable?: boolean;
  readonly onClose?: () => void;
  readonly onSelect?: () => void;
  readonly onTitleChange?: (value: string) => void;
  readonly onTitleDirty?: () => void;
}

export interface NoteWorkspaceEditorContent {
  readonly bodyText?: string;
  readonly editorLabel?: string;
  readonly editorPlaceholder?: string;
  readonly fallbackTitle?: string;
  readonly pageOpen?: boolean;
  readonly saveStatus?: string;
  readonly tabs?: ReadonlyArray<NoteWorkspaceEditorTabContent>;
  readonly title?: string;
  readonly titleEditable?: boolean;
  readonly onAddTab?: () => void;
  readonly onBodyTextChange?: (value: string) => void;
  readonly onBodyTextDirty?: () => void;
  readonly onClose?: () => void;
  readonly onTitleChange?: (value: string) => void;
  readonly onTitleDirty?: () => void;
}

export interface NoteWorkspaceReviewRailContent {
  readonly collapseLabel?: string;
  readonly followUps?: ReadonlyArray<NoteWorkspaceFollowUpItem>;
  readonly followUpTitle?: string;
  readonly sources?: ReadonlyArray<NoteWorkspaceSourceItem>;
  readonly sourcesTitle?: string;
  readonly summary?: string;
  readonly summaryTitle?: string;
  readonly title?: string;
  readonly onClose?: () => void;
}

export interface NoteFirstWorkspaceSurfaceProps {
  readonly askPanel?: NoteWorkspaceAskPanelContent;
  readonly askPanelOpen?: boolean;
  readonly composerSlot: ReactNode;
  readonly editor?: NoteWorkspaceEditorContent;
  readonly header?: NoteWorkspaceHeaderContent;
  readonly notes: ReadonlyArray<NoteWorkspaceItem>;
  readonly notesList?: NoteWorkspaceNotesListContent;
  readonly navigationSlot?: ReactNode;
  readonly reviewRail?: NoteWorkspaceReviewRailContent;
  readonly reviewRailOpen?: boolean;
  readonly reviewSlot?: ReactNode;
  readonly sidebarCollapsed?: boolean;
  readonly signedInAs: string;
  readonly statusMessage: string;
  readonly utilitySlot?: ReactNode;
  readonly onSidebarCollapsedChange?: (collapsed: boolean) => void;
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
  | "capture"
  | "inbox"
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
  readonly badge?: number | string;
  readonly onSelect?: () => void;
}

export type NudgeSidebarTodayTone = "blue" | "orange";

export interface NudgeSidebarTodayItem {
  readonly label: string;
  readonly id?: string;
  readonly active?: boolean;
  readonly tone?: NudgeSidebarTodayTone;
  readonly onSelect?: () => void;
}

export type NudgeSidebarNotificationTone = "blue" | "green" | "ink" | "orange";

export interface NudgeSidebarNotificationItem {
  readonly body: string;
  readonly title: string;
  readonly id?: string;
  readonly tone?: NudgeSidebarNotificationTone;
  readonly onSelect?: () => void;
}

export interface NudgeSidebarProfile {
  readonly avatarAlt?: string;
  readonly avatarSrc?: string;
  readonly name: string;
  readonly status: string;
  readonly initials?: string;
}

export interface NudgeSidebarProfileAction {
  readonly description?: string;
  readonly id?: string;
  readonly label: string;
  readonly onSelect?: () => void;
  readonly tone?: "neutral" | "danger";
}

export interface NudgeSidebarNavigationSurfaceProps {
  readonly signedInAs: string;
  readonly statusMessage: string;
  readonly appInitial?: string;
  readonly appName?: string;
  readonly footerSlot?: ReactNode;
  readonly items?: ReadonlyArray<NudgeSidebarNavigationItem>;
  readonly logoAlt?: string;
  readonly logoSrc?: string;
  readonly showAppName?: boolean;
  readonly notificationActive?: boolean;
  readonly notificationItems?: ReadonlyArray<NudgeSidebarNotificationItem>;
  readonly notificationLabel?: string;
  readonly notificationTrayOpen?: boolean;
  readonly notificationTrayTitle?: string;
  readonly profile?: NudgeSidebarProfile;
  readonly profileActions?: ReadonlyArray<NudgeSidebarProfileAction>;
  readonly profileMenuDescription?: string;
  readonly profileMenuLabel?: string;
  readonly profileMenuTitle?: string;
  readonly todayItems?: ReadonlyArray<NudgeSidebarTodayItem>;
  readonly todayLabel?: string;
  readonly onNotificationTrayToggle?: () => void;
}

export interface NudgeWorkspaceShellSurfaceProps {
  readonly children: ReactNode;
  readonly signedInAs: string;
  readonly statusMessage: string;
  readonly ariaLabel?: string;
  readonly contentClassName?: string;
  readonly defaultSidebarCollapsed?: boolean;
  readonly header?: NoteWorkspaceHeaderContent;
  readonly leadingSlot?: ReactNode;
  readonly navigationSlot?: ReactNode;
  readonly sidebarCollapsed?: boolean;
  readonly sidebarRailLabel?: string;
  readonly trailingSlot?: ReactNode;
  readonly utilitySlot?: ReactNode;
  readonly onSidebarCollapsedChange?: (collapsed: boolean) => void;
  readonly onSidebarRailClick?: () => void;
}

export const stickyColors: ReadonlyArray<StickyColor> = ["yellow", "green", "blue", "rose"];

const defaultSidebarNavigationItems: ReadonlyArray<NudgeSidebarNavigationItem> = [
  { group: "Workspace", key: "inbox", label: "Inbox" },
  { active: true, group: "Workspace", key: "overview", label: "Notes" },
  { group: "Workspace", key: "review", label: "Review" },
  { group: "Workspace", key: "capture", label: "Capture" },
] satisfies ReadonlyArray<NudgeSidebarNavigationItem>;
const noteFirstSidebarNavigationItems: ReadonlyArray<NudgeSidebarNavigationItem> = [
  { group: "Workspace", key: "inbox", label: "Inbox" },
  { active: true, group: "Workspace", key: "overview", label: "Notes" },
  { group: "Workspace", key: "review", label: "Review" },
  { group: "Workspace", key: "capture", label: "Capture" },
] satisfies ReadonlyArray<NudgeSidebarNavigationItem>;
const defaultWorkspaceAskResponseBullets: ReadonlyArray<string> = [];
const defaultWorkspaceAskSources: ReadonlyArray<NoteWorkspaceSourceItem> = [];
const defaultSidebarTodayItems: ReadonlyArray<NudgeSidebarTodayItem> = [];

type NudgeCssVariableProperties = CSSProperties & {
  readonly [key: `--${string}`]: string | number | undefined;
};

function workspaceShellStyle(sidebarCollapsed: boolean): NudgeCssVariableProperties {
  const sidebarWidth = sidebarCollapsed ? "0rem" : "16rem";
  return {
    "--sidebar-edge-width": "1rem",
    "--sidebar-panel-width": "16rem",
    "--sidebar-current-width": sidebarWidth,
    "--sidebar-rail-width": "1rem",
    "--sidebar-width": sidebarWidth,
    "--sidebar-width-icon": "0rem",
  };
}

interface ResolvedWorkspaceAskPanelHeaderContent {
  readonly ariaLabel: string;
  readonly closeLabel: string;
  readonly expandLabel: string;
  readonly showClose: boolean;
  readonly showExpand: boolean;
  readonly title: string;
  readonly onClose?: () => void;
  readonly onExpand?: () => void;
}

interface ResolvedWorkspaceAskPanelContent {
  readonly assistantInitial: string;
  readonly assistantName: string;
  readonly header: ResolvedWorkspaceAskPanelHeaderContent;
  readonly messages?: ReadonlyArray<NoteWorkspaceChatMessage>;
  readonly prompt: string;
  readonly responseBullets: ReadonlyArray<string>;
  readonly responseIntro: string;
  readonly sources: ReadonlyArray<NoteWorkspaceSourceItem>;
  readonly sourcesTitle: string;
  readonly userLabel: string;
}

const shellPanelClass =
  "rounded-lg bg-surface-inverse-panel shadow-[0_0_0_1px_var(--overlay-surface-8),0_16px_42px_var(--overlay-scrim-28)]";
const insetPanelClass =
  "rounded-lg bg-surface-inverse-inset shadow-[inset_0_0_0_1px_var(--overlay-surface-7)]";
const darkPanelClass =
  "rounded-lg bg-surface-inverse-raised text-content-inverse-bright shadow-[0_0_0_1px_var(--overlay-surface-8),0_18px_48px_var(--overlay-scrim-34)]";
const eyebrowClass =
  "m-0 text-[0.68rem] font-semibold tracking-[0.14em] text-content-inverse-muted uppercase";
const primaryButtonClass =
  "min-h-10 rounded-lg bg-accent-vivid px-4 text-sm font-semibold text-content-on-strong shadow-[0_1px_0_var(--overlay-surface-18)_inset,0_10px_24px_var(--overlay-accent-vivid-20)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50";
const secondaryButtonClass =
  "min-h-10 rounded-lg bg-surface-inverse-control px-3 text-sm font-semibold text-content-inverse shadow-[0_0_0_1px_var(--overlay-surface-9),0_8px_18px_var(--overlay-scrim-18)] transition-[scale,background-color,box-shadow] duration-150 ease-out hover:bg-surface-inverse-control-hover active:scale-[0.96] disabled:opacity-50";

export function DailyOperatingLoopSurface(props: DailyOperatingLoopSurfaceProps) {
  const sidebarSlot = props.navigationSlot ?? (
    <NudgeSidebarNavigationSurface
      signedInAs={props.signedInAs}
      statusMessage={props.statusMessage}
    />
  );
  return (
    <main className="bg-surface-inverse-canvas text-content-inverse min-h-dvh">
      <div className="mx-auto grid w-full max-w-[112rem] lg:grid-cols-[20.25rem_minmax(0,1fr)]">
        <aside className="bg-surface-inverse-sidebar hidden min-h-dvh flex-col shadow-[inset_-1px_0_var(--overlay-surface-8)] lg:flex">
          {sidebarSlot}
        </aside>

        <div className="min-w-0">
          <div className="bg-surface-inverse-sidebar flex items-center justify-between gap-3 px-4 py-3 shadow-[inset_0_-1px_var(--overlay-surface-8)] lg:hidden">
            <p className="text-content-inverse-strong m-0 text-sm font-semibold">Nudge</p>
            <p className="bg-surface-success-dark text-status-success m-0 rounded-full px-3 py-1 text-xs font-semibold">
              {props.statusMessage}
            </p>
          </div>

          <div className="grid gap-5 px-4 py-4 sm:px-6 lg:px-7">
            <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-content-inverse-muted h-5 w-5" aria-hidden />
                  <p className={eyebrowClass}>{props.signedInAs}</p>
                </div>
                <h1 className="text-content-inverse-strong m-0 mt-2 text-3xl leading-tight font-semibold tracking-normal text-balance sm:text-4xl">
                  Daily Operating Loop
                </h1>
                <p className="text-content-inverse-subtle m-0 mt-2 max-w-2xl text-sm leading-6 text-pretty">
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
                      <p className="text-content-inverse-muted m-0 text-[0.68rem] font-semibold tracking-[0.14em] uppercase">
                        Today
                      </p>
                      <h2
                        className="text-content-inverse-bright m-0 mt-1 text-xl font-semibold text-balance"
                        id="nudge-capture-heading"
                      >
                        Capture
                      </h2>
                    </div>
                    <div className="bg-accent-vivid h-2 w-12 rounded-full" aria-hidden="true" />
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
                    className="text-content-inverse-strong m-0 mt-1 text-lg font-semibold text-balance"
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

export function NudgeWorkspaceShellSurface(props: NudgeWorkspaceShellSurfaceProps) {
  const [uncontrolledSidebarCollapsed, setUncontrolledSidebarCollapsed] = useState(
    props.defaultSidebarCollapsed ?? false,
  );
  const [sidebarPeeked, setSidebarPeeked] = useState(false);
  const sidebarCollapsed = props.sidebarCollapsed ?? uncontrolledSidebarCollapsed;
  const sidebarRevealed = !sidebarCollapsed || sidebarPeeked;
  const sidebarSlot = props.navigationSlot ?? (
    <NudgeSidebarNavigationSurface
      items={noteFirstSidebarNavigationItems}
      signedInAs={props.signedInAs}
      statusMessage={props.statusMessage}
    />
  );
  const contentClassName =
    props.contentClassName ?? "h-full min-h-0 overflow-y-auto px-4 pb-4 lg:px-3";
  const hasSlottedLayout = props.leadingSlot !== undefined || props.trailingSlot !== undefined;
  const sidebarInsetClassName = [
    "m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-surface-page [border-width:var(--border-width-workbench)] border-[var(--line-soft)] shadow-[0_0_0_1px_var(--overlay-neutral-6),0_18px_54px_var(--overlay-neutral-13)]",
    sidebarCollapsed ? "" : "ml-0",
  ]
    .filter(Boolean)
    .join(" ");
  const updateSidebarCollapsed = (collapsed: boolean) => {
    if (!collapsed) setSidebarPeeked(false);
    if (props.sidebarCollapsed === undefined) {
      setUncontrolledSidebarCollapsed(collapsed);
    }
    props.onSidebarCollapsedChange?.(collapsed);
  };
  const toggleSidebarCollapsed = () => {
    props.onSidebarRailClick?.();
    updateSidebarCollapsed(!sidebarCollapsed);
  };
  const slideSidebar = (deltaX: number) => {
    if (deltaX < -28) {
      updateSidebarCollapsed(true);
      return;
    }
    if (deltaX > 28) {
      updateSidebarCollapsed(false);
    }
  };
  return (
    <main
      className="bg-surface-sidebar text-content-primary h-dvh overflow-hidden"
      aria-label={props.ariaLabel ?? "Nudge workspace shell"}
      style={workspaceShellStyle(sidebarCollapsed)}
    >
      <div
        className="group/sidebar-wrapper bg-surface-sidebar flex h-dvh w-full transition-[padding] duration-200 ease-out"
        data-slot="sidebar-wrapper"
        data-sidebar-provider="true"
      >
        {sidebarCollapsed ? (
          <button
            aria-label="Show sidebar"
            className="hover:bg-accent-primary/8 focus-visible:bg-accent-primary/10 focus-visible:ring-accent-ring/70 fixed inset-y-0 left-0 z-50 hidden w-[var(--sidebar-edge-width)] cursor-e-resize bg-transparent transition-[background-color] duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none lg:block"
            data-testid="sidebar-edge-reveal"
            type="button"
            onBlur={() => setSidebarPeeked(false)}
            onClick={() => updateSidebarCollapsed(false)}
            onFocus={() => setSidebarPeeked(true)}
            onPointerEnter={() => setSidebarPeeked(true)}
          />
        ) : null}
        <aside
          className={`group/sidebar bg-surface-sidebar text-content-sidebar hidden min-h-0 shrink-0 flex-col overflow-hidden transition-[opacity,translate,width] duration-200 ease-out lg:flex ${
            sidebarCollapsed
              ? `fixed inset-y-0 left-0 z-40 w-[var(--sidebar-panel-width)] shadow-[0_24px_64px_var(--overlay-neutral-18)] ${
                  sidebarRevealed
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none -translate-x-full opacity-0"
                }`
              : "relative w-[var(--sidebar-current-width)]"
          }`}
          data-collapsible={sidebarCollapsed ? "offcanvas" : ""}
          data-side="left"
          data-sidebar="sidebar"
          data-sidebar-collapsed={sidebarCollapsed}
          data-sidebar-peeked={sidebarPeeked}
          data-slot="sidebar"
          data-state={sidebarCollapsed ? "collapsed" : "expanded"}
          data-variant="inset"
          onPointerEnter={() => {
            if (sidebarCollapsed) setSidebarPeeked(true);
          }}
          onPointerLeave={() => {
            if (sidebarCollapsed) setSidebarPeeked(false);
          }}
        >
          {sidebarSlot}
          <NudgeSidebarRail
            label={props.sidebarRailLabel ?? "Toggle sidebar"}
            onSlide={slideSidebar}
            onToggle={toggleSidebarCollapsed}
          />
        </aside>

        <div
          className={sidebarInsetClassName}
          data-testid="sidebar-inset"
          data-sidebar-inset-state={sidebarCollapsed ? "collapsed" : "expanded"}
          data-slot="sidebar-inset"
        >
          <div className="bg-surface-sidebar-dark text-surface-warm flex items-center justify-between gap-3 px-4 py-3 shadow-[0_1px_0_var(--overlay-ink-8)] lg:hidden">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold">Nudge</p>
              <p className="text-content-sidebar-mobile-muted m-0 truncate text-xs font-medium">
                {props.signedInAs}
              </p>
            </div>
            {props.utilitySlot ? (
              <div className="flex items-center gap-2">{props.utilitySlot}</div>
            ) : null}
          </div>

          <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
            <WorkspaceTopHeader content={props.header} />
            <div className={contentClassName}>
              {hasSlottedLayout ? (
                <WorkspaceShellSlottedLayout
                  leadingSlot={props.leadingSlot}
                  trailingSlot={props.trailingSlot}
                >
                  {props.children}
                </WorkspaceShellSlottedLayout>
              ) : (
                props.children
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function NudgeSidebarRail(props: {
  readonly label: string;
  readonly onSlide: (deltaX: number) => void;
  readonly onToggle: () => void;
}) {
  const dragStartX = useRef<number | undefined>(undefined);
  const suppressNextClick = useRef(false);

  return (
    <button
      aria-label={props.label}
      className="hover:bg-accent-primary/8 hover:after:bg-accent-primary/70 focus-visible:bg-accent-primary/10 focus-visible:ring-accent-ring/70 absolute inset-y-0 -right-[calc(var(--sidebar-rail-width)/2)] z-20 hidden w-[var(--sidebar-rail-width)] cursor-col-resize items-stretch justify-center transition-[background-color] duration-150 ease-out after:block after:h-full after:w-[2px] after:bg-transparent after:transition-colors focus-visible:ring-2 focus-visible:outline-none lg:flex"
      data-testid="sidebar-rail"
      type="button"
      onClick={() => {
        if (suppressNextClick.current) {
          suppressNextClick.current = false;
          return;
        }
        props.onToggle();
      }}
      onPointerCancel={() => {
        dragStartX.current = undefined;
      }}
      onPointerDown={(event) => {
        dragStartX.current = event.clientX;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
      }}
      onPointerUp={(event) => {
        const startX = dragStartX.current;
        dragStartX.current = undefined;
        if (startX === undefined) return;

        const deltaX = event.clientX - startX;
        if (Math.abs(deltaX) < 28) return;

        suppressNextClick.current = true;
        props.onSlide(deltaX);
      }}
    />
  );
}

function WorkspaceShellSlottedLayout(props: {
  readonly children: ReactNode;
  readonly leadingSlot?: ReactNode;
  readonly trailingSlot?: ReactNode;
}) {
  const hasLeadingSlot = props.leadingSlot !== undefined;
  const hasTrailingSlot = props.trailingSlot !== undefined;
  return (
    <>
      <section
        className={`hidden h-full min-h-0 gap-2 px-3 pb-3 lg:grid ${workspaceShellSlotGridClass(
          hasLeadingSlot,
          hasTrailingSlot,
        )}`}
        data-testid="shell-layout"
        data-layout="slotted"
      >
        {hasLeadingSlot ? (
          <div className="min-h-0" data-testid="shell-leading-slot">
            {props.leadingSlot}
          </div>
        ) : null}
        <div className="min-h-0" data-testid="shell-main-slot">
          {props.children}
        </div>
        {hasTrailingSlot ? (
          <div className="min-h-0" data-testid="shell-trailing-slot">
            {props.trailingSlot}
          </div>
        ) : null}
      </section>

      <section
        className="grid h-full min-h-0 gap-3 overflow-y-auto px-4 pb-4 lg:hidden"
        data-testid="shell-layout"
        data-layout="slotted-mobile"
      >
        <div className="min-h-[28rem]" data-testid="shell-main-slot">
          {props.children}
        </div>
        {hasLeadingSlot ? <div data-testid="shell-leading-slot">{props.leadingSlot}</div> : null}
        {hasTrailingSlot ? <div data-testid="shell-trailing-slot">{props.trailingSlot}</div> : null}
      </section>
    </>
  );
}

function workspaceShellSlotGridClass(hasLeadingSlot: boolean, hasTrailingSlot: boolean) {
  if (hasLeadingSlot && hasTrailingSlot) {
    return "lg:grid-cols-[minmax(18rem,20rem)_minmax(32rem,1fr)_minmax(16rem,18rem)] 2xl:grid-cols-[20rem_minmax(42rem,1fr)_18rem]";
  }
  if (hasLeadingSlot) {
    return "lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] 2xl:grid-cols-[20rem_minmax(42rem,1fr)]";
  }
  return "lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)] 2xl:grid-cols-[minmax(42rem,1fr)_18rem]";
}

export function NoteFirstWorkspaceSurface(props: NoteFirstWorkspaceSurfaceProps) {
  const selectedNote = props.notes[0];
  const askPanelContent = resolveWorkspaceAskPanelContent(props.askPanel);
  return (
    <NudgeWorkspaceShellSurface
      contentClassName="h-full min-h-0 overflow-hidden px-0 pb-0"
      {...(props.sidebarCollapsed !== undefined
        ? { sidebarCollapsed: props.sidebarCollapsed }
        : {})}
      signedInAs={props.signedInAs}
      statusMessage={props.statusMessage}
      {...(props.header !== undefined ? { header: props.header } : {})}
      {...(props.navigationSlot !== undefined ? { navigationSlot: props.navigationSlot } : {})}
      {...(props.onSidebarCollapsedChange !== undefined
        ? { onSidebarCollapsedChange: props.onSidebarCollapsedChange }
        : {})}
      {...(props.utilitySlot !== undefined ? { utilitySlot: props.utilitySlot } : {})}
    >
      <WorkspaceAgentWorkbench
        askContent={askPanelContent}
        composerSlot={props.composerSlot}
        editorContent={props.editor}
        listContent={props.notesList}
        notes={props.notes}
        reviewContent={props.reviewRail}
        reviewSlot={props.reviewSlot}
        selectedNote={selectedNote}
        signedInAs={props.signedInAs}
      />
    </NudgeWorkspaceShellSurface>
  );
}

function WorkspaceAgentWorkbench(props: {
  readonly askContent: ResolvedWorkspaceAskPanelContent;
  readonly composerSlot: ReactNode;
  readonly editorContent: NoteWorkspaceEditorContent | undefined;
  readonly listContent: NoteWorkspaceNotesListContent | undefined;
  readonly notes: ReadonlyArray<NoteWorkspaceItem>;
  readonly reviewContent: NoteWorkspaceReviewRailContent | undefined;
  readonly reviewSlot?: ReactNode;
  readonly selectedNote: NoteWorkspaceItem | undefined;
  readonly signedInAs: string;
}) {
  const activeEditorTab = props.editorContent?.tabs?.find((tab) => tab.active);
  const noteTitle =
    activeEditorTab?.title ??
    props.editorContent?.title ??
    props.selectedNote?.title ??
    props.editorContent?.fallbackTitle ??
    "Today";
  const editorTabs = workspaceEditorTabs({
    editorContent: props.editorContent,
    fallbackTitle: noteTitle,
  });
  const notesTitle = props.listContent?.title ?? "Notes";
  const editorBodyText = props.editorContent?.bodyText ?? props.selectedNote?.bodyText ?? "";
  const editorLabel = props.editorContent?.editorLabel ?? `${noteTitle} editor`;
  const editorPlaceholder = props.editorContent?.editorPlaceholder ?? "Start today's note...";
  const chatMessages = workspaceAgentChatMessages(props.askContent);
  const pageOpen = props.editorContent?.pageOpen ?? true;
  const workbenchClass = pageOpen
    ? "bg-surface-page text-content-strong grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(24rem,42vh)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(23rem,30rem)] lg:grid-rows-none"
    : "bg-surface-page text-content-strong grid h-full min-h-0 min-w-0 overflow-hidden";
  const agentRailClass = pageOpen
    ? "bg-surface-page grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]"
    : "bg-surface-page grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] px-4 sm:px-6 lg:px-8";
  const agentRailScrollClass = pageOpen
    ? "bg-surface-page min-h-0 overflow-y-auto px-4 py-5 sm:px-5"
    : "bg-surface-page min-h-0 overflow-y-auto px-0 py-8 sm:py-10";
  const agentMessagesClass = pageOpen
    ? "flex min-h-full flex-col justify-end gap-3"
    : "mx-auto flex min-h-full w-full max-w-[48rem] flex-col justify-end gap-3";
  const dockedComposerClass = pageOpen ? "px-4 pb-4 sm:px-5 sm:pb-5" : "px-0 pb-6 sm:pb-8";
  const dockedComposerInnerClass = pageOpen ? "w-full" : "mx-auto w-full max-w-[48rem]";

  return (
    <section
      className={workbenchClass}
      data-testid="workbench-layout"
      data-layout={pageOpen ? "page-with-agent-rail" : "agent-only"}
      aria-label="Nudge notes workspace"
    >
      {pageOpen ? (
        <section
          className="bg-surface-base m-2 grid min-h-0 min-w-0 grid-rows-[3.25rem_minmax(0,1fr)] overflow-hidden rounded-xl border [border-width:var(--border-width-workbench)] border-[var(--line-soft)]"
          data-testid="workbench-page"
          aria-label={`${notesTitle} page`}
        >
          <header
            className="border-line-divider bg-surface-page text-content-strong flex min-h-[3.25rem] items-center border-b [border-bottom-width:var(--border-width-workbench)]"
            data-testid="page-header"
          >
            <div
              className="bg-surface-page flex min-w-0 flex-1 items-stretch gap-0 self-stretch overflow-x-auto"
              data-testid="page-titlebar"
            >
              <div
                className="flex min-w-max items-stretch"
                data-testid="page-tab-strip"
                role="tablist"
              >
                {editorTabs.map((tab) => (
                  <WorkspaceNotePageTab
                    key={tab.id}
                    tab={tab}
                    fallbackSaveStatus={props.editorContent?.saveStatus}
                    fallbackTitleEditable={props.editorContent?.titleEditable}
                    fallbackOnTitleChange={props.editorContent?.onTitleChange}
                    fallbackOnTitleDirty={props.editorContent?.onTitleDirty}
                    fallbackOnClose={props.editorContent?.onClose}
                    fallbackOnSelect={undefined}
                  />
                ))}
              </div>
              {editorTabs.length === 0 ? (
                <WorkspaceNotePageTab
                  tab={{
                    active: true,
                    id: "active-note",
                    title: noteTitle,
                  }}
                  fallbackSaveStatus={props.editorContent?.saveStatus}
                  fallbackTitleEditable={props.editorContent?.titleEditable}
                  fallbackOnTitleChange={props.editorContent?.onTitleChange}
                  fallbackOnTitleDirty={props.editorContent?.onTitleDirty}
                  fallbackOnClose={props.editorContent?.onClose}
                  fallbackOnSelect={undefined}
                />
              ) : null}
            </div>
            <button
              aria-label="Add page tab"
              className="border-line-divider bg-surface-base text-content-subtle hover:bg-surface-page hover:text-content-strong grid h-full min-h-[3.25rem] w-13 shrink-0 place-items-center border-b [border-bottom-width:var(--border-width-workbench)] border-l [border-left-width:var(--border-width-workbench)] transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.96]"
              data-testid="page-add-tab"
              type="button"
              onClick={props.editorContent?.onAddTab}
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="bg-surface-base min-h-0 overflow-y-auto p-2 sm:p-3 lg:p-4">
            <div className="mx-auto grid min-h-full w-full max-w-[76rem] content-start gap-4">
              <article
                className="bg-surface-base min-h-[calc(100dvh-13rem)] rounded-xl px-5 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
                data-testid="page-document"
              >
                <WorkspaceNoteEditor
                  bodyText={editorBodyText}
                  label={editorLabel}
                  placeholder={editorPlaceholder}
                  {...(props.editorContent?.onBodyTextDirty
                    ? { onBodyTextDirty: props.editorContent.onBodyTextDirty }
                    : {})}
                  {...(props.editorContent?.onBodyTextChange
                    ? { onBodyTextChange: props.editorContent.onBodyTextChange }
                    : {})}
                />
              </article>
            </div>
          </div>
        </section>
      ) : null}

      <aside
        className={agentRailClass}
        data-testid="agent-rail"
        aria-label={`${props.askContent.header.title} agent panel`}
      >
        <div className={agentRailScrollClass} data-testid="agent-rail-scroll">
          <div
            className={agentMessagesClass}
            data-testid="agent-chat-messages"
            aria-label={`${props.askContent.header.title} chat messages`}
          >
            {chatMessages.map((message, index) => (
              <WorkspaceAgentChatMessage
                key={`${message.role}:${message.body}:${index}`}
                message={message}
              />
            ))}
          </div>
        </div>

        <div className={dockedComposerClass} data-testid="docked-composer">
          <div className={dockedComposerInnerClass}>{props.composerSlot}</div>
        </div>
      </aside>
    </section>
  );
}

function workspaceEditorTabs(input: {
  readonly editorContent: NoteWorkspaceEditorContent | undefined;
  readonly fallbackTitle: string;
}): ReadonlyArray<NoteWorkspaceEditorTabContent> {
  const tabs = input.editorContent?.tabs ?? [];
  if (tabs.length > 0) return tabs;

  if (!input.editorContent) return [];

  return [
    {
      active: true,
      id: "active-note",
      title: input.fallbackTitle,
    },
  ];
}

function WorkspaceNotePageTab(props: {
  readonly tab: NoteWorkspaceEditorTabContent;
  readonly fallbackOnClose: (() => void) | undefined;
  readonly fallbackOnSelect: (() => void) | undefined;
  readonly fallbackOnTitleChange: ((value: string) => void) | undefined;
  readonly fallbackOnTitleDirty: (() => void) | undefined;
  readonly fallbackSaveStatus: string | undefined;
  readonly fallbackTitleEditable: boolean | undefined;
}) {
  const active = props.tab.active === true;
  const saveStatus = props.tab.saveStatus ?? (active ? props.fallbackSaveStatus : undefined);
  const titleEditable = props.tab.titleEditable ?? (active ? props.fallbackTitleEditable : false);
  const onClose = props.tab.onClose ?? (active ? props.fallbackOnClose : undefined);
  const onSelect = props.tab.onSelect ?? props.fallbackOnSelect;
  const onTitleChange =
    props.tab.onTitleChange ?? (active ? props.fallbackOnTitleChange : undefined);
  const onTitleDirty = props.tab.onTitleDirty ?? (active ? props.fallbackOnTitleDirty : undefined);
  const tabClass = active
    ? "bg-surface-base text-content-strong"
    : "bg-surface-page text-content-subtle hover:bg-surface-base/72 hover:text-content-strong";

  return (
    <div
      aria-label={`Open ${props.tab.title}`}
      aria-selected={active}
      className={`${tabClass} border-line-divider flex min-h-[3.25rem] max-w-72 min-w-44 items-center gap-2 border-r [border-right-width:var(--border-width-workbench)] px-4 transition-[background-color,color] duration-150 ease-out`}
      data-active={active ? "true" : "false"}
      data-testid="page-tab"
      role="tab"
    >
      <FileText className="h-4 w-4 shrink-0" aria-hidden />
      {active && titleEditable ? (
        <WorkspaceNoteTitleInput
          readOnly={onTitleChange === undefined}
          title={props.tab.title}
          {...(onTitleChange ? { onTitleChange } : {})}
          {...(onTitleDirty ? { onTitleDirty } : {})}
        />
      ) : (
        <button
          aria-label={`Open ${props.tab.title}`}
          className="m-0 min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-sm font-semibold text-inherit transition-[scale,color] duration-150 ease-out outline-none active:scale-[0.98]"
          type="button"
          onClick={onSelect}
        >
          {props.tab.title}
        </button>
      )}
      {saveStatus ? (
        <p className="text-content-subtle m-0 shrink-0 text-xs font-medium">{saveStatus}</p>
      ) : null}
      <button
        aria-label={`Close ${props.tab.title}`}
        className="text-content-subtle hover:bg-interaction-hover hover:text-content-strong grid size-8 shrink-0 place-items-center rounded-md transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.96]"
        type="button"
        onClick={onClose}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function WorkspaceNoteTitleInput(props: {
  readonly readOnly: boolean;
  readonly title: string;
  readonly onTitleChange?: (value: string) => void;
  readonly onTitleDirty?: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(props.title);
  const lastTitleProp = useRef(props.title);
  const titleDirtyReported = useRef(false);
  const draftTitleRef = useRef(props.title);
  const onTitleChangeRef = useRef(props.onTitleChange);
  const onTitleDirtyRef = useRef(props.onTitleDirty);

  useEffect(() => {
    onTitleChangeRef.current = props.onTitleChange;
  }, [props.onTitleChange]);

  useEffect(() => {
    onTitleDirtyRef.current = props.onTitleDirty;
  }, [props.onTitleDirty]);

  useEffect(() => {
    if (props.title === lastTitleProp.current) return;

    lastTitleProp.current = props.title;
    titleDirtyReported.current = false;
    draftTitleRef.current = props.title;
    setDraftTitle(props.title);
  }, [props.title]);

  const reportTitleDirty = (title: string) => {
    if (title === lastTitleProp.current) return;
    if (titleDirtyReported.current) return;

    titleDirtyReported.current = true;
    onTitleDirtyRef.current?.();
  };

  const commitTitleChange = () => {
    const title = draftTitleRef.current;
    if (title === lastTitleProp.current) {
      titleDirtyReported.current = false;
      return;
    }

    lastTitleProp.current = title;
    titleDirtyReported.current = false;
    onTitleChangeRef.current?.(title);
  };

  const resetTitleChange = () => {
    const title = lastTitleProp.current;
    titleDirtyReported.current = false;
    draftTitleRef.current = title;
    setDraftTitle(title);
  };

  return (
    <input
      aria-label="Note title"
      className="m-0 min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-sm font-semibold text-inherit outline-none"
      data-testid="page-title-input"
      readOnly={props.readOnly}
      value={draftTitle}
      onBlur={commitTitleChange}
      onChange={(event) => {
        const nextTitle = event.currentTarget.value;
        draftTitleRef.current = nextTitle;
        setDraftTitle(nextTitle);
        reportTitleDirty(nextTitle);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitTitleChange();
          event.currentTarget.blur();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          resetTitleChange();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

interface TipTapJsonNode {
  type: string;
  content?: TipTapJsonNode[];
  text?: string;
}

function WorkspaceNoteEditor(props: {
  readonly bodyText: string;
  readonly label: string;
  readonly placeholder: string;
  readonly onBodyTextChange?: (value: string) => void;
  readonly onBodyTextDirty?: () => void;
}) {
  const lastBodyText = useRef(props.bodyText);
  const lastCommittedBodyText = useRef(props.bodyText);
  const lastBodyTextProp = useRef(props.bodyText);
  const bodyTextDirtyReported = useRef(false);
  const onBodyTextChangeRef = useRef(props.onBodyTextChange);
  const onBodyTextDirtyRef = useRef(props.onBodyTextDirty);

  useEffect(() => {
    onBodyTextChangeRef.current = props.onBodyTextChange;
  }, [props.onBodyTextChange]);

  useEffect(() => {
    onBodyTextDirtyRef.current = props.onBodyTextDirty;
  }, [props.onBodyTextDirty]);

  const commitBodyTextChange = (bodyText: string) => {
    if (bodyText === lastCommittedBodyText.current) return;

    lastCommittedBodyText.current = bodyText;
    bodyTextDirtyReported.current = false;
    onBodyTextChangeRef.current?.(bodyText);
  };

  const reportBodyTextDirty = (bodyText: string) => {
    if (bodyText === lastCommittedBodyText.current) return;
    if (bodyTextDirtyReported.current) return;

    bodyTextDirtyReported.current = true;
    onBodyTextDirtyRef.current?.();
  };

  const editor = useEditor(
    {
      content: tiptapDocumentFromPlainText(props.bodyText),
      editorProps: {
        attributes: {
          "aria-label": props.label,
          "data-testid": "tiptap-prosemirror",
          class:
            "min-h-[calc(100dvh-21rem)] w-full outline-none text-base leading-7 text-content-workbench-body [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>blockquote]:border-l-2 [&>blockquote]:border-[var(--line-soft)] [&>blockquote]:pl-4 [&>h1]:mt-6 [&>h1]:mb-3 [&>h1]:text-3xl [&>h1]:font-semibold [&>h2]:mt-5 [&>h2]:mb-3 [&>h2]:text-2xl [&>h2]:font-semibold [&>ol]:my-4 [&>ol]:pl-6 [&>p]:my-3 [&>ul]:my-4 [&>ul]:pl-6 [&_.is-empty::before]:pointer-events-none [&_.is-empty::before]:float-left [&_.is-empty::before]:h-0 [&_.is-empty::before]:text-content-subtle [&_.is-empty::before]:content-[attr(data-placeholder)]",
        },
      },
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder: props.placeholder,
        }),
      ],
      immediatelyRender: false,
      onBlur: ({ editor: blurredEditor }) => {
        const nextBodyText = blurredEditor.getText({ blockSeparator: "\n\n" });
        lastBodyText.current = nextBodyText;
        commitBodyTextChange(nextBodyText);
      },
      onUpdate: ({ editor: updatedEditor }) => {
        const nextBodyText = updatedEditor.getText({ blockSeparator: "\n\n" });
        lastBodyText.current = nextBodyText;
        reportBodyTextDirty(nextBodyText);
      },
    },
    [props.label, props.placeholder],
  );

  useEffect(() => {
    if (editor === null) return;
    if (props.bodyText === lastBodyTextProp.current) return;

    lastBodyTextProp.current = props.bodyText;
    lastCommittedBodyText.current = props.bodyText;
    bodyTextDirtyReported.current = false;
    if (props.bodyText === lastBodyText.current) return;

    editor.commands.setContent(tiptapDocumentFromPlainText(props.bodyText));
    lastBodyText.current = props.bodyText;
  }, [editor, props.bodyText]);

  return (
    <section
      className="min-h-[calc(100dvh-17rem)]"
      data-testid="page-editor"
      aria-label={props.label}
    >
      <div
        className="min-h-[calc(100dvh-17rem)] [&_.ProseMirror-focused]:outline-none"
        data-testid="tiptap-editor"
      >
        <EditorContent editor={editor} />
        {editor === null ? (
          <WorkspaceNoteEditorStaticContent
            bodyText={props.bodyText}
            placeholder={props.placeholder}
          />
        ) : null}
      </div>
    </section>
  );
}

function WorkspaceNoteEditorStaticContent(props: {
  readonly bodyText: string;
  readonly placeholder: string;
}) {
  const paragraphs = noteEditorStaticParagraphs(props.bodyText);
  if (paragraphs.length === 0) {
    return <p className="text-content-subtle m-0 text-base leading-7">{props.placeholder}</p>;
  }

  return (
    <div className="text-content-workbench-body grid gap-4 text-base leading-7">
      {paragraphs.map((paragraph, index) => (
        <p
          className="m-0 whitespace-pre-wrap"
          key={`${paragraph}:${index}`}
          data-testid="tiptap-static-paragraph"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function noteEditorStaticParagraphs(bodyText: string): ReadonlyArray<string> {
  return bodyText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function tiptapDocumentFromPlainText(bodyText: string): TipTapJsonNode {
  const paragraphs = noteEditorStaticParagraphs(bodyText);
  return {
    content:
      paragraphs.length > 0
        ? paragraphs.map(tiptapParagraphFromPlainText)
        : [{ type: "paragraph" }],
    type: "doc",
  };
}

function tiptapParagraphFromPlainText(paragraph: string): TipTapJsonNode {
  const content: TipTapJsonNode[] = [];
  const lines = paragraph.split("\n");
  lines.forEach((line, index) => {
    if (line.length > 0) {
      content.push({
        text: line,
        type: "text",
      });
    }
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

  return {
    ...(content.length > 0 ? { content } : {}),
    type: "paragraph",
  };
}

interface WorkspaceAgentChatMessageContent {
  readonly body: string;
  readonly label: string;
  readonly role: NoteWorkspaceChatRole;
  readonly kind?: "error" | "thinking";
  readonly bullets?: ReadonlyArray<string>;
  readonly commands?: ReadonlyArray<NoteWorkspaceChatCommandReceipt>;
}

function workspaceAgentChatMessages(
  askContent: ResolvedWorkspaceAskPanelContent,
): ReadonlyArray<WorkspaceAgentChatMessageContent> {
  if (askContent.messages && askContent.messages.length > 0) {
    return askContent.messages.map((message) => ({
      body: message.body,
      ...(message.bullets ? { bullets: message.bullets } : {}),
      ...(message.commands ? { commands: message.commands } : {}),
      ...(message.kind ? { kind: message.kind } : {}),
      label:
        message.label ??
        (message.role === "assistant" ? askContent.assistantName : askContent.userLabel),
      role: message.role,
    }));
  }

  const messages: Array<WorkspaceAgentChatMessageContent> = [];
  const prompt = askContent.prompt.trim();
  if (prompt.length > 0) {
    messages.push({
      body: prompt,
      label: askContent.userLabel,
      role: "user",
    });
  }

  const reply = askContent.responseIntro.trim();
  const bullets = askContent.responseBullets
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0);
  if (reply.length > 0 || bullets.length > 0) {
    messages.push({
      body: reply,
      bullets,
      label: askContent.assistantName,
      role: "assistant",
    });
  }

  return messages;
}

function WorkspaceAgentChatMessage(props: { readonly message: WorkspaceAgentChatMessageContent }) {
  const isUser = props.message.role === "user";
  const isThinking = props.message.kind === "thinking";
  const isError = props.message.kind === "error";
  if (isThinking) {
    return (
      <article
        className="flex justify-start"
        data-testid="agent-chat-message"
        data-message-role={props.message.role}
        data-message-kind="thinking"
      >
        <WorkspaceAgentThinkingIndicator label={props.message.body} />
      </article>
    );
  }

  return (
    <article
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      data-testid="agent-chat-message"
      data-message-role={props.message.role}
      {...(isError ? { "data-message-kind": "error" } : {})}
    >
      <div
        className={`text-sm leading-6 ${
          isUser
            ? "bg-surface-page-muted text-content-card max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 shadow-[inset_0_0_0_1px_var(--overlay-slate-7)]"
            : `w-full px-0 py-1 ${isError ? "text-status-danger-content" : "text-content-workbench-body"}`
        }`}
      >
        {isUser ? (
          <p className="sr-only">{props.message.label}</p>
        ) : props.message.label ? (
          <p className="text-content-soft m-0 mb-1 text-[0.7rem] leading-4 font-medium">
            {props.message.label}
          </p>
        ) : null}
        {props.message.body.length > 0 ? (
          <p className="m-0 text-pretty whitespace-pre-wrap">{props.message.body}</p>
        ) : null}
        {props.message.bullets && props.message.bullets.length > 0 ? (
          <ul className="m-0 mt-2 grid gap-1.5 pl-4">
            {props.message.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        {props.message.commands && props.message.commands.length > 0 ? (
          <div className="mt-3 grid gap-1.5">
            {props.message.commands.map((command, index) => (
              <div
                className="bg-surface-page-muted text-content-card flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-semibold"
                data-testid="agent-command-receipt"
                key={command.id ?? `${command.label}:${index}`}
              >
                <span className="min-w-0 truncate">{command.label}</span>
                <span className="text-content-soft shrink-0">{command.status}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function WorkspaceAgentThinkingIndicator(props: { readonly label: string }) {
  const label = props.label.trim() || "Thinking...";
  return (
    <div
      className="text-content-soft flex h-6 items-center gap-2 text-xs"
      data-testid="agent-thinking-indicator"
      aria-live="polite"
    >
      <span className="relative flex h-3 w-5 items-center" aria-hidden>
        <span className="bg-content-soft absolute left-0 size-1.5 animate-pulse rounded-full opacity-35" />
        <span className="bg-content-soft absolute left-[0.4rem] size-1.5 animate-pulse rounded-full opacity-55 [animation-delay:120ms]" />
        <span className="bg-content-soft absolute left-[0.8rem] size-1.5 animate-pulse rounded-full opacity-75 [animation-delay:240ms]" />
      </span>
      <span className="animate-pulse bg-[linear-gradient(90deg,var(--content-soft),var(--content-primary),var(--content-soft))] bg-[length:200%_100%] bg-clip-text text-transparent">
        {label}
      </span>
    </div>
  );
}

function WorkspaceTopHeader(props: { readonly content: NoteWorkspaceHeaderContent | undefined }) {
  const title = props.content?.title ?? "Notes";
  return (
    <header className="bg-surface-base relative z-10 hidden min-h-12 items-center justify-between border-b [border-bottom-width:var(--border-width-workbench)] border-[var(--line-soft)] px-5 py-2 lg:flex">
      <div className="flex min-w-0 items-center gap-3">
        <p className="text-content-primary m-0 text-xl font-semibold tracking-[-0.01em]">{title}</p>
      </div>
    </header>
  );
}

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "N";
  const first = parts[0]?.slice(0, 1) ?? "";
  const second = parts.length > 1 ? (parts[1]?.slice(0, 1) ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

function resolveWorkspaceAskPanelContent(
  content: NoteWorkspaceAskPanelContent | undefined,
): ResolvedWorkspaceAskPanelContent {
  const headerTitle = content?.header?.title ?? content?.title ?? "Ask Nudge";
  const header: ResolvedWorkspaceAskPanelHeaderContent = {
    ariaLabel: content?.header?.ariaLabel ?? headerTitle,
    closeLabel: content?.header?.closeLabel ?? content?.closeLabel ?? `Close ${headerTitle}`,
    expandLabel: content?.header?.expandLabel ?? content?.expandLabel ?? `Expand ${headerTitle}`,
    showClose: content?.header?.showClose ?? true,
    showExpand: content?.header?.showExpand ?? true,
    title: headerTitle,
    ...((content?.header?.onClose ?? content?.onClose)
      ? { onClose: content?.header?.onClose ?? content?.onClose }
      : {}),
    ...((content?.header?.onExpand ?? content?.onExpand)
      ? { onExpand: content?.header?.onExpand ?? content?.onExpand }
      : {}),
  };
  return {
    assistantInitial: content?.assistantInitial ?? "N",
    assistantName: content?.assistantName ?? "Nudge",
    header,
    ...(content?.messages ? { messages: content.messages } : {}),
    prompt: content?.prompt ?? "",
    responseBullets: content?.responseBullets ?? defaultWorkspaceAskResponseBullets,
    responseIntro: content?.responseIntro ?? "",
    sources: content?.sources ?? defaultWorkspaceAskSources,
    sourcesTitle: content?.sourcesTitle ?? "Sources",
    userLabel: content?.userLabel ?? "You",
  };
}

export function NudgeSidebarNavigationSurface(props: NudgeSidebarNavigationSurfaceProps) {
  const items = props.items ?? defaultSidebarNavigationItems;
  const appName = props.appName ?? "Nudge";
  const appInitial = props.appInitial ?? initialFromLabel(appName);
  const showAppName = props.showAppName ?? true;
  const notificationActive = props.notificationActive ?? false;
  const notificationLabel = props.notificationLabel ?? "Notifications";
  const notificationItems = props.notificationItems ?? [];
  const notificationTrayOpen = props.notificationTrayOpen ?? false;
  const todayLabel = props.todayLabel ?? "Today";
  const todayItems = props.todayItems ?? defaultSidebarTodayItems;
  const profileName = props.profile?.name ?? props.signedInAs;
  const profileStatus = props.profile?.status ?? props.statusMessage;
  const profileInitials = props.profile?.initials ?? initialsFromName(profileName);
  const profileActions = props.profileActions ?? [];
  return (
    <div className="bg-surface-sidebar text-content-sidebar flex h-full min-h-0 flex-col px-2 py-4">
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 px-2">
        <div className={`flex min-w-0 items-center ${showAppName ? "gap-3" : "gap-0"}`}>
          {props.logoSrc ? (
            <img
              className={
                showAppName
                  ? "size-8 shrink-0 object-contain"
                  : "h-8 w-auto max-w-[8.75rem] shrink-0 object-contain"
              }
              src={props.logoSrc}
              alt={props.logoAlt ?? appName}
            />
          ) : (
            <div className="bg-accent-primary text-content-on-strong grid size-7 place-items-center rounded-lg text-sm font-black shadow-[0_10px_22px_var(--overlay-accent-28)]">
              {appInitial}
            </div>
          )}
          {showAppName ? (
            <p className="m-0 truncate text-lg font-semibold tracking-[-0.02em]">{appName}</p>
          ) : null}
        </div>
        <button
          aria-expanded={notificationTrayOpen}
          aria-label={notificationLabel}
          className="text-content-sidebar-icon hover:bg-surface-inset hover:text-content-strong relative grid size-9 place-items-center rounded-lg transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.96]"
          type="button"
          onClick={props.onNotificationTrayToggle}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {notificationActive ? (
            <span className="bg-accent-primary absolute top-1.5 right-1.5 size-2.5 rounded-full" />
          ) : null}
        </button>
      </div>
      {notificationTrayOpen ? (
        <SidebarNotificationTray
          items={notificationItems}
          title={props.notificationTrayTitle ?? "Notifications"}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col pt-6">
        <div className="px-2">
          <p className="text-content-caption m-0 text-sm font-medium">{todayLabel}</p>
          {todayItems.length > 0 ? (
            <div
              className="bg-surface-inset mt-3 grid gap-2 rounded-lg px-3 py-3 shadow-[inset_0_0_0_1px_var(--overlay-slate-8)]"
              data-testid="sidebar-today-items"
            >
              {todayItems.map((item, index) => (
                <SidebarTodayItem item={item} key={item.id ?? `${item.label}:${index}`} />
              ))}
            </div>
          ) : null}
        </div>

        <nav className="mt-9 grid gap-1 px-2" aria-label="Nudge navigation">
          {items.map((item) => (
            <SidebarNavItem
              active={item.active === true}
              icon={sidebarNavigationIcon(item.key)}
              key={item.key}
              onSelect={item.onSelect}
              {...(item.badge !== undefined ? { badge: item.badge } : {})}
            >
              {item.label}
            </SidebarNavItem>
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <div className="bg-line-sidebar h-px w-full" data-testid="sidebar-footer-divider" />
          <div className="px-2">
            <SidebarProfileSettingsPopover
              actions={profileActions}
              avatarAlt={props.profile?.avatarAlt ?? `${profileName} profile photo`}
              avatarSrc={props.profile?.avatarSrc}
              footerSlot={props.footerSlot}
              initials={profileInitials}
              label={props.profileMenuLabel ?? "Open user settings"}
              menuDescription={props.profileMenuDescription ?? profileStatus}
              menuTitle={props.profileMenuTitle ?? "User settings"}
              name={profileName}
              status={profileStatus}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarNotificationTray(props: {
  readonly items: ReadonlyArray<NudgeSidebarNotificationItem>;
  readonly title: string;
}) {
  return (
    <section
      className="bg-surface-inset mx-2 mt-3 grid gap-2 rounded-lg p-3 shadow-[inset_0_0_0_1px_var(--overlay-slate-8)]"
      data-testid="notification-tray"
      aria-label={props.title}
    >
      <p className="text-content-caption m-0 text-xs font-semibold tracking-[0.12em] uppercase">
        {props.title}
      </p>
      {props.items.length > 0 ? (
        <div className="grid gap-1.5">
          {props.items.map((item, index) => (
            <SidebarNotificationItem item={item} key={item.id ?? `${item.title}:${index}`} />
          ))}
        </div>
      ) : (
        <p className="text-content-secondary m-0 text-sm font-medium">No notifications.</p>
      )}
    </section>
  );
}

function SidebarNotificationItem(props: { readonly item: NudgeSidebarNotificationItem }) {
  const content = (
    <>
      <span className={sidebarNotificationDotClass(props.item.tone ?? "ink")} aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{props.item.title}</span>
        <span className="text-content-secondary mt-0.5 block text-xs leading-5">
          {props.item.body}
        </span>
      </span>
    </>
  );
  const className =
    "grid min-h-12 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg px-2 py-2 text-left transition-[scale,background-color] duration-150 ease-out active:scale-[0.98]";

  if (props.item.onSelect) {
    return (
      <button
        className={`${className} hover:bg-surface-base/46`}
        type="button"
        onClick={props.item.onSelect}
      >
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

function SidebarTodayItem(props: { readonly item: NudgeSidebarTodayItem }) {
  const content = (
    <>
      <span className={sidebarTodayDotClass(props.item.tone ?? "blue")} aria-hidden />
      {props.item.label}
    </>
  );
  const className =
    "flex min-h-7 items-center gap-3 rounded-md text-left text-sm font-medium transition-[scale,background-color] duration-150 ease-out active:scale-[0.98]";

  if (props.item.onSelect || props.item.active) {
    return (
      <button
        aria-pressed={props.item.active === true}
        className={`${className} ${props.item.onSelect ? "hover:bg-surface-base/46" : ""}`}
        type="button"
        onClick={props.item.onSelect}
      >
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}

function SidebarProfileSettingsPopover(props: {
  readonly actions: ReadonlyArray<NudgeSidebarProfileAction>;
  readonly avatarAlt: string;
  readonly avatarSrc: string | undefined;
  readonly footerSlot: ReactNode | undefined;
  readonly initials: string;
  readonly label: string;
  readonly menuDescription: string;
  readonly menuTitle: string;
  readonly name: string;
  readonly status: string;
}) {
  const row = (
    <>
      <SidebarProfileAvatar
        alt={props.avatarAlt}
        footerSlot={props.footerSlot}
        initials={props.initials}
        src={props.avatarSrc}
        useFooterSlot={props.actions.length === 0}
      />
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-semibold">{props.name}</span>
      </span>
      <ChevronDown className="text-content-icon-muted ml-auto h-4 w-4 shrink-0" aria-hidden />
    </>
  );

  const rowClassName =
    "mt-4 flex min-h-12 w-full items-center gap-3 rounded-lg text-left transition-[scale,background-color] duration-150 ease-out active:scale-[0.98]";

  if (props.actions.length === 0) {
    return <div className={rowClassName}>{row}</div>;
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        className={`${rowClassName} hover:bg-surface-base/62 focus-visible:ring-accent-ring/70 px-1 focus-visible:ring-2 focus-visible:outline-none`}
        data-testid="user-settings-trigger"
        type="button"
        aria-label={props.label}
      >
        {row}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="right" align="end" sideOffset={12}>
          <Popover.Popup
            className="bg-surface-base/88 text-content-primary z-50 grid w-72 gap-3 rounded-xl p-3 shadow-[0_28px_80px_var(--overlay-sidebar-26),0_0_0_1px_var(--overlay-ink-8),inset_0_1px_var(--overlay-surface-76)] backdrop-blur-2xl"
            data-testid="user-settings-popover"
          >
            <Popover.Arrow className="fill-surface-base/88" />
            <div className="grid gap-1 px-1 pt-1">
              <Popover.Title className="text-content-primary m-0 text-sm font-semibold">
                {props.menuTitle}
              </Popover.Title>
              <Popover.Description className="text-content-muted m-0 text-xs leading-5">
                {props.menuDescription}
              </Popover.Description>
            </div>
            <div className="grid gap-1">
              {props.actions.map((action, index) => (
                <Popover.Close
                  className={sidebarProfileActionClass(action.tone ?? "neutral")}
                  key={action.id ?? `${action.label}:${index}`}
                  type="button"
                  onClick={action.onSelect}
                >
                  <span className="block text-sm font-semibold">{action.label}</span>
                  {action.description ? (
                    <span className="text-content-muted mt-0.5 block text-xs leading-5">
                      {action.description}
                    </span>
                  ) : null}
                </Popover.Close>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SidebarProfileAvatar(props: {
  readonly alt: string;
  readonly footerSlot: ReactNode | undefined;
  readonly initials: string;
  readonly src: string | undefined;
  readonly useFooterSlot: boolean;
}) {
  if (props.src) {
    return (
      <img
        className="bg-surface-avatar size-10 shrink-0 rounded-full object-cover shadow-[0_0_0_1px_var(--overlay-slate-12)]"
        src={props.src}
        alt={props.alt}
      />
    );
  }

  if (props.useFooterSlot && props.footerSlot) {
    return (
      <span className="bg-surface-avatar text-content-primary grid size-10 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-semibold [&_.cl-avatarBox]:!size-10 [&_.cl-avatarImage]:!size-10 [&_.cl-rootBox]:!contents [&_.cl-userButtonTrigger]:!size-10">
        {props.footerSlot}
      </span>
    );
  }

  return (
    <span className="bg-surface-avatar text-content-primary grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold">
      {props.initials}
    </span>
  );
}

function sidebarProfileActionClass(tone: NonNullable<NudgeSidebarProfileAction["tone"]>) {
  const base =
    "rounded-lg px-3 py-2.5 text-left transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/35";
  if (tone === "danger") {
    return `${base} text-accent-content-strong hover:bg-surface-accent-soft`;
  }
  return `${base} text-content-primary hover:bg-surface-accent-hover`;
}

function initialFromLabel(label: string) {
  return label.trim().slice(0, 1).toUpperCase() || "N";
}

function sidebarTodayDotClass(tone: NudgeSidebarTodayTone) {
  switch (tone) {
    case "blue":
      return "size-3 rounded-full bg-status-update-dot";
    case "orange":
      return "size-3 rounded-full border-2 border-accent-primary";
  }
}

function sidebarNotificationDotClass(tone: NudgeSidebarNotificationTone) {
  switch (tone) {
    case "blue":
      return "mt-1 size-2.5 rounded-full bg-status-update-dot";
    case "green":
      return "mt-1 size-2.5 rounded-full bg-status-ready-dot";
    case "orange":
      return "mt-1 size-2.5 rounded-full bg-accent-primary";
    case "ink":
      return "mt-1 size-2.5 rounded-full bg-content-secondary";
  }
}

function SidebarNavItem(props: {
  readonly active: boolean;
  readonly badge?: number | string;
  readonly children: ReactNode;
  readonly icon: ReactNode;
  readonly onSelect?: (() => void) | undefined;
}) {
  const className = `relative flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-[15px] font-medium transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.98] ${
    props.active
      ? "bg-surface-inset text-content-strong shadow-[inset_3px_0_0_var(--accent-primary),inset_0_0_0_1px_var(--overlay-slate-7)]"
      : "text-content-secondary hover:bg-surface-inset/70 hover:text-content-strong"
  }`;
  const content = (
    <>
      <span
        className={`grid size-5 place-items-center ${props.active ? "text-accent-primary" : ""}`}
      >
        {props.icon}
      </span>
      <span className="min-w-0 truncate">{props.children}</span>
      {props.badge !== undefined ? (
        <span className="text-content-secondary ml-auto text-sm font-semibold tabular-nums">
          {props.badge}
        </span>
      ) : null}
    </>
  );
  if (props.onSelect) {
    return (
      <button
        aria-current={props.active ? "page" : undefined}
        className={className}
        data-testid="sidebar-nav-item"
        type="button"
        onClick={props.onSelect}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      aria-current={props.active ? "page" : undefined}
      className={className}
      data-testid="sidebar-nav-item"
    >
      {content}
    </div>
  );
}

function sidebarNavigationIcon(key: NudgeSidebarNavigationKey) {
  switch (key) {
    case "capture":
      return <CameraIcon />;
    case "inbox":
      return <Inbox className="h-5 w-5" aria-hidden />;
    case "overview":
      return <FileText className="h-5 w-5" aria-hidden />;
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

function CameraIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
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
              <h2 className="text-content-inverse-strong m-0 mt-1 text-lg font-semibold text-balance">
                {snapshot.dayCountText}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActivityPill label="Active" value={snapshot.activeDaysText} tone="green" />
              <ActivityPill label="Notes" value={snapshot.totalNotesText} tone="blue" />
              <ActivityPill label="Signals" value={snapshot.totalSignalsText} tone="rose" />
            </div>
          </div>

          <div className="bg-surface-inverse-canvas rounded-lg p-3 shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-content-inverse-strong m-0 text-sm font-semibold">
                Daily activity
              </p>
              <p className="text-content-inverse-muted m-0 text-xs font-semibold">
                Notes + signals
              </p>
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
                      <stop offset="0%" stopColor="var(--chart-blue)" stopOpacity={0.36} />
                      <stop offset="100%" stopColor="var(--chart-blue)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="nudgeSignalsGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-vivid)" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="var(--accent-vivid)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--overlay-surface-8)" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    tickLine={false}
                    tick={{ fill: "var(--content-inverse-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--content-inverse-muted)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-inverse-panel)",
                      border: "1px solid var(--overlay-surface-10)",
                      borderRadius: "8px",
                      color: "var(--content-inverse-strong)",
                    }}
                    cursor={{ stroke: "var(--overlay-surface-12)" }}
                    labelStyle={{ color: "var(--content-inverse-strong)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="notes"
                    stroke="var(--chart-blue)"
                    fill="url(#nudgeNotesGradient)"
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="signals"
                    stroke="var(--accent-vivid)"
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
            <p className="text-content-inverse-strong m-0 text-sm font-semibold">Selected day</p>
            <p className="text-chart-blue m-0 text-xs font-semibold">{props.currentDate}</p>
          </div>
          <div className="bg-surface-inverse-canvas mt-3 rounded-lg p-3 shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
            <p className="text-content-inverse-strong m-0 text-sm font-semibold">Activity mix</p>
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
                    tick={{ fill: "var(--line-neutral)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-inverse-panel)",
                      border: "1px solid var(--overlay-surface-10)",
                      borderRadius: "8px",
                      color: "var(--content-inverse-strong)",
                    }}
                    cursor={{ fill: "var(--overlay-surface-4)" }}
                    labelStyle={{ color: "var(--content-inverse-strong)" }}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--status-success)"
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
          <h2 className="text-content-inverse-strong m-0 mt-1 truncate text-lg font-semibold">
            {props.title || props.localDate}
          </h2>
        </div>
        <p className="bg-surface-inverse-inset text-content-inverse-subtle m-0 rounded-lg px-2 py-1 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--overlay-surface-7)]">
          Updated {formatJournalTime(props.updatedAt)}
        </p>
      </div>
      <p className="text-content-inverse-muted m-0 mt-1 text-sm font-medium">{props.localDate}</p>
      <div className="text-line-neutral-soft mt-4 text-base leading-7 text-pretty whitespace-pre-wrap">
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
          <h2 className="text-content-inverse-strong m-0 mt-1 text-lg font-semibold text-balance">
            Recent signals
          </h2>
        </div>
        <p className="bg-surface-warm-depth text-accent-soft m-0 rounded-lg px-2 py-1 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--overlay-accent-vivid-20)]">
          {signalCountText(props.signals.length)}
        </p>
      </div>

      {props.signals.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {props.signals.map((signal) => (
            <article
              className="bg-surface-inverse-canvas grid gap-2 rounded-lg px-3 py-3 shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]"
              key={signal.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-status-danger-content m-0 text-xs font-semibold tracking-[0.12em] uppercase">
                  {signal.source}
                </p>
                <p className="text-content-inverse-muted m-0 text-xs font-semibold">
                  {formatSignalTime(signal.occurredAt)}
                </p>
              </div>
              <p className="text-line-neutral-soft m-0 text-sm leading-6 text-pretty">
                {signal.noteText}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-content-inverse-muted m-0 mt-4 text-sm font-medium">
          No recent signals yet.
        </p>
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
          <h3 className="text-content-inverse-strong m-0 mt-1 text-xl font-semibold text-balance">
            {props.title}
          </h3>
        </div>
        <div className="bg-surface-success-dark text-status-success flex h-10 w-10 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_var(--overlay-success-18)]">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div className="bg-surface-inverse-canvas mt-4 grid grid-cols-3 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
        <CaptureResultMetric label="Signals" value={String(props.signalCount)} tone="rose" />
        <CaptureResultMetric label="Open actions" value={String(props.actionCount)} tone="green" />
        <CaptureResultMetric label="References" value={String(props.sourceCount)} tone="blue" />
      </div>

      <div className="mt-4 grid gap-2">
        {props.items.map((item) => (
          <div
            className="bg-surface-inverse-canvas grid min-h-16 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg px-3 py-3 shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]"
            key={`${item.title}:${item.value}`}
          >
            <div className="min-w-0">
              <p className="text-content-inverse-strong m-0 text-sm font-semibold">{item.title}</p>
              <p className="text-content-inverse-muted m-0 mt-1 text-xs leading-5">
                {item.subtitle}
              </p>
            </div>
            <p
              className={`${captureResultToneClass(item.tone)} m-0 self-start rounded-lg px-2 py-1 text-xs font-semibold`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-content-inverse-subtle m-0 mt-4 text-sm leading-6 text-pretty">
        {props.summary}
      </p>

      {props.references.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.references.map((reference) => (
            <span
              className="bg-surface-inverse-inset text-content-inverse-subtle rounded-lg px-2 py-1 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--overlay-surface-7)]"
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
    <div className="min-h-16 px-3 py-3 shadow-[inset_-1px_0_var(--overlay-surface-8)] last:shadow-none">
      <p className="text-content-inverse-strong m-0 text-lg font-semibold tabular-nums">
        {props.value}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="text-content-inverse-muted m-0 text-[0.68rem] font-semibold tracking-[0.1em] uppercase">
          {props.label}
        </p>
      </div>
    </div>
  );
}

export function SettingsSurface(props: SettingsSurfaceProps) {
  return (
    <main className="bg-surface-inverse-canvas text-content-inverse min-h-dvh">
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
          <p className="text-content-inverse-strong m-0 text-sm font-semibold">Settings</p>
          {props.accountSlot ? <div className="min-h-10">{props.accountSlot}</div> : null}
        </header>

        <section className={`${shellPanelClass} p-5`}>
          <div className="bg-surface-info-muted text-chart-blue flex h-11 w-11 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_var(--overlay-chart-blue-16)]">
            <CircleUserRound className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-content-inverse-strong m-0 mt-4 text-3xl font-semibold tracking-normal text-balance">
            {props.accountName}
          </h1>
          <p className="text-content-inverse-muted m-0 mt-2 text-sm font-semibold">
            {props.workspaceLabel} · {props.surfaceLabel}
          </p>
        </section>

        <SettingsSectionSurface title="Account">
          <SettingsRowSurface
            icon={<CircleUserRound className="text-status-info h-4 w-4" aria-hidden />}
            label="Name"
            value={props.accountName}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<HardDrive className="text-status-downloaded h-4 w-4" aria-hidden />}
            label="Workspace"
            value={props.workspaceLabel}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<Database className="text-accent-vivid h-4 w-4" aria-hidden />}
            label="Session"
            value={props.sessionLabel}
          />
        </SettingsSectionSurface>

        {props.desktopSlot ? props.desktopSlot : null}

        <SettingsSectionSurface title="Sync">
          <SettingsRowSurface
            icon={<Server className="text-status-info h-4 w-4" aria-hidden />}
            label="Surface"
            value={props.surfaceLabel}
          />
          <SettingsDividerSurface />
          <SettingsRowSurface
            icon={<HardDrive className="text-status-downloaded h-4 w-4" aria-hidden />}
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
              <Trash2 className="text-accent-vivid h-4 w-4" aria-hidden />
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
      <span className="bg-surface-inverse-canvas flex h-9 w-9 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
        {props.icon}
      </span>
      <p className="text-content-inverse-strong m-0 text-sm font-semibold">{props.label}</p>
      <p className="text-content-inverse-subtle m-0 min-w-0 text-right text-sm font-semibold break-words">
        {props.value}
      </p>
    </div>
  );
}

function SettingsDividerSurface() {
  return <div className="bg-surface-base/8 ml-[4.75rem] h-px" />;
}

function ActivityPill(props: {
  readonly label: string;
  readonly tone: "blue" | "green" | "rose";
  readonly value: string;
}) {
  return (
    <div className="bg-surface-inverse-canvas min-h-10 rounded-lg px-3 py-2 shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
      <div className="flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="text-content-inverse-muted m-0 text-[0.68rem] font-semibold tracking-[0.12em] uppercase">
          {props.label}
        </p>
      </div>
      <p className="text-content-inverse-strong m-0 mt-1 text-sm font-semibold">{props.value}</p>
    </div>
  );
}

function CalendarDayCell(props: { readonly day: CalendarActivityDay; readonly selected: boolean }) {
  return (
    <div
      className={`min-h-20 rounded-lg px-2 py-2 ${
        props.selected
          ? "bg-surface-info-muted shadow-[inset_0_0_0_1px_var(--overlay-chart-blue-22)]"
          : "bg-surface-inverse-canvas shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]"
      }`}
    >
      <p className="text-content-inverse-subtle m-0 text-xs font-semibold">
        {shortCalendarDay(props.day.localDate)}
      </p>
      <div className="mt-3 flex items-end gap-1">
        <ActivityBar count={props.day.noteCount} tone="blue" />
        <ActivityBar count={props.day.signalCount} tone="rose" />
      </div>
      <p className="text-content-inverse-muted m-0 mt-2 text-[0.68rem] font-semibold">
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
    <div className="bg-surface-inverse-canvas min-h-16 rounded-lg p-2 text-center shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
      <p className="text-content-inverse-strong m-0 text-sm font-semibold">{props.value}</p>
      <p className="text-content-inverse-muted m-0 mt-1 text-[0.68rem] font-semibold tracking-[0.1em] uppercase">
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
    <div className="bg-surface-inverse-panel min-h-14 rounded-lg px-3 py-2 shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
      <div className="flex items-center gap-2">
        <span className={`${metricToneClass(props.tone)} h-2 w-2 rounded-sm`} aria-hidden="true" />
        <p className="text-content-inverse-muted m-0 text-[0.68rem] font-semibold tracking-[0.12em] uppercase">
          {props.label}
        </p>
      </div>
      <p className="text-content-inverse-strong m-0 mt-1 truncate text-sm font-semibold tabular-nums">
        {props.value}
      </p>
    </div>
  );
}

function metricToneClass(tone: "blue" | "green" | "rose") {
  switch (tone) {
    case "blue":
      return "bg-status-info";
    case "green":
      return "bg-status-downloaded";
    case "rose":
      return "bg-accent-vivid";
  }
}

function captureResultToneClass(tone: "blue" | "green" | "orange" | "purple") {
  switch (tone) {
    case "blue":
      return "bg-surface-info-muted text-chart-blue-bright";
    case "green":
      return "bg-surface-success-dark text-status-success-bright";
    case "orange":
      return "bg-surface-warm-depth text-accent-soft";
    case "purple":
      return "bg-surface-purple-depth text-chart-purple-bright";
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
          className={`${colorSwatchClass(color)} h-6 w-6 rounded-full shadow-[inset_0_0_0_1px_var(--overlay-ink-16)] transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.96] ${
            props.color === color
              ? "ring-accent-primary ring-2 ring-offset-2 ring-offset-[var(--surface-warm)]"
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
  const variant = props.variant ?? "panel";
  const isChatVariant = variant === "chat";
  const placeholder =
    props.placeholder ?? (isChatVariant ? "Ask for follow-up changes" : "What matters now?");
  const addContextLabel = props.addContextLabel ?? "Add context";
  const contextWindowLabel =
    props.contextWindowLabel ?? props.sourceSearchLabel ?? "Context window";
  const modelPickerLabel = props.modelPickerLabel ?? "Select AI model";
  const modelValue = props.modelValue ?? "5.5";
  const submitLabel = props.submitLabel ?? (isChatVariant ? "Send message" : "Capture");
  const voiceInputLabel = props.voiceInputLabel ?? "Voice input";
  const showsContinuationDraft =
    props.onContinuationTextChange !== undefined &&
    (attachments.length > 0 || continuationText.trim().length > 0);
  const hasContent =
    props.bodyText.trim().length > 0 ||
    continuationText.trim().length > 0 ||
    attachments.length > 0;
  const openContextWindow = props.onOpenContextWindow ?? props.onSearchSources;
  const openModelPicker = props.onOpenModelPicker;
  const openVoiceInput = props.onVoiceInput ?? props.onAttachVoice;
  const attachmentClass = isChatVariant
    ? "inline-flex min-h-8 items-center gap-2 rounded-full bg-surface-base/62 px-2 text-xs font-semibold text-content-primary shadow-[0_0_0_1px_var(--overlay-ink-6),0_6px_14px_var(--overlay-ink-6)]"
    : "inline-flex min-h-8 items-center gap-2 rounded-lg bg-surface-note px-2 text-xs font-semibold text-content-primary shadow-[inset_0_0_0_1px_var(--overlay-ink-7)]";
  const continuationClass = isChatVariant
    ? "mt-2 min-h-16 w-full resize-none rounded-2xl border-0 bg-surface-base/46 p-3 text-sm leading-6 text-content-primary shadow-[inset_0_0_0_1px_var(--overlay-ink-6)] outline-none placeholder:text-content-placeholder"
    : "mt-3 min-h-20 w-full resize-y rounded-lg bg-surface-warm p-3 text-sm leading-6 text-content-primary shadow-[inset_0_0_0_1px_var(--overlay-ink-7)] outline-none placeholder:text-content-placeholder";
  const chatIconButtonClass =
    "grid size-8 place-items-center rounded-xl text-content-composer-icon transition-[scale,background-color,color] duration-150 ease-out hover:bg-content-primary/6 hover:text-content-hover-strong active:scale-[0.96]";

  if (isChatVariant) {
    return (
      <section
        className="bg-surface-base/74 w-full max-w-full rounded-[1.5rem] px-2.5 py-2.5 shadow-[0_16px_42px_var(--overlay-ink-12),0_2px_8px_var(--overlay-ink-6),inset_0_0_0_1px_var(--overlay-surface-64)] backdrop-blur-xl"
        data-testid="chat-composer-shell"
        data-composer-variant={variant}
      >
        <textarea
          className="text-content-primary placeholder:text-surface-neutral-track min-h-16 w-full resize-none border-0 bg-transparent px-1 pt-1 text-base leading-7 font-medium text-pretty outline-none sm:text-lg"
          placeholder={placeholder}
          value={props.bodyText}
          onChange={(event) => props.onBodyTextChange(event.target.value)}
        />
        {attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div className={attachmentClass} key={attachment.id}>
                <span className="bg-surface-base/72 text-content-muted rounded-md px-2 py-1 text-[0.68rem] font-semibold">
                  {attachmentLabel(attachment.kind)}
                </span>
                <span>{attachment.label}</span>
                {props.onRemoveAttachment ? (
                  <button
                    aria-label={`Remove ${attachment.label}`}
                    className="text-content-muted hover:bg-content-primary/6 hover:text-content-primary flex h-7 w-7 items-center justify-center rounded-md transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.96]"
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
            className={continuationClass}
            placeholder="Keep writing..."
            value={continuationText}
            onChange={(event) => props.onContinuationTextChange?.(event.target.value)}
          />
        ) : null}
        <div className="mt-1.5 flex min-h-10 min-w-0 items-center gap-1 overflow-hidden">
          <button
            aria-label={addContextLabel}
            className={chatIconButtonClass}
            type="button"
            onClick={props.onAddContext}
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
          {props.statusMessage ? (
            <p
              className="text-content-composer-icon m-0 min-w-0 flex-1 truncate px-1 text-xs font-medium"
              aria-live="polite"
            >
              {props.statusMessage}
            </p>
          ) : null}
          <div className="ml-auto flex min-w-0 items-center gap-1">
            <button
              aria-label={contextWindowLabel}
              className={chatIconButtonClass}
              type="button"
              onClick={openContextWindow}
            >
              <Circle className="h-5 w-5 stroke-[2.4]" aria-hidden />
            </button>
            <button
              aria-label={modelPickerLabel}
              className="text-content-composer-strong hover:bg-content-primary/6 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-xl px-1.5 transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
              type="button"
              onClick={openModelPicker}
            >
              <span className="text-[1.05rem] leading-none font-medium tabular-nums">
                {modelValue}
              </span>
              <ChevronDown className="text-content-composer-icon h-4 w-4" aria-hidden />
            </button>
            <button
              aria-label={voiceInputLabel}
              className={chatIconButtonClass}
              type="button"
              onClick={openVoiceInput}
            >
              <Mic className="h-5 w-5" aria-hidden />
            </button>
            <button
              className="bg-surface-send text-content-on-strong hover:bg-content-send-hover grid size-10 place-items-center rounded-full shadow-[0_10px_22px_var(--overlay-control-18),inset_0_1px_var(--overlay-surface-24)] transition-[scale,background-color,box-shadow] duration-150 ease-out active:scale-[0.96] disabled:opacity-70"
              disabled={props.disabled || !hasContent}
              type="button"
              onClick={props.onSubmit}
              aria-label={submitLabel}
            >
              <ArrowUp className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="bg-surface-base/72 rounded-xl p-3 shadow-[0_14px_34px_var(--overlay-ink-8),inset_0_0_0_1px_var(--overlay-ink-7)]"
      data-composer-variant={variant}
    >
      <textarea
        className="text-content-primary placeholder:text-content-placeholder min-h-24 w-full resize-y border-0 bg-transparent p-1 text-sm leading-6 text-pretty outline-none"
        placeholder={placeholder}
        value={props.bodyText}
        onChange={(event) => props.onBodyTextChange(event.target.value)}
      />
      {attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div className={attachmentClass} key={attachment.id}>
              <span className="bg-surface-base/72 text-content-muted rounded-md px-2 py-1 text-[0.68rem] font-semibold">
                {attachmentLabel(attachment.kind)}
              </span>
              <span>{attachment.label}</span>
              {props.onRemoveAttachment ? (
                <button
                  aria-label={`Remove ${attachment.label}`}
                  className="text-content-muted hover:bg-content-primary/6 hover:text-content-primary flex h-7 w-7 items-center justify-center rounded-md transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.96]"
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
          className={continuationClass}
          placeholder="Keep writing..."
          value={continuationText}
          onChange={(event) => props.onContinuationTextChange?.(event.target.value)}
        />
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 shadow-[inset_0_1px_var(--overlay-ink-7)]">
        <div className="flex flex-wrap items-center gap-2">
          <NoteColorPicker color={props.color} onChange={props.onChange} />
          {props.onAttachImage ? (
            <button
              aria-label="Attach photo"
              className="text-content-body hover:bg-content-primary/6 grid size-9 place-items-center rounded-lg transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
              type="button"
              onClick={props.onAttachImage}
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {props.onAttachDrawing ? (
            <button
              aria-label="Attach drawing"
              className="text-content-body hover:bg-content-primary/6 grid size-9 place-items-center rounded-lg transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
              type="button"
              onClick={props.onAttachDrawing}
            >
              <PenLine className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {props.onAttachVoice ? (
            <button
              aria-label="Attach voice"
              className="text-content-body hover:bg-content-primary/6 grid size-9 place-items-center rounded-lg transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]"
              type="button"
              onClick={props.onAttachVoice}
            >
              <Mic className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {props.statusMessage ? (
            <p className="text-content-muted m-0 text-xs font-medium">{props.statusMessage}</p>
          ) : null}
          <button
            className="bg-accent-primary text-content-on-strong grid size-10 place-items-center rounded-full shadow-[0_12px_24px_var(--overlay-accent-28)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
            disabled={props.disabled || !hasContent}
            type="button"
            onClick={props.onSubmit}
            aria-label={submitLabel}
          >
            <SendHorizontal className="h-4 w-4" aria-hidden />
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
          <h2 className="text-content-control-strong m-0 truncate text-base font-semibold">
            {props.title}
          </h2>
          <p className="text-content-control-muted m-0 mt-1 text-xs font-medium">
            Revision {props.serverRevision}
          </p>
        </div>
        <button
          className="border-overlay-scrim/10 bg-surface-base/45 text-content-control-strong min-h-9 rounded-md border px-2 text-xs font-semibold"
          type="button"
          onClick={() => props.onPinnedChange(!props.pinned)}
        >
          {props.pinned ? "Pinned" : "Pin"}
        </button>
      </div>

      <textarea
        className="text-content-control-strong placeholder:text-content-data-secondary mt-3 min-h-32 flex-1 resize-none border-0 bg-transparent text-sm leading-6 outline-none"
        placeholder="Keep writing..."
        value={props.bodyText}
        onChange={(event) => props.onBodyTextChange(event.target.value)}
      />

      <div className="mt-4 grid gap-3">
        <NoteColorPicker color={props.color} onChange={props.onChange} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-content-data-muted m-0 min-h-5 text-xs font-medium">
            {props.statusMessage || (props.dirty ? "Unsaved" : "")}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="border-overlay-scrim/10 bg-surface-base/45 text-content-control-strong min-h-9 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"
              disabled={props.archiving}
              type="button"
              onClick={props.onArchive}
            >
              Archive
            </button>
            <button
              className="bg-surface-strong text-content-on-strong min-h-9 rounded-md px-3 text-xs font-semibold disabled:opacity-50"
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
        <h2 className="text-content-inverse-strong m-0 mt-2 text-lg font-semibold">No notes yet</h2>
      </div>
    </section>
  );
}

export function ReviewActionSurface(props: ReviewActionSurfaceProps) {
  return (
    <article className={`${shellPanelClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-content-inverse-muted m-0 text-xs font-semibold tracking-[0.14em] uppercase">
            {props.kind} · {props.status}
          </p>
          <h3 className="text-content-inverse-strong m-0 mt-1 text-base font-semibold text-balance">
            {props.title}
          </h3>
        </div>
        <span className="bg-surface-success-dark text-status-success-bright rounded-lg px-2 py-1 text-xs font-semibold tabular-nums">
          {props.confidencePercent}%
        </span>
      </div>
      <p className="text-line-neutral-soft m-0 mt-2 text-sm leading-6 text-pretty">{props.body}</p>
      <p className="bg-surface-inverse-canvas text-content-inverse-subtle m-0 mt-3 rounded-lg px-3 py-2 text-xs font-medium shadow-[inset_0_0_0_1px_var(--overlay-surface-8)]">
        {props.followThroughText}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="bg-surface-inverse-action text-content-inverse-bright min-h-9 rounded-lg px-2 text-xs font-semibold transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onAccept}
        >
          Accept
        </button>
        <button
          className="bg-surface-inverse-inset text-content-inverse min-h-9 rounded-lg px-2 text-xs font-semibold shadow-[0_0_0_1px_var(--overlay-surface-9)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
          disabled={props.disabled}
          type="button"
          onClick={props.onComplete}
        >
          Done
        </button>
        <button
          className="bg-surface-inverse-inset text-content-inverse min-h-9 rounded-lg px-2 text-xs font-semibold shadow-[0_0_0_1px_var(--overlay-surface-9)] transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
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
      return "border-chart-green-muted bg-chart-green-wash";
    case "blue":
      return "border-chart-blue-line bg-chart-blue-wash";
    case "rose":
      return "border-chart-rose-soft bg-chart-rose-wash";
    case "yellow":
      return "border-chart-yellow-soft bg-chart-yellow-wash";
  }
}

function colorSwatchClass(color: StickyColor) {
  switch (color) {
    case "green":
      return "border-chart-green-soft bg-chart-green-surface";
    case "blue":
      return "border-chart-blue-muted bg-chart-blue-surface";
    case "rose":
      return "border-chart-rose-muted bg-chart-rose";
    case "yellow":
      return "border-chart-yellow-muted bg-chart-yellow";
  }
}
