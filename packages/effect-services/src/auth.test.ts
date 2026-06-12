import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { AuthService } from "./index";

describe("AuthService", () => {
  test("dev layer resolves the current dev user", async () => {
    const program = Effect.gen(function* () {
      const auth = yield* AuthService;
      return yield* auth.currentUser;
    });

    const user = await Effect.runPromise(Effect.provide(program, AuthService.layerDev));

    expect(user).toEqual({
      id: "dev-user",
      displayName: "Dev User",
    });
  });
});
