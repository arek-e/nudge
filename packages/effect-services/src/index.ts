import { Context, Effect } from "effect";
import type { DevUser } from "@personal-agent-os/domain";

export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  {
    readonly currentUser: Effect.Effect<DevUser>;
  }
>() {}

export const DevAuthService = AuthService.of({
  currentUser: Effect.succeed({
    id: "dev-user",
    displayName: "Dev User",
  }),
});
