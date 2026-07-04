import { describe, expect, test } from "bun:test";
import { appUserProfileFromIdentity } from "./usersPolicy";

describe("Convex users policy", () => {
  test("uses the Clerk subject as the stable external id", () => {
    expect(
      appUserProfileFromIdentity({
        email: "alex@example.com",
        name: "Alex",
        pictureUrl: "https://example.com/avatar.png",
        subject: "user_2abc",
      }),
    ).toEqual({
      email: "alex@example.com",
      externalId: "user_2abc",
      imageUrl: "https://example.com/avatar.png",
      name: "Alex",
    });
  });

  test("does not invent an app user profile when unauthenticated", () => {
    expect(appUserProfileFromIdentity(null)).toBeNull();
  });
});
