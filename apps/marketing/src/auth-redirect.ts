export const marketingAppHref = "https://app.explorenudge.com";

export function marketingRootRedirectTarget(input: {
  readonly clerkClientUat?: string | undefined;
  readonly clerkSession?: string | undefined;
}) {
  if (hasUsableCookieValue(input.clerkSession)) return marketingAppHref;
  if (hasActiveClientUat(input.clerkClientUat)) return marketingAppHref;
  return null;
}

function hasUsableCookieValue(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(
    normalized &&
    normalized !== "0" &&
    normalized !== "null" &&
    normalized !== "undefined" &&
    normalized !== "deleted",
  );
}

function hasActiveClientUat(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return false;
  const timestamp = Number(normalized);
  return Number.isFinite(timestamp) && timestamp > 0;
}
