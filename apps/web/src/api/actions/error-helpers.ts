export interface ErrorFromUnknownInput {
  readonly error: unknown;
  readonly fallbackMessage: string;
}

export type ErrorFromUnknownResult = Error;

export function errorFromUnknown(input: ErrorFromUnknownInput): ErrorFromUnknownResult {
  return input.error instanceof Error ? input.error : new Error(input.fallbackMessage);
}
