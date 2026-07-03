export const defaultNudgeWebAppUrl = "https://nudge-web.teampitch.workers.dev";
export const desktopProtocol = "nudge";
export const desktopAuthCallbackUrl = `${desktopProtocol}://auth/callback`;

export function resolveNudgeWebAppUrl(env: Readonly<Record<string, string | undefined>>) {
  const configured = env.NUDGE_WEB_APP_URL?.trim();
  return configured && configured.length > 0 ? configured : defaultNudgeWebAppUrl;
}

export function resolveDesktopE2eReadyFile(env: Readonly<Record<string, string | undefined>>) {
  const configured = env.NUDGE_DESKTOP_E2E_READY_FILE?.trim();
  return configured && configured.length > 0 ? configured : undefined;
}

export function resolveDesktopAutoUpdatesEnabled(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly isPackaged: boolean;
}) {
  const override = input.env.NUDGE_DESKTOP_AUTO_UPDATE?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;
  return input.isPackaged;
}

export function canOpenExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isDesktopAuthCallbackUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === `${desktopProtocol}:` &&
      url.hostname === "auth" &&
      url.pathname === "/callback"
    );
  } catch {
    return false;
  }
}

export function desktopAuthTicketFromCallbackUrl(value: string) {
  if (!isDesktopAuthCallbackUrl(value)) return undefined;
  const url = new URL(value);
  const ticket = url.searchParams.get("ticket")?.trim();
  return ticket && ticket.length > 0 ? ticket : undefined;
}

export function desktopWebAppUrlForAuthTicket(webAppUrl: string, ticket: string) {
  const url = new URL(webAppUrl);
  url.searchParams.set("desktop_ticket", ticket);
  return url.toString();
}
