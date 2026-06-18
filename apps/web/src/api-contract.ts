import { oc } from "@orpc/contract";
import { z } from "zod";

export const eventRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  source: z.string(),
  occurredAt: z.string(),
  schemaVersion: z.number().int(),
  idempotencyKey: z.string().optional(),
  payload: z.unknown(),
  createdAt: z.string(),
});

export const eventInputSchema = z.object({
  type: z.string().min(1),
  source: z.string().min(1),
  occurredAt: z.string().datetime(),
  schemaVersion: z.number().int().min(1),
  idempotencyKey: z.string().min(1).max(256).optional(),
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
  editedBodyDocument: z.unknown().optional(),
  createdAt: z.string(),
});

export const commitmentRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  proposalId: z.string(),
  reviewId: z.string(),
  title: z.string(),
  body: z.string(),
  bodyDocument: z.unknown().optional(),
  status: z.enum(["active", "completed", "abandoned"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const outcomeRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  commitmentId: z.string(),
  result: z.enum(["completed", "abandoned"]),
  note: z.string().optional(),
  recordedAt: z.string(),
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
  tool: z.enum(["listRecentSignals", "reply"]),
});

export const conversationMetadataSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  recentToolEvents: z.array(conversationToolEventSchema),
  skills: z.array(z.enum(["intake-loop", "review-commitment", "close-loop"])),
  subAgents: z.array(z.enum(["loopIntake"])),
  tools: z.array(z.literal("listRecentSignals")),
  workflows: z.array(z.enum(["dailyDigest"])),
});

export const listRecentSignalsToolResponseSchema = z.object({
  conversationId: z.string(),
  tool: z.literal("listRecentSignals"),
  signals: z.array(eventRecordSchema),
});

export const conversationMessageInputSchema = z.object({
  message: z.string().min(1).max(4_000),
});

export const conversationMessageResponseSchema = z.object({
  conversationId: z.string(),
  draft: z
    .object({
      confidence: z.number().min(0).max(1),
      proposal: proposalRecordSchema,
      requiresReview: z.literal(true),
      signal: eventRecordSchema,
    })
    .nullable(),
  message: z.string(),
  reply: z.string(),
  skillsApplied: z.array(z.enum(["intake-loop"])),
  subAgentsUsed: z.array(z.enum(["loopIntake"])),
  usedTools: z.array(z.enum(["appendSignal", "createSynthesis", "generateProposals"])),
  workflowHooks: z.array(z.enum(["dailyDigest"])),
});

export const sessionResponseSchema = z.object({
  authMode: z.enum(["better-auth", "dev", "unauthenticated"]),
  user: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  workspace: z.object({ id: z.string(), label: z.string() }).nullable(),
});

export const dataExportResponseSchema = z.object({
  user: z.object({ id: z.string(), displayName: z.string() }),
  commitments: z.array(commitmentRecordSchema),
  events: z.array(eventRecordSchema),
  frames: z.array(frameRecordSchema),
  outcomes: z.array(outcomeRecordSchema),
  proposals: z.array(proposalRecordSchema),
  reviews: z.array(reviewRecordSchema),
  syntheses: z.array(synthesisRecordSchema),
});

export const accountDeleteResponseSchema = z.object({ deleted: z.literal(true) });

const synthesisInputSchema = z.object({ frameKey: z.string().default("current_state") });
const proposalsInputSchema = z.object({ frameKey: z.string().default("current_state") });
const reviewInputSchema = z.object({
  proposalId: z.string(),
  decision: z.enum(["accepted", "edited", "rejected"]),
  editedTitle: z.string().optional(),
  editedBody: z.string().optional(),
  editedBodyDocument: z.unknown().optional(),
});
const commitmentsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const outcomeInputSchema = z.object({
  commitmentId: z.string(),
  result: z.enum(["completed", "abandoned"]),
  note: z.string().optional(),
});
const outcomesInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const conversationInputSchema = z.object({
  conversationId: z.string().min(1).max(128),
});
const conversationSignalsInputSchema = conversationInputSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
const conversationMessageRouteInputSchema = conversationInputSchema.extend(
  conversationMessageInputSchema.shape,
);

export const apiContract = {
  account: {
    delete: oc
      .route({ method: "POST", path: "/account/delete" })
      .output(accountDeleteResponseSchema),
  },
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
    sendMessage: oc
      .route({ method: "POST", path: "/conversations/{conversationId}/messages" })
      .input(conversationMessageRouteInputSchema)
      .output(conversationMessageResponseSchema),
  },
  captures: {
    append: oc
      .route({ method: "POST", path: "/captures" })
      .input(eventInputSchema)
      .output(eventRecordSchema),
  },
  dataExport: oc.route({ method: "GET", path: "/export" }).output(dataExportResponseSchema),
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
  session: oc.route({ method: "GET", path: "/session" }).output(sessionResponseSchema),
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
  commitments: {
    list: oc
      .route({ method: "GET", path: "/commitments" })
      .input(commitmentsInputSchema)
      .output(z.object({ commitments: z.array(commitmentRecordSchema) })),
  },
  reviews: {
    create: oc
      .route({ method: "POST", path: "/reviews" })
      .input(reviewInputSchema)
      .output(reviewRecordSchema),
  },
  outcomes: {
    list: oc
      .route({ method: "GET", path: "/outcomes" })
      .input(outcomesInputSchema)
      .output(z.object({ outcomes: z.array(outcomeRecordSchema) })),
    create: oc
      .route({ method: "POST", path: "/outcomes" })
      .input(outcomeInputSchema)
      .output(outcomeRecordSchema),
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
