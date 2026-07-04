interface DesktopSettingsSurfaceProps {
  readonly disabled: boolean;
  readonly isDesktop: boolean;
  readonly shortcut: string;
  readonly statusMessage: string;
  readonly onResetShortcut: () => void;
  readonly onSaveShortcut: () => void;
  readonly onShortcutChange: (value: string) => void;
}

export function DesktopSettingsSurface(props: DesktopSettingsSurfaceProps) {
  if (!props.isDesktop) return null;

  return (
    <section className="rounded-lg border border-[#d2d9e2] bg-white p-4 shadow-sm">
      <p className="m-0 text-xs font-semibold tracking-[0.14em] text-[#667085] uppercase">
        Desktop
      </p>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#111827]">Quick Capture</h2>
          <p className="m-0 text-sm leading-6 text-[#4b5563]">Global shortcut</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <input
            aria-label="Quick Capture global shortcut"
            className="min-h-11 rounded-md border border-[#c3ccd7] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#f14f23] focus:ring-2 focus:ring-[#f14f23]/20"
            disabled={props.disabled}
            value={props.shortcut}
            onChange={(event) => props.onShortcutChange(event.currentTarget.value)}
          />
          <button
            className="min-h-11 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white disabled:opacity-50"
            disabled={props.disabled}
            type="button"
            onClick={props.onSaveShortcut}
          >
            Save
          </button>
          <button
            className="min-h-11 rounded-md border border-[#c3ccd7] bg-white px-4 text-sm font-semibold text-[#111827] disabled:opacity-50"
            disabled={props.disabled}
            type="button"
            onClick={props.onResetShortcut}
          >
            Reset
          </button>
        </div>
        {props.statusMessage ? (
          <p className="m-0 text-sm leading-6 text-[#667085]" role="status">
            {props.statusMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
