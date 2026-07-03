export const defaultNudgeWebAppUrl = "https://nudge-web.teampitch.workers.dev";

export function resolveNudgeWebAppUrl(env: Readonly<Record<string, string | undefined>>) {
  const configured = env.NUDGE_WEB_APP_URL?.trim();
  return configured && configured.length > 0 ? configured : defaultNudgeWebAppUrl;
}

export function resolveDesktopE2eReadyFile(env: Readonly<Record<string, string | undefined>>) {
  const configured = env.NUDGE_DESKTOP_E2E_READY_FILE?.trim();
  return configured && configured.length > 0 ? configured : undefined;
}

export function canOpenExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
