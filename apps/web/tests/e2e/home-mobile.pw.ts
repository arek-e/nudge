import { expect, test } from "@playwright/test";

test("unauthenticated app shell shows the login page", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { authMode: "unauthenticated", user: null, workspace: null },
      status: 200,
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in to Lares" })).toBeVisible();
  await expect(
    page.getByText("Private workspace access is limited to invited accounts."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "good afternoon." })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
});

test("mobile app shell uses persistent bottom navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "good afternoon." })).toBeVisible();
  await expect(page.getByLabel("Home dashboard")).toBeVisible();
  await expect(page.getByText(/Next: (Capture|Synthesis|Proposal|Review|Outcome)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open loop" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  const dashboardBottom = await page.getByLabel("Home dashboard").evaluate((element) => {
    return element.getBoundingClientRect().bottom;
  });
  const viewportHeight = page.viewportSize()?.height ?? 0;
  expect(dashboardBottom).toBeLessThanOrEqual(viewportHeight);

  await expect(page.getByRole("heading", { name: "Journal" })).toBeVisible();
  await page.getByLabel("Daily journal").fill("need to write to michael");
  await page.getByRole("button", { name: "Save journal" }).tap();
  await expect(page.getByText("Saved. Lares will review the changed text.")).toBeVisible();

  const note = `Playwright typed client ${Date.now()}`;
  await page
    .getByRole("region", { name: "Capture" })
    .getByRole("button", { name: "Write capture" })
    .tap();
  const captureDialogBox = await page.getByRole("dialog", { name: "Write capture" }).boundingBox();
  expect(captureDialogBox?.y).toBeLessThanOrEqual(2);
  expect(captureDialogBox?.height ?? 0).toBeGreaterThanOrEqual(viewportHeight - 2);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Heading" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Text" })).toBeVisible();
  await page.getByRole("textbox", { name: "Capture body" }).fill(note);
  await page.getByRole("button", { name: "Save capture" }).tap();
  await expect(page.getByText("Saved. This is now in the user-owned event log.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Tell Lares" })).toBeVisible();
  await page.getByRole("button", { name: "Tell Lares" }).tap();
  await expect(page.getByText("Lares understood")).toBeVisible();
  await expect(page.getByLabel("Tell Lares").getByRole("button", { name: "Accept" })).toBeVisible();

  await page.getByRole("button", { name: "Generate synthesis" }).tap();
  await expect(page.getByText(/signal[s]? captured/i)).toBeVisible();

  await page.getByRole("button", { name: "Generate proposals" }).tap();
  await expect(
    page.getByRole("heading", { name: "Clarify next attention point" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit & commit" }).first().tap();
  await expect(page.getByRole("button", { name: "Heading" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Text" })).toBeVisible();
  await page.getByRole("button", { name: "AI draft" }).tap();
  await page
    .getByRole("textbox", { name: "Commitment body" })
    .fill("Confirm travel follow-up\nSend the travel follow-up before lunch.");
  await page.getByRole("button", { name: "Commit edited proposal" }).tap();
  const commitments = page.getByRole("region", { name: "Active commitments" });
  await expect(commitments).toBeVisible();
  await expect(
    commitments.getByRole("heading", { name: "Confirm travel follow-up" }),
  ).toBeVisible();
  const completionButtons = commitments.getByRole("button", { name: "Mark completed" });
  await completionButtons.first().tap();
  const closedLoop = page.getByRole("region", { name: "Closed loop" });
  await expect(closedLoop).toBeVisible();
  await expect(
    closedLoop.getByRole("heading", { name: /Marked complete from the Today loop at/ }).first(),
  ).toBeVisible();

  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  const primaryNav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(primaryNav.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Loop" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Journey" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Insights" })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Docs" })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Prompts" })).toHaveCount(0);

  await primaryNav.getByRole("button", { name: "Write capture" }).tap();
  const addSheetBox = await page.getByRole("dialog", { name: "Add to Lares" }).boundingBox();
  expect(addSheetBox?.y).toBeGreaterThanOrEqual(0);
  expect((addSheetBox?.y ?? 0) + (addSheetBox?.height ?? 0)).toBeLessThanOrEqual(viewportHeight);
  await page.getByRole("button", { name: "Cancel" }).tap();

  await page.getByRole("link", { name: "Loop" }).tap();
  await expect(page.getByRole("heading", { name: "Daily Operating Loop" })).toBeVisible();
  await expect(
    page.getByText(
      "Capture → Signal → Frame → Synthesis → Proposal → Review → Commitment → Outcome",
    ),
  ).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("Dev User's workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete local data" })).toBeVisible();

  await page.getByRole("link", { name: "Journey" }).tap();
  await expect(page.getByRole("heading", { name: "Journey timeline" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Journey" })).toBeVisible();
  await page.getByRole("button", { name: "Write capture" }).tap();
  await expect(page.getByRole("dialog", { name: "Add to Lares" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture note" })).toBeVisible();
  await page.getByRole("button", { name: "Capture note" }).tap();
  await expect(page.getByRole("textbox", { name: "Capture body" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).tap();
  await expect(page.getByRole("heading", { name: "Journey timeline" })).toBeVisible();
  await expect(page.getByText("Manual check in submitted").first()).toBeVisible();

  await page.getByRole("link", { name: "Insights" }).tap();
  await expect(page.getByText("Completion trend")).toBeVisible();
  await expect(page.getByText("Completion rate")).toBeVisible();

  await page.screenshot({ path: "test-results/mobile-home-menu.png", fullPage: true });
});
