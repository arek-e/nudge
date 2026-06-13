import type { Value } from "platejs";
import type { ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from "@platejs/basic-nodes/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Home,
  Lightbulb,
  Moon,
  PenLine,
  Plus,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { useEffect, useState } from "react";

export type RichTextDocument = Value;

const shellClass = "mx-auto grid h-dvh w-full max-w-[44rem] grid-rows-[1fr] text-neutral-100";
const contentViewportClass =
  "min-h-0 overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5.75rem+env(safe-area-inset-bottom))]";
const surfaceClass =
  "relative overflow-hidden rounded-[1.45rem] border border-white/6 bg-[#1f1f1f]/95 p-5 shadow-[0_18px_42px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl";
const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border-0 bg-[#f4f1eb] px-4 text-[0.8125rem] font-medium text-[#080808] shadow-none disabled:opacity-70";
const secondaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border-0 bg-white/5 px-4 text-[0.8125rem] font-medium text-neutral-200 shadow-none disabled:opacity-70";
const eyebrowClass = "mb-2 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-neutral-400";
const summaryClass = "mt-4 text-[0.875rem] leading-[1.55] text-neutral-300";

export interface EventListItem {
  readonly id: string;
  readonly type: string;
  readonly source?: string;
  readonly occurredAt?: string;
  readonly payload: unknown;
}

export interface SynthesisViewModel {
  readonly summary: string;
  readonly themes: ReadonlyArray<string>;
  readonly openQuestions: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
}

export interface ProposalViewModel {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly rationale: string;
}

export interface CommitmentViewModel {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
}

export interface OutcomeViewModel {
  readonly id: string;
  readonly result: string;
  readonly note?: string | undefined;
  readonly recordedAt: string;
}

export interface InsightViewModel {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface JourneyDayGroupViewModel {
  readonly dateLabel: string;
  readonly items: ReadonlyArray<{
    readonly detail: string;
    readonly id: string;
    readonly title: string;
  }>;
}

export interface TodayLoopState {
  readonly activeCommitmentCount: number;
  readonly hasSynthesis: boolean;
  readonly pendingProposalCount: number;
  readonly signalCount: number;
}

export interface TodayNextActionViewModel {
  readonly stage: "Capture" | "Synthesis" | "Proposal" | "Review" | "Outcome";
  readonly label: string;
  readonly detail: string;
  readonly href: string;
}

export function deriveTodayNextAction(state: TodayLoopState): TodayNextActionViewModel {
  if (state.pendingProposalCount > 0) {
    return {
      stage: "Review",
      label: "Review proposal",
      detail: `${state.pendingProposalCount} proposal${state.pendingProposalCount === 1 ? "" : "s"} waiting for your decision.`,
      href: "#proposals-title",
    };
  }

  if (state.activeCommitmentCount > 0) {
    return {
      stage: "Outcome",
      label: "Close commitment",
      detail: `${state.activeCommitmentCount} active commitment${state.activeCommitmentCount === 1 ? "" : "s"} ready for an outcome check.`,
      href: "#commitments-title",
    };
  }

  if (state.hasSynthesis) {
    return {
      stage: "Proposal",
      label: "Generate proposals",
      detail: "Turn the current synthesis into reviewable next steps.",
      href: "#proposals-title",
    };
  }

  if (state.signalCount > 0) {
    return {
      stage: "Synthesis",
      label: "Synthesize signals",
      detail: `${state.signalCount} signal${state.signalCount === 1 ? "" : "s"} captured and ready to interpret.`,
      href: "#synthesis-title",
    };
  }

  return {
    stage: "Capture",
    label: "Capture current state",
    detail: "Start by adding priorities, constraints, energy, or follow-ups.",
    href: "#check-in-title",
  };
}

export function deriveJourneyDayGroups(
  events: ReadonlyArray<EventListItem>,
): ReadonlyArray<JourneyDayGroupViewModel> {
  const groups = new Map<string, JourneyDayGroupViewModel["items"]>();
  const sorted = [...events].sort((a, b) => {
    return Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? "");
  });

  for (const event of sorted) {
    const date = event.occurredAt ? new Date(event.occurredAt) : new Date(0);
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }).format(date);
    const items = groups.get(dateLabel) ?? [];
    groups.set(dateLabel, [
      ...items,
      {
        detail: eventText(event.payload),
        id: event.id,
        title: titleFromEventType(event.type),
      },
    ]);
  }

  return [...groups.entries()].map(([dateLabel, items]) => ({ dateLabel, items }));
}

export function deriveLoopInsights(input: {
  readonly activeCommitmentCount: number;
  readonly outcomes: ReadonlyArray<OutcomeViewModel>;
}): ReadonlyArray<InsightViewModel> {
  const totalClosed = input.outcomes.length;
  const completed = input.outcomes.filter((outcome) => outcome.result === "completed").length;
  const completionRate = totalClosed === 0 ? 0 : Math.round((completed / totalClosed) * 100);

  return [
    {
      label: "Completion rate",
      value: totalClosed === 0 ? "No data" : `${completionRate}%`,
      detail:
        totalClosed === 0
          ? "Close a commitment to start building trend history."
          : `${completed} of ${totalClosed} closed loop${totalClosed === 1 ? "" : "s"} completed recently.`,
    },
    {
      label: "Open loop load",
      value: `${input.activeCommitmentCount}`,
      detail:
        input.activeCommitmentCount === 0
          ? "No commitments are waiting for an outcome."
          : `${input.activeCommitmentCount} commitment${input.activeCommitmentCount === 1 ? "" : "s"} still need an outcome.`,
    },
    {
      label: "Closed loops",
      value: `${totalClosed}`,
      detail: `${totalClosed} outcome${totalClosed === 1 ? "" : "s"} recorded in recent history.`,
    },
  ];
}

export const plainTextToRichTextDocument = (text: string): RichTextDocument => [
  {
    type: "p",
    children: [{ text }],
  },
];

const plateValueToPlainText = (value: Value) => {
  return value
    .map((node) => {
      if (!Array.isArray(node.children)) return "";
      return node.children
        .map((child) => ("text" in child && typeof child.text === "string" ? child.text : ""))
        .join("");
    })
    .join("\n")
    .trim();
};

export function LaresAppShell(props: { readonly children: ReactNode }) {
  return (
    <main className={shellClass}>
      <div className={contentViewportClass}>{props.children}</div>
    </main>
  );
}

export function DashboardHeader(props: { readonly title?: string }) {
  return (
    <header className="sticky top-0 z-2 flex items-center justify-between bg-gradient-to-b from-[#191919] to-[#19191900] py-3">
      <div>
        <p className={eyebrowClass}>Lares</p>
        <h1 className="m-0 max-w-[14ch] text-2xl leading-[1.04] font-medium tracking-[-0.035em] text-balance">
          {props.title ?? "Home"}
        </h1>
      </div>
      <a
        className="grid size-11 place-content-center rounded-full border border-white/5 bg-[#272727] text-sm font-semibold text-white no-underline"
        aria-label="Settings"
        href="/settings"
      >
        <UserRound className="size-5" aria-hidden="true" strokeWidth={2.2} />
      </a>
    </header>
  );
}

export function HomeDashboard(props: {
  readonly eventCount: number;
  readonly loading: boolean;
  readonly nextAction: TodayNextActionViewModel;
  readonly onOpenLoop: () => void;
}) {
  const days = [
    ["Su", "13"],
    ["Mo", "14"],
    ["Tu", "15"],
    ["We", "16"],
    ["Th", "17"],
    ["Fr", "18"],
    ["Sa", "19"],
  ] as const;

  return (
    <motion.section
      className="mb-6 grid content-start gap-2.5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      aria-label="Home dashboard"
    >
      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-3">
        <span
          className="grid size-8 place-content-center rounded-full bg-[#232323]"
          aria-hidden="true"
        >
          <Sparkles className="size-4 text-neutral-400" strokeWidth={2.1} />
        </span>
        <h1 className="m-0 max-w-none text-center text-base font-semibold tracking-[-0.03em] text-white lowercase">
          good afternoon.
        </h1>
        <span
          className="grid size-8 place-content-center justify-self-end rounded-full bg-[#232323]"
          aria-hidden="true"
        >
          <UserRound className="size-4 text-[#f4f1eb]" strokeWidth={2.2} />
        </span>
      </div>
      <div
        className="grid grid-cols-7 items-center gap-1 text-center text-neutral-500"
        aria-label="Week"
      >
        {days.map(([weekday, day]) => (
          <span
            className={`grid min-h-9 place-content-center gap-0.5 rounded-xl ${weekday === "Fr" ? "bg-[#232323] text-white" : ""}`}
            key={weekday}
          >
            <small className="text-[0.58rem]">{weekday}</small>
            <strong className="text-[0.7rem] font-semibold">{day}</strong>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard label="Morning Preparation">
          <Sun className="mx-auto size-5 text-neutral-300" aria-hidden="true" strokeWidth={2} />
          <strong>Ready to take on the day?</strong>
          <span>{props.loading ? "..." : `${props.eventCount} signals in context`}</span>
        </DashboardCard>
        <DashboardCard label="Evening Reflection">
          <Moon className="mx-auto size-5 text-neutral-300" aria-hidden="true" strokeWidth={2} />
          <strong>Time to clear your mind.</strong>
          <span>Close the loop before rest.</span>
        </DashboardCard>
      </div>
      <DashboardCard label="Daily operating loop" wide>
        <span className="text-[0.68rem] font-semibold tracking-[0.18em] text-neutral-400 uppercase">
          Next: {props.nextAction.stage}
        </span>
        <strong>{props.nextAction.label}</strong>
        <span>{props.nextAction.detail}</span>
        <button
          className="justify-self-center rounded-full bg-[#f4f1eb] px-5 py-2 text-[0.75rem] font-semibold text-[#080808] no-underline"
          type="button"
          onClick={props.onOpenLoop}
        >
          <span className="inline-flex items-center gap-1.5 text-[#080808]">
            <Lightbulb className="size-3.5" aria-hidden="true" strokeWidth={2.3} />
            Open loop
          </span>
        </button>
      </DashboardCard>
    </motion.section>
  );
}

export function DashboardCard(props: {
  readonly label: string;
  readonly children: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <motion.article
      className={`${surfaceClass} ${props.wide ? "min-h-32 p-4 text-center" : "min-h-38 p-4"}`}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.14 }}
    >
      <p className={eyebrowClass}>{props.label}</p>
      <div className="grid h-full content-center gap-2 text-center [&>span]:text-[0.75rem] [&>span]:leading-snug [&>span]:text-neutral-300 [&>strong]:text-base [&>strong]:leading-tight [&>strong]:font-semibold [&>strong]:tracking-[-0.025em] [&>strong]:text-white">
        {props.children}
      </div>
    </motion.article>
  );
}

export function AgentState(props: {
  readonly tone: "idle" | "reading" | "drafting" | "blocked";
  readonly label: string;
  readonly value: string;
}) {
  return (
    <motion.div
      className="inline-flex w-fit items-center gap-3 rounded-2xl border border-white/5 bg-[#272727] px-3 py-2 text-[0.8125rem] shadow-[0_1px_1px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.02)]"
      aria-label={`${props.label}: ${props.value}`}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.14 }}
    >
      <span
        className="size-3.5 border border-[#f4f1eb] bg-[radial-gradient(currentColor_1px,transparent_1px)] bg-[length:4px_4px] text-[#f4f1eb]"
        aria-hidden="true"
      />
      <span className="grid gap-0.5">
        <span className="text-xs font-medium tracking-[0.12em] text-neutral-400 uppercase">
          {props.label}
        </span>
        <strong className="text-[0.8125rem] font-medium text-white">{props.value}</strong>
      </span>
    </motion.div>
  );
}

export function Surface(props: {
  readonly id?: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly primary?: boolean;
}) {
  const titleId = props.id ?? slugify(props.title);

  return (
    <motion.section
      className={`${surfaceClass} mt-4 ${props.primary ? "bg-[#232323]" : ""}`}
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {props.eyebrow ? <p className={eyebrowClass}>{props.eyebrow}</p> : null}
      <h2
        id={titleId}
        className="m-0 text-lg leading-tight font-medium tracking-[-0.02em] text-white"
      >
        {props.title}
      </h2>
      {props.children}
    </motion.section>
  );
}

export function CheckInForm(props: {
  readonly status: string;
  readonly saving: boolean;
  readonly onOpen: () => void;
}) {
  return (
    <div>
      <p className={summaryClass}>Capture priorities, energy, constraints, and follow-ups.</p>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <motion.button
          type="button"
          className={buttonClass}
          disabled={props.saving}
          whileTap={{ scale: 0.985 }}
          onClick={props.onOpen}
        >
          {props.saving ? "Saving..." : "Write capture"}
        </motion.button>
        <a className={secondaryButtonClass} href="/api/docs">
          API docs
        </a>
      </div>
      <p id="status" role="status" className="mt-3 text-sm text-neutral-300">
        {props.status}
      </p>
    </div>
  );
}

export function BottomNav(props: {
  readonly active: "today" | "loop" | "journey" | "insights";
  readonly onCapture: () => void;
}) {
  const todayActive = props.active === "today";
  const loopActive = props.active === "loop";
  const journeyActive = props.active === "journey";
  const insightsActive = props.active === "insights";

  return (
    <nav
      className="fixed right-1/2 bottom-0 z-3 grid w-full max-w-[44rem] translate-x-1/2 grid-cols-5 items-end gap-1 bg-[#111111]/96 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
      aria-label="Primary navigation"
    >
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${todayActive ? "text-white" : "text-neutral-500"}`}
        aria-current={todayActive ? "page" : undefined}
        href="/"
      >
        <Home className="size-5" aria-hidden="true" strokeWidth={todayActive ? 2.8 : 2} />
        Today
      </a>
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${loopActive ? "text-white" : "text-neutral-500"}`}
        aria-current={loopActive ? "page" : undefined}
        href="/loop"
      >
        <ClipboardList className="size-5" aria-hidden="true" strokeWidth={loopActive ? 2.8 : 2} />
        Loop
      </a>
      <motion.button
        className="grid size-14 min-h-14 justify-self-center rounded-full bg-[#f4f1eb] text-3xl leading-none text-[#080808] shadow-none"
        type="button"
        aria-label="Write capture"
        whileTap={{ scale: 0.95 }}
        onClick={props.onCapture}
      >
        <Plus className="m-auto size-7" aria-hidden="true" strokeWidth={2.4} />
      </motion.button>
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${journeyActive ? "text-white" : "text-neutral-500"}`}
        aria-current={journeyActive ? "page" : undefined}
        href="/journey"
      >
        <BookOpen className="size-5" aria-hidden="true" strokeWidth={journeyActive ? 2.8 : 2} />
        Journey
      </a>
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${insightsActive ? "text-white" : "text-neutral-500"}`}
        aria-current={insightsActive ? "page" : undefined}
        href="/insights"
      >
        <BarChart3 className="size-5" aria-hidden="true" strokeWidth={insightsActive ? 2.8 : 2} />
        Insights
      </a>
    </nav>
  );
}

export function AddActionSheet(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCaptureNote: () => void;
}) {
  return (
    <Drawer.Root open={props.open} onOpenChange={(open) => (!open ? props.onClose() : undefined)}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-20 min-h-dvh bg-black/55 transition-opacity" />
        <Drawer.Viewport className="fixed inset-0 z-21">
          <Drawer.Popup
            className={`${surfaceClass} fixed inset-x-0 bottom-0 mx-auto w-full max-w-[44rem] rounded-t-[2rem] rounded-b-none p-4 pb-[max(1.35rem,env(safe-area-inset-bottom))] outline-0`}
          >
            <Drawer.Content>
              <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-white/10" aria-hidden="true" />
              <Drawer.Title className="m-0 text-center text-2xl font-semibold tracking-[-0.03em] text-white">
                Add to Lares
              </Drawer.Title>
              <Drawer.Description className="mx-auto mt-2 max-w-[18rem] text-center text-[0.8125rem] leading-relaxed text-neutral-400">
                Start with the smallest useful signal. Lares can synthesize it after you save.
              </Drawer.Description>
              <div className="mt-6 grid gap-3">
                <motion.button
                  className={`${buttonClass} justify-start gap-3 px-5`}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={props.onCaptureNote}
                >
                  <span className="grid size-9 place-content-center rounded-full bg-[#111111] text-white">
                    <PenLine className="size-4" aria-hidden="true" strokeWidth={2.3} />
                  </span>
                  <span className="grid text-left">
                    <strong className="text-sm font-semibold">Capture note</strong>
                    <span className="text-xs text-neutral-600">
                      Write raw context, thought, or follow-up.
                    </span>
                  </span>
                </motion.button>
                <button className={`${secondaryButtonClass} gap-2`} type="button" disabled>
                  <Sparkles className="size-4" aria-hidden="true" strokeWidth={2} />
                  Start reflection soon
                </button>
                <button className={`${secondaryButtonClass} gap-2`} type="button" disabled>
                  <CheckCircle2 className="size-4" aria-hidden="true" strokeWidth={2} />
                  Log outcome soon
                </button>
              </div>
              <Drawer.Close className={`${secondaryButtonClass} mt-4 w-full`}>Cancel</Drawer.Close>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function SynthesisPanel(props: {
  readonly synthesis: SynthesisViewModel | undefined;
  readonly loading: boolean;
  readonly generating: boolean;
  readonly onGenerate: () => void;
}) {
  return (
    <div className="grid gap-4">
      <p className={summaryClass}>
        {props.synthesis?.summary ??
          (props.loading ? "Loading latest synthesis..." : "No synthesis yet.")}
      </p>

      {props.synthesis ? (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/5 bg-white/4 px-2 py-1 text-xs text-neutral-300">
            {props.synthesis.sourceSignalIds.length} source signals
          </span>
          <span className="rounded-full border border-white/5 bg-white/4 px-2 py-1 text-xs text-neutral-300">
            {props.synthesis.themes.join(", ")}
          </span>
        </div>
      ) : null}

      {props.synthesis?.openQuestions.length ? (
        <div className="border-t border-white/5 pt-4">
          <p className={eyebrowClass}>Open questions</p>
          {props.synthesis.openQuestions.map((question) => (
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-300" key={question}>
              {question}
            </p>
          ))}
        </div>
      ) : null}

      <motion.button
        type="button"
        className={buttonClass}
        disabled={props.generating}
        whileTap={{ scale: 0.985 }}
        onClick={props.onGenerate}
      >
        {props.generating ? "Synthesizing..." : "Generate synthesis"}
      </motion.button>
    </div>
  );
}

export function ProposalReviewPanel(props: {
  readonly proposals: ReadonlyArray<ProposalViewModel> | undefined;
  readonly loading: boolean;
  readonly generating: boolean;
  readonly reviewingId: string | undefined;
  readonly editingProposalId?: string | undefined;
  readonly onGenerate: () => void;
  readonly onAccept: (proposalId: string) => void;
  readonly onReject: (proposalId: string) => void;
  readonly onStartEdit: (proposal: ProposalViewModel) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4">
        <p className={summaryClass}>
          {props.loading
            ? "Loading proposals..."
            : props.proposals?.length
              ? `${props.proposals.length} proposals waiting for review.`
              : "No pending proposals."}
        </p>
        <motion.button
          type="button"
          className={buttonClass}
          disabled={props.generating}
          whileTap={{ scale: 0.985 }}
          onClick={props.onGenerate}
        >
          {props.generating ? "Generating..." : "Generate proposals"}
        </motion.button>
      </div>

      {props.proposals?.length ? (
        <div className="grid gap-4">
          {props.proposals.map((proposal) => (
            <article className="border-t border-white/5 pt-4" key={proposal.id}>
              <p className={eyebrowClass}>{proposal.kind}</p>
              <h3 className="m-0 text-base leading-tight font-medium text-white">
                {proposal.title}
              </h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-300">
                {proposal.body}
              </p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-500">
                {proposal.rationale}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <motion.button
                  type="button"
                  className={buttonClass}
                  disabled={props.reviewingId === proposal.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => props.onAccept(proposal.id)}
                >
                  Accept
                </motion.button>
                <motion.button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={props.reviewingId === proposal.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => props.onReject(proposal.id)}
                >
                  Reject
                </motion.button>
                <motion.button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={props.reviewingId === proposal.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => props.onStartEdit(proposal)}
                >
                  Edit & commit
                </motion.button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WritingDrawer(props: {
  readonly open: boolean;
  readonly eyebrow: string;
  readonly drawerTitle: string;
  readonly description: string;
  readonly bodyLabel: string;
  readonly submitLabel: string;
  readonly body: string;
  readonly bodyDocument: RichTextDocument | undefined;
  readonly onBodyChange: (body: string) => void;
  readonly onBodyDocumentChange: (document: RichTextDocument) => void;
  readonly onAiDraft: () => void;
  readonly onCancel: () => void;
  readonly onCommit: () => void;
}) {
  const visualViewportHeight = useVisualViewportHeight();

  return (
    <Drawer.Root open={props.open} onOpenChange={(open) => (!open ? props.onCancel() : undefined)}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-20 min-h-dvh bg-[#111111] transition-opacity" />
        <Drawer.Viewport className="fixed inset-0 z-21">
          <Drawer.Popup
            className="fixed inset-0 mx-auto grid w-full max-w-[44rem] grid-rows-[auto_1fr] overflow-hidden bg-[#1f1f1f] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-neutral-100 outline-0"
            style={visualViewportHeight ? { height: `${visualViewportHeight}px` } : undefined}
          >
            <Drawer.Content>
              <div className="grid h-full min-h-0 grid-rows-[auto_1fr]" aria-label="Edit proposal">
                <div className="bg-[#1f1f1f] pb-3">
                  <p className={eyebrowClass}>{props.eyebrow}</p>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Drawer.Title className="m-0 text-2xl font-semibold tracking-[-0.02em] text-white">
                        {props.drawerTitle}
                      </Drawer.Title>
                      <Drawer.Description className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-400">
                        {props.description}
                      </Drawer.Description>
                    </div>
                    <Drawer.Close className="min-h-10 rounded-full border-0 bg-white/5 px-3 text-xs font-medium text-neutral-200 shadow-none">
                      Cancel
                    </Drawer.Close>
                  </div>
                  <motion.button
                    className={`${buttonClass} mt-3 w-full`}
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={props.onCommit}
                  >
                    {props.submitLabel}
                  </motion.button>
                </div>
                <div className="min-h-0 overflow-y-auto overscroll-contain pt-3">
                  <label className="mb-2 block text-[0.8125rem] font-medium text-neutral-200">
                    {props.bodyLabel}
                  </label>
                  <RichTextEditor
                    document={props.bodyDocument}
                    label={props.bodyLabel}
                    value={props.body}
                    onAiDraft={props.onAiDraft}
                    onChange={props.onBodyChange}
                    onDocumentChange={props.onBodyDocumentChange}
                  />
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const update = () => setHeight(window.visualViewport?.height);
    update();
    window.visualViewport.addEventListener("resize", update);
    window.visualViewport.addEventListener("scroll", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}

export function RichTextEditor(props: {
  readonly value: string;
  readonly document: RichTextDocument | undefined;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly onDocumentChange: (document: RichTextDocument) => void;
  readonly onAiDraft: () => void;
}) {
  const showSlashCommands = props.value.trim() === "/" || props.value.trim().startsWith("/ai");
  const setFirstBlockType = (type: "p" | "h2") => {
    const current = props.document ?? plainTextToRichTextDocument(props.value);
    const next = current.map((node, index) => (index === 0 ? { ...node, type } : node));
    props.onDocumentChange(next);
    props.onChange(plateValueToPlainText(next));
  };
  const editor = usePlateEditor({
    plugins: [BoldPlugin, ItalicPlugin, UnderlinePlugin],
    value: props.document ?? plainTextToRichTextDocument(props.value),
  });

  return (
    <div className="w-full" data-base-ui-swipe-ignore="true">
      <Plate
        key={JSON.stringify(props.document ?? props.value)}
        editor={editor}
        onChange={({ value }) => {
          props.onDocumentChange(value);
          props.onChange(plateValueToPlainText(value));
        }}
      >
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Editor formatting">
          <button
            type="button"
            className="min-h-9 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-neutral-300 shadow-none"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setFirstBlockType("p")}
          >
            Text
          </button>
          <button
            type="button"
            className="min-h-9 rounded-full border border-white/10 bg-[#f4f1eb] px-3 text-xs text-[#080808] shadow-none"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setFirstBlockType("h2")}
          >
            Heading
          </button>
          <button
            type="button"
            className="ml-auto min-h-9 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-neutral-300 shadow-none"
            onClick={props.onAiDraft}
          >
            AI draft
          </button>
        </div>
        {showSlashCommands ? (
          <div
            className="mb-2 grid gap-1 rounded-2xl border border-white/5 bg-white/4 p-2"
            role="menu"
            aria-label="Slash commands"
          >
            <button
              className="min-h-9 justify-start rounded-xl bg-transparent px-3 text-left text-neutral-100 shadow-none"
              type="button"
              role="menuitem"
              onClick={props.onAiDraft}
            >
              Draft with AI
            </button>
          </div>
        ) : null}
        <PlateContent
          aria-label={props.label}
          className="min-h-60 bg-transparent py-4 text-lg leading-relaxed text-neutral-100 outline-none"
          onInput={(event) => props.onChange(event.currentTarget.textContent ?? "")}
          placeholder={
            props.label.toLowerCase().includes("capture")
              ? "Write the capture in your own words..."
              : "Write the commitment in your own words..."
          }
        />
      </Plate>
    </div>
  );
}

export function CommitmentPanel(props: {
  readonly commitments: ReadonlyArray<CommitmentViewModel> | undefined;
  readonly loading: boolean;
  readonly completingId: string | undefined;
  readonly onComplete: (commitmentId: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <p className={summaryClass}>
        {props.loading
          ? "Loading commitments..."
          : props.commitments?.length
            ? `${props.commitments.length} active commitments.`
            : "No active commitments."}
      </p>

      {props.commitments?.length ? (
        <div className="grid gap-4">
          {props.commitments.map((commitment) => (
            <article className="border-t border-white/5 pt-4" key={commitment.id}>
              <p className={eyebrowClass}>{commitment.status}</p>
              <h3 className="m-0 text-base leading-tight font-medium text-white">
                {commitment.title}
              </h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-300">
                {commitment.body}
              </p>
              <motion.button
                type="button"
                className={`${buttonClass} mt-4`}
                disabled={props.completingId === commitment.id}
                whileTap={{ scale: 0.985 }}
                onClick={() => props.onComplete(commitment.id)}
              >
                {props.completingId === commitment.id ? "Completing..." : "Mark completed"}
              </motion.button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OutcomePanel(props: {
  readonly outcomes: ReadonlyArray<OutcomeViewModel> | undefined;
  readonly loading: boolean;
}) {
  return (
    <div className="grid gap-4">
      <p className={summaryClass}>
        {props.loading
          ? "Loading outcomes..."
          : props.outcomes?.length
            ? `${props.outcomes.length} recently closed loops.`
            : "No closed loops yet."}
      </p>

      {props.outcomes?.length ? (
        <div className="grid gap-4">
          {props.outcomes.map((outcome) => (
            <article className="border-t border-white/5 pt-4" key={outcome.id}>
              <p className={eyebrowClass}>{outcome.result}</p>
              <h3 className="m-0 text-base leading-tight font-medium text-white">
                {outcome.note ?? "Closed without note"}
              </h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-300">
                {formatEventTime(outcome.recordedAt)}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const eventColumn = createColumnHelper<EventListItem>();

const eventColumns = [
  eventColumn.accessor("type", {
    header: "Event",
    cell: (info) => (
      <span className="font-medium text-white">{formatEventType(info.getValue())}</span>
    ),
  }),
  eventColumn.accessor((event) => eventText(event.payload), {
    id: "detail",
    header: "Detail",
    cell: (info) => <span className="text-neutral-300">{info.getValue()}</span>,
  }),
  eventColumn.accessor((event) => event.occurredAt ?? "", {
    id: "time",
    header: "Time",
    cell: (info) => <span className="text-neutral-500">{formatEventTime(info.getValue())}</span>,
  }),
];

export function EventTable(props: {
  readonly events: ReadonlyArray<EventListItem> | undefined;
  readonly loading: boolean;
  readonly error: boolean;
}) {
  const table = useReactTable({
    columns: eventColumns,
    data: [...(props.events ?? [])],
    getCoreRowModel: getCoreRowModel(),
  });

  if (props.loading) {
    return <p className={summaryClass}>Loading events...</p>;
  }

  if (props.error) {
    return <p className={summaryClass}>Could not load events. Check the deployment logs.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5">
      <table className="w-full border-collapse text-left text-[0.8125rem]">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  className="border-b border-white/5 px-3 py-3 text-xs font-medium tracking-[0.12em] text-neutral-500 uppercase"
                  key={header.id}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {row.getVisibleCells().map((cell) => (
                  <td className="border-b border-white/5 px-3 py-3 align-top" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))
          ) : (
            <tr>
              <td colSpan={eventColumns.length}>No events yet. Save the first check-in.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function JourneyTimeline(props: {
  readonly groups: ReadonlyArray<JourneyDayGroupViewModel> | undefined;
  readonly loading: boolean;
  readonly error: boolean;
}) {
  if (props.loading) return <p className={summaryClass}>Loading Journey...</p>;
  if (props.error) return <p className={summaryClass}>Could not load Journey.</p>;
  if (!props.groups?.length) return <p className={summaryClass}>No loop history yet.</p>;

  return (
    <div className="mt-4 grid gap-5">
      {props.groups.map((group) => (
        <section className="grid gap-3" key={group.dateLabel} aria-label={group.dateLabel}>
          <h3 className="m-0 text-sm font-semibold tracking-[0.12em] text-neutral-400 uppercase">
            {group.dateLabel}
          </h3>
          <div className="grid gap-2">
            {group.items.map((item) => (
              <article className="rounded-2xl bg-white/4 p-4" key={item.id}>
                <h4 className="m-0 text-base font-semibold text-white">{item.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-neutral-300">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function InsightsPanel(props: { readonly insights: ReadonlyArray<InsightViewModel> }) {
  return (
    <div className="grid gap-4">
      {props.insights.map((insight) => (
        <article className="rounded-2xl border border-white/5 bg-white/4 p-4" key={insight.label}>
          <p className={eyebrowClass}>{insight.label}</p>
          <h3 className="m-0 text-2xl leading-tight font-semibold tracking-[-0.03em] text-white">
            {insight.value}
          </h3>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-300">{insight.detail}</p>
        </article>
      ))}
    </div>
  );
}

function eventText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "note" in payload &&
    typeof payload.note === "string"
  ) {
    return payload.note;
  }

  return JSON.stringify(payload);
}

function titleFromEventType(type: string) {
  const [first, ...rest] = type.split("_").filter(Boolean);
  if (!first) return "Signal";
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

function formatEventType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEventTime(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}
