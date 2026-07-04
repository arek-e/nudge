// oxlint-disable no-underscore-dangle -- Convex document ids are exposed as _id.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { notAuthenticatedError } from "./authPolicy";
import {
  applyDailyNotePatch,
  idempotencyConflict,
  sameMutationReplay,
  type ExistingMutationReceipt,
} from "./spikePolicy";
import { ensureCurrentAppUser, findUserByExternalId } from "./users";
import { appUserProfileFromIdentity } from "./usersPolicy";

const agentStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("failed"),
);

const findDailyNote = async (
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
  localDate: string,
) =>
  await ctx.db
    .query("documents")
    .withIndex("by_owner_local_date", (index) =>
      index.eq("ownerId", ownerId).eq("localDate", localDate),
    )
    .first();

const findAgentStatuses = async (ctx: QueryCtx | MutationCtx, documentId: Id<"documents">) => {
  const statuses = await ctx.db
    .query("agentStatuses")
    .withIndex("by_document", (index) => index.eq("documentId", documentId))
    .collect();
  return statuses.filter((status) => status.idempotencyKey !== undefined);
};

const findAgentStatus = async (
  ctx: QueryCtx | MutationCtx,
  documentId: Id<"documents">,
  idempotencyKey: string,
) =>
  await ctx.db
    .query("agentStatuses")
    .withIndex("by_document_idempotency_key", (index) =>
      index.eq("documentId", documentId).eq("idempotencyKey", idempotencyKey),
    )
    .first();

const findMutationReceipt = async (
  ctx: MutationCtx,
  ownerId: Id<"users">,
  idempotencyKey: string,
) =>
  await ctx.db
    .query("documentMutations")
    .withIndex("by_owner_idempotency_key", (index) =>
      index.eq("ownerId", ownerId).eq("idempotencyKey", idempotencyKey),
    )
    .first();

const mutationReceiptFrom = (
  existing: Doc<"documentMutations"> | null,
): ExistingMutationReceipt | null =>
  existing ? { payloadHash: existing.payloadHash, status: "accepted" } : null;

export const getDailyNote = query({
  args: {
    localDate: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = appUserProfileFromIdentity(await ctx.auth.getUserIdentity());
    if (!profile) {
      return { auth: "unauthenticated", document: null, status: null, statuses: [] };
    }

    const user = await findUserByExternalId(ctx, profile.externalId);
    if (!user) {
      return { auth: "authenticated", document: null, status: null, statuses: [], user: null };
    }

    const document = await findDailyNote(ctx, user._id, args.localDate);
    const statuses = document ? await findAgentStatuses(ctx, document._id) : [];
    const latestStatus = statuses.slice(-1)[0] ?? null;
    return { auth: "authenticated", document, status: latestStatus, statuses, user };
  },
});

export const patchDailyNote = mutation({
  args: {
    baseServerRevision: v.optional(v.string()),
    bodyDocument: v.optional(v.any()),
    bodyText: v.string(),
    idempotencyKey: v.string(),
    localDate: v.string(),
    payloadHash: v.string(),
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
    const existingDocument = await findDailyNote(ctx, user._id, args.localDate);

    if (sameMutationReplay(existingReceipt, args.payloadHash)) {
      return {
        document: existingDocument,
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

    if (
      existingDocument &&
      args.baseServerRevision !== undefined &&
      args.baseServerRevision !== existingDocument.serverRevision
    ) {
      return {
        document: existingDocument,
        error: {
          code: "revision_conflict",
          serverRevision: existingDocument.serverRevision,
        },
        ok: false,
      };
    }

    const now = new Date().toISOString();
    const applied = applyDailyNotePatch({
      existing: existingDocument
        ? {
            bodyDocument: existingDocument.bodyDocument,
            bodyText: existingDocument.bodyText,
            serverRevision: existingDocument.serverRevision,
            title: existingDocument.title,
          }
        : null,
      input: {
        bodyDocument: args.bodyDocument,
        bodyText: args.bodyText,
        title: args.title,
      },
      now,
    });

    const documentId = existingDocument
      ? existingDocument._id
      : await ctx.db.insert("documents", {
          bodyDocument: applied.bodyDocument,
          bodyText: applied.bodyText,
          localDate: args.localDate,
          serverRevision: applied.serverRevision,
          title: applied.title,
          updatedAt: applied.updatedAt,
          ownerId: user._id,
        });

    if (existingDocument) {
      await ctx.db.patch(documentId, {
        bodyDocument: applied.bodyDocument,
        bodyText: applied.bodyText,
        serverRevision: applied.serverRevision,
        title: applied.title,
        updatedAt: applied.updatedAt,
      });
    }

    await ctx.db.insert("documentMutations", {
      createdAt: now,
      documentId,
      idempotencyKey: args.idempotencyKey,
      ownerId: user._id,
      payloadHash: args.payloadHash,
      status: "accepted",
    });

    await ctx.db.insert("agentStatuses", {
      documentId,
      idempotencyKey: args.idempotencyKey,
      status: "queued",
      updatedAt: now,
    });

    const document = await ctx.db.get(documentId);
    return { document, ok: true, replayed: false, status: "accepted" };
  },
});

export const setAgentStatus = mutation({
  args: {
    errorCode: v.optional(v.string()),
    idempotencyKey: v.string(),
    localDate: v.string(),
    status: agentStatus,
  },
  handler: async (ctx, args) => {
    const user = await ensureCurrentAppUser(ctx);
    if (!user) {
      return { error: notAuthenticatedError(), ok: false };
    }

    const document = await findDailyNote(ctx, user._id, args.localDate);
    if (!document) {
      return { error: { code: "document_not_found" }, ok: false };
    }
    const mutationReceipt = await findMutationReceipt(ctx, user._id, args.idempotencyKey);
    if (!mutationReceipt) {
      return { error: { code: "mutation_not_found" }, ok: false };
    }
    if (mutationReceipt.documentId !== document._id) {
      return { error: { code: "mutation_document_mismatch" }, ok: false };
    }

    const now = new Date().toISOString();
    const existing = await findAgentStatus(ctx, document._id, args.idempotencyKey);
    const values = {
      idempotencyKey: args.idempotencyKey,
      status: args.status,
      updatedAt: now,
      ...(args.errorCode !== undefined ? { errorCode: args.errorCode } : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, values);
    } else {
      await ctx.db.insert("agentStatuses", {
        documentId: document._id,
        ...values,
      });
    }

    return {
      ok: true,
      status: await findAgentStatus(ctx, document._id, args.idempotencyKey),
    };
  },
});
