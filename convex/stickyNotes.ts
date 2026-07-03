// oxlint-disable no-underscore-dangle -- Convex document ids are exposed as _id.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { notAuthenticatedError } from "./authPolicy";
import {
  applyStickyNotePatch,
  idempotencyConflict,
  sameMutationReplay,
  type ExistingMutationReceipt,
} from "./stickyNotePolicy";
import { ensureCurrentAppUser, findUserByExternalId } from "./users";
import { appUserProfileFromIdentity } from "./usersPolicy";

const agentStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("failed"),
);

const defaultStickyColor = "yellow";

const findMutationReceipt = async (
  ctx: MutationCtx,
  ownerId: Id<"users">,
  idempotencyKey: string,
) =>
  await ctx.db
    .query("stickyNoteMutations")
    .withIndex("by_owner_idempotency_key", (index) =>
      index.eq("ownerId", ownerId).eq("idempotencyKey", idempotencyKey),
    )
    .first();

const mutationReceiptFrom = (
  existing: Doc<"stickyNoteMutations"> | null,
): ExistingMutationReceipt | null =>
  existing ? { payloadHash: existing.payloadHash, status: "accepted" } : null;

const findOwnedNote = async (
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
  noteId: Id<"stickyNotes">,
) => {
  const note = await ctx.db.get(noteId);
  return note?.ownerId === ownerId ? note : null;
};

const findAgentStatuses = async (ctx: QueryCtx | MutationCtx, noteId: Id<"stickyNotes">) => {
  const statuses = await ctx.db
    .query("stickyNoteAgentStatuses")
    .withIndex("by_note", (index) => index.eq("noteId", noteId))
    .collect();
  return statuses.filter((status) => status.idempotencyKey !== undefined);
};

const findAgentStatus = async (
  ctx: QueryCtx | MutationCtx,
  noteId: Id<"stickyNotes">,
  idempotencyKey: string,
) =>
  await ctx.db
    .query("stickyNoteAgentStatuses")
    .withIndex("by_note_idempotency_key", (index) =>
      index.eq("noteId", noteId).eq("idempotencyKey", idempotencyKey),
    )
    .first();

const sortStickyNotes = (left: Doc<"stickyNotes">, right: Doc<"stickyNotes">) => {
  if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
  return right.updatedAt.localeCompare(left.updatedAt) || right.sortOrder - left.sortOrder;
};

export const list = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = appUserProfileFromIdentity(await ctx.auth.getUserIdentity());
    if (!profile) {
      return { auth: "unauthenticated", notes: [], user: null };
    }

    const user = await findUserByExternalId(ctx, profile.externalId);
    if (!user) {
      return { auth: "authenticated", notes: [], user: null };
    }

    const notes = await ctx.db
      .query("stickyNotes")
      .withIndex("by_owner_updated", (index) => index.eq("ownerId", user._id))
      .collect();
    const visibleNotes = notes
      .filter((note) => args.includeArchived === true || note.status === "active")
      .sort(sortStickyNotes)
      .slice(0, args.limit ?? 50);

    return { auth: "authenticated", notes: visibleNotes, user };
  },
});

export const create = mutation({
  args: {
    bodyDocument: v.optional(v.any()),
    bodyText: v.string(),
    color: v.optional(v.string()),
    idempotencyKey: v.string(),
    payloadHash: v.string(),
    pinned: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureCurrentAppUser(ctx);
    if (!user) {
      return {
        error: notAuthenticatedError(),
        ok: false,
      };
    }

    const existingMutation = await findMutationReceipt(ctx, user._id, args.idempotencyKey);
    const existingReceipt = mutationReceiptFrom(existingMutation);
    if (sameMutationReplay(existingReceipt, args.payloadHash)) {
      const note = existingMutation ? await ctx.db.get(existingMutation.noteId) : null;
      return {
        note,
        ok: true,
        replayed: true,
        status: existingMutation?.status ?? "accepted",
      };
    }

    if (existingReceipt) {
      return {
        error: idempotencyConflict(existingReceipt, args.payloadHash),
        ok: false,
      };
    }

    const now = new Date().toISOString();
    const applied = applyStickyNotePatch({
      existing: null,
      input: {
        bodyDocument: args.bodyDocument,
        bodyText: args.bodyText,
        color: args.color ?? defaultStickyColor,
        pinned: args.pinned ?? false,
        title: args.title,
      },
      now,
    });
    const noteId = await ctx.db.insert("stickyNotes", {
      bodyDocument: applied.bodyDocument,
      bodyText: applied.bodyText,
      color: applied.color,
      createdAt: now,
      ownerId: user._id,
      pinned: applied.pinned,
      serverRevision: applied.serverRevision,
      sortOrder: args.sortOrder ?? Date.parse(now),
      status: "active",
      title: applied.title,
      updatedAt: applied.updatedAt,
    });

    await ctx.db.insert("stickyNoteMutations", {
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
      noteId,
      ownerId: user._id,
      payloadHash: args.payloadHash,
      status: "accepted",
    });
    await ctx.db.insert("stickyNoteAgentStatuses", {
      idempotencyKey: args.idempotencyKey,
      noteId,
      status: "queued",
      updatedAt: now,
    });

    return {
      note: await ctx.db.get(noteId),
      ok: true,
      replayed: false,
      status: "accepted",
    };
  },
});

export const patch = mutation({
  args: {
    baseServerRevision: v.optional(v.string()),
    bodyDocument: v.optional(v.any()),
    bodyText: v.string(),
    color: v.optional(v.string()),
    idempotencyKey: v.string(),
    noteId: v.id("stickyNotes"),
    payloadHash: v.string(),
    pinned: v.optional(v.boolean()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureCurrentAppUser(ctx);
    if (!user) {
      return { error: notAuthenticatedError(), ok: false };
    }

    const existingMutation = await findMutationReceipt(ctx, user._id, args.idempotencyKey);
    const existingReceipt = mutationReceiptFrom(existingMutation);
    const existingNote = await findOwnedNote(ctx, user._id, args.noteId);

    if (sameMutationReplay(existingReceipt, args.payloadHash)) {
      return {
        note: existingNote,
        ok: true,
        replayed: true,
        status: existingMutation?.status ?? "accepted",
      };
    }

    if (existingReceipt) {
      return { error: idempotencyConflict(existingReceipt, args.payloadHash), ok: false };
    }

    if (!existingNote) {
      return { error: { code: "note_not_found" }, ok: false };
    }

    if (
      args.baseServerRevision !== undefined &&
      args.baseServerRevision !== existingNote.serverRevision
    ) {
      return {
        error: {
          code: "revision_conflict",
          serverRevision: existingNote.serverRevision,
        },
        note: existingNote,
        ok: false,
      };
    }

    const now = new Date().toISOString();
    const applied = applyStickyNotePatch({
      existing: {
        bodyDocument: existingNote.bodyDocument,
        bodyText: existingNote.bodyText,
        color: existingNote.color,
        pinned: existingNote.pinned,
        serverRevision: existingNote.serverRevision,
        title: existingNote.title,
      },
      input: {
        bodyDocument: args.bodyDocument ?? existingNote.bodyDocument,
        bodyText: args.bodyText,
        color: args.color ?? existingNote.color,
        pinned: args.pinned ?? existingNote.pinned,
        title: args.title ?? existingNote.title,
      },
      now,
    });

    await ctx.db.patch(existingNote._id, {
      bodyDocument: applied.bodyDocument,
      bodyText: applied.bodyText,
      color: applied.color,
      pinned: applied.pinned,
      serverRevision: applied.serverRevision,
      title: applied.title,
      updatedAt: applied.updatedAt,
    });
    await ctx.db.insert("stickyNoteMutations", {
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
      noteId: existingNote._id,
      ownerId: user._id,
      payloadHash: args.payloadHash,
      status: "accepted",
    });
    await ctx.db.insert("stickyNoteAgentStatuses", {
      idempotencyKey: args.idempotencyKey,
      noteId: existingNote._id,
      status: "queued",
      updatedAt: now,
    });

    return {
      note: await ctx.db.get(existingNote._id),
      ok: true,
      replayed: false,
      status: "accepted",
    };
  },
});

export const archive = mutation({
  args: {
    idempotencyKey: v.string(),
    noteId: v.id("stickyNotes"),
    payloadHash: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ensureCurrentAppUser(ctx);
    if (!user) {
      return { error: notAuthenticatedError(), ok: false };
    }

    const existingMutation = await findMutationReceipt(ctx, user._id, args.idempotencyKey);
    const existingReceipt = mutationReceiptFrom(existingMutation);
    const existingNote = await findOwnedNote(ctx, user._id, args.noteId);

    if (sameMutationReplay(existingReceipt, args.payloadHash)) {
      return {
        note: existingNote,
        ok: true,
        replayed: true,
        status: existingMutation?.status ?? "accepted",
      };
    }

    if (existingReceipt) {
      return { error: idempotencyConflict(existingReceipt, args.payloadHash), ok: false };
    }

    if (!existingNote) {
      return { error: { code: "note_not_found" }, ok: false };
    }

    const now = new Date().toISOString();
    const nextRevision = Number(existingNote.serverRevision) + 1;
    await ctx.db.patch(existingNote._id, {
      serverRevision: String(Number.isFinite(nextRevision) ? nextRevision : 1),
      status: "archived",
      updatedAt: now,
    });
    await ctx.db.insert("stickyNoteMutations", {
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
      noteId: existingNote._id,
      ownerId: user._id,
      payloadHash: args.payloadHash,
      status: "accepted",
    });

    return {
      note: await ctx.db.get(existingNote._id),
      ok: true,
      replayed: false,
      status: "accepted",
    };
  },
});

export const setAgentStatus = mutation({
  args: {
    errorCode: v.optional(v.string()),
    idempotencyKey: v.string(),
    noteId: v.id("stickyNotes"),
    status: agentStatus,
  },
  handler: async (ctx, args) => {
    const user = await ensureCurrentAppUser(ctx);
    if (!user) {
      return { error: notAuthenticatedError(), ok: false };
    }

    const note = await findOwnedNote(ctx, user._id, args.noteId);
    if (!note) {
      return { error: { code: "note_not_found" }, ok: false };
    }
    const mutationReceipt = await findMutationReceipt(ctx, user._id, args.idempotencyKey);
    if (!mutationReceipt) {
      return { error: { code: "mutation_not_found" }, ok: false };
    }
    if (mutationReceipt.noteId !== note._id) {
      return { error: { code: "mutation_note_mismatch" }, ok: false };
    }

    const now = new Date().toISOString();
    const existing = await findAgentStatus(ctx, note._id, args.idempotencyKey);
    const values = {
      idempotencyKey: args.idempotencyKey,
      status: args.status,
      updatedAt: now,
      ...(args.errorCode !== undefined ? { errorCode: args.errorCode } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, values);
    } else {
      await ctx.db.insert("stickyNoteAgentStatuses", {
        noteId: note._id,
        ...values,
      });
    }

    return {
      ok: true,
      status: await findAgentStatus(ctx, note._id, args.idempotencyKey),
      statuses: await findAgentStatuses(ctx, note._id),
    };
  },
});
