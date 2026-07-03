import { expect, test } from "@playwright/test";

test("unauthenticated app shell shows the login page", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        authMode: "unauthenticated",
        user: null,
        workspace: null,
      },
      status: 200,
    });
  });

  await page.goto("/");

  await expect(page.getByRole("link", { name: "Nudge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("Sign in with a passkey, Google, or an email code.")).toBeVisible();
  await expect(page.getByText("Other ways to continue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "good afternoon." })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
});

test("today avatar opens account actions", async ({ page }) => {
  let signedOut = false;
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: signedOut
        ? {
            authMode: "unauthenticated",
            user: null,
            workspace: null,
          }
        : {
            authMode: "clerk",
            user: { displayName: "Lana", id: "auth-user-1" },
            workspace: { id: "auth-user-1", label: "Lana's workspace" },
          },
      status: 200,
    });
  });
  await page.route("**/api/auth/sign-out**", async (route) => {
    signedOut = true;
    await route.fulfill({ contentType: "application/json", json: { success: true }, status: 200 });
  });

  await page.goto("/");

  await page.getByRole("button", { name: "Account" }).tap();
  await expect(page.getByRole("menu", { name: "Account actions" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();

  await page.getByRole("menuitem", { name: "Settings" }).tap();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("Lana's workspace")).toBeVisible();
  await expect(page.getByText("Clerk account")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Account" }).tap();
  await page.getByRole("menuitem", { name: "Sign out" }).tap();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("mobile app shell uses persistent bottom navigation", async ({ page }) => {
  test.setTimeout(60000);
  const journalLoaded = page.waitForResponse(
    (response) => response.request().method() === "GET" && response.url().includes("/api/journal/"),
  );
  await page.goto("/");
  await journalLoaded;

  await expect(page.getByRole("heading", { name: "good afternoon." })).toBeVisible();
  await expect(page.getByLabel("Home dashboard")).toBeVisible();
  await expect(page.getByText("Calendar")).toBeVisible();
  await expect(page.getByText("Open loops")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  const dashboardBottom = await page.getByLabel("Home dashboard").evaluate((element) => {
    return element.getBoundingClientRect().bottom;
  });
  const viewportHeight = page.viewportSize()?.height ?? 0;
  expect(dashboardBottom).toBeLessThanOrEqual(viewportHeight);

  await expect(page.getByRole("heading", { name: "Daily note" })).toHaveCount(0);
  await expect(page.getByLabel("Daily journal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save journal" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Recent notes" })).toBeVisible();

  const journalStamp = Date.now();
  const journalAction = `write to michael about playwright ${journalStamp}`;
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Write capture" })
    .tap();
  await page.getByRole("button", { name: "Note" }).tap();
  await page.getByRole("textbox", { name: "Daily journal" }).fill(`need to ${journalAction}`);
  await page.getByRole("button", { name: "Save journal" }).tap();
  await expect(page.getByRole("dialog", { name: "Daily note" })).toHaveCount(0, {
    timeout: 30000,
  });

  const note = `Playwright typed client ${Date.now()}`;
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Write capture" })
    .tap();
  await page.getByRole("button", { name: "Note" }).tap();
  const captureDialogBox = await page.getByRole("dialog", { name: "Daily note" }).boundingBox();
  expect(captureDialogBox?.y).toBeLessThanOrEqual(2);
  expect(captureDialogBox?.height ?? 0).toBeGreaterThanOrEqual(viewportHeight - 2);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Heading" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Text" })).toBeVisible();
  await page.getByRole("textbox", { name: "Daily journal" }).fill(note);
  await page.getByRole("button", { name: "Save journal" }).tap();
  await expect(page.getByRole("dialog", { name: "Daily note" })).toHaveCount(0, {
    timeout: 30000,
  });

  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  const primaryNav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(primaryNav.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Actions" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Journey" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Insights" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Docs" })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Prompts" })).toHaveCount(0);

  await primaryNav.getByRole("button", { name: "Write capture" }).tap();
  const addSheetBox = await page.getByRole("dialog", { name: "Add" }).boundingBox();
  expect(addSheetBox?.y).toBeGreaterThanOrEqual(0);
  expect((addSheetBox?.y ?? 0) + (addSheetBox?.height ?? 0)).toBeLessThanOrEqual(viewportHeight);
  await page.getByRole("button", { name: "Cancel" }).tap();

  await page.evaluate(() => {
    Reflect.set(window, "__vestaClientNavMarker", "still-mounted");
  });
  await page.getByRole("link", { name: "Actions" }).tap();
  await expect(page.getByRole("heading", { exact: true, name: "Actions" })).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => Reflect.get(window, "__vestaClientNavMarker")))
    .toBe("still-mounted");
  await expect(page.getByText(/AI analysis · (queued|running|completed)/)).toBeVisible();
  await expect(page.getByText(/cloudflare-think · @cf\/zai-org\/glm-4\.7-flash/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("Anonymous User's workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add passkey" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete local data" })).toBeVisible();

  await page.getByRole("link", { name: "Journey" }).tap();
  await expect(page.getByRole("heading", { name: "Journey timeline" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Journey" })).toBeVisible();
  await page.getByRole("button", { name: "Write capture" }).tap();
  await expect(page.getByRole("dialog", { name: "Add" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Note" })).toBeVisible();
  await page.getByRole("button", { name: "Note" }).tap();
  await expect(page.getByRole("textbox", { name: "Daily journal" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).tap();
  await expect(page.getByRole("heading", { name: "Journey timeline" })).toBeVisible();
  await expect(page.getByText("Manual check in submitted").first()).toBeVisible();

  await page.getByRole("link", { name: "Insights" }).tap();
  await expect(page.getByText("Summaries")).toBeVisible();

  await page.screenshot({ path: "test-results/mobile-home-menu.png", fullPage: true });
});
