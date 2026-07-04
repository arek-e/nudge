interface ConvexAuthIdentity {
  readonly email?: string;
  readonly name?: string;
  readonly pictureUrl?: string;
  readonly subject: string;
}

export interface AppUserProfile {
  readonly email?: string;
  readonly externalId: string;
  readonly imageUrl?: string;
  readonly name?: string;
}

export function appUserProfileFromIdentity(
  identity: ConvexAuthIdentity | null,
): AppUserProfile | null {
  if (!identity) return null;

  return {
    externalId: identity.subject,
    ...(identity.email ? { email: identity.email } : {}),
    ...(identity.name ? { name: identity.name } : {}),
    ...(identity.pictureUrl ? { imageUrl: identity.pictureUrl } : {}),
  };
}
