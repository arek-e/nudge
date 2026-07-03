export type AppSurface = "web" | "desktop" | "raycast" | "ios";

export interface SurfaceIdentityStorage {
  readonly getItem: (key: string) => string | null | undefined;
  readonly setItem: (key: string, value: string) => void;
}

export interface BuildSurfaceIdentityHeadersInput {
  readonly surface: AppSurface;
  readonly anonymousUserId?: string;
  readonly bearerToken?: string;
}

export interface BuildManualCaptureInput {
  readonly note: string;
  readonly surface: AppSurface;
  readonly attachments?: unknown;
  readonly idempotencyKey?: string;
  readonly occurredAt?: string;
}

export interface ManualCaptureInput {
  readonly type: "manual_check_in_submitted";
  readonly source: string;
  readonly occurredAt: string;
  readonly schemaVersion: 1;
  readonly payload: {
    readonly note: string;
    readonly attachments?: unknown;
  };
  readonly idempotencyKey?: string;
}

export interface SurfaceEventRecord {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  readonly source: string;
  readonly occurredAt: string;
  readonly schemaVersion: number;
  readonly payload: unknown;
  readonly createdAt: string;
  readonly idempotencyKey?: string;
}

export interface SurfaceSession {
  readonly authMode: string;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  } | null;
  readonly workspace: {
    readonly id: string;
    readonly label: string;
  } | null;
}

export interface SurfaceCalendarDay {
  readonly localDate: string;
  readonly noteCount: number;
  readonly signalCount: number;
}

export interface SurfaceActionItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly confidence: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dueAt?: string;
  readonly eventEndsAt?: string;
  readonly eventStartsAt?: string;
  readonly metadata?: unknown;
  readonly remindAt?: string;
}

export interface SurfaceAgentRun {
  readonly id: string;
  readonly userId: string;
  readonly triggerType: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly status: string;
  readonly startedAt: string;
  readonly metadata: unknown;
  readonly completedAt?: string;
  readonly errorCode?: string;
  readonly model?: string;
}

export interface SurfaceActionsResponse {
  readonly actions: ReadonlyArray<SurfaceActionItem>;
  readonly latestRun?: SurfaceAgentRun;
}

export type SurfaceActionReviewStatus = "accepted" | "dismissed" | "completed";

export interface SurfaceActionStatusInput {
  readonly itemId: string;
  readonly status: SurfaceActionReviewStatus;
}

export interface SurfaceJournalDocument {
  readonly id: string;
  readonly userId: string;
  readonly localDate: string;
  readonly title: string;
  readonly bodyText: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly bodyDocument?: unknown;
}

export interface SurfaceJournalRevision {
  readonly id: string;
  readonly documentId: string;
  readonly userId: string;
  readonly bodyText: string;
  readonly changedText: string;
  readonly changeHash: string;
  readonly createdAt: string;
  readonly revisionNumber: number;
  readonly processedAt?: string;
}

export interface SurfaceJournalSaveInput {
  readonly bodyText: string;
  readonly localDate: string;
  readonly title: string;
  readonly bodyDocument?: unknown;
}

export interface SurfaceJournalSaveResponse {
  readonly document: SurfaceJournalDocument;
  readonly revision: SurfaceJournalRevision;
  readonly analysisRun?: SurfaceAgentRun;
}

export interface SurfaceConversationMemoryResult {
  readonly chunkId: string;
  readonly score: number;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly text: string;
}

export interface SurfaceConversationMessageInput {
  readonly message: string;
  readonly conversationId?: string;
}

export interface SurfaceConversationMessageResponse {
  readonly conversationId: string;
  readonly draft: unknown;
  readonly memoryResults: ReadonlyArray<SurfaceConversationMemoryResult>;
  readonly message: string;
  readonly reasoningHarness: unknown;
  readonly reply: string;
  readonly skillsApplied: ReadonlyArray<string>;
  readonly subAgentsUsed: ReadonlyArray<string>;
  readonly usedTools: ReadonlyArray<string>;
  readonly workflowHooks: ReadonlyArray<string>;
}

export interface SurfaceRefreshContextInput {
  readonly localDate: string;
  readonly timeZone: string;
  readonly actionLimit?: number;
  readonly signalLimit?: number;
}

export interface SurfaceRefreshContext {
  readonly actions: SurfaceActionsResponse;
  readonly calendarDays: ReadonlyArray<SurfaceCalendarDay>;
  readonly journal: SurfaceJournalDocument | null;
  readonly session: SurfaceSession;
  readonly signals: ReadonlyArray<SurfaceEventRecord>;
}

export interface SurfaceEngineClient {
  readonly appendManualCapture: (input: {
    readonly note: string;
    readonly attachments?: unknown;
    readonly idempotencyKey?: string;
    readonly occurredAt?: string;
  }) => Promise<SurfaceEventRecord>;
  readonly refreshContext: (input: SurfaceRefreshContextInput) => Promise<SurfaceRefreshContext>;
  readonly saveJournal: (input: SurfaceJournalSaveInput) => Promise<SurfaceJournalSaveResponse>;
  readonly sendConversationMessage: (
    input: SurfaceConversationMessageInput,
  ) => Promise<SurfaceConversationMessageResponse>;
  readonly updateActionStatus: (input: SurfaceActionStatusInput) => Promise<SurfaceActionItem>;
}

export interface CreateSurfaceEngineClientInput extends BuildSurfaceIdentityHeadersInput {
  readonly baseUrl: string;
  readonly fetch?: (request: Request) => Promise<Response>;
}

export const surfaceAnonymousUserStorageKey = "nudge.anonymousUserID";

export function surfaceClientHeader(surface: AppSurface) {
  return surface;
}

export function surfaceCaptureSource(surface: AppSurface) {
  switch (surface) {
    case "web":
      return "web_app";
    case "desktop":
      return "desktop_app";
    case "raycast":
      return "raycast_extension";
    case "ios":
      return "ios_app";
  }
}

export function buildSurfaceIdentityHeaders(input: BuildSurfaceIdentityHeadersInput) {
  const headers: Record<string, string> = {
    "x-nudge-client": surfaceClientHeader(input.surface),
  };
  const bearerToken = input.bearerToken?.trim();
  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
    return headers;
  }

  const anonymousUserId = input.anonymousUserId?.trim().toLowerCase();
  if (anonymousUserId) {
    headers["x-nudge-anonymous-user-id"] = anonymousUserId;
  }
  return headers;
}

function defaultRandomUUID() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== "function") {
    throw new Error("crypto.randomUUID is required to create an anonymous Nudge identity");
  }
  return randomUUID.call(globalThis.crypto);
}

export function generatedAnonymousUserId(randomUUID: () => string = defaultRandomUUID) {
  return `anon_${randomUUID().toLowerCase()}`;
}

export function anonymousUserIdFromStorage(input: {
  readonly storage: SurfaceIdentityStorage;
  readonly randomUUID?: () => string;
}) {
  const existing = input.storage.getItem(surfaceAnonymousUserStorageKey)?.trim().toLowerCase();
  if (existing?.startsWith("anon_")) return existing;

  const userId = generatedAnonymousUserId(input.randomUUID ?? defaultRandomUUID);
  input.storage.setItem(surfaceAnonymousUserStorageKey, userId);
  return userId;
}

export function buildManualCaptureInput(input: BuildManualCaptureInput): ManualCaptureInput {
  return {
    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: {
      ...(input.attachments !== undefined ? { attachments: input.attachments } : {}),
      note: input.note,
    },
    schemaVersion: 1,
    source: surfaceCaptureSource(input.surface),
    type: "manual_check_in_submitted",
  };
}

function baseUrlWithSlash(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function engineUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, baseUrlWithSlash(baseUrl)).toString();
}

function engineUrlWithQuery(
  baseUrl: string,
  path: string,
  query: Readonly<Record<string, string | number | undefined>> = {},
) {
  const url = new URL(engineUrl(baseUrl, path));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readEngineJson(response: Response) {
  if (!response.ok) {
    throw new Error(`Nudge Engine request failed with ${response.status}`);
  }
  return await response.json();
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function readNumberProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "number" ? property : undefined;
}

function readArrayProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return Array.isArray(property) ? property : undefined;
}

function readStringArrayProperty(value: unknown, key: string) {
  return readArrayProperty(value, key)?.filter((item) => typeof item === "string");
}

function readNullableObjectProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  if (property === null) return null;
  return typeof property === "object" && property !== null ? property : undefined;
}

function eventRecordFrom(value: unknown): SurfaceEventRecord {
  const id = readStringProperty(value, "id");
  const userId = readStringProperty(value, "userId");
  const type = readStringProperty(value, "type");
  const source = readStringProperty(value, "source");
  const occurredAt = readStringProperty(value, "occurredAt");
  const schemaVersion = readNumberProperty(value, "schemaVersion");
  const createdAt = readStringProperty(value, "createdAt");
  const idempotencyKey = readStringProperty(value, "idempotencyKey");
  if (
    !id ||
    !userId ||
    !type ||
    !source ||
    !occurredAt ||
    schemaVersion === undefined ||
    !createdAt
  ) {
    throw new Error("Invalid Nudge Engine event response");
  }

  return {
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    createdAt,
    id,
    occurredAt,
    payload: readObjectProperty(value, "payload"),
    schemaVersion,
    source,
    type,
    userId,
  };
}

function sessionUserFrom(value: unknown) {
  const id = readStringProperty(value, "id");
  const displayName = readStringProperty(value, "displayName");
  return id && displayName ? { displayName, id } : null;
}

function sessionWorkspaceFrom(value: unknown) {
  const id = readStringProperty(value, "id");
  const label = readStringProperty(value, "label");
  return id && label ? { id, label } : null;
}

function sessionFrom(value: unknown): SurfaceSession {
  const authMode = readStringProperty(value, "authMode");
  const userValue = readNullableObjectProperty(value, "user");
  const workspaceValue = readNullableObjectProperty(value, "workspace");
  if (!authMode || userValue === undefined || workspaceValue === undefined) {
    throw new Error("Invalid Nudge Engine session response");
  }
  return {
    authMode,
    user: userValue === null ? null : sessionUserFrom(userValue),
    workspace: workspaceValue === null ? null : sessionWorkspaceFrom(workspaceValue),
  };
}

function calendarDayFrom(value: unknown): SurfaceCalendarDay {
  const localDate = readStringProperty(value, "localDate");
  const noteCount = readNumberProperty(value, "noteCount");
  const signalCount = readNumberProperty(value, "signalCount");
  if (!localDate || noteCount === undefined || signalCount === undefined) {
    throw new Error("Invalid Nudge Engine calendar day response");
  }
  return { localDate, noteCount, signalCount };
}

function actionItemFrom(value: unknown): SurfaceActionItem {
  const id = readStringProperty(value, "id");
  const kind = readStringProperty(value, "kind");
  const title = readStringProperty(value, "title");
  const body = readStringProperty(value, "body");
  const status = readStringProperty(value, "status");
  const confidence = readNumberProperty(value, "confidence");
  const createdAt = readStringProperty(value, "createdAt");
  const updatedAt = readStringProperty(value, "updatedAt");
  const dueAt = readStringProperty(value, "dueAt");
  const eventEndsAt = readStringProperty(value, "eventEndsAt");
  const eventStartsAt = readStringProperty(value, "eventStartsAt");
  const remindAt = readStringProperty(value, "remindAt");
  const metadata = readObjectProperty(value, "metadata");
  if (
    !id ||
    !kind ||
    !title ||
    !body ||
    !status ||
    confidence === undefined ||
    !createdAt ||
    !updatedAt
  ) {
    throw new Error("Invalid Nudge Engine action response");
  }
  return {
    body,
    confidence,
    createdAt,
    ...(dueAt !== undefined ? { dueAt } : {}),
    ...(eventEndsAt !== undefined ? { eventEndsAt } : {}),
    ...(eventStartsAt !== undefined ? { eventStartsAt } : {}),
    id,
    kind,
    ...(metadata !== undefined ? { metadata } : {}),
    ...(remindAt !== undefined ? { remindAt } : {}),
    status,
    title,
    updatedAt,
  };
}

function agentRunFrom(value: unknown): SurfaceAgentRun {
  const id = readStringProperty(value, "id");
  const userId = readStringProperty(value, "userId");
  const triggerType = readStringProperty(value, "triggerType");
  const sourceType = readStringProperty(value, "sourceType");
  const sourceId = readStringProperty(value, "sourceId");
  const status = readStringProperty(value, "status");
  const startedAt = readStringProperty(value, "startedAt");
  const completedAt = readStringProperty(value, "completedAt");
  const errorCode = readStringProperty(value, "errorCode");
  const model = readStringProperty(value, "model");
  if (!id || !userId || !triggerType || !sourceType || !sourceId || !status || !startedAt) {
    throw new Error("Invalid Nudge Engine agent run response");
  }
  return {
    ...(completedAt !== undefined ? { completedAt } : {}),
    ...(errorCode !== undefined ? { errorCode } : {}),
    id,
    metadata: readObjectProperty(value, "metadata"),
    ...(model !== undefined ? { model } : {}),
    sourceId,
    sourceType,
    startedAt,
    status,
    triggerType,
    userId,
  };
}

function actionsResponseFrom(value: unknown): SurfaceActionsResponse {
  const actions = readArrayProperty(value, "actions");
  if (!actions) throw new Error("Invalid Nudge Engine actions response");
  const latestRunValue = readObjectProperty(value, "latestRun");
  return {
    actions: actions.map(actionItemFrom),
    ...(latestRunValue !== undefined ? { latestRun: agentRunFrom(latestRunValue) } : {}),
  };
}

function actionStatusResponseFrom(value: unknown) {
  const action = readObjectProperty(value, "action");
  if (action === undefined) throw new Error("Invalid Nudge Engine action status response");
  return actionItemFrom(action);
}

function journalDocumentFrom(value: unknown): SurfaceJournalDocument {
  const id = readStringProperty(value, "id");
  const userId = readStringProperty(value, "userId");
  const localDate = readStringProperty(value, "localDate");
  const title = readStringProperty(value, "title");
  const bodyText = readStringProperty(value, "bodyText");
  const createdAt = readStringProperty(value, "createdAt");
  const updatedAt = readStringProperty(value, "updatedAt");
  const bodyDocument = readObjectProperty(value, "bodyDocument");
  if (
    !id ||
    !userId ||
    !localDate ||
    !title ||
    bodyText === undefined ||
    !createdAt ||
    !updatedAt
  ) {
    throw new Error("Invalid Nudge Engine journal response");
  }
  return {
    ...(bodyDocument !== undefined ? { bodyDocument } : {}),
    bodyText,
    createdAt,
    id,
    localDate,
    title,
    updatedAt,
    userId,
  };
}

function journalRevisionFrom(value: unknown): SurfaceJournalRevision {
  const id = readStringProperty(value, "id");
  const documentId = readStringProperty(value, "documentId");
  const userId = readStringProperty(value, "userId");
  const bodyText = readStringProperty(value, "bodyText");
  const changedText = readStringProperty(value, "changedText");
  const changeHash = readStringProperty(value, "changeHash");
  const createdAt = readStringProperty(value, "createdAt");
  const revisionNumber = readNumberProperty(value, "revisionNumber");
  const processedAt = readStringProperty(value, "processedAt");
  if (
    !id ||
    !documentId ||
    !userId ||
    bodyText === undefined ||
    changedText === undefined ||
    !changeHash ||
    !createdAt ||
    revisionNumber === undefined
  ) {
    throw new Error("Invalid Nudge Engine journal revision response");
  }

  return {
    bodyText,
    changeHash,
    changedText,
    createdAt,
    documentId,
    id,
    ...(processedAt !== undefined ? { processedAt } : {}),
    revisionNumber,
    userId,
  };
}

function journalResponseFrom(value: unknown) {
  const document = readNullableObjectProperty(value, "document");
  if (document === undefined) throw new Error("Invalid Nudge Engine journal response");
  return document === null ? null : journalDocumentFrom(document);
}

function journalSaveResponseFrom(value: unknown): SurfaceJournalSaveResponse {
  const document = readObjectProperty(value, "document");
  const revision = readObjectProperty(value, "revision");
  const analysisRun = readObjectProperty(value, "analysisRun");
  if (document === undefined || revision === undefined) {
    throw new Error("Invalid Nudge Engine journal save response");
  }

  return {
    ...(typeof analysisRun === "object" && analysisRun !== null
      ? { analysisRun: agentRunFrom(analysisRun) }
      : {}),
    document: journalDocumentFrom(document),
    revision: journalRevisionFrom(revision),
  };
}

function conversationMemoryResultFrom(value: unknown): SurfaceConversationMemoryResult {
  const chunkId = readStringProperty(value, "chunkId");
  const score = readNumberProperty(value, "score");
  const sourceId = readStringProperty(value, "sourceId");
  const sourceType = readStringProperty(value, "sourceType");
  const text = readStringProperty(value, "text");
  if (!chunkId || score === undefined || !sourceId || !sourceType || !text) {
    throw new Error("Invalid Nudge Engine conversation memory response");
  }
  return { chunkId, score, sourceId, sourceType, text };
}

function conversationMessageResponseFrom(value: unknown): SurfaceConversationMessageResponse {
  const conversationId = readStringProperty(value, "conversationId");
  const message = readStringProperty(value, "message");
  const reply = readStringProperty(value, "reply");
  const memoryResults = readArrayProperty(value, "memoryResults");
  const skillsApplied = readStringArrayProperty(value, "skillsApplied");
  const subAgentsUsed = readStringArrayProperty(value, "subAgentsUsed");
  const usedTools = readStringArrayProperty(value, "usedTools");
  const workflowHooks = readStringArrayProperty(value, "workflowHooks");
  const reasoningHarness = readObjectProperty(value, "reasoningHarness");
  if (
    !conversationId ||
    !message ||
    !reply ||
    memoryResults === undefined ||
    skillsApplied === undefined ||
    subAgentsUsed === undefined ||
    usedTools === undefined ||
    workflowHooks === undefined ||
    reasoningHarness === undefined
  ) {
    throw new Error("Invalid Nudge Engine conversation response");
  }
  return {
    conversationId,
    draft: readObjectProperty(value, "draft") ?? null,
    memoryResults: memoryResults.map(conversationMemoryResultFrom),
    message,
    reasoningHarness,
    reply,
    skillsApplied,
    subAgentsUsed,
    usedTools,
    workflowHooks,
  };
}

export function createSurfaceEngineClient(
  input: CreateSurfaceEngineClientInput,
): SurfaceEngineClient {
  const fetcher = input.fetch ?? ((request: Request) => globalThis.fetch(request));
  const requestJson = async (
    path: string,
    requestInput: {
      readonly body?: unknown;
      readonly method?: "GET" | "POST";
      readonly query?: Readonly<Record<string, string | number | undefined>>;
    } = {},
  ) => {
    const method = requestInput.method ?? "GET";
    const response = await fetcher(
      new Request(engineUrlWithQuery(input.baseUrl, path, requestInput.query), {
        ...(requestInput.body !== undefined ? { body: JSON.stringify(requestInput.body) } : {}),
        headers: {
          ...(requestInput.body !== undefined ? { "content-type": "application/json" } : {}),
          ...buildSurfaceIdentityHeaders(input),
        },
        method,
      }),
    );
    return await readEngineJson(response);
  };

  return {
    appendManualCapture: async (captureInput) => {
      const body = buildManualCaptureInput({
        ...(captureInput.attachments !== undefined
          ? { attachments: captureInput.attachments }
          : {}),
        ...(captureInput.idempotencyKey !== undefined
          ? { idempotencyKey: captureInput.idempotencyKey }
          : {}),
        note: captureInput.note,
        ...(captureInput.occurredAt !== undefined ? { occurredAt: captureInput.occurredAt } : {}),
        surface: input.surface,
      });
      return eventRecordFrom(await requestJson("/api/captures", { body, method: "POST" }));
    },
    refreshContext: async (contextInput) => {
      const [session, calendarDays, actions, signals, journal] = await Promise.all([
        requestJson("/api/session").then(sessionFrom),
        requestJson("/api/calendar/days", {
          query: { timeZone: contextInput.timeZone },
        }).then((value) => (readArrayProperty(value, "days") ?? []).map(calendarDayFrom)),
        requestJson("/api/actions", {
          query: { limit: contextInput.actionLimit },
        }).then(actionsResponseFrom),
        requestJson("/api/signals", {
          query: { limit: contextInput.signalLimit },
        }).then((value) => (readArrayProperty(value, "signals") ?? []).map(eventRecordFrom)),
        requestJson(`/api/journal/${encodeURIComponent(contextInput.localDate)}`).then(
          journalResponseFrom,
        ),
      ]);

      return { actions, calendarDays, journal, session, signals };
    },
    saveJournal: async (journalInput) => {
      return journalSaveResponseFrom(
        await requestJson("/api/journal", {
          body: {
            ...(journalInput.bodyDocument !== undefined
              ? { bodyDocument: journalInput.bodyDocument }
              : {}),
            bodyText: journalInput.bodyText,
            localDate: journalInput.localDate,
            title: journalInput.title,
          },
          method: "POST",
        }),
      );
    },
    sendConversationMessage: async (conversationInput) => {
      const conversationId = conversationInput.conversationId ?? "default";
      return conversationMessageResponseFrom(
        await requestJson(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
          body: { message: conversationInput.message },
          method: "POST",
        }),
      );
    },
    updateActionStatus: async (statusInput) => {
      return actionStatusResponseFrom(
        await requestJson(`/api/actions/${encodeURIComponent(statusInput.itemId)}/status`, {
          body: {
            itemId: statusInput.itemId,
            status: statusInput.status,
          },
          method: "POST",
        }),
      );
    },
  };
}

export interface DailyNoteDrawerTextInput {
  readonly dirty: boolean;
  readonly currentText: string;
  readonly remoteBodyText: string | null | undefined;
}

export interface DailyNotePatchInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly idempotencyKey: string;
  readonly localDate: string;
  readonly payloadHash: string;
  readonly title: string;
  readonly baseServerRevision?: string;
}

export interface StickyNoteCreateInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly color: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly pinned: boolean;
  readonly title: string;
}

export interface StickyNotePatchInput<
  NoteId extends string = string,
> extends StickyNoteCreateInput {
  readonly noteId: NoteId;
  readonly baseServerRevision?: string;
}

export interface BuildDailyNotePatchInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly idempotencyKey: string;
  readonly localDate: string;
  readonly serverRevision?: string;
  readonly title: string;
}

export interface BuildStickyNoteCreateInput {
  readonly bodyDocument?: unknown;
  readonly bodyText: string;
  readonly color?: string;
  readonly idempotencyKey: string;
  readonly pinned?: boolean;
  readonly title?: string;
}

export interface BuildStickyNotePatchInput<
  NoteId extends string = string,
> extends BuildStickyNoteCreateInput {
  readonly noteId: NoteId;
  readonly serverRevision?: string;
}

export function todayLocalDate(date: Date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function surfacePayloadHash(value: string) {
  return `${value.length}:${value}`;
}

export function noteTextFromPayload(payload: unknown) {
  if (payload && typeof payload === "object" && "note" in payload) {
    return String(Reflect.get(payload, "note"));
  }
  if (payload && typeof payload === "object" && "changedText" in payload) {
    return String(Reflect.get(payload, "changedText"));
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

export function dailyNoteDrawerText(input: DailyNoteDrawerTextInput) {
  if (input.dirty) {
    return input.currentText;
  }
  return input.remoteBodyText ?? "";
}

export function buildDailyNotePatchInput(input: BuildDailyNotePatchInput): DailyNotePatchInput {
  return {
    ...(input.serverRevision !== undefined ? { baseServerRevision: input.serverRevision } : {}),
    ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
    bodyText: input.bodyText,
    idempotencyKey: input.idempotencyKey,
    localDate: input.localDate,
    payloadHash: surfacePayloadHash(input.bodyText),
    title: input.title,
  };
}

export function stickyNoteTitleFromText(bodyText: string) {
  const firstLine = bodyText.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return firstLine.length > 0 ? firstLine.slice(0, 72) : "Untitled note";
}

function stickyNotePayloadHash(input: {
  readonly bodyText: string;
  readonly color: string;
  readonly pinned: boolean;
  readonly title: string;
}) {
  return surfacePayloadHash(
    JSON.stringify({
      bodyText: input.bodyText,
      color: input.color,
      pinned: input.pinned,
      title: input.title,
    }),
  );
}

export function buildStickyNoteCreateInput(
  input: BuildStickyNoteCreateInput,
): StickyNoteCreateInput {
  const color = input.color ?? "yellow";
  const pinned = input.pinned ?? false;
  const title = input.title ?? stickyNoteTitleFromText(input.bodyText);
  return {
    ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
    bodyText: input.bodyText,
    color,
    idempotencyKey: input.idempotencyKey,
    payloadHash: stickyNotePayloadHash({
      bodyText: input.bodyText,
      color,
      pinned,
      title,
    }),
    pinned,
    title,
  };
}

export function buildStickyNotePatchInput<NoteId extends string>(
  input: BuildStickyNotePatchInput<NoteId>,
): StickyNotePatchInput<NoteId> {
  const createInput = buildStickyNoteCreateInput(input);
  return {
    ...(input.serverRevision !== undefined ? { baseServerRevision: input.serverRevision } : {}),
    ...createInput,
    noteId: input.noteId,
  };
}
