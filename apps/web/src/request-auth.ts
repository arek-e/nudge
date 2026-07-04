import type { RequestSession } from "./request-context";
import type { NudgeAppService } from "./Services/NudgeApp";

export async function resolveCurrentUser(input: {
  readonly app: NudgeAppService;
  readonly request: Request;
}): Promise<RequestSession> {
  const session = await input.app.resolveSession({ env: input.app.env, request: input.request });
  if (session) {
    const user = {
      displayName: session.user.name ?? session.user.email ?? "Nudge User",
      id: session.user.id,
    };
    return {
      authMode: "clerk",
      user,
    };
  }

  return {
    authMode: "unauthenticated",
    user: null,
  };
}
