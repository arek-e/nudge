import { describe, expect, test } from "bun:test";
import { marketingRootRedirectTarget } from "./auth-redirect";

describe("marketing root auth redirect", () => {
  test("sends visitors with a Clerk session cookie to the app dashboard", () => {
    expect(marketingRootRedirectTarget({ clerkSession: "session-token" })).toBe(
      "https://app.explorenudge.com",
    );
  });

  test("sends visitors with an active Clerk client activity cookie to the app dashboard", () => {
    expect(marketingRootRedirectTarget({ clerkClientUat: "1783120800" })).toBe(
      "https://app.explorenudge.com",
    );
  });

  test("keeps unsigned visitors on the marketing site", () => {
    expect(marketingRootRedirectTarget({})).toBeNull();
    expect(marketingRootRedirectTarget({ clerkClientUat: "0" })).toBeNull();
    expect(marketingRootRedirectTarget({ clerkSession: "   " })).toBeNull();
  });
});
