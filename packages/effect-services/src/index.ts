import { Context, Effect, Layer } from "effect";
import type { DevUser } from "@lares/domain";

export class AuthService extends Context.Service<
  AuthService,
  {
    readonly currentUser: Effect.Effect<DevUser>;
  }
>()("lares/AuthService") {
  static readonly layerDev = Layer.succeed(AuthService)({
    currentUser: Effect.succeed({
      id: "dev-user",
      displayName: "Dev User",
    }),
  });
}
