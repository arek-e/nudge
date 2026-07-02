import type { Value } from "platejs";
import type { ChangeEvent, DragEvent, FormEvent, MouseEvent, ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from "@platejs/basic-nodes/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUp,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  ClipboardList,
  FileText,
  Home,
  ImageIcon,
  KeyRound,
  LogOut,
  Moon,
  PenLine,
  Plus,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { DotmCircular3 } from "./components/ui/dotm-circular-3";
import { DotmCircular8 } from "./components/ui/dotm-circular-8";
import { DotmCircular17 } from "./components/ui/dotm-circular-17";
import { DotmSquare3 } from "./components/ui/dotm-square-3";

export type RichTextDocument = Value;

const shellClass = "mx-auto grid h-dvh w-full max-w-[44rem] grid-rows-[1fr] text-neutral-100";
const contentViewportClass =
  "min-h-0 overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5.75rem+env(safe-area-inset-bottom))]";
const surfaceClass =
  "relative overflow-hidden rounded-[1.45rem] border border-white/6 bg-[#1f1f1f]/95 p-5 shadow-[0_18px_42px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl";
const buttonClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border-0 bg-[#ec5c29] px-4 text-[0.8125rem] font-medium text-[#1a2735] shadow-none disabled:opacity-70";
const secondaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border-0 bg-white/5 px-4 text-[0.8125rem] font-medium text-neutral-200 shadow-none disabled:opacity-70";
const eyebrowClass = "mb-2 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-neutral-400";
const summaryClass = "mt-4 text-[0.875rem] leading-[1.55] text-neutral-300";
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");
const vestaLogoSrc = "/icons/vesta-logo-dark.svg";
const vestaLogoLongSrc = "/icons/vesta-logo-long-dark.svg";

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

export interface SignalCalendarDatum {
  readonly count: number;
  readonly isToday: boolean;
  readonly label: string;
}

export interface LoopFunnelDatum {
  readonly fill: string;
  readonly label: string;
  readonly value: number;
}

export interface OutcomeTrendDatum {
  readonly abandoned: number;
  readonly completed: number;
  readonly label: string;
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
          ? "No outcomes yet."
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

export function buildSignalCalendarData(
  events: ReadonlyArray<EventListItem>,
  now: Date = new Date(),
): ReadonlyArray<SignalCalendarDatum> {
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    const count = events.filter((event) => {
      const occurred = Date.parse(event.occurredAt ?? "");
      return occurred >= date.getTime() && occurred < next.getTime();
    }).length;
    return {
      count,
      isToday: date.toDateString() === now.toDateString(),
      label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).slice(0, 1),
    };
  });
}

export function buildLoopFunnelData(input: {
  readonly activeCommitmentCount: number;
  readonly closedOutcomeCount: number;
  readonly pendingProposalCount: number;
  readonly signalCount: number;
  readonly synthesisCount: number;
}): ReadonlyArray<LoopFunnelDatum> {
  return [
    { fill: "#9cc9e8", label: "Signals", value: input.signalCount },
    { fill: "#ec5c29", label: "Insights", value: input.synthesisCount },
    { fill: "#e7a5a1", label: "Review", value: input.pendingProposalCount },
    { fill: "#f4efe8", label: "Commit", value: input.activeCommitmentCount },
    { fill: "#9fbf9f", label: "Closed", value: input.closedOutcomeCount },
  ];
}

export function buildOutcomeTrendData(
  outcomes: ReadonlyArray<OutcomeViewModel>,
): ReadonlyArray<OutcomeTrendDatum> {
  const groups = new Map<string, { abandoned: number; completed: number }>();
  for (const outcome of outcomes) {
    const label = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(
      new Date(outcome.recordedAt),
    );
    const current = groups.get(label) ?? { abandoned: 0, completed: 0 };
    groups.set(label, {
      abandoned: current.abandoned + (outcome.result === "abandoned" ? 1 : 0),
      completed: current.completed + (outcome.result === "completed" ? 1 : 0),
    });
  }
  return [...groups.entries()].map(([label, value]) => ({ label, ...value }));
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

export function VestaAppShell(props: { readonly children: ReactNode }) {
  return (
    <main className={shellClass}>
      <div className={contentViewportClass}>{props.children}</div>
    </main>
  );
}

export function LoginCard(props: {
  readonly email: string;
  readonly emailOtpEnabled: boolean;
  readonly error: string;
  readonly googleEnabled: boolean;
  readonly logoLongSrc?: string;
  readonly passkeyEnabled: boolean;
  readonly pendingEmail: boolean;
  readonly pendingPasskey: boolean;
  readonly sentTo: string;
  readonly otp: string;
  readonly onEmailChange: (email: string) => void;
  readonly onGoogle: () => void;
  readonly onOtpChange: (otp: string) => void;
  readonly onPasskey: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const hasProvider = props.passkeyEnabled || props.googleEnabled;
  const logoLongSrc = props.logoLongSrc ?? vestaLogoLongSrc;
  const emailButtonLabel = props.pendingEmail
    ? props.sentTo
      ? "Verifying code..."
      : "Sending code..."
    : props.sentTo
      ? "Verify code"
      : "Continue with email";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#161616] p-6 text-white md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a
          className="flex items-center self-center text-sm font-medium text-white no-underline"
          href="/"
        >
          <img className="h-8 w-auto" src={logoLongSrc} alt="Vesta" />
        </a>
        <section className="rounded-2xl border border-white/8 bg-[#1f1f1f] p-6 shadow-[0_18px_42px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.03)]">
          <header className="text-center">
            <h1 className="m-0 text-xl font-semibold tracking-[-0.02em] text-white">
              Welcome back
            </h1>
            <p className="mt-2 mb-0 text-sm leading-6 text-neutral-400">
              Sign in with a passkey, Google, or an email code.
            </p>
          </header>
          <div className="mt-6 grid gap-4">
            <form className="grid gap-4" onSubmit={props.onSubmit}>
              <label className="grid gap-2 text-sm font-medium text-neutral-200">
                Email
                <input
                  className="min-h-11 rounded-xl border border-white/10 bg-[#111] px-3 text-base text-white outline-none focus:border-white/35"
                  autoComplete="email"
                  inputMode="email"
                  required
                  type="email"
                  value={props.email}
                  onChange={(event) => props.onEmailChange(event.currentTarget.value)}
                />
              </label>
              {props.sentTo ? (
                <label className="grid gap-2 text-sm font-medium text-neutral-200">
                  Code
                  <input
                    className="min-h-11 rounded-xl border border-white/10 bg-[#111] px-3 text-base text-white outline-none focus:border-white/35"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                    type="text"
                    value={props.otp}
                    onChange={(event) => props.onOtpChange(event.currentTarget.value)}
                  />
                </label>
              ) : null}
              {props.sentTo ? (
                <p className="m-0 text-sm text-emerald-300">
                  Enter the code sent to {props.sentTo}.
                </p>
              ) : null}
              {props.error ? <p className="m-0 text-sm text-red-300">{props.error}</p> : null}
              <button
                className={buttonClass}
                disabled={!props.emailOtpEnabled || props.pendingEmail}
                type="submit"
              >
                {emailButtonLabel}
              </button>
            </form>
            {hasProvider ? (
              <div className="grid gap-3">
                <div className="relative py-1 text-center text-xs text-neutral-500">
                  <span className="absolute inset-x-0 top-1/2 border-t border-white/8" />
                  <span className="relative bg-[#1f1f1f] px-2">Other ways to continue</span>
                </div>
                <div className="flex justify-center gap-2">
                  {props.passkeyEnabled ? (
                    <button
                      className="grid size-11 place-items-center rounded-full border border-white/8 bg-white/5 text-neutral-100 disabled:opacity-70"
                      aria-label="Continue with passkey"
                      disabled={props.pendingPasskey}
                      onClick={props.onPasskey}
                      title="Continue with passkey"
                      type="button"
                    >
                      <KeyRound className="size-5" aria-hidden="true" strokeWidth={2.1} />
                    </button>
                  ) : null}
                  <button
                    className="grid size-11 place-items-center rounded-full border border-white/8 bg-white/5 text-neutral-500 opacity-55"
                    aria-label="Gmail unavailable"
                    disabled
                    title="Gmail sign-in unavailable"
                    type="button"
                  >
                    <svg
                      className="size-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="52 42 88 66"
                      aria-hidden="true"
                    >
                      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
                      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
                      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
                      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
                      <path
                        fill="#c5221f"
                        d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export function DashboardHeader(props: { readonly title?: string }) {
  return (
    <header className="sticky top-0 z-2 flex items-center justify-between bg-gradient-to-b from-[#191919] to-[#19191900] py-3">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <img className="size-5" src={vestaLogoSrc} alt="" aria-hidden="true" />
          <p className="m-0 text-[0.75rem] font-medium tracking-[0.12em] text-neutral-400 uppercase">
            Vesta
          </p>
        </div>
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
  readonly hasJournalEntry: boolean;
  readonly loading: boolean;
  readonly onOpenSettings?: () => void;
  readonly onSignOut?: () => void;
  readonly openLoopCount: number;
  readonly weeklyActivity: ReadonlyArray<SignalCalendarDatum>;
}) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const today = new Date();
  const dayStart = new Date(today);
  dayStart.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(dayStart);
    date.setDate(dayStart.getDate() + index);
    return {
      day: String(date.getDate()).padStart(2, "0"),
      isToday: date.toDateString() === today.toDateString(),
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).slice(0, 2),
    };
  });

  return (
    <motion.section
      className="mb-6 grid content-start gap-2.5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      aria-label="Home dashboard"
    >
      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-3">
        <span className="grid size-8 place-content-center rounded-full" aria-hidden="true">
          <img className="size-7" src={vestaLogoSrc} alt="" />
        </span>
        <h1 className="m-0 max-w-none text-center text-base font-semibold tracking-[-0.03em] text-white lowercase">
          good afternoon.
        </h1>
        <div className="relative justify-self-end">
          <button
            className="grid size-8 place-content-center rounded-full border-0 bg-[#232323] text-[#f4f1eb]"
            type="button"
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            aria-label="Account"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <UserRound className="size-4" aria-hidden="true" strokeWidth={2.2} />
          </button>
          {accountMenuOpen ? (
            <div
              className="absolute top-10 right-0 z-10 grid min-w-44 gap-1 rounded-2xl border border-white/8 bg-[#272727] p-1.5 shadow-2xl"
              role="menu"
              aria-label="Account actions"
            >
              <button
                className="flex min-h-10 items-center gap-2 rounded-xl border-0 bg-transparent px-3 text-left text-sm font-medium text-neutral-100"
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountMenuOpen(false);
                  props.onOpenSettings?.();
                }}
              >
                <Settings className="size-4 text-neutral-400" aria-hidden="true" strokeWidth={2} />
                Settings
              </button>
              <button
                className="flex min-h-10 items-center gap-2 rounded-xl border-0 bg-transparent px-3 text-left text-sm font-medium text-neutral-100"
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountMenuOpen(false);
                  props.onSignOut?.();
                }}
              >
                <LogOut className="size-4 text-neutral-400" aria-hidden="true" strokeWidth={2} />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="grid grid-cols-7 items-center gap-1 text-center text-neutral-500"
        aria-label="Week"
      >
        {days.map((day) => (
          <span
            className={`grid min-h-9 place-content-center gap-0.5 rounded-xl ${day.isToday ? "bg-[#232323] text-white" : ""}`}
            key={day.weekday}
          >
            <small className="text-[0.58rem]">{day.weekday}</small>
            <strong className="text-[0.7rem] font-semibold">{day.day}</strong>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard label="Notes">
          <Sun className="mx-auto size-5 text-neutral-300" aria-hidden="true" strokeWidth={2} />
          <strong>{props.hasJournalEntry ? "Written" : "Empty"}</strong>
          <span>{props.loading ? "..." : `${props.eventCount} items`}</span>
        </DashboardCard>
        <DashboardCard label="Open loops">
          <Moon className="mx-auto size-5 text-neutral-300" aria-hidden="true" strokeWidth={2} />
          <strong>{props.openLoopCount}</strong>
          <span>{props.openLoopCount === 0 ? "Clear" : "Open"}</span>
        </DashboardCard>
      </div>
      <DashboardCard label="Calendar" wide>
        <span className="text-[0.68rem] font-semibold tracking-[0.18em] text-neutral-400 uppercase">
          This week
        </span>
        <WeeklyActivityChart data={props.weeklyActivity} />
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

const chartFrameClass = "h-28 w-full [&_.recharts-cartesian-axis-tick_text]:fill-neutral-500";

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readChartTooltipItem(payload: unknown) {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0];
  const name = readObjectProperty(first, "name");
  const value = readObjectProperty(first, "value");
  return {
    ...(typeof name === "string" ? { name } : {}),
    ...(typeof value === "number" ? { value } : {}),
  };
}

function ChartTooltip(props: {
  readonly active?: boolean;
  readonly label?: string;
  readonly payload?: unknown;
}) {
  if (!props.active) return null;
  const first = readChartTooltipItem(props.payload);
  if (!first) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#111]/95 px-3 py-2 text-xs text-neutral-200 shadow-xl">
      <strong className="block text-white">{props.label ?? first.name}</strong>
      <span>{first.value ?? 0}</span>
    </div>
  );
}

export function WeeklyActivityChart(props: { readonly data: ReadonlyArray<SignalCalendarDatum> }) {
  return (
    <div className={chartFrameClass} aria-label="Weekly activity chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={props.data} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} fontSize={11} />
          <Tooltip cursor={false} content={<ChartTooltip />} />
          <Bar dataKey="count" radius={[8, 8, 8, 8]} minPointSize={6}>
            {props.data.map((item) => (
              <Cell key={item.label} fill={item.isToday ? "#f4efe8" : "#6b7280"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LoopFunnelChart(props: { readonly data: ReadonlyArray<LoopFunnelDatum> }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3" aria-label="Loop funnel chart">
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={props.data}
              dataKey="value"
              nameKey="label"
              innerRadius={28}
              outerRadius={52}
              paddingAngle={4}
            >
              {props.data.map((item) => (
                <Cell key={item.label} fill={item.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-2">
        {props.data.map((item) => (
          <div
            className="grid grid-cols-[0.65rem_1fr_auto] items-center gap-2 text-xs"
            key={item.label}
          >
            <span className="size-2.5 rounded-full" style={{ background: item.fill }} />
            <span className="text-neutral-400">{item.label}</span>
            <strong className="text-neutral-100">{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OutcomeTrendChart(props: { readonly data: ReadonlyArray<OutcomeTrendDatum> }) {
  return (
    <div className="h-36 w-full" aria-label="Outcome trend chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={props.data} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
          <defs>
            <linearGradient id="vesta-completed" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#9fbf9f" stopOpacity={0.55} />
              <stop offset="95%" stopColor="#9fbf9f" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} fontSize={11} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="#9fbf9f"
            fill="url(#vesta-completed)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="abandoned"
            stroke="#e7a5a1"
            fill="transparent"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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

type ChatAlign = "start" | "end";
type BubbleVariant = "default" | "secondary" | "muted" | "ghost" | "destructive";
type MarkerVariant = "default" | "border" | "separator";
type DotMatrixVisualState = "thinking" | "tool";
type VestaChatActivityStatus = "active" | "complete" | "error";

export interface VestaChatMessage {
  readonly content: string;
  readonly draftTitle?: string;
  readonly id: string;
  readonly memoryCount?: number;
  readonly role: "assistant" | "user";
  readonly streaming?: boolean;
}

export interface VestaChatActivity {
  readonly id: string;
  readonly kind: "thinking" | "tool";
  readonly label: string;
  readonly status?: VestaChatActivityStatus;
}

export interface VestaChatAttachment {
  readonly id: string;
  readonly name: string;
  readonly size?: number;
  readonly type?: string;
}

export type VestaChatEvent =
  | ({ readonly type: "activity" } & VestaChatActivity)
  | ({ readonly type: "message" } & VestaChatMessage);

const chatActivity = (activity: VestaChatActivity) => activity;
const chatEvent = (event: VestaChatEvent) => event;

type ChatTimelineGroup =
  | {
      readonly activities: ReadonlyArray<VestaChatActivity>;
      readonly id: string;
      readonly minimized: boolean;
      readonly type: "activity";
    }
  | {
      readonly id: string;
      readonly message: VestaChatMessage;
      readonly type: "message";
    };

// ponytail: request/response chat shell; replace with the full shadcn scroller when SSE streaming lands.
export function MessageScrollerProvider(props: {
  readonly autoScroll?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div data-slot="message-scroller-provider" data-auto-scroll={props.autoScroll || undefined}>
      {props.children}
    </div>
  );
}

export function MessageScroller(props: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      data-slot="message-scroller"
      className={cx("relative grid h-full min-h-0 grid-rows-[1fr]", props.className)}
    >
      {props.children}
    </div>
  );
}

export function MessageScrollerViewport(props: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      data-slot="message-scroller-viewport"
      className={cx("min-h-0 overflow-y-auto overscroll-contain px-4 py-4", props.className)}
    >
      {props.children}
    </div>
  );
}

export function MessageScrollerContent(props: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      data-slot="message-scroller-content"
      className={cx("mx-auto grid w-full max-w-[38rem] gap-5", props.className)}
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {props.children}
    </div>
  );
}

export function MessageScrollerItem(props: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly messageId?: string;
  readonly scrollAnchor?: boolean;
}) {
  return (
    <div
      data-slot="message-scroller-item"
      data-message-id={props.messageId}
      data-scroll-anchor={props.scrollAnchor || undefined}
      className={props.className}
    >
      {props.children}
    </div>
  );
}

export function Message(props: {
  readonly align?: ChatAlign;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const align = props.align ?? "start";
  return (
    <div
      data-slot="message"
      className={cx(
        "flex items-end gap-2.5",
        align === "end" ? "justify-end" : "justify-start",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function MessageAvatar(props: {
  readonly align?: ChatAlign;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      data-slot="message-avatar"
      className={cx(
        "grid size-8 shrink-0 place-content-center rounded-full bg-white/6 text-neutral-300",
        props.align === "end" && "order-2",
        props.className,
      )}
      aria-hidden="true"
    >
      {props.children}
    </div>
  );
}

export function MessageContent(props: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div data-slot="message-content" className={cx("grid max-w-[82%] gap-1.5", props.className)}>
      {props.children}
    </div>
  );
}

export function MessageFooter(props: {
  readonly align?: ChatAlign;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      data-slot="message-footer"
      className={cx(
        "flex text-xs text-neutral-400",
        props.align === "end" ? "justify-end" : "justify-start",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function Bubble(props: {
  readonly align?: ChatAlign;
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: BubbleVariant;
}) {
  const variant = props.variant ?? "secondary";
  const variantClass =
    variant === "default"
      ? "bg-[#f4f1eb] text-[#080808]"
      : variant === "muted"
        ? "bg-white/5 text-neutral-200"
        : variant === "ghost"
          ? "max-w-none bg-transparent px-0 text-neutral-100"
          : variant === "destructive"
            ? "bg-red-500/12 text-red-100 ring-1 ring-red-400/20"
            : "bg-[#272727] text-neutral-100";

  return (
    <div
      data-slot="bubble"
      data-align={props.align ?? "start"}
      data-variant={variant}
      className={cx(
        "w-fit max-w-[80%] rounded-[1.25rem] px-4 py-3 text-sm leading-6 text-pretty",
        props.align === "end" && "justify-self-end",
        variantClass,
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function BubbleContent(props: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div data-slot="bubble-content" className={cx("whitespace-pre-wrap", props.className)}>
      {props.children}
    </div>
  );
}

export function Marker(props: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly role?: string;
  readonly variant?: MarkerVariant;
}) {
  const variant = props.variant ?? "default";
  return (
    <div
      data-slot="marker"
      data-variant={variant}
      role={props.role}
      className={cx(
        "flex items-center gap-1.5 text-xs text-neutral-400",
        variant === "border" && "border-t border-white/6 pt-3",
        variant === "separator" && "justify-center border-y border-white/6 py-3",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function MarkerIcon(props: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <span data-slot="marker-icon" className={cx("text-neutral-500", props.className)} aria-hidden>
      {props.children}
    </span>
  );
}

export function MarkerContent(props: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span data-slot="marker-content" className={props.className}>
      {props.children}
    </span>
  );
}

const chatAttachmentAccept = "image/*,.pdf,.doc,.docx,.txt,.md";

function formatAttachmentSize(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  const kib = size / 1024;
  if (kib < 1024) return `${Math.round(kib)} KB`;
  const mib = kib / 1024;
  return `${mib < 10 ? mib.toFixed(1) : Math.round(mib)} MB`;
}

function isImageAttachment(attachment: VestaChatAttachment) {
  return (
    attachment.type?.startsWith("image/") ||
    /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(attachment.name)
  );
}

export function DotMatrixLoader(props: { readonly state?: DotMatrixVisualState } = {}) {
  const state = props.state ?? "thinking";
  const tone = state === "tool" ? "amber" : "cyan";
  const registryLoader = state === "tool" ? "dotm-square-3" : "dotm-thinking-sequence";

  return (
    <span
      data-slot="dot-matrix-loader"
      data-state={state}
      data-registry-loader={registryLoader}
      data-tone={tone}
      className={cx(
        "inline-flex size-4 items-center justify-center dmx-transitioning",
        `dmx-state-${state}`,
        `dmx-tone-${tone}`,
      )}
      aria-hidden="true"
    >
      {state === "tool" ? (
        <DotmSquare3
          animated
          ariaLabel="Working"
          color="#ffd166"
          dotShape="square"
          dotSize={2.35}
          halo={0.14}
          size={16}
        />
      ) : (
        <span
          data-slot="dot-matrix-loader-sequence"
          className="dmx-thinking-sequence relative inline-flex size-4"
        >
          <span
            data-slot="dot-matrix-loader-stage"
            data-registry-loader-stage="dotm-circular-3"
            className="dmx-thinking-sequence-stage"
          >
            <DotmCircular3
              animated
              ariaLabel="Thinking"
              color="#8ee8ff"
              dotSize={2.2}
              halo={0.14}
              size={16}
            />
          </span>
          <span
            data-slot="dot-matrix-loader-stage"
            data-registry-loader-stage="dotm-circular-8"
            className="dmx-thinking-sequence-stage"
          >
            <DotmCircular8
              animated
              ariaLabel="Thinking"
              color="#8ee8ff"
              dotSize={2.2}
              halo={0.12}
              size={16}
            />
          </span>
          <span
            data-slot="dot-matrix-loader-stage"
            data-registry-loader-stage="dotm-circular-17"
            className="dmx-thinking-sequence-stage"
          >
            <DotmCircular17
              animated
              ariaLabel="Thinking"
              color="#8ee8ff"
              dotSize={2.2}
              halo={0.12}
              size={16}
            />
          </span>
        </span>
      )}
    </span>
  );
}

function groupChatTimeline(
  events: ReadonlyArray<VestaChatEvent>,
): ReadonlyArray<ChatTimelineGroup> {
  const groups: Array<
    | Omit<Extract<ChatTimelineGroup, { type: "activity" }>, "minimized">
    | Extract<ChatTimelineGroup, { type: "message" }>
  > = [];
  let activities: Array<VestaChatActivity> = [];
  let activityGroupId = "";
  const flushActivities = () => {
    if (activities.length === 0) return;
    groups.push({ activities, id: `activity-${activityGroupId}`, type: "activity" });
    activities = [];
    activityGroupId = "";
  };

  for (const event of events) {
    if (event.type === "message") {
      flushActivities();
      groups.push({ id: event.id, message: event, type: "message" });
      continue;
    }

    if (!activityGroupId) activityGroupId = event.id;
    activities.push(
      event.status
        ? { id: event.id, kind: event.kind, label: event.label, status: event.status }
        : { id: event.id, kind: event.kind, label: event.label },
    );
  }
  flushActivities();

  return groups.map((group, index) =>
    group.type === "message"
      ? group
      : {
          ...group,
          minimized: groups
            .slice(index + 1)
            .some(
              (next) =>
                next.type === "message" &&
                next.message.role === "assistant" &&
                next.message.content.trim().length > 0,
            ),
        },
  );
}

function activityStatus(activity: VestaChatActivity): VestaChatActivityStatus {
  return activity.status ?? "active";
}

function ActivityStatusDot(props: {
  readonly state?: DotMatrixVisualState;
  readonly status: VestaChatActivityStatus;
}) {
  return (
    <span
      data-slot="activity-status-dot"
      data-status={props.status}
      className={cx(
        "inline-flex size-2 shrink-0 rounded-full",
        props.status === "active" &&
          cx(
            "animate-spin border border-t-transparent bg-transparent",
            props.state === "thinking" ? "border-[#8ee8ff]" : "border-[#ffd166]",
          ),
        props.status === "complete" && "bg-neutral-500",
        props.status === "error" && "bg-red-500",
      )}
      aria-hidden="true"
    />
  );
}

function ActivitySteps(props: {
  readonly activities: ReadonlyArray<VestaChatActivity>;
  readonly minimized?: boolean;
}) {
  if (props.activities.length === 0) {
    return null;
  }

  const hasActiveStep = props.activities.some((activity) => activityStatus(activity) === "active");
  const hasError = props.activities.some((activity) => activityStatus(activity) === "error");
  const state = props.activities.some((activity) => activity.kind === "tool") ? "tool" : "thinking";
  const title = hasError
    ? "Needs attention"
    : hasActiveStep
      ? state === "tool"
        ? "Working"
        : "Thinking"
      : "Completed";
  const countLabel = `${props.activities.length} step${props.activities.length === 1 ? "" : "s"}`;

  return (
    <MessageScrollerItem>
      <details
        data-slot="activity-steps"
        data-minimized={props.minimized || undefined}
        className="group w-fit max-w-[min(34rem,100%)] rounded-lg bg-white/[0.035] px-2.5 py-2 text-xs text-neutral-400 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
        open={!props.minimized}
      >
        <summary
          data-slot="activity-steps-summary"
          className="flex cursor-pointer list-none items-start gap-2 pr-1 transition-colors outline-none hover:text-neutral-300 [&::-webkit-details-marker]:hidden"
        >
          <span
            data-slot="activity-steps-loader"
            className="mt-px inline-flex size-4 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            {hasActiveStep ? (
              <DotMatrixLoader state={state} />
            ) : (
              <ActivityStatusDot status={hasError ? "error" : "complete"} />
            )}
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="text-[0.78rem] leading-4 font-medium text-neutral-200">{title}</span>
            <span className="text-[0.7rem] leading-3.5 text-neutral-500">{countLabel}</span>
          </span>
          <ChevronDown
            className="mt-1 ml-1 size-3.5 shrink-0 text-neutral-500 transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
            strokeWidth={2.2}
          />
        </summary>
        <ol
          data-slot="activity-step-rail"
          className="mt-2 ml-2 grid gap-2 border-l border-white/10 py-0.5 pl-4"
        >
          {props.activities.map((activity) => (
            <li
              key={activity.id}
              data-slot="activity-step"
              data-kind={activity.kind}
              className="relative min-w-0 text-[0.76rem] leading-5 text-neutral-300"
            >
              <span
                data-slot="activity-step-node"
                className="absolute top-[0.43rem] -left-[1.22rem] grid size-2 place-content-center rounded-full bg-[#1a2735] ring-4 ring-[#1a2735]"
              >
                <ActivityStatusDot state={activity.kind} status={activityStatus(activity)} />
              </span>
              <span className="break-words">{activity.label}</span>
            </li>
          ))}
        </ol>
      </details>
    </MessageScrollerItem>
  );
}

export function VestaChat(props: {
  readonly activities?: ReadonlyArray<VestaChatActivity>;
  readonly attachments?: ReadonlyArray<VestaChatAttachment>;
  readonly className?: string;
  readonly error?: string;
  readonly events?: ReadonlyArray<VestaChatEvent>;
  readonly input: string;
  readonly messages: ReadonlyArray<VestaChatMessage>;
  readonly sending: boolean;
  readonly onAttachmentRemove?: (id: string) => void;
  readonly onAttachmentsAdd?: (files: ReadonlyArray<File>) => void;
  readonly onInputChange: (input: string) => void;
  readonly onSubmit: () => void;
}) {
  const canSend = props.input.trim().length > 0 && !props.sending;
  const attachments = props.attachments ?? [];
  const canAttach = Boolean(props.onAttachmentsAdd) && !props.sending;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const activities =
    props.activities ??
    (props.sending
      ? [chatActivity({ id: "thinking", kind: "thinking", label: "Thinking..." })]
      : []);
  const timelineEvents =
    props.events ??
    ([
      ...props.messages.map((message) => chatEvent({ ...message, type: "message" })),
      ...activities.map((activity) => chatEvent({ ...activity, type: "activity" })),
    ] satisfies ReadonlyArray<VestaChatEvent>);
  const timelineGroups = groupChatTimeline(timelineEvents);
  const hasMessages = timelineEvents.some((event) => event.type === "message");
  const addFiles = (files: ReadonlyArray<File>) => {
    if (!props.onAttachmentsAdd || files.length === 0) return;
    props.onAttachmentsAdd(files);
  };
  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  };
  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!canAttach || !Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    setDraggingFiles(true);
  };
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canAttach) return;
    event.preventDefault();
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
    setDraggingFiles(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canAttach) return;
    event.preventDefault();
    setDraggingFiles(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <main
      className={cx(
        "mx-auto grid h-dvh w-full max-w-[42rem] bg-[#1a2735] text-neutral-100",
        props.className,
      )}
    >
      <section className="grid min-h-0 grid-rows-[auto_1fr_auto]" aria-label="Vesta chat">
        <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
          <div className="mb-1.5 flex items-center gap-2">
            <img className="size-5" src={vestaLogoSrc} alt="" aria-hidden="true" />
            <p className="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
              Vesta
            </p>
          </div>
          <h1 className="m-0 text-xl leading-tight font-semibold text-balance text-white">Chat</h1>
        </header>

        <MessageScrollerProvider autoScroll>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent>
                {!hasMessages ? (
                  <MessageScrollerItem>
                    <Marker variant="separator">
                      <MarkerContent>No messages yet</MarkerContent>
                    </Marker>
                  </MessageScrollerItem>
                ) : null}
                {timelineGroups.map((group) => {
                  if (group.type === "activity") {
                    return (
                      <ActivitySteps
                        key={group.id}
                        activities={group.activities}
                        minimized={group.minimized}
                      />
                    );
                  }

                  const message = group.message;
                  const align = message.role === "user" ? "end" : "start";
                  const memoryLabel =
                    typeof message.memoryCount === "number" && message.memoryCount > 0
                      ? `${message.memoryCount} memor${message.memoryCount === 1 ? "y" : "ies"}`
                      : "";

                  return (
                    <MessageScrollerItem
                      key={group.id}
                      messageId={message.id}
                      scrollAnchor={message.role === "user"}
                    >
                      <Message align={align}>
                        <MessageContent
                          className={cx(
                            message.role === "user"
                              ? "max-w-[75%] items-end"
                              : "max-w-[min(34rem,100%)] items-start",
                          )}
                        >
                          <Bubble
                            align={align}
                            variant={message.role === "user" ? "default" : "ghost"}
                            className={
                              message.role === "user"
                                ? "max-w-full px-3.5 py-2.5 text-[0.9375rem] leading-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                                : "max-w-full rounded-[1.35rem] bg-[#1b1b1b] px-4 py-3.5 text-[0.9375rem] leading-6 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                            }
                          >
                            <BubbleContent>
                              {message.content}
                              {message.streaming ? (
                                <span
                                  data-slot="streaming-cursor"
                                  className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse rounded-full bg-neutral-300"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </BubbleContent>
                          </Bubble>
                          {message.draftTitle || memoryLabel ? (
                            <MessageFooter align={align}>
                              <Marker className="w-fit rounded-full bg-white/[0.04] px-2.5 py-1 text-[0.72rem] leading-5 text-neutral-400 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                                <MarkerIcon>
                                  <Sparkles className="size-3" strokeWidth={2.2} />
                                </MarkerIcon>
                                <MarkerContent>
                                  {message.draftTitle ? (
                                    <>
                                      <span className="font-medium text-neutral-300">
                                        Review draft
                                      </span>
                                      {": "}
                                      {message.draftTitle}
                                    </>
                                  ) : null}
                                  {message.draftTitle && memoryLabel ? " · " : null}
                                  {memoryLabel}
                                </MarkerContent>
                              </Marker>
                            </MessageFooter>
                          ) : null}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  );
                })}
                {props.error ? (
                  <MessageScrollerItem>
                    <Bubble variant="destructive">
                      <BubbleContent>{props.error}</BubbleContent>
                    </Bubble>
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>

        <form
          className="bg-[#1a2735]/96 px-5 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
          aria-label="Message Vesta"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) props.onSubmit();
          }}
        >
          <div
            data-slot="chat-composer-dropzone"
            data-dragging={draggingFiles || undefined}
            className="mx-auto w-full max-w-[38rem]"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div
              data-slot="chat-composer-surface"
              className={cx(
                "relative grid gap-3 rounded-[1.55rem] bg-[#1d1d1d] px-4 pt-4 pb-3 text-neutral-100 shadow-[0_18px_48px_rgba(0,0,0,0.34),0_0_0_1px_rgba(255,255,255,0.08)]",
                draggingFiles && "shadow-[0_18px_48px_rgba(0,0,0,0.34),0_0_0_1px_#8ee8ff]",
              )}
            >
              {draggingFiles ? (
                <div
                  data-slot="chat-composer-drop-hint"
                  className="pointer-events-none absolute inset-2 z-10 grid place-content-center rounded-[1.2rem] bg-[#1a2735]/88 text-sm font-medium text-[#8ee8ff] shadow-[inset_0_0_0_1px_rgba(142,232,255,0.55)] backdrop-blur-sm"
                >
                  Drop files to attach
                </div>
              ) : null}
              {attachments.length > 0 ? (
                <div
                  data-slot="chat-attachment-list"
                  className="flex gap-2 overflow-x-auto pb-1"
                  aria-label={`${attachments.length} file${attachments.length === 1 ? "" : "s"} attached`}
                >
                  <span className="sr-only">
                    {attachments.length} file{attachments.length === 1 ? "" : "s"} attached
                  </span>
                  {attachments.map((attachment) => {
                    const size = formatAttachmentSize(attachment.size);
                    const isImage = isImageAttachment(attachment);
                    return (
                      <div
                        key={attachment.id}
                        data-slot="chat-attachment"
                        className="flex max-w-52 min-w-0 shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] px-2.5 py-2 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                      >
                        <span
                          className="grid size-8 shrink-0 place-content-center rounded-lg bg-white/[0.06] text-neutral-300"
                          aria-hidden="true"
                        >
                          {isImage ? (
                            <ImageIcon className="size-4" strokeWidth={2.1} />
                          ) : (
                            <FileText className="size-4" strokeWidth={2.1} />
                          )}
                        </span>
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate text-[0.78rem] leading-4 font-medium text-neutral-100">
                            {attachment.name}
                          </span>
                          {size ? (
                            <span className="text-[0.7rem] leading-4 text-neutral-500">{size}</span>
                          ) : null}
                        </span>
                        {props.onAttachmentRemove ? (
                          <button
                            className="grid size-7 shrink-0 place-content-center rounded-full border-0 bg-transparent text-neutral-500 transition-colors hover:text-neutral-200"
                            aria-label={`Remove ${attachment.name}`}
                            type="button"
                            onClick={() => props.onAttachmentRemove?.(attachment.id)}
                          >
                            <X className="size-3.5" aria-hidden="true" strokeWidth={2.2} />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <textarea
                className="max-h-40 min-h-18 resize-none border-0 bg-transparent p-0 text-[1rem] leading-6 text-white outline-none placeholder:text-neutral-500"
                aria-label="Message"
                placeholder="Message Vesta"
                rows={2}
                value={props.input}
                onChange={(event) => props.onInputChange(event.currentTarget.value)}
              />
              <div
                data-slot="chat-composer-toolbar"
                className="flex min-h-10 items-center justify-between gap-3"
              >
                <button
                  className="grid size-10 shrink-0 place-content-center rounded-full border-0 bg-transparent text-neutral-400 transition-colors hover:text-neutral-100 disabled:text-neutral-700"
                  aria-label="Attach files"
                  disabled={!canAttach}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="size-5" aria-hidden="true" strokeWidth={2} />
                </button>
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  accept={chatAttachmentAccept}
                  tabIndex={-1}
                  onChange={handleFileInputChange}
                />
                <button
                  className="grid size-10 shrink-0 place-content-center rounded-full border-0 bg-[#f4f1eb] text-[#080808] transition-transform active:scale-[0.96] disabled:bg-white/10 disabled:text-neutral-500"
                  aria-label="Send message"
                  disabled={!canSend}
                  type="submit"
                >
                  <ArrowUp className="size-5" aria-hidden="true" strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

export function CheckInForm(props: {
  readonly status: string;
  readonly saving: boolean;
  readonly onOpen: () => void;
}) {
  return (
    <div>
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
  readonly onNavigate?: (href: "/" | "/actions" | "/journey" | "/insights") => void;
}) {
  const todayActive = props.active === "today";
  const loopActive = props.active === "loop";
  const journeyActive = props.active === "journey";
  const insightsActive = props.active === "insights";
  const navigate = (
    href: "/" | "/actions" | "/journey" | "/insights",
    event: MouseEvent<HTMLAnchorElement>,
  ) => {
    if (!props.onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    props.onNavigate(href);
  };

  return (
    <nav
      className="fixed right-1/2 bottom-0 z-3 grid w-full max-w-[44rem] translate-x-1/2 grid-cols-5 items-end gap-1 bg-[#1a2735]/96 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
      aria-label="Primary navigation"
    >
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${todayActive ? "text-white" : "text-neutral-500"}`}
        aria-current={todayActive ? "page" : undefined}
        href="/"
        onClick={(event) => navigate("/", event)}
      >
        <Home className="size-5" aria-hidden="true" strokeWidth={todayActive ? 2.8 : 2} />
        Today
      </a>
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${loopActive ? "text-white" : "text-neutral-500"}`}
        aria-current={loopActive ? "page" : undefined}
        href="/actions"
        onClick={(event) => navigate("/actions", event)}
      >
        <ClipboardList className="size-5" aria-hidden="true" strokeWidth={loopActive ? 2.8 : 2} />
        Actions
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
        onClick={(event) => navigate("/journey", event)}
      >
        <BookOpen className="size-5" aria-hidden="true" strokeWidth={journeyActive ? 2.8 : 2} />
        Journey
      </a>
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${insightsActive ? "text-white" : "text-neutral-500"}`}
        aria-current={insightsActive ? "page" : undefined}
        href="/insights"
        onClick={(event) => navigate("/insights", event)}
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
  readonly onOpenChat: () => void;
}) {
  return (
    <Drawer.Root open={props.open} onOpenChange={(open) => (!open ? props.onClose() : undefined)}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-20 min-h-dvh bg-black/55 transition-opacity" />
        <Drawer.Viewport className="fixed inset-0 z-21">
          <Drawer.Popup className="fixed inset-x-0 bottom-0 mx-auto max-h-[calc(100dvh-1rem)] w-full max-w-[44rem] overflow-y-auto overscroll-contain rounded-t-[2rem] rounded-b-none border border-white/6 bg-[#1f1f1f]/95 p-4 pb-[max(1.35rem,env(safe-area-inset-bottom))] shadow-[0_18px_42px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.02)] outline-0 backdrop-blur-xl">
            <Drawer.Content>
              <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-white/10" aria-hidden="true" />
              <Drawer.Title className="m-0 text-center text-2xl font-semibold tracking-[-0.03em] text-white">
                Add
              </Drawer.Title>
              <div className="mt-6 grid gap-3">
                <motion.button
                  className={`${buttonClass} justify-start gap-3 px-5`}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={props.onCaptureNote}
                >
                  <span className="grid size-9 place-content-center rounded-full bg-[#1a2735] text-white">
                    <PenLine className="size-4" aria-hidden="true" strokeWidth={2.3} />
                  </span>
                  <span className="grid text-left">
                    <strong className="text-sm font-semibold">Note</strong>
                  </span>
                </motion.button>
                <motion.button
                  className={`${secondaryButtonClass} justify-start gap-3 px-5`}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={props.onOpenChat}
                >
                  <span className="grid size-9 place-content-center rounded-full bg-[#1a2735] text-white">
                    <Bot className="size-4" aria-hidden="true" strokeWidth={2.3} />
                  </span>
                  <span className="grid text-left">
                    <strong className="text-sm font-semibold">Chat</strong>
                  </span>
                </motion.button>
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
        {props.synthesis?.summary ?? (props.loading ? "Loading..." : "None")}
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
        {props.generating ? "Synthesizing..." : "Synthesize"}
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
            ? "Loading..."
            : props.proposals?.length
              ? `${props.proposals.length} pending`
              : "None"}
        </p>
        <motion.button
          type="button"
          className={buttonClass}
          disabled={props.generating}
          whileTap={{ scale: 0.985 }}
          onClick={props.onGenerate}
        >
          {props.generating ? "Generating..." : "Generate"}
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
                  Edit
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
        <Drawer.Backdrop className="fixed inset-0 z-20 min-h-dvh bg-[#1a2735] transition-opacity" />
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
                      {props.description ? (
                        <Drawer.Description className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-400">
                          {props.description}
                        </Drawer.Description>
                      ) : null}
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
            ? `${props.commitments.length} active`
            : "None"}
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
            ? `${props.outcomes.length} closed`
            : "None"}
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
    return <p className={summaryClass}>Loading...</p>;
  }

  if (props.error) {
    return <p className={summaryClass}>Could not load.</p>;
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
              <td colSpan={eventColumns.length}>No events.</td>
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
  if (props.loading) return <p className={summaryClass}>Loading...</p>;
  if (props.error) return <p className={summaryClass}>Could not load.</p>;
  if (!props.groups?.length) return <p className={summaryClass}>No history.</p>;

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
