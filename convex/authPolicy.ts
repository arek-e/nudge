interface ConvexAuthIdentity {
  readonly subject: string;
}

export function authenticatedExternalId(identity: ConvexAuthIdentity | null) {
  return identity?.subject ?? null;
}

export function notAuthenticatedError() {
  return { code: "not_authenticated" };
}
