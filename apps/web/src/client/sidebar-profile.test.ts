import { describe, expect, test } from "bun:test";
import { sidebarProfileDisplayName } from "./sidebar-profile";

describe("sidebarProfileDisplayName", () => {
  test("prefers the authenticated Clerk full name over the temporary fallback", () => {
    expect(
      sidebarProfileDisplayName(
        {
          fullName: "Alexander Eklund",
          primaryEmailAddress: { emailAddress: "alex@example.com" },
        },
        "You",
      ),
    ).toBe("Alexander Eklund");
  });

  test("builds a display name from first and last name", () => {
    expect(
      sidebarProfileDisplayName(
        {
          firstName: "Alex",
          lastName: "Eklund",
        },
        "You",
      ),
    ).toBe("Alex Eklund");
  });

  test("falls back to username, email, then provided name", () => {
    expect(sidebarProfileDisplayName({ username: "alex" }, "You")).toBe("alex");
    expect(
      sidebarProfileDisplayName(
        {
          primaryEmailAddress: { emailAddress: "alex@example.com" },
        },
        "You",
      ),
    ).toBe("alex@example.com");
    expect(sidebarProfileDisplayName(null, "Jane Smith")).toBe("Jane Smith");
  });
});
