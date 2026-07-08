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
    <section className="border-line-settings bg-surface-base rounded-lg border p-4 shadow-sm">
      <p className="text-content-control-muted m-0 text-xs font-semibold tracking-[0.14em] uppercase">
        Desktop
      </p>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-content-control-strong m-0 text-base font-semibold">Quick Capture</h2>
          <p className="text-content-control m-0 text-sm leading-6">Global shortcut</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <input
            aria-label="Quick Capture global shortcut"
            className="border-line-control bg-surface-base text-content-control-strong focus:border-accent-primary focus:ring-accent-primary/20 min-h-11 rounded-md border px-3 text-sm outline-none focus:ring-2"
            disabled={props.disabled}
            value={props.shortcut}
            onChange={(event) => props.onShortcutChange(event.currentTarget.value)}
          />
          <button
            className="bg-surface-strong text-content-on-strong min-h-11 rounded-md px-4 text-sm font-semibold disabled:opacity-50"
            disabled={props.disabled}
            type="button"
            onClick={props.onSaveShortcut}
          >
            Save
          </button>
          <button
            className="border-line-control bg-surface-base text-content-control-strong min-h-11 rounded-md border px-4 text-sm font-semibold disabled:opacity-50"
            disabled={props.disabled}
            type="button"
            onClick={props.onResetShortcut}
          >
            Reset
          </button>
        </div>
        {props.statusMessage ? (
          <p className="text-content-control-muted m-0 text-sm leading-6" role="status">
            {props.statusMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
