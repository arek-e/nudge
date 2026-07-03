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

interface NudgeDesktopBridge {
  readonly appVersion: string;
  readonly authCallbackUrl: string;
  readonly surface: "desktop";
  checkForUpdate(): Promise<NudgeDesktopUpdateActionResult>;
  downloadUpdate(): Promise<NudgeDesktopUpdateActionResult>;
  getUpdateState(): Promise<NudgeDesktopUpdateState>;
  installUpdate(): Promise<NudgeDesktopUpdateActionResult>;
  onUpdateState(listener: (state: unknown) => void): () => void;
  openExternalAuth(url: string): Promise<{ readonly ok: boolean }>;
}

interface Window {
  readonly nudgeDesktop?: NudgeDesktopBridge;
}
