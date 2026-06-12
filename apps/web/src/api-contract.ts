import { oc } from "@orpc/contract";
import { z } from "zod";

export const eventRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  source: z.string(),
  occurredAt: z.string(),
  schemaVersion: z.number().int(),
  payload: z.unknown(),
  createdAt: z.string(),
});

export const eventInputSchema = z.object({
  type: z.string().min(1),
  source: z.string().min(1),
  occurredAt: z.string().datetime(),
  schemaVersion: z.number().int().min(1),
  payload: z.unknown(),
});

export const eventListInputSchema = z.object({
  from: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  to: z.string().datetime().optional(),
});

export const frameRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  key: z.string(),
  title: z.string(),
  prompt: z.string(),
  status: z.literal("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const synthesisRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  frameId: z.string(),
  summary: z.string(),
  themes: z.array(z.string()),
  openQuestions: z.array(z.string()),
  sourceSignalIds: z.array(z.string()),
  generatedAt: z.string(),
  createdAt: z.string(),
});

export const synthesisResponseSchema = z.object({
  frame: frameRecordSchema,
  synthesis: synthesisRecordSchema,
});

export const proposalRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  synthesisId: z.string(),
  kind: z.enum(["clarify", "follow_up", "commit", "ignore"]),
  status: z.enum(["pending", "accepted", "edited", "rejected"]),
  title: z.string(),
  body: z.string(),
  rationale: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reviewRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  proposalId: z.string(),
  decision: z.enum(["accepted", "edited", "rejected"]),
  editedTitle: z.string().optional(),
  editedBody: z.string().optional(),
  createdAt: z.string(),
});

export const traceSpanSummarySchema = z.object({
  id: z.string(),
  traceId: z.string(),
  parentSpanId: z.string().nullable(),
  name: z.string(),
  kind: z.string(),
  status: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationMs: z.number().nullable(),
  routeName: z.string().nullable(),
  method: z.string().nullable(),
  path: z.string().nullable(),
});

export const conversationToolEventSchema = z.object({
  at: z.string(),
  resultCount: z.number().int().min(0),
  tool: z.literal("listRecentSignals"),
});

export const conversationMetadataSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  recentToolEvents: z.array(conversationToolEventSchema),
  tools: z.array(z.literal("listRecentSignals")),
});

export const listRecentSignalsToolResponseSchema = z.object({
  conversationId: z.string(),
  tool: z.literal("listRecentSignals"),
  signals: z.array(eventRecordSchema),
});

const synthesisInputSchema = z.object({ frameKey: z.string().default("current_state") });
const proposalsInputSchema = z.object({ frameKey: z.string().default("current_state") });
const reviewInputSchema = z.object({
  proposalId: z.string(),
  decision: z.enum(["accepted", "edited", "rejected"]),
  editedTitle: z.string().optional(),
  editedBody: z.string().optional(),
});
const conversationInputSchema = z.object({
  conversationId: z.string().min(1).max(128),
});
const conversationSignalsInputSchema = conversationInputSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const apiContract = {
  conversations: {
    get: oc
      .route({ method: "GET", path: "/conversations/{conversationId}" })
      .input(conversationInputSchema)
      .output(conversationMetadataSchema),
    listRecentSignals: oc
      .route({
        method: "GET",
        path: "/conversations/{conversationId}/tools/list-recent-signals",
      })
      .input(conversationSignalsInputSchema)
      .output(listRecentSignalsToolResponseSchema),
  },
  captures: {
    append: oc
      .route({ method: "POST", path: "/captures" })
      .input(eventInputSchema)
      .output(eventRecordSchema),
  },
  events: {
    append: oc
      .route({ method: "POST", path: "/events" })
      .input(eventInputSchema)
      .output(eventRecordSchema),
    list: oc
      .route({ method: "GET", path: "/events" })
      .input(eventListInputSchema)
      .output(z.object({ events: z.array(eventRecordSchema) })),
  },
  signals: {
    list: oc
      .route({ method: "GET", path: "/signals" })
      .input(eventListInputSchema)
      .output(z.object({ signals: z.array(eventRecordSchema) })),
  },
  proposals: {
    generate: oc
      .route({ method: "POST", path: "/proposals/generate" })
      .input(proposalsInputSchema)
      .output(z.object({ proposals: z.array(proposalRecordSchema) })),
    list: oc
      .route({ method: "GET", path: "/proposals" })
      .input(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }))
      .output(z.object({ proposals: z.array(proposalRecordSchema) })),
  },
  reviews: {
    create: oc
      .route({ method: "POST", path: "/reviews" })
      .input(reviewInputSchema)
      .output(reviewRecordSchema),
  },
  syntheses: {
    create: oc
      .route({ method: "POST", path: "/syntheses" })
      .input(synthesisInputSchema)
      .output(synthesisResponseSchema),
    latest: oc
      .route({ method: "GET", path: "/syntheses/latest" })
      .input(synthesisInputSchema)
      .output(synthesisResponseSchema),
  },
  traces: {
    recent: oc
      .route({ method: "GET", path: "/traces/recent" })
      .input(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }))
      .output(z.object({ spans: z.array(traceSpanSummarySchema) })),
  },
};
