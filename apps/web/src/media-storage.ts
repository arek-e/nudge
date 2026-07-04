import { z } from "zod";

const mediaIdPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u;

export const mediaIdSchema = z
  .string()
  .regex(mediaIdPattern)
  .transform((id) => id.toLowerCase());

const mediaUploadSchema = z
  .object({
    byteLength: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024)
      .optional(),
    dataBase64: z.string().min(1),
    id: mediaIdSchema.optional(),
    kind: z.enum(["image", "voice"]),
    label: z.string().min(1).max(160),
    mimeType: z.enum(["audio/mp4", "image/jpeg", "image/png"]),
  })
  .strict();

export interface StoredMediaReference {
  readonly byteLength: number;
  readonly id: string;
  readonly kind: "image" | "voice";
  readonly label: string;
  readonly mimeType: "audio/mp4" | "image/jpeg" | "image/png";
  readonly url: string;
}

export type StoreMediaUploadResult =
  | {
      readonly media: StoredMediaReference;
      readonly ok: true;
    }
  | {
      readonly error: string;
      readonly ok: false;
      readonly status: 400 | 413;
    };

export function mediaObjectKey(userId: string, mediaId: string) {
  return `users/${storageSegment(userId)}/media/${mediaId}`;
}

export async function storeMediaUpload(input: {
  readonly bucket: R2Bucket;
  readonly payload: unknown;
  readonly userId: string;
}): Promise<StoreMediaUploadResult> {
  const parsed = mediaUploadSchema.safeParse(input.payload);
  if (!parsed.success) {
    return { error: "Invalid media upload", ok: false, status: 400 };
  }

  const bytes = decodeBase64(parsed.data.dataBase64);
  if (!bytes) {
    return { error: "Invalid media data", ok: false, status: 400 };
  }
  if (parsed.data.byteLength !== undefined && parsed.data.byteLength !== bytes.byteLength) {
    return { error: "Media byte length mismatch", ok: false, status: 400 };
  }

  const id = parsed.data.id ?? crypto.randomUUID();
  const key = mediaObjectKey(input.userId, id);
  await input.bucket.put(key, bytes, {
    customMetadata: {
      id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      userId: input.userId,
    },
    httpMetadata: { contentType: parsed.data.mimeType },
  });

  return {
    media: {
      byteLength: bytes.byteLength,
      id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      mimeType: parsed.data.mimeType,
      url: `/api/media/${id}`,
    },
    ok: true,
  };
}

function decodeBase64(value: string) {
  try {
    const binary = atob(value.trim());
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function storageSegment(value: string) {
  const safe = value.replaceAll(/[^A-Za-z0-9._-]/gu, "_").slice(0, 160);
  return safe.length > 0 ? safe : "user";
}
