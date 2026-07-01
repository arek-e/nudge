const anonymousUserStorageKey = "lares.anonymousUserID";

export function generatedAnonymousUserId(randomUUID: () => string = crypto.randomUUID) {
  return `anon_${randomUUID().toLowerCase()}`;
}

export function anonymousUserId() {
  const storage = globalThis.localStorage;
  const existing = storage.getItem(anonymousUserStorageKey)?.trim().toLowerCase();
  if (existing?.startsWith("anon_")) return existing;

  const userId = generatedAnonymousUserId();
  storage.setItem(anonymousUserStorageKey, userId);
  return userId;
}

export function anonymousIdentityHeaders() {
  return {
    "x-lares-anonymous-user-id": anonymousUserId(),
    "x-lares-client": "web",
  };
}
