import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const clientMainUrl = new URL("./client/main.tsx", import.meta.url);

describe("desktop auth UI", () => {
  test("opens browser auth from the desktop shell instead of rendering inline Clerk sign-in", async () => {
    const source = await readFile(clientMainUrl, "utf8");

    expect(source).toContain("function DesktopSignInScreen()");
    expect(source).toContain("useRef(false)");
    expect(source).toContain("void openBrowserSignIn();");
    expect(source).toContain("bridge.openExternalAuth(url)");
    expect(source).toContain("Finish sign-in in your browser");
    expect(source).not.toContain("Use embedded sign in");
  });
});
