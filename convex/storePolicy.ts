export const changedTextFrom = (previous: string | null, next: string) => {
  if (!previous) return next;
  if (next.startsWith(previous)) return next.slice(previous.length).trim();
  return next;
};

export const diffSummaryFrom = (previous: string | null, changedText: string) => {
  if (!previous) return "Created daily journal document.";
  if (changedText.length === 0) return "Saved without text changes.";
  return "Updated daily journal document.";
};

export const simpleHash = (value: string) => `${value.length}:${value}`;

export const memoryChunkHash = (input: {
  readonly chunkIndex: number;
  readonly chunkText: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly userId: string;
}) =>
  `${input.userId}:${input.sourceType}:${input.sourceId}:${input.chunkIndex}:${input.chunkText}`;

export const memoryChunksFrom = (bodyText: string) => {
  const trimmed = bodyText.trim();
  if (trimmed.length === 0) return [];
  return [trimmed];
};

export const sameJson = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
