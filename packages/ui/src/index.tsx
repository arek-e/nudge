import type { Value } from "platejs";
import type { FormEvent, ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from "@platejs/basic-nodes/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { motion } from "motion/react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";

export type RichTextDocument = Value;

const shellClass =
  "mx-auto w-full max-w-[44rem] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-neutral-100";
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
  return <main className={shellClass}>{props.children}</main>;
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
      <span
        className="grid size-11 place-content-center rounded-full border border-white/5 bg-[#272727] text-sm font-semibold text-white"
        aria-label="Account"
      >
        L
      </span>
    </header>
  );
}

export function HomeDashboard(props: { readonly eventCount: number; readonly loading: boolean }) {
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
      className="mb-10 grid min-h-[calc(100dvh-6rem)] content-start gap-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      aria-label="Home dashboard"
    >
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-3">
        <span className="block size-9 rounded-full bg-[#232323]" aria-hidden="true" />
        <h1 className="m-0 max-w-none text-center text-lg font-semibold tracking-[-0.03em] text-white lowercase">
          good afternoon.
        </h1>
        <span
          className="block size-9 justify-self-end rounded-full bg-[radial-gradient(circle_at_50%_35%,#f4f1eb_0_18%,transparent_19%),radial-gradient(circle_at_50%_78%,#f4f1eb_0_30%,transparent_31%),#232323]"
          aria-hidden="true"
        />
      </div>
      <div
        className="grid grid-cols-7 items-center gap-1 text-center text-neutral-500"
        aria-label="Week"
      >
        {days.map(([weekday, day]) => (
          <span
            className={`grid min-h-12 place-content-center gap-0.5 rounded-2xl ${weekday === "Fr" ? "border border-white/10 bg-[#232323] text-white" : ""}`}
            key={weekday}
          >
            <small className="text-[0.62rem]">{weekday}</small>
            <strong className="text-xs font-semibold">{day}</strong>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DashboardCard label="Morning Preparation">
          <strong>Ready to take on the day?</strong>
          <span>{props.loading ? "..." : `${props.eventCount} signals in context`}</span>
        </DashboardCard>
        <DashboardCard label="Evening Reflection">
          <strong>Time to clear your mind.</strong>
          <span>Close the loop before rest.</span>
        </DashboardCard>
      </div>
      <DashboardCard label="on glowing reviews." wide>
        <strong>What deserves attention next?</strong>
        <span>Capture the current state, then let Lares synthesize it.</span>
        <span className="justify-self-center rounded-full bg-[#f4f1eb] px-6 py-3 text-[0.8125rem] font-semibold text-[#080808]">
          Reflect
        </span>
      </DashboardCard>
      <p className="my-3 mb-14 text-center text-[0.68rem] font-semibold tracking-[0.42em] text-neutral-500 uppercase">
        get inspired
      </p>
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
      className={`${surfaceClass} ${props.wide ? "min-h-48 text-center" : "min-h-58"}`}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.14 }}
    >
      <p className={eyebrowClass}>{props.label}</p>
      <div className="grid h-full content-center gap-3 text-center [&>span]:text-[0.8125rem] [&>span]:text-neutral-300 [&>strong]:text-lg [&>strong]:leading-tight [&>strong]:font-semibold [&>strong]:tracking-[-0.025em] [&>strong]:text-white">
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
  readonly active: "today" | "events";
  readonly onCapture: () => void;
}) {
  const todayActive = props.active === "today";
  const eventsActive = props.active === "events";

  return (
    <nav
      className="fixed right-1/2 bottom-0 z-3 grid w-full max-w-[44rem] translate-x-1/2 grid-cols-5 items-end gap-1 border-t border-white/8 bg-[#111111]/96 px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-18px_42px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl"
      aria-label="Primary navigation"
    >
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${todayActive ? "text-white" : "text-neutral-500"}`}
        aria-current={todayActive ? "page" : undefined}
        href="/"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {todayActive ? "●" : "○"}
        </span>
        Today
      </a>
      <a
        className="grid min-h-12 place-items-center text-[0.68rem] text-neutral-500 no-underline"
        href="/#proposals-title"
      >
        <span className="text-base leading-none" aria-hidden="true">
          ○
        </span>
        Loop
      </a>
      <motion.button
        className="grid size-14 min-h-14 justify-self-center rounded-full bg-[#f4f1eb] text-3xl leading-none text-[#080808] shadow-none"
        type="button"
        aria-label="Write capture"
        whileTap={{ scale: 0.95 }}
        onClick={props.onCapture}
      >
        +
      </motion.button>
      <a
        className={`grid min-h-12 place-items-center text-[0.68rem] no-underline ${eventsActive ? "text-white" : "text-neutral-500"}`}
        aria-current={eventsActive ? "page" : undefined}
        href="/events"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {eventsActive ? "●" : "◌"}
        </span>
        Events
      </a>
      <a
        className="grid min-h-12 place-items-center text-[0.68rem] text-neutral-500 no-underline"
        href="/api/docs"
      >
        <span className="text-base leading-none" aria-hidden="true">
          □
        </span>
        Docs
      </a>
    </nav>
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
  return (
    <Drawer.Root open={props.open} onOpenChange={(open) => (!open ? props.onCancel() : undefined)}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-20 min-h-dvh bg-black/55 transition-opacity" />
        <Drawer.Viewport className="fixed inset-0 z-21">
          <Drawer.Popup
            className={`${surfaceClass} fixed inset-x-0 bottom-0 mx-auto max-h-[92dvh] min-h-[78dvh] w-full max-w-[44rem] overflow-auto overscroll-contain rounded-t-[1.65rem] rounded-b-none p-4 pb-[max(1.35rem,env(safe-area-inset-bottom))] outline-0`}
          >
            <Drawer.Content>
              <form
                aria-label="Edit proposal"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  props.onCommit();
                }}
              >
                <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/10" aria-hidden="true" />
                <div>
                  <p className={eyebrowClass}>{props.eyebrow}</p>
                  <Drawer.Title className="m-0 text-2xl font-semibold tracking-[-0.02em] text-white">
                    {props.drawerTitle}
                  </Drawer.Title>
                  <Drawer.Description className="mt-2 text-[0.8125rem] leading-relaxed text-neutral-400">
                    {props.description}
                  </Drawer.Description>
                </div>
                <div className="sticky top-0 z-1 mt-4 grid gap-2 bg-gradient-to-b from-[#1f1f1f] to-[#1f1f1f00] pb-4">
                  <motion.button className={buttonClass} type="submit" whileTap={{ scale: 0.985 }}>
                    {props.submitLabel}
                  </motion.button>
                  <Drawer.Close className={secondaryButtonClass}>Cancel</Drawer.Close>
                </div>
                <label
                  className="mb-2 block text-[0.8125rem] font-medium text-neutral-200"
                  htmlFor="writing-body"
                >
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
              </form>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
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
          placeholder="Write the commitment in your own words..."
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
