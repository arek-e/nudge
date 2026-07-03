export interface StickyNotePatchInput {
  readonly bodyDocument: unknown | undefined;
  readonly bodyText: string;
  readonly color: string;
  readonly pinned: boolean;
  readonly title: string;
}

export interface ExistingStickyNote {
  readonly bodyDocument: unknown | undefined;
  readonly bodyText: string;
  readonly color: string;
  readonly pinned: boolean;
  readonly serverRevision: string;
  readonly title: string;
}

export interface AppliedStickyNotePatch {
  readonly bodyDocument: unknown | undefined;
  readonly bodyText: string;
  readonly color: string;
  readonly pinned: boolean;
  readonly serverRevision: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface ExistingMutationReceipt {
  readonly payloadHash: string;
  readonly status: "accepted";
}

export function applyStickyNotePatch(input: {
  readonly existing: ExistingStickyNote | null;
  readonly input: StickyNotePatchInput;
  readonly now: string;
}): AppliedStickyNotePatch {
  const previousRevision = input.existing ? Number(input.existing.serverRevision) : 0;
  const nextRevision = Number.isFinite(previousRevision) ? previousRevision + 1 : 1;
  return {
    bodyDocument: input.input.bodyDocument,
    bodyText: input.input.bodyText,
    color: input.input.color,
    pinned: input.input.pinned,
    serverRevision: String(nextRevision),
    title: input.input.title,
    updatedAt: input.now,
  };
}

export function sameMutationReplay(existing: ExistingMutationReceipt | null, payloadHash: string) {
  return existing !== null && existing.payloadHash === payloadHash;
}

export function idempotencyConflict(existing: ExistingMutationReceipt, payloadHash: string) {
  return existing.payloadHash === payloadHash
    ? null
    : { code: "idempotency_conflict", existingPayloadHash: existing.payloadHash };
}
