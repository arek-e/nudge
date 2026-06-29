import { describe, expect, test } from "bun:test";
import { loginAuthMethodsForView } from "../src/client/login-preview";

describe("loginAuthMethodsForView", () => {
  test("shows the login card for the local dev preview query only", () => {
    expect(
      loginAuthMethodsForView(
        {
          authMethods: { emailOtp: false, google: false, passkey: false },
          authMode: "dev",
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
