type ClassValue = false | null | number | string | undefined;

export function cn(...inputs: ReadonlyArray<ClassValue>) {
  return inputs.filter(Boolean).join(" ");
}
