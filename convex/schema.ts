import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const agentStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("failed"),
);

export default defineSchema({
  agentStatuses: defineTable({
    documentId: v.id("documents"),
    errorCode: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    status: agentStatus,
    updatedAt: v.string(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_idempotency_key", ["documentId", "idempotencyKey"]),
  documentMutations: defineTable({
    createdAt: v.string(),
    documentId: v.id("documents"),
    idempotencyKey: v.string(),
    ownerId: v.id("users"),
    payloadHash: v.string(),
    status: v.literal("accepted"),
  }).index("by_owner_idempotency_key", ["ownerId", "idempotencyKey"]),
  documents: defineTable({
    bodyDocument: v.optional(v.any()),
    bodyText: v.string(),
    localDate: v.string(),
    ownerId: v.id("users"),
    serverRevision: v.string(),
    title: v.string(),
    updatedAt: v.string(),
  }).index("by_owner_local_date", ["ownerId", "localDate"]),
  users: defineTable({
    createdAt: v.string(),
    email: v.optional(v.string()),
    externalId: v.string(),
    imageUrl: v.optional(v.string()),
    name: v.optional(v.string()),
    updatedAt: v.string(),
  }).index("by_external_id", ["externalId"]),
});
