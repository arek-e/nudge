import { describe, expect, test } from "bun:test";
import {
  normalizeWebMediaMimeType,
  preferredBrowserVoiceMimeType,
  webMediaAttachmentDraft,
} from "./browser-media";

describe("browser media capture", () => {
  test("prefers the Chromium voice recording MIME type", () => {
    const mimeType = preferredBrowserVoiceMimeType((candidate) => candidate === "audio/webm");

    expect(mimeType).toBe("audio/webm");
  });

  test("falls back to MP4 voice recording when WebM is unavailable", () => {
    const mimeType = preferredBrowserVoiceMimeType((candidate) => candidate === "audio/mp4");

    expect(mimeType).toBe("audio/mp4");
  });

  test("normalizes browser recorder MIME strings before upload", () => {
    expect(normalizeWebMediaMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeWebMediaMimeType("audio/mp4;codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(normalizeWebMediaMimeType("image/png")).toBe("image/png");
    expect(normalizeWebMediaMimeType("audio/ogg")).toBeNull();
  });

  test("creates a voice attachment draft from recorded browser media", () => {
    expect(
      webMediaAttachmentDraft({
        dataURL: "data:audio/webm;base64,dm9pY2U=",
        id: "voice-1",
        kind: "voice",
        label: "Voice recording",
        mimeType: "audio/webm;codecs=opus",
        presentationKind: "voice",
      }),
    ).toEqual({
      dataURL: "data:audio/webm;base64,dm9pY2U=",
      id: "voice-1",
      kind: "voice",
      label: "Voice recording",
      mimeType: "audio/webm",
      presentationKind: "voice",
    });
  });
});
