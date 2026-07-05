import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";

export interface GetSessionInput {
  readonly context: ApiContext;
}

export interface GetSessionResult {
  readonly authMode: "clerk" | "unauthenticated";
  readonly user: ApiContext["session"]["user"];
  readonly workspace: { readonly id: string; readonly label: string } | null;
}

export function getSession(input: GetSessionInput): ApiAction<GetSessionResult> {
  return Effect.succeed({
    authMode: input.context.session.authMode,
    user: input.context.session.user,
    workspace: input.context.session.user
      ? {
          id: input.context.session.user.id,
          label: `${input.context.session.user.displayName}'s workspace`,
        }
      : null,
  });
}
