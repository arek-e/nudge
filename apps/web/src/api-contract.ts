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

export const journalDocumentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  localDate: z.string(),
  title: z.string(),
  bodyText: z.string(),
  bodyDocument: z.unknown().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const journalRevisionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  bodyText: z.string(),
  changedText: z.string(),
  diffSummary: z.string(),
  createdAt: z.string(),
});

const memorySourceTypeSchema = z.enum([
  "daily_note",
  "note_revision",
  "extracted_item",
  "summary",
  "journal_document",
  "journal_revision",
  "signal",
  "proposal",
  "commitment",
]);

export const memoryDocumentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceType: memorySourceTypeSchema,
  sourceId: z.string(),
  title: z.string(),
  bodyText: z.string(),
  localDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const memoryChunkSchema = z.object({
  id: z.string(),
  userId: z.string(),
  memoryDocumentId: z.string(),
  sourceType: memorySourceTypeSchema,
  sourceId: z.string(),
  chunkText: z.string(),
  chunkHash: z.string(),
  chunkIndex: z.number().int(),
  indexedAt: z.string().optional(),
  createdAt: z.string(),
});

export const memoryIndexJobSchema = z.object({
  id: z.string(),
  userId: z.string(),
  memoryChunkId: z.string(),
  sourceType: memorySourceTypeSchema,
  sourceId: z.string(),
  status: z.enum(["pending", "indexed", "failed"]),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const memoryRetrievalEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  query: z.string(),
  resultChunkIds: z.array(z.string()),
  source: z.string(),
  createdAt: z.string(),
});

export const dailyNoteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  localDate: z.string(),
  title: z.string(),
  bodyText: z.string(),
  bodyDocument: z.unknown().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const noteRevisionSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  userId: z.string(),
  revisionNumber: z.number().int(),
  bodyText: z.string(),
  changedText: z.string(),
  changeHash: z.string(),
  createdAt: z.string(),
  processedAt: z.string().optional(),
});

export const extractedItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceRevisionId: z.string(),
  sourceNoteId: z.string(),
  kind: z.enum(["task", "reminder", "follow_up", "event", "memory", "question", "idea"]),
  title: z.string(),
  body: z.string(),
  status: z.enum(["proposed", "accepted", "dismissed", "completed", "archived"]),
  dueAt: z.string().optional(),
  remindAt: z.string().optional(),
  eventStartsAt: z.string().optional(),
  eventEndsAt: z.string().optional(),
  confidence: z.number(),
  dedupeKey: z.string(),
  metadata: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const itemEventSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  userId: z.string(),
  eventType: z.enum([
    "created",
    "accepted",
    "edited",
    "dismissed",
    "completed",
    "snoozed",
    "archived",
  ]),
  payload: z.unknown(),
  createdAt: z.string(),
});

export const summaryDocumentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  periodType: z.enum(["day", "week", "month", "quarter", "year", "custom"]),
  periodStart: z.string(),
  periodEnd: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.enum(["draft", "ready", "superseded"]),
  generatedAt: z.string(),
  sourceNoteIds: z.array(z.string()),
  sourceItemIds: z.array(z.string()),
  metadata: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const agentRunSchema = z.object({
  id: z.string(),
  userId: z.string(),
  triggerType: z.enum(["note_inactivity", "manual", "end_of_day", "end_of_week", "backfill"]),
  sourceType: z.string(),
  sourceId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  model: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  errorCode: z.string().optional(),
  metadata: z.unknown(),
});

export const agentRunOutputSchema = z.object({
  id: z.string(),
  runId: z.string(),
  outputType: z.enum(["extracted_item", "summary", "memory_document"]),
  outputId: z.string(),
  createdAt: z.string(),
});

const extractedItemListInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["proposed", "accepted", "dismissed", "completed", "archived"]).optional(),
});

const extractedItemStatusInputSchema = z.object({
  itemId: z.string(),
  status: z.enum(["proposed", "accepted", "dismissed", "completed", "archived"]),
});

const summaryListInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  periodType: z.enum(["day", "week", "month", "quarter", "year", "custom"]).optional(),
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
  tool: z.enum(["listRecentSignals", "retrieveMemory", "reply"]),
});

export const conversationToolSchema = z.enum(["listRecentSignals", "retrieveMemory"]);

export const conversationMetadataSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  recentToolEvents: z.array(conversationToolEventSchema),
  reasoningHarness: z.object({
    name: z.literal("think"),
    runtime: z.literal("cloudflare-agents"),
  }),
  skills: z.array(z.enum(["intake-loop", "review-commitment", "close-loop"])),
  subAgents: z.array(z.enum(["loopIntakeThink"])),
  tools: z.array(conversationToolSchema),
  workflows: z.array(z.enum(["dailyDigest"])),
});

export const listRecentSignalsToolResponseSchema = z.object({
  conversationId: z.string(),
  tool: z.literal("listRecentSignals"),
  signals: z.array(eventRecordSchema),
});

export const retrieveMemoryToolResponseSchema = z.object({
  conversationId: z.string(),
  tool: z.literal("retrieveMemory"),
  results: z.array(
    z.object({
      chunkId: z.string(),
      score: z.number(),
      sourceId: z.string(),
      sourceType: memorySourceTypeSchema,
      text: z.string(),
    }),
  ),
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
  memoryResults: z.array(
    z.object({
      chunkId: z.string(),
      score: z.number(),
      sourceId: z.string(),
      sourceType: memorySourceTypeSchema,
      text: z.string(),
    }),
  ),
  reasoningHarness: z.object({
    name: z.literal("think"),
    runtime: z.literal("cloudflare-agents"),
  }),
  reply: z.string(),
  skillsApplied: z.array(z.enum(["intake-loop"])),
  subAgentsUsed: z.array(z.enum(["loopIntakeThink"])),
  usedTools: z.array(
    z.enum(["appendSignal", "createSynthesis", "generateProposals", "retrieveMemory"]),
  ),
  workflowHooks: z.array(z.enum(["dailyDigest"])),
});

export const sessionResponseSchema = z.object({
  authMethods: z.object({
    emailMagicLink: z.boolean(),
    google: z.boolean(),
  }),
  authMode: z.enum(["better-auth", "dev", "unauthenticated"]),
  user: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  workspace: z.object({ id: z.string(), label: z.string() }).nullable(),
});

export const dataExportResponseSchema = z.object({
  agentRunOutputs: z.array(agentRunOutputSchema),
  agentRuns: z.array(agentRunSchema),
  user: z.object({ id: z.string(), displayName: z.string() }),
  commitments: z.array(commitmentRecordSchema),
  dailyNotes: z.array(dailyNoteSchema),
  events: z.array(eventRecordSchema),
  extractedItems: z.array(extractedItemSchema),
  frames: z.array(frameRecordSchema),
  itemEvents: z.array(itemEventSchema),
  journalDocuments: z.array(journalDocumentSchema),
  journalRevisions: z.array(journalRevisionSchema),
  memoryChunks: z.array(memoryChunkSchema),
  memoryDocuments: z.array(memoryDocumentSchema),
  memoryIndexJobs: z.array(memoryIndexJobSchema),
  memoryRetrievalEvents: z.array(memoryRetrievalEventSchema),
  noteRevisions: z.array(noteRevisionSchema),
  outcomes: z.array(outcomeRecordSchema),
  proposals: z.array(proposalRecordSchema),
  reviews: z.array(reviewRecordSchema),
  summaryDocuments: z.array(summaryDocumentSchema),
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
const journalInputSchema = z.object({
  bodyDocument: z.unknown().optional(),
  bodyText: z.string().max(100_000),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
});
const journalGetInputSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
const conversationMemoryInputSchema = conversationInputSchema.extend({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  query: z.string().min(1).max(1_000),
});
const conversationMessageRouteInputSchema = conversationInputSchema.extend(
  conversationMessageInputSchema.shape,
);

export const apiContract = {
  actions: {
    list: oc
      .route({ method: "GET", path: "/actions" })
      .input(extractedItemListInputSchema)
      .output(
        z.object({ actions: z.array(extractedItemSchema), latestRun: agentRunSchema.optional() }),
      ),
    updateStatus: oc
      .route({ method: "POST", path: "/actions/{itemId}/status" })
      .input(extractedItemStatusInputSchema)
      .output(z.object({ action: extractedItemSchema })),
  },
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
    retrieveMemory: oc
      .route({
        method: "GET",
        path: "/conversations/{conversationId}/tools/retrieve-memory",
      })
      .input(conversationMemoryInputSchema)
      .output(retrieveMemoryToolResponseSchema),
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
  journal: {
    get: oc
      .route({ method: "GET", path: "/journal/{localDate}" })
      .input(journalGetInputSchema)
      .output(z.object({ document: journalDocumentSchema.nullable() })),
    save: oc
      .route({ method: "POST", path: "/journal" })
      .input(journalInputSchema)
      .output(z.object({ document: journalDocumentSchema, revision: journalRevisionSchema })),
  },
  signals: {
    list: oc
      .route({ method: "GET", path: "/signals" })
      .input(eventListInputSchema)
      .output(z.object({ signals: z.array(eventRecordSchema) })),
  },
  session: oc.route({ method: "GET", path: "/session" }).output(sessionResponseSchema),
  summaries: {
    list: oc
      .route({ method: "GET", path: "/summaries" })
      .input(summaryListInputSchema)
      .output(z.object({ summaries: z.array(summaryDocumentSchema) })),
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
