export const defaultNudgeWebAppUrl = "https://app.explorenudge.com/";
export const desktopProtocol = "nudge";
export const desktopAuthCallbackUrl = `${desktopProtocol}://auth/callback`;
export const defaultQuickCaptureShortcut = "CommandOrControl+Shift+N";

export interface DesktopSettings {
  readonly quickCaptureShortcut: string;
}

export const defaultDesktopSettings: DesktopSettings = {
  quickCaptureShortcut: defaultQuickCaptureShortcut,
};

const desktopShortcutModifierOrder = ["CommandOrControl", "Command", "Control", "Alt", "Shift"];
const desktopShortcutKeyNames = new Map([
  ["esc", "Escape"],
  ["escape", "Escape"],
  ["return", "Enter"],
  ["enter", "Enter"],
  ["space", "Space"],
  ["tab", "Tab"],
  ["backspace", "Backspace"],
  ["delete", "Delete"],
  ["del", "Delete"],
  ["up", "Up"],
  ["down", "Down"],
  ["left", "Left"],
  ["right", "Right"],
  ["+", "Plus"],
  ["plus", "Plus"],
  ["-", "Minus"],
  ["minus", "Minus"],
]);

function desktopShortcutModifierFromToken(token: string) {
  switch (token) {
    case "mod":
    case "cmdorctrl":
    case "commandorcontrol":
      return "CommandOrControl";
    case "cmd":
    case "command":
    case "meta":
      return "Command";
    case "ctrl":
    case "control":
      return "Control";
    case "alt":
    case "option":
      return "Alt";
    case "shift":
      return "Shift";
    default:
      return null;
  }
}

function desktopShortcutKeyFromToken(token: string) {
  const namedKey = desktopShortcutKeyNames.get(token);
  if (namedKey) return namedKey;
  if (/^[a-z0-9]$/.test(token)) return token.toUpperCase();
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(token)) return token.toUpperCase();
  return null;
}

export function normalizeDesktopShortcut(value: string) {
  const tokens = value
    .trim()
    .split("+")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
  if (tokens.length < 2) return null;

  const modifiers = new Set<string>();
  let key: string | null = null;
  for (const token of tokens) {
    const modifier = desktopShortcutModifierFromToken(token);
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    const nextKey = desktopShortcutKeyFromToken(token);
    if (!nextKey || key !== null) return null;
    key = nextKey;
  }

  if (!key || modifiers.size === 0) return null;
  const orderedModifiers = desktopShortcutModifierOrder.filter((modifier) =>
    modifiers.has(modifier),
  );
  return [...orderedModifiers, key].join("+");
}

export function desktopSettingsFromUnknown(value: unknown): DesktopSettings {
  if (!value || typeof value !== "object") return defaultDesktopSettings;
  const shortcut = Reflect.get(value, "quickCaptureShortcut");
  if (typeof shortcut !== "string") return defaultDesktopSettings;
  const quickCaptureShortcut = normalizeDesktopShortcut(shortcut);
  return quickCaptureShortcut ? { quickCaptureShortcut } : defaultDesktopSettings;
}

export function desktopSettingsUpdateFromUnknown(value: unknown): DesktopSettings | null {
  if (!value || typeof value !== "object") return null;
  const shortcut = Reflect.get(value, "quickCaptureShortcut");
  if (typeof shortcut !== "string") return null;
  const quickCaptureShortcut = normalizeDesktopShortcut(shortcut);
  return quickCaptureShortcut ? { quickCaptureShortcut } : null;
}

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
