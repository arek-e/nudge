export interface ToSynthesisResponseInput {
  readonly synthesis: {
    readonly id: string;
    readonly userId: string;
    readonly frameId: string;
    readonly summary: string;
    readonly themes: ReadonlyArray<string>;
    readonly openQuestions: ReadonlyArray<string>;
    readonly sourceSignalIds: ReadonlyArray<string>;
    readonly generatedAt: string;
    readonly createdAt: string;
  };
}

export interface ToSynthesisResponseResult {
  readonly id: string;
  readonly userId: string;
  readonly frameId: string;
  readonly summary: string;
  readonly themes: string[];
  readonly openQuestions: string[];
  readonly sourceSignalIds: string[];
  readonly generatedAt: string;
  readonly createdAt: string;
}

export function toSynthesisResponse(input: ToSynthesisResponseInput): ToSynthesisResponseResult {
  return {
    ...input.synthesis,
    themes: [...input.synthesis.themes],
    openQuestions: [...input.synthesis.openQuestions],
    sourceSignalIds: [...input.synthesis.sourceSignalIds],
  };
}
