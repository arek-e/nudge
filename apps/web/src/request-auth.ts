import type { RequestSession } from "./request-context";
import type { LaresAppService } from "./Services/LaresApp";
import { isBetterAuthConfigured } from "./auth";

export async function resolveCurrentUser(input: {
  readonly app: LaresAppService;
  readonly headers: Headers;
}): Promise<RequestSession> {
  const session = await input.app.resolveSession({ env: input.app.env, headers: input.headers });
  if (session) {
    const user = {
      displayName: session.user.name ?? session.user.email ?? "Lares User",
      id: session.user.id,
    };
    return {
      authMode: "better-auth",
      user,
    };
  }

  if (isBetterAuthConfigured(input.app.env)) {
    return {
      authMode: "unauthenticated",
      user: null,
    };
  }

  return {
    authMode: "dev",
    user: input.app.devUser,
  };
}
