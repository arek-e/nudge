import type { WebMediaAttachmentDraft, WebMediaKind, WebMediaMimeType } from "./web-capture";

export type WebVoiceMimeType = "audio/mp4" | "audio/webm";

export interface BrowserMediaAttachmentInput {
  readonly dataURL: string;
  readonly id: string;
  readonly kind: WebMediaKind;
  readonly label: string;
  readonly mimeType: string;
  readonly presentationKind?: "drawing" | "photo" | "voice";
}

const browserVoiceMimeTypes: ReadonlyArray<WebVoiceMimeType> = ["audio/webm", "audio/mp4"];

export function preferredBrowserVoiceMimeType(
  isTypeSupported: (mimeType: WebVoiceMimeType) => boolean = browserMediaRecorderSupports,
) {
  for (const mimeType of browserVoiceMimeTypes) {
    if (isTypeSupported(mimeType)) return mimeType;
  }
  return null;
}

export function normalizeWebMediaMimeType(value: string): WebMediaMimeType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "image/jpeg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  if (normalized === "audio/mp4" || normalized.startsWith("audio/mp4;")) return "audio/mp4";
  if (normalized === "audio/webm" || normalized.startsWith("audio/webm;")) return "audio/webm";
  return null;
}

export function webMediaAttachmentDraft(
  input: BrowserMediaAttachmentInput,
): WebMediaAttachmentDraft | null {
  const mimeType = normalizeWebMediaMimeType(input.mimeType);
  if (!mimeType) return null;
  return {
    dataURL: input.dataURL,
    id: input.id,
    kind: input.kind,
    label: input.label,
    mimeType,
    ...(input.presentationKind !== undefined ? { presentationKind: input.presentationKind } : {}),
  };
}

function browserMediaRecorderSupports(mimeType: WebVoiceMimeType) {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType);
}
