import type { RequestSession } from "./request-context";
import type { VestaAppService } from "./Services/VestaApp";

const anonymousUserIdPattern =
  /^anon_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function anonymousUserIdFrom(headers: Headers) {
  const userId = headers.get("x-vesta-anonymous-user-id")?.trim().toLowerCase();
  return userId && anonymousUserIdPattern.test(userId) ? userId : null;
}

export async function resolveCurrentUser(input: {
  readonly app: VestaAppService;
  readonly request: Request;
}): Promise<RequestSession> {
  const session = await input.app.resolveSession({ env: input.app.env, request: input.request });
  if (session) {
    const user = {
      displayName: session.user.name ?? session.user.email ?? "Vesta User",
      id: session.user.id,
    };
    return {
      authMode: "clerk",
      user,
    };
  }

  const anonymousUserId = anonymousUserIdFrom(input.request.headers);
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
