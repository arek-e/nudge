/// <reference types="vite/client" />

type NudgeDesktopUpdateStatus =
  | "available"
  | "checking"
  | "disabled"
  | "downloaded"
  | "downloading"
  | "error"
  | "idle"
  | "up-to-date";

interface NudgeDesktopUpdateState {
  readonly availableVersion: string | null;
  readonly canRetry: boolean;
  readonly currentVersion: string;
  readonly downloadedVersion: string | null;
  readonly downloadPercent: number | null;
  readonly enabled: boolean;
  readonly message: string | null;
  readonly status: NudgeDesktopUpdateStatus;
}

interface NudgeDesktopUpdateActionResult {
  readonly accepted: boolean;
  readonly completed: boolean;
  readonly state: NudgeDesktopUpdateState;
}

interface NudgeDesktopSettings {
  readonly quickCaptureShortcut: string;
}

interface NudgeDesktopSettingsActionResult {
  readonly ok: boolean;
  readonly settings: NudgeDesktopSettings;
  readonly error?: string;
}

interface NudgeDesktopBridge {
  readonly appVersion: string;
  readonly authCallbackUrl: string;
  readonly surface: "desktop";
  checkForUpdate(): Promise<NudgeDesktopUpdateActionResult>;
  downloadUpdate(): Promise<NudgeDesktopUpdateActionResult>;
  getSettings(): Promise<NudgeDesktopSettingsActionResult>;
  getUpdateState(): Promise<NudgeDesktopUpdateState>;
  installUpdate(): Promise<NudgeDesktopUpdateActionResult>;
  onUpdateState(listener: (state: unknown) => void): () => void;
  openExternalAuth(url: string): Promise<{ readonly ok: boolean }>;
  setSettings(settings: NudgeDesktopSettings): Promise<NudgeDesktopSettingsActionResult>;
}

interface NudgeDesktopQuickCaptureBridge {
  close(): Promise<{ readonly ok: boolean }>;
  submitted(): Promise<{ readonly ok: boolean }>;
}

interface Window {
  readonly nudgeDesktop?: NudgeDesktopBridge;
  readonly nudgeDesktopQuickCapture?: NudgeDesktopQuickCaptureBridge;
}
