import { describe, expect, test } from "bun:test";
import { authenticatedExternalId, notAuthenticatedError } from "./authPolicy";

describe("Convex auth policy", () => {
  test("uses the validated Clerk subject as the external id", () => {
    expect(authenticatedExternalId({ subject: "user_2abc" })).toBe("user_2abc");
  });

  test("does not invent an external id when the Convex request is unauthenticated", () => {
    expect(authenticatedExternalId(null)).toBeNull();
    expect(notAuthenticatedError()).toEqual({ code: "not_authenticated" });
  });
});
