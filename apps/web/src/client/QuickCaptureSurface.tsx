import type { KeyboardEvent } from "react";

interface QuickCaptureSurfaceProps {
  readonly disabled: boolean;
  readonly note: string;
  readonly statusMessage: string;
  readonly onClose: () => void;
  readonly onNoteChange: (value: string) => void;
  readonly onSubmit: () => void;
}

export function QuickCaptureSurface(props: QuickCaptureSurfaceProps) {
  const submitOnCommandEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <main className="bg-surface-capture-canvas text-content-control-strong flex min-h-dvh items-center p-3">
      <form
        className="border-line-capture bg-surface-base grid w-full gap-3 rounded-lg border p-4 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <header className="flex min-h-8 items-center justify-between gap-3">
          <h1 className="m-0 text-base font-semibold tracking-normal">Quick Capture</h1>
          <button
            aria-label="Close"
            className="border-line-control-soft bg-surface-control text-content-control hover:bg-surface-control-hover grid size-8 place-items-center rounded-md border text-lg leading-none"
            type="button"
            onClick={props.onClose}
          >
            x
          </button>
        </header>
        <textarea
          autoFocus
          className="border-line-control bg-surface-base focus:border-accent-primary focus:ring-accent-primary/20 min-h-28 resize-none rounded-md border p-3 text-sm leading-6 outline-none focus:ring-2"
          disabled={props.disabled}
          placeholder="What should Nudge process?"
          value={props.note}
          onChange={(event) => props.onNoteChange(event.currentTarget.value)}
          onKeyDown={submitOnCommandEnter}
        />
        <footer className="flex min-h-10 items-center justify-between gap-3">
          <p className="text-content-control-muted m-0 truncate text-sm" role="status">
            {props.statusMessage}
          </p>
          <button
            className="bg-surface-strong text-content-on-strong min-h-10 rounded-md px-4 text-sm font-semibold shadow-sm disabled:opacity-60"
            disabled={props.disabled}
            type="submit"
          >
            {props.disabled ? "Capturing" : "Capture"}
          </button>
        </footer>
      </form>
    </main>
  );
}
