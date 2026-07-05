import { describe, expect, test } from "bun:test";
import { storeMediaUpload } from "./media-storage";

describe("media storage", () => {
  test("rejects oversized base64 uploads before writing to R2", async () => {
    const bucket = {
      put: async () => {
        throw new Error("oversized media should not be written");
      },
    } as R2Bucket;

    const result = await storeMediaUpload({
      bucket,
      payload: {
        dataBase64: "A".repeat(Math.ceil((25 * 1024 * 1024) / 3) * 4 + 1),
        kind: "image",
        label: "oversized",
        mimeType: "image/png",
      },
      userId: "user-a",
    });

    expect(result).toEqual({ error: "Media too large", ok: false, status: 413 });
  });
});
