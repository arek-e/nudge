import type { AppSurface } from "@nudge/surface";

export interface WebDraftStorage {
  readonly getItem: (key: string) => string | null;
  readonly removeItem: (key: string) => unknown;
  readonly setItem: (key: string, value: string) => unknown;
}

export interface WebLocalDraft {
  readonly bodyText: string;
  readonly continuationText: string;
  readonly localDate: string;
  readonly version: 1;
}

export function loadWebLocalDraft(input: {
  readonly localDate: string;
  readonly storage: WebDraftStorage;
  readonly surface: AppSurface;
}): WebLocalDraft | null {
  const value = input.storage.getItem(webLocalDraftKey(input.surface, input.localDate));
  if (!value) return null;

  try {
    return webLocalDraftFromValue(JSON.parse(value), input.localDate);
  } catch {
    return null;
  }
}

export function saveWebLocalDraft(input: {
  readonly bodyText: string;
  readonly continuationText: string;
  readonly localDate: string;
  readonly storage: WebDraftStorage;
  readonly surface: AppSurface;
}) {
  const bodyText = input.bodyText.trim();
  const continuationText = input.continuationText.trim();
  if (!bodyText && !continuationText) {
    clearWebLocalDraft(input);
    return null;
  }

  const draft: WebLocalDraft = {
    bodyText,
    continuationText,
    localDate: input.localDate,
    version: 1,
  };
  input.storage.setItem(webLocalDraftKey(input.surface, input.localDate), JSON.stringify(draft));
  return draft;
}

export function clearWebLocalDraft(input: {
  readonly localDate: string;
  readonly storage: WebDraftStorage;
  readonly surface: AppSurface;
}) {
  input.storage.removeItem(webLocalDraftKey(input.surface, input.localDate));
}

function webLocalDraftKey(surface: AppSurface, localDate: string) {
  return `nudge.${surface}.local-draft.${localDate}`;
}

function webLocalDraftFromValue(value: unknown, localDate: string): WebLocalDraft | null {
  const version = readObjectProperty(value, "version");
  const storedLocalDate = readObjectProperty(value, "localDate");
  const bodyText = readObjectProperty(value, "bodyText");
  const continuationText = readObjectProperty(value, "continuationText");
  if (
    version !== 1 ||
    storedLocalDate !== localDate ||
    typeof bodyText !== "string" ||
    typeof continuationText !== "string"
  ) {
    return null;
  }
  return {
    bodyText,
    continuationText,
    localDate,
    version,
  };
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}
