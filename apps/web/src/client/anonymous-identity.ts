const anonymousUserStorageKey = "nudge.anonymousUserID";
const legacyAnonymousUserStorageKey = "vesta.anonymousUserID";

export function generatedAnonymousUserId(randomUUID: () => string = crypto.randomUUID) {
  return `anon_${randomUUID().toLowerCase()}`;
}

export function anonymousUserId() {
  const storage = globalThis.localStorage;
  const existing = storage.getItem(anonymousUserStorageKey)?.trim().toLowerCase();
  if (existing?.startsWith("anon_")) return existing;
  const legacy = storage.getItem(legacyAnonymousUserStorageKey)?.trim().toLowerCase();
  if (legacy?.startsWith("anon_")) {
    storage.setItem(anonymousUserStorageKey, legacy);
    return legacy;
  }

  const userId = generatedAnonymousUserId();
  storage.setItem(anonymousUserStorageKey, userId);
  return userId;
}

export function anonymousIdentityHeaders() {
  return {
    "x-nudge-anonymous-user-id": anonymousUserId(),
    "x-nudge-client": "web",
  };
}
