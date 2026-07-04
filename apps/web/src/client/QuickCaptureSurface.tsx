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
    <main className="flex min-h-dvh items-center bg-[#eef1f5] p-3 text-[#111827]">
      <form
        className="grid w-full gap-3 rounded-lg border border-[#cbd5df] bg-white p-4 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <header className="flex min-h-8 items-center justify-between gap-3">
          <h1 className="m-0 text-base font-semibold tracking-normal">Quick Capture</h1>
          <button
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md border border-[#d7dee8] bg-[#f8fafc] text-lg leading-none text-[#4b5563] hover:bg-[#eef2f7]"
            type="button"
            onClick={props.onClose}
          >
            x
          </button>
        </header>
        <textarea
          autoFocus
          className="min-h-28 resize-none rounded-md border border-[#c3ccd7] bg-white p-3 text-sm leading-6 outline-none focus:border-[#f14f23] focus:ring-2 focus:ring-[#f14f23]/20"
          disabled={props.disabled}
          placeholder="What should Nudge process?"
          value={props.note}
          onChange={(event) => props.onNoteChange(event.currentTarget.value)}
          onKeyDown={submitOnCommandEnter}
        />
        <footer className="flex min-h-10 items-center justify-between gap-3">
          <p className="m-0 truncate text-sm text-[#667085]" role="status">
            {props.statusMessage}
          </p>
          <button
            className="min-h-10 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
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
