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
import { AnimatePresence, motion } from "motion/react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";

export type RichTextDocument = Value;

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
  return <main className="app-shell">{props.children}</main>;
}

export function DashboardHeader(props: {
  readonly title?: string;
  readonly menuOpen: boolean;
  readonly onMenuToggle: () => void;
  readonly onMenuClose: () => void;
}) {
  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Lares</p>
          <h1>{props.title ?? "Home"}</h1>
        </div>
        <motion.button
          type="button"
          className="menu-button"
          aria-label={props.menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={props.menuOpen}
          onClick={props.onMenuToggle}
          whileTap={{ scale: 0.96 }}
        >
          <span />
          <span />
        </motion.button>
      </header>

      <AnimatePresence>
        {props.menuOpen ? <MobileMenu onClose={props.onMenuClose} /> : null}
      </AnimatePresence>
    </>
  );
}

export function HomeDashboard(props: { readonly eventCount: number; readonly loading: boolean }) {
  return (
    <motion.section
      className="dashboard-grid"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      aria-label="Home dashboard"
    >
      <DashboardCard label="Agent state">
        <AgentState tone="reading" label="Lares" value="Reading context" />
      </DashboardCard>
      <DashboardCard label="Today">
        <strong>{props.loading ? "..." : props.eventCount}</strong>
        <span>signals in context</span>
      </DashboardCard>
      <DashboardCard label="Next">
        <strong>Check in</strong>
        <span>give Lares the current state</span>
      </DashboardCard>
    </motion.section>
  );
}

export function DashboardCard(props: { readonly label: string; readonly children: ReactNode }) {
  return (
    <motion.article
      className="dashboard-card glass-surface"
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.14 }}
    >
      <p className="eyebrow">{props.label}</p>
      <div className="dashboard-card-body">{props.children}</div>
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
      className={`agent-state agent-state-${props.tone}`}
      aria-label={`${props.label}: ${props.value}`}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.14 }}
    >
      <span className="agent-state-icon" aria-hidden="true" />
      <span className="agent-state-copy">
        <span>{props.label}</span>
        <strong>{props.value}</strong>
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
      className={`card glass-surface${props.primary ? " primary-card" : ""}`}
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
      <h2 id={titleId}>{props.title}</h2>
      {props.children}
    </motion.section>
  );
}

export function CheckInForm(props: {
  readonly note: string;
  readonly status: string;
  readonly saving: boolean;
  readonly onNoteChange: (note: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <label htmlFor="note">What should Lares capture?</label>
      <textarea
        id="note"
        name="note"
        autoComplete="off"
        value={props.note}
        placeholder="Priorities, energy, constraints, people to follow up with..."
        onChange={(event) => props.onNoteChange(event.target.value)}
      />
      <div className="actions">
        <motion.button type="submit" disabled={props.saving} whileTap={{ scale: 0.985 }}>
          {props.saving ? "Saving..." : "Save capture"}
        </motion.button>
        <a className="button secondary" href="/api/docs">
          API docs
        </a>
      </div>
      <p id="status" role="status">
        {props.status}
      </p>
    </form>
  );
}

export function SynthesisPanel(props: {
  readonly synthesis: SynthesisViewModel | undefined;
  readonly loading: boolean;
  readonly generating: boolean;
  readonly onGenerate: () => void;
}) {
  return (
    <div className="synthesis-panel">
      <p className="summary">
        {props.synthesis?.summary ??
          (props.loading ? "Loading latest synthesis..." : "No synthesis yet.")}
      </p>

      {props.synthesis ? (
        <div className="synthesis-meta">
          <span>{props.synthesis.sourceSignalIds.length} source signals</span>
          <span>{props.synthesis.themes.join(", ")}</span>
        </div>
      ) : null}

      {props.synthesis?.openQuestions.length ? (
        <div className="open-questions">
          <p className="eyebrow">Open questions</p>
          {props.synthesis.openQuestions.map((question) => (
            <p key={question}>{question}</p>
          ))}
        </div>
      ) : null}

      <motion.button
        type="button"
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
  readonly editedTitle: string;
  readonly editedBody: string;
  readonly onGenerate: () => void;
  readonly onAccept: (proposalId: string) => void;
  readonly onReject: (proposalId: string) => void;
  readonly onStartEdit: (proposal: ProposalViewModel) => void;
  readonly onEditTitle: (title: string) => void;
  readonly onEditBody: (body: string) => void;
  readonly onCancelEdit: () => void;
  readonly onCommitEdit: () => void;
}) {
  return (
    <div className="proposal-panel">
      <div className="proposal-panel-header">
        <p className="summary">
          {props.loading
            ? "Loading proposals..."
            : props.proposals?.length
              ? `${props.proposals.length} proposals waiting for review.`
              : "No pending proposals."}
        </p>
        <motion.button
          type="button"
          disabled={props.generating}
          whileTap={{ scale: 0.985 }}
          onClick={props.onGenerate}
        >
          {props.generating ? "Generating..." : "Generate proposals"}
        </motion.button>
      </div>

      {props.proposals?.length ? (
        <div className="proposal-list">
          {props.proposals.map((proposal) => (
            <article className="proposal-item" key={proposal.id}>
              <p className="eyebrow">{proposal.kind}</p>
              <h3>{proposal.title}</h3>
              <p>{proposal.body}</p>
              <p className="proposal-rationale">{proposal.rationale}</p>
              <div className="proposal-actions">
                <motion.button
                  type="button"
                  disabled={props.reviewingId === proposal.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => props.onAccept(proposal.id)}
                >
                  Accept
                </motion.button>
                <motion.button
                  type="button"
                  className="secondary-button"
                  disabled={props.reviewingId === proposal.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => props.onReject(proposal.id)}
                >
                  Reject
                </motion.button>
                <motion.button
                  type="button"
                  className="secondary-button"
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

export function ProposalEditorDrawer(props: {
  readonly open: boolean;
  readonly title: string;
  readonly body: string;
  readonly bodyDocument: RichTextDocument | undefined;
  readonly onTitleChange: (title: string) => void;
  readonly onBodyChange: (body: string) => void;
  readonly onBodyDocumentChange: (document: RichTextDocument) => void;
  readonly onAiDraft: () => void;
  readonly onCancel: () => void;
  readonly onCommit: () => void;
}) {
  return (
    <Drawer.Root open={props.open} onOpenChange={(open) => (!open ? props.onCancel() : undefined)}>
      <Drawer.Portal>
        <Drawer.Backdrop className="drawer-backdrop" />
        <Drawer.Viewport className="drawer-viewport">
          <Drawer.Popup className="writing-drawer glass-surface">
            <Drawer.Content>
              <form
                aria-label="Edit proposal"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  props.onCommit();
                }}
              >
                <div className="drawer-handle" aria-hidden="true" />
                <div className="writing-drawer-header">
                  <p className="eyebrow">Edit proposal</p>
                  <Drawer.Title>Commit this as your own</Drawer.Title>
                  <Drawer.Description>
                    Shape the generated proposal into language you would actually stand behind.
                  </Drawer.Description>
                </div>
                <label htmlFor="commitment-title">Commitment title</label>
                <input
                  id="commitment-title"
                  value={props.title}
                  onChange={(event) => props.onTitleChange(event.target.value)}
                />
                <label htmlFor="commitment-body">Commitment body</label>
                <RichTextEditor
                  document={props.bodyDocument}
                  label="Commitment body"
                  value={props.body}
                  onAiDraft={props.onAiDraft}
                  onChange={props.onBodyChange}
                  onDocumentChange={props.onBodyDocumentChange}
                />
                <div className="drawer-actions">
                  <motion.button type="submit" whileTap={{ scale: 0.985 }}>
                    Commit edited proposal
                  </motion.button>
                  <Drawer.Close className="secondary-button">Cancel</Drawer.Close>
                </div>
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
  const editor = usePlateEditor({
    plugins: [BoldPlugin, ItalicPlugin, UnderlinePlugin],
    value: props.document ?? plainTextToRichTextDocument(props.value),
  });

  return (
    <div className="rich-text-editor" data-base-ui-swipe-ignore="true">
      <Plate
        editor={editor}
        onChange={({ value }) => {
          props.onDocumentChange(value);
          props.onChange(plateValueToPlainText(value));
        }}
      >
        <div className="rich-text-toolbar" aria-label="Editor formatting">
          <button
            type="button"
            className="secondary-button"
            onMouseDown={(event) => {
              event.preventDefault();
              editor.tf.bold.toggle();
            }}
          >
            Bold
          </button>
          <button
            type="button"
            className="secondary-button"
            onMouseDown={(event) => {
              event.preventDefault();
              editor.tf.italic.toggle();
            }}
          >
            Italic
          </button>
          <button
            type="button"
            className="secondary-button"
            onMouseDown={(event) => {
              event.preventDefault();
              editor.tf.underline.toggle();
            }}
          >
            Underline
          </button>
          <button type="button" className="secondary-button" onClick={props.onAiDraft}>
            AI draft
          </button>
        </div>
        <PlateContent
          aria-label={props.label}
          className="rich-text-content"
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
    <div className="commitment-panel">
      <p className="summary">
        {props.loading
          ? "Loading commitments..."
          : props.commitments?.length
            ? `${props.commitments.length} active commitments.`
            : "No active commitments."}
      </p>

      {props.commitments?.length ? (
        <div className="commitment-list">
          {props.commitments.map((commitment) => (
            <article className="commitment-item" key={commitment.id}>
              <p className="eyebrow">{commitment.status}</p>
              <h3>{commitment.title}</h3>
              <p>{commitment.body}</p>
              <motion.button
                type="button"
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
    <div className="outcome-panel">
      <p className="summary">
        {props.loading
          ? "Loading outcomes..."
          : props.outcomes?.length
            ? `${props.outcomes.length} recently closed loops.`
            : "No closed loops yet."}
      </p>

      {props.outcomes?.length ? (
        <div className="outcome-list">
          {props.outcomes.map((outcome) => (
            <article className="outcome-item" key={outcome.id}>
              <p className="eyebrow">{outcome.result}</p>
              <h3>{outcome.note ?? "Closed without note"}</h3>
              <p>{formatEventTime(outcome.recordedAt)}</p>
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
    cell: (info) => <span className="event-type">{formatEventType(info.getValue())}</span>,
  }),
  eventColumn.accessor((event) => eventText(event.payload), {
    id: "detail",
    header: "Detail",
    cell: (info) => <span className="event-note">{info.getValue()}</span>,
  }),
  eventColumn.accessor((event) => event.occurredAt ?? "", {
    id: "time",
    header: "Time",
    cell: (info) => <span className="event-time">{formatEventTime(info.getValue())}</span>,
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
    return <p className="empty-state">Loading events...</p>;
  }

  if (props.error) {
    return <p className="empty-state">Could not load events. Check the deployment logs.</p>;
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
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
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
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

export function injectStyles(styles: string) {
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);
}

function MobileMenu(props: { readonly onClose: () => void }) {
  return (
    <motion.div
      className="menu-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={props.onClose}
    >
      <motion.nav
        className="mobile-menu glass-surface"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        aria-label="Mobile menu"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mobile-menu-heading">
          <span>Navigate</span>
          <strong>Lares</strong>
        </div>
        <a href="/" onClick={props.onClose}>
          Home
        </a>
        <a href="/#today-title" onClick={props.onClose}>
          Today
        </a>
        <a href="/#check-in-title" onClick={props.onClose}>
          Capture
        </a>
        <a href="/events">Events</a>
        <a href="/api/docs">API docs</a>
      </motion.nav>
    </motion.div>
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
