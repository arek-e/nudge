import { z } from "zod";

const mediaIdPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u;
const maxMediaBytes = 25 * 1024 * 1024;
const maxMediaBase64Length = Math.ceil(maxMediaBytes / 3) * 4;

export const mediaIdSchema = z
  .string()
  .regex(mediaIdPattern)
  .transform((id) => id.toLowerCase());

const mediaUploadSchema = z
  .object({
    byteLength: z.number().int().positive().max(maxMediaBytes).optional(),
    dataBase64: z.string().min(1),
    id: mediaIdSchema.optional(),
    kind: z.enum(["image", "voice"]),
    label: z.string().min(1).max(160),
    mimeType: z.enum(["audio/mp4", "audio/webm", "image/jpeg", "image/png"]),
  })
  .strict();

export interface StoredMediaReference {
  readonly byteLength: number;
  readonly id: string;
  readonly kind: "image" | "voice";
  readonly label: string;
  readonly mimeType: "audio/mp4" | "audio/webm" | "image/jpeg" | "image/png";
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
  return `${mediaObjectPrefix(userId)}${mediaId}`;
}

export function mediaObjectPrefix(userId: string) {
  return `users/${storageSegment(userId)}/media/`;
}

export async function deleteUserMedia(input: {
  readonly bucket: R2Bucket;
  readonly userId: string;
}) {
  const prefix = mediaObjectPrefix(input.userId);
  let cursor: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop -- R2 pagination is cursor-dependent.
    const page = await input.bucket.list({ ...(cursor ? { cursor } : {}), prefix });
    const keys = page.objects.map((object) => object.key);
    if (keys.length > 0) {
      // eslint-disable-next-line no-await-in-loop -- delete each listed page before advancing.
      await input.bucket.delete(keys);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export async function storeMediaUpload(input: {
  readonly bucket: R2Bucket;
  readonly payload: unknown;
  readonly userId: string;
}): Promise<StoreMediaUploadResult> {
  const base64Length = mediaBase64Length(input.payload);
  if (base64Length !== null && base64Length > maxMediaBase64Length) {
    return { error: "Media too large", ok: false, status: 413 };
  }

  const parsed = mediaUploadSchema.safeParse(input.payload);
  if (!parsed.success) {
    return { error: "Invalid media upload", ok: false, status: 400 };
  }

  const bytes = decodeBase64(parsed.data.dataBase64);
  if (!bytes) {
    return { error: "Invalid media data", ok: false, status: 400 };
  }
  if (bytes.byteLength > maxMediaBytes) {
    return { error: "Media too large", ok: false, status: 413 };
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

function mediaBase64Length(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const dataBase64 = Reflect.get(payload, "dataBase64");
  return typeof dataBase64 === "string" ? dataBase64.trim().length : null;
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
