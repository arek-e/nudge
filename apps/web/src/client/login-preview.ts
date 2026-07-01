type AuthMethods = {
  readonly emailOtp: boolean;
  readonly google: boolean;
  readonly passkey: boolean;
};

export function loginAuthMethodsForView(
  session: {
    readonly authMethods: AuthMethods;
    readonly authMode: "anonymous" | "better-auth" | "unauthenticated";
  },
  search: string,
): AuthMethods | null {
  if (session.authMode === "unauthenticated") return session.authMethods;
  void search;
  return null;
}
