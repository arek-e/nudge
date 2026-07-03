export interface DailyNoteDrawerTextInput {
  readonly dirty: boolean;
  readonly currentText: string;
  readonly remoteBodyText: string | null | undefined;
}

export interface DailyNotePatchInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly idempotencyKey: string;
  readonly localDate: string;
  readonly payloadHash: string;
  readonly title: string;
  readonly baseServerRevision?: string;
}

export interface StickyNoteCreateInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly color: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly pinned: boolean;
  readonly title: string;
}

export interface StickyNotePatchInput<
  NoteId extends string = string,
> extends StickyNoteCreateInput {
  readonly noteId: NoteId;
  readonly baseServerRevision?: string;
}

export interface BuildDailyNotePatchInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly idempotencyKey: string;
  readonly localDate: string;
  readonly serverRevision?: string;
  readonly title: string;
}

export interface BuildStickyNoteCreateInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly color?: string;
  readonly idempotencyKey: string;
  readonly pinned?: boolean;
  readonly title?: string;
}

export interface BuildStickyNotePatchInput<
  NoteId extends string = string,
> extends BuildStickyNoteCreateInput {
  readonly noteId: NoteId;
  readonly serverRevision?: string;
}

export function todayLocalDate(date: Date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function surfacePayloadHash(value: string) {
  return `${value.length}:${value}`;
}

export function noteTextFromPayload(payload: unknown) {
  if (payload && typeof payload === "object" && "note" in payload) {
    return String(Reflect.get(payload, "note"));
  }
  if (payload && typeof payload === "object" && "changedText" in payload) {
    return String(Reflect.get(payload, "changedText"));
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

export function dailyNoteDrawerText(input: DailyNoteDrawerTextInput) {
  if (input.dirty) {
    return input.currentText;
  }
  return input.remoteBodyText ?? "";
}

export function buildDailyNotePatchInput(input: BuildDailyNotePatchInput): DailyNotePatchInput {
  return {
    ...(input.serverRevision !== undefined ? { baseServerRevision: input.serverRevision } : {}),
    ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
    bodyText: input.bodyText,
    idempotencyKey: input.idempotencyKey,
    localDate: input.localDate,
    payloadHash: surfacePayloadHash(input.bodyText),
    title: input.title,
  };
}

export function stickyNoteTitleFromText(bodyText: string) {
  const firstLine = bodyText.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return firstLine.length > 0 ? firstLine.slice(0, 72) : "Untitled note";
}

function stickyNotePayloadHash(input: {
  readonly bodyText: string;
  readonly color: string;
  readonly pinned: boolean;
  readonly title: string;
}) {
  return surfacePayloadHash(
    JSON.stringify({
      bodyText: input.bodyText,
      color: input.color,
      pinned: input.pinned,
      title: input.title,
    }),
  );
}

export function buildStickyNoteCreateInput(
  input: BuildStickyNoteCreateInput,
): StickyNoteCreateInput {
  const color = input.color ?? "yellow";
  const pinned = input.pinned ?? false;
  const title = input.title ?? stickyNoteTitleFromText(input.bodyText);
  return {
    ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
    bodyText: input.bodyText,
    color,
    idempotencyKey: input.idempotencyKey,
    payloadHash: stickyNotePayloadHash({
      bodyText: input.bodyText,
      color,
      pinned,
      title,
    }),
    pinned,
    title,
  };
}

export function buildStickyNotePatchInput<NoteId extends string>(
  input: BuildStickyNotePatchInput<NoteId>,
): StickyNotePatchInput<NoteId> {
  const createInput = buildStickyNoteCreateInput(input);
  return {
    ...(input.serverRevision !== undefined ? { baseServerRevision: input.serverRevision } : {}),
    ...createInput,
    noteId: input.noteId,
  };
}
