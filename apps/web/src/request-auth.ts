import type { RequestSession } from "./request-context";
import type { VestaAppService } from "./Services/VestaApp";

const anonymousUserIdPattern =
  /^anon_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function anonymousUserIdFrom(headers: Headers) {
  const userId = headers.get("x-lares-anonymous-user-id")?.trim().toLowerCase();
  return userId && anonymousUserIdPattern.test(userId) ? userId : null;
}

export async function resolveCurrentUser(input: {
  readonly app: VestaAppService;
  readonly headers: Headers;
}): Promise<RequestSession> {
  const session = await input.app.resolveSession({ env: input.app.env, headers: input.headers });
  if (session) {
    const user = {
      displayName: session.user.name ?? session.user.email ?? "Vesta User",
      id: session.user.id,
    };
    return {
      authMode: "better-auth",
      user,
    };
  }

  const anonymousUserId = anonymousUserIdFrom(input.headers);
  if (anonymousUserId) {
    return {
      authMode: "anonymous",
      user: {
        displayName: "Anonymous User",
        id: anonymousUserId,
      },
    };
  }

  return {
    authMode: "unauthenticated",
    user: null,
  };
}
