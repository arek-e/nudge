export interface SidebarProfileUser {
  readonly firstName?: string | null;
  readonly fullName?: string | null;
  readonly lastName?: string | null;
  readonly primaryEmailAddress?: {
    readonly emailAddress?: string | null;
  } | null;
  readonly username?: string | null;
}

export function sidebarProfileDisplayName(
  user: SidebarProfileUser | null | undefined,
  fallbackName: string,
) {
  const fullName = cleanProfileName(user?.fullName);
  if (fullName) return fullName;

  const composedName = [cleanProfileName(user?.firstName), cleanProfileName(user?.lastName)]
    .filter((name) => name !== undefined)
    .join(" ");
  if (composedName) return composedName;

  return (
    cleanProfileName(user?.username) ??
    cleanProfileName(user?.primaryEmailAddress?.emailAddress) ??
    cleanProfileName(fallbackName) ??
    "You"
  );
}

function cleanProfileName(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : undefined;
}
