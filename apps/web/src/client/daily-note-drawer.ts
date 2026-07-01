interface DailyNoteDrawerTextInput {
  readonly dirty: boolean;
  readonly currentText: string;
  readonly remoteBodyText: string | null | undefined;
}

export function dailyNoteDrawerText(input: DailyNoteDrawerTextInput) {
  if (input.dirty) {
    return input.currentText;
  }
  return input.remoteBodyText ?? "";
}
