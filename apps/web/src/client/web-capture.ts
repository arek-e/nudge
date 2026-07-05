import type {
  SurfaceAgentRun,
  SurfaceEngineClient,
  SurfaceEventRecord,
  SurfaceJournalDocument,
  SurfaceJournalRevision,
} from "@nudge/surface";
import { createWebSurfaceEngineClient, nudgeRequestHeaders } from "./api-client";
import { currentAppSurface } from "./surface-runtime";

export type WebMediaKind = "image" | "voice";
export type WebMediaMimeType = "audio/mp4" | "audio/webm" | "image/jpeg" | "image/png";

export interface AppendWebCaptureInput {
  readonly note: string;
  readonly attachments?: unknown;
  readonly idempotencyKey?: string;
  readonly occurredAt?: string;
}

export interface SaveWebCaptureInput extends AppendWebCaptureInput {
  readonly localDate: string;
  readonly existingJournalText?: string;
  readonly mediaAttachments?: ReadonlyArray<WebMediaAttachmentDraft>;
  readonly title?: string;
  readonly trailingNote?: string;
  readonly treatsNoteAsFullBody?: boolean;
}

export interface SaveWebDailyNoteDraftInput {
  readonly continuationNote?: string;
  readonly existingJournalText?: string;
  readonly idempotencyKey?: string;
  readonly localDate: string;
  readonly note: string;
  readonly title?: string;
  readonly treatsNoteAsFullBody?: boolean;
}

export interface WebMediaAttachmentDraft {
  readonly dataURL: string;
  readonly id: string;
  readonly kind: WebMediaKind;
  readonly label: string;
  readonly mimeType: WebMediaMimeType;
  readonly presentationKind?: "drawing" | "photo" | "voice";
}

export interface StoredWebMediaAttachment {
  readonly byteLength: number;
  readonly id: string;
  readonly kind: WebMediaKind;
  readonly label: string;
  readonly mimeType: WebMediaMimeType;
  readonly url: string;
}

export interface SavedWebCapture {
  readonly capture: SurfaceEventRecord;
  readonly journal: SurfaceJournalDocument;
  readonly revision: SurfaceJournalRevision;
  readonly analysisRun?: SurfaceAgentRun;
}

export interface SavedWebDailyNoteDraft {
  readonly journal: SurfaceJournalDocument;
  readonly revision: SurfaceJournalRevision;
  readonly analysisRun?: SurfaceAgentRun;
}

export interface WebCaptureResultItem {
  readonly title: string;
  readonly value: string;
  readonly subtitle: string;
  readonly tone: "blue" | "green" | "orange" | "purple";
}

export interface WebCaptureResult {
  readonly title: string;
  readonly signalCount: number;
  readonly actionCount: number;
  readonly sourceCount: number;
  readonly summary: string;
  readonly items: ReadonlyArray<WebCaptureResultItem>;
  readonly references: ReadonlyArray<string>;
}

export type WebAppendCaptureClient = Pick<SurfaceEngineClient, "appendManualCapture">;
export type WebAppendCaptureClientFactory = () => Promise<WebAppendCaptureClient>;
export type WebCaptureJournalClient = Pick<
  SurfaceEngineClient,
  "appendManualCapture" | "saveJournal"
>;
export type WebCaptureJournalClientFactory = () => Promise<WebCaptureJournalClient>;
export type WebDailyNoteDraftClient = Pick<SurfaceEngineClient, "saveJournal">;
export type WebDailyNoteDraftClientFactory = () => Promise<WebDailyNoteDraftClient>;
export type WebMediaUploader = (
  attachment: WebMediaAttachmentDraft,
) => Promise<StoredWebMediaAttachment>;

export async function appendWebCapture(
  input: AppendWebCaptureInput,
  clientFactory: WebAppendCaptureClientFactory = createWebSurfaceEngineClient,
): Promise<SurfaceEventRecord> {
  const note = input.note.trim();
  if (!note) throw new Error("Write a note first.");

  const client = await clientFactory();
  return await client.appendManualCapture({
    ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
    idempotencyKey: input.idempotencyKey ?? `${currentAppSurface()}:${crypto.randomUUID()}`,
    note,
    ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
  });
}

export async function saveWebCapture(
  input: SaveWebCaptureInput,
  clientFactory: WebCaptureJournalClientFactory = createWebSurfaceEngineClient,
  mediaUploader: WebMediaUploader = uploadWebMediaAttachment,
): Promise<SavedWebCapture> {
  const composition = webJournalSaveComposition({
    existingJournalText: input.existingJournalText,
    leadingNote: input.note,
    trailingNote: input.trailingNote,
    treatsLeadingNoteAsFullBody: input.treatsNoteAsFullBody ?? false,
  });
  if (!composition.captureNoteText) throw new Error("Write a note first.");

  const client = await clientFactory();
  const storedAttachments = await uploadWebMediaAttachments(
    input.mediaAttachments ?? [],
    mediaUploader,
  );
  const bodyDocument = journalBodyDocument(composition, storedAttachments);
  const journal = await client.saveJournal({
    ...(bodyDocument.length > 0 ? { bodyDocument } : {}),
    bodyText: composition.journalBodyText,
    localDate: input.localDate,
    title: input.title ?? input.localDate,
  });
  const capture = await client.appendManualCapture({
    ...captureAttachmentsInput(input.attachments, storedAttachments),
    idempotencyKey: input.idempotencyKey ?? `${currentAppSurface()}:${crypto.randomUUID()}`,
    note: composition.captureNoteText,
    ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
  });

  return {
    ...(journal.analysisRun !== undefined ? { analysisRun: journal.analysisRun } : {}),
    capture,
    journal: journal.document,
    revision: journal.revision,
  };
}

export async function saveWebDailyNoteDraft(
  input: SaveWebDailyNoteDraftInput,
  clientFactory: WebDailyNoteDraftClientFactory = createWebSurfaceEngineClient,
): Promise<SavedWebDailyNoteDraft> {
  const composition = webJournalSaveComposition({
    existingJournalText: input.existingJournalText,
    leadingNote: input.note,
    trailingNote: input.continuationNote,
    treatsLeadingNoteAsFullBody: input.treatsNoteAsFullBody ?? false,
  });
  if (!composition.journalBodyText) throw new Error("Write a note first.");

  const client = await clientFactory();
  const bodyDocument = journalBodyDocument(composition, []);
  const journal = await client.saveJournal({
    ...(bodyDocument.length > 0 ? { bodyDocument } : {}),
    bodyText: composition.journalBodyText,
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    localDate: input.localDate,
    title: input.title ?? input.localDate,
  });

  return {
    ...(journal.analysisRun !== undefined ? { analysisRun: journal.analysisRun } : {}),
    journal: journal.document,
    revision: journal.revision,
  };
}

export async function uploadWebMediaAttachment(
  attachment: WebMediaAttachmentDraft,
  options: {
    readonly baseUrl?: string;
    readonly fetch?: (request: Request) => Promise<Response>;
    readonly headers?: () => Promise<HeadersInit>;
  } = {},
): Promise<StoredWebMediaAttachment> {
  const uploadDraft = mediaUploadDraftFromDataURL(attachment.dataURL);
  if (!uploadDraft) throw new Error("The attachment could not be prepared for upload.");

  const headers = new Headers(
    options.headers
      ? await options.headers()
      : await nudgeRequestHeaders({ "content-type": "application/json" }),
  );
  headers.set("content-type", "application/json");
  const request = new Request(`${options.baseUrl ?? window.location.origin}/api/media`, {
    body: JSON.stringify({
      byteLength: uploadDraft.byteLength,
      dataBase64: uploadDraft.dataBase64,
      id: attachment.id,
      kind: attachment.kind,
      label: attachment.label,
      mimeType: attachment.mimeType,
    }),
    headers,
    method: "POST",
  });
  const response = await (options.fetch ?? fetch)(request);
  if (!response.ok) throw new Error("Media upload failed.");
  return storedWebMediaAttachmentFromValue(await response.json());
}

export function captureResultFromSavedWebCapture(input: {
  readonly actionCount: number;
  readonly noteText: string;
  readonly saved: SavedWebCapture;
  readonly signalCount: number;
}): WebCaptureResult {
  const references = captureResultReferenceLabels(input);
  const items: WebCaptureResultItem[] = [
    {
      subtitle: "Updated in the Engine.",
      title: "Journal",
      tone: "orange",
      value: input.saved.journal.localDate,
    },
    {
      subtitle: displayLabelFromIdentifier(input.saved.capture.type),
      title: "Capture",
      tone: "blue",
      value: displayLabelFromIdentifier(input.saved.capture.source),
    },
  ];

  if (input.actionCount > 0) {
    items.push({
      subtitle: "Current actions remain available for follow-up.",
      title: "Open actions",
      tone: "green",
      value: String(input.actionCount),
    });
  }

  if (input.saved.analysisRun !== undefined) {
    items.push({
      subtitle: "Nudge is looking for follow-ups, commitments, and open loops.",
      title: "AI review",
      tone: "purple",
      value: displayLabelFromIdentifier(input.saved.analysisRun.status),
    });
  }

  return {
    actionCount: input.actionCount,
    items,
    references,
    signalCount: input.signalCount,
    sourceCount: references.length,
    summary: `Saved to ${input.saved.journal.localDate}. Nudge can use this capture with the current journal, signals, and action context.`,
    title: input.noteText.trim(),
  };
}

async function uploadWebMediaAttachments(
  attachments: ReadonlyArray<WebMediaAttachmentDraft>,
  mediaUploader: WebMediaUploader,
) {
  return await Promise.all(attachments.map((attachment) => mediaUploader(attachment)));
}

type RichTextBlock = RichTextMediaBlock | RichTextParagraphBlock;

interface RichTextMediaBlock {
  readonly attrs: {
    readonly alt: string;
    readonly id: string;
    readonly mimeType: WebMediaMimeType;
    readonly src: string;
  };
  readonly type: "audio" | "img";
}

interface RichTextParagraphBlock {
  readonly children: ReadonlyArray<{ readonly text: string }>;
  readonly type: "p";
}

interface WebJournalSaveComposition {
  readonly captureNoteText: string;
  readonly existingJournalText: string;
  readonly journalBodyText: string;
  readonly leadingNote: string;
  readonly trailingNote: string;
}

function webJournalSaveComposition(input: {
  readonly existingJournalText: string | undefined;
  readonly leadingNote: string;
  readonly trailingNote: string | undefined;
  readonly treatsLeadingNoteAsFullBody: boolean;
}): WebJournalSaveComposition {
  const existing = input.existingJournalText?.trim() ?? "";
  const leading = input.leadingNote.trim();
  const trailing = input.trailingNote?.trim() ?? "";
  const leadingDelta = journalLeadingDelta(existing, leading);
  const leadingForCapture = leadingDelta ?? leading;
  const leadingForDocument = input.treatsLeadingNoteAsFullBody ? leading : leadingForCapture;
  const existingForDocument = input.treatsLeadingNoteAsFullBody ? "" : existing;
  const captureNoteText = joinedParagraphText([leadingForCapture, trailing]);

  return {
    captureNoteText,
    existingJournalText: existingForDocument,
    journalBodyText: joinedParagraphText([existingForDocument, leadingForDocument, trailing]),
    leadingNote: leadingForDocument,
    trailingNote: trailing,
  };
}

function journalLeadingDelta(existing: string, leading: string) {
  if (!existing) return null;
  if (leading === existing) return "";
  if (!leading.startsWith(existing)) return null;

  const suffix = leading.slice(existing.length);
  const first = suffix.at(0);
  if (!first || !isWhitespace(first)) return null;
  return suffix.trim();
}

function joinedParagraphText(paragraphs: ReadonlyArray<string>) {
  return paragraphs.filter((paragraph) => paragraph.length > 0).join("\n\n");
}

function isWhitespace(value: string) {
  return value.trim().length === 0;
}

function journalBodyDocument(
  composition: WebJournalSaveComposition,
  attachments: ReadonlyArray<StoredWebMediaAttachment>,
) {
  if (attachments.length === 0 && !composition.trailingNote) return [];
  const blocks: RichTextBlock[] = [];
  if (composition.existingJournalText) blocks.push(paragraphBlock(composition.existingJournalText));
  if (composition.leadingNote) blocks.push(paragraphBlock(composition.leadingNote));
  blocks.push(...attachments.map(mediaBlock));
  if (composition.trailingNote) blocks.push(paragraphBlock(composition.trailingNote));
  return blocks;
}

function paragraphBlock(text: string): RichTextParagraphBlock {
  return { children: [{ text }], type: "p" };
}

function mediaBlock(attachment: StoredWebMediaAttachment): RichTextMediaBlock {
  return {
    attrs: {
      alt: attachment.label,
      id: attachment.id,
      mimeType: attachment.mimeType,
      src: attachment.url,
    },
    type: attachment.kind === "voice" ? "audio" : "img",
  };
}

function captureAttachmentsInput(
  metadataAttachments: unknown,
  mediaAttachments: ReadonlyArray<StoredWebMediaAttachment>,
) {
  if (mediaAttachments.length > 0) return { attachments: mediaAttachments.map(mediaReference) };
  return metadataAttachments !== undefined ? { attachments: metadataAttachments } : {};
}

function mediaReference(attachment: StoredWebMediaAttachment) {
  return {
    id: attachment.id,
    kind: attachment.kind,
    label: attachment.label,
    mimeType: attachment.mimeType,
    url: attachment.url,
  };
}

function captureResultReferenceLabels(input: {
  readonly actionCount: number;
  readonly saved: SavedWebCapture;
  readonly signalCount: number;
}) {
  const labels = [
    `Journal ${input.saved.journal.localDate}`,
    displayLabelFromIdentifier(input.saved.capture.source),
  ];
  if (input.signalCount > 0)
    labels.push(`${input.signalCount} signal${input.signalCount === 1 ? "" : "s"}`);
  if (input.actionCount > 0) {
    labels.push(`${input.actionCount} open action${input.actionCount === 1 ? "" : "s"}`);
  }
  if (input.saved.analysisRun !== undefined) {
    labels.push(`AI review ${input.saved.analysisRun.status}`);
  }
  return labels;
}

function mediaUploadDraftFromDataURL(dataURL: string) {
  const separatorIndex = dataURL.indexOf(",");
  if (separatorIndex < 0) return null;
  const dataBase64 = dataURL.slice(separatorIndex + 1);
  const bytes = decodeBase64ByteLength(dataBase64);
  if (bytes === null || bytes < 1) return null;
  return { byteLength: bytes, dataBase64 };
}

function decodeBase64ByteLength(value: string) {
  try {
    return atob(value).length;
  } catch {
    return null;
  }
}

function storedWebMediaAttachmentFromValue(value: unknown): StoredWebMediaAttachment {
  const byteLength = readNumberProperty(value, "byteLength");
  const id = readStringProperty(value, "id");
  const kind = readMediaKindProperty(value, "kind");
  const label = readStringProperty(value, "label");
  const mimeType = readMediaMimeTypeProperty(value, "mimeType");
  const url = readStringProperty(value, "url");
  if (
    byteLength === undefined ||
    id === undefined ||
    kind === undefined ||
    label === undefined ||
    mimeType === undefined ||
    url === undefined
  ) {
    throw new Error("Invalid media upload response.");
  }
  return { byteLength, id, kind, label, mimeType, url };
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readNumberProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "number" ? property : undefined;
}

function readStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function readMediaKindProperty(value: unknown, key: string): WebMediaKind | undefined {
  const property = readStringProperty(value, key);
  if (property === "image" || property === "voice") return property;
  return undefined;
}

function readMediaMimeTypeProperty(value: unknown, key: string): WebMediaMimeType | undefined {
  const property = readStringProperty(value, key);
  if (
    property === "audio/mp4" ||
    property === "audio/webm" ||
    property === "image/jpeg" ||
    property === "image/png"
  ) {
    return property;
  }
  return undefined;
}

function displayLabelFromIdentifier(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
