export type StickyColor = "yellow" | "green" | "blue" | "rose";

export interface NoteColorPickerProps {
  readonly color: StickyColor;
  readonly onChange: (color: StickyColor) => void;
}

export interface NoteComposerSurfaceProps extends NoteColorPickerProps {
  readonly bodyText: string;
  readonly disabled: boolean;
  readonly statusMessage?: string;
  readonly onBodyTextChange: (value: string) => void;
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

export const stickyColors: ReadonlyArray<StickyColor> = ["yellow", "green", "blue", "rose"];

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
  return (
    <section className="rounded-lg border border-[#d2d9e2] bg-white p-3 shadow-sm">
      <textarea
        className="min-h-28 w-full resize-y border-0 bg-transparent p-1 text-base leading-7 text-[#111827] outline-none placeholder:text-[#7b8491]"
        placeholder="Write something to remember..."
        value={props.bodyText}
        onChange={(event) => props.onBodyTextChange(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e7ec] pt-3">
        <NoteColorPicker color={props.color} onChange={props.onChange} />
        <div className="flex items-center gap-3">
          {props.statusMessage ? (
            <p className="m-0 text-sm font-medium text-[#596475]">{props.statusMessage}</p>
          ) : null}
          <button
            className="min-h-10 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            disabled={props.disabled || !props.bodyText.trim()}
            type="button"
            onClick={props.onSubmit}
          >
            Add note
          </button>
        </div>
      </div>
    </section>
  );
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
