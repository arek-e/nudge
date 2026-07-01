import { describe, expect, test } from "bun:test";
import { loginAuthMethodsForView } from "../src/client/login-preview";

describe("loginAuthMethodsForView", () => {
  test("shows the login card only for unauthenticated sessions", () => {
    expect(
      loginAuthMethodsForView(
        {
          authMethods: { emailOtp: true, google: false, passkey: true },
          authMode: "unauthenticated",
        },
        "?auth=login",
      ),
    ).toEqual({ emailOtp: true, google: false, passkey: true });

    expect(
      loginAuthMethodsForView(
        {
          authMethods: { emailOtp: true, google: false, passkey: true },
          authMode: "better-auth",
        },
        "?auth=login",
      ),
    ).toBeNull();
  });
});
