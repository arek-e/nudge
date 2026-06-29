type AuthMethods = {
  readonly emailOtp: boolean;
  readonly google: boolean;
  readonly passkey: boolean;
};

export function loginAuthMethodsForView(
  session: {
    readonly authMethods: AuthMethods;
    readonly authMode: "better-auth" | "dev" | "unauthenticated";
  },
  search: string,
): AuthMethods | null {
  if (session.authMode === "unauthenticated") return session.authMethods;
  // ponytail: visual-only local preview, use real Better Auth config for auth-flow QA.
  if (session.authMode === "dev" && new URLSearchParams(search).get("auth") === "login") {
    return { emailOtp: true, google: false, passkey: true };
  }
  return null;
}
