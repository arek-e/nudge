import { expect, test } from "@playwright/test";

test("mobile home dashboard menu exposes app navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByLabel("Home dashboard")).toBeVisible();

  const note = `Playwright typed client ${Date.now()}`;
  await page.getByLabel("What should Lares capture?").fill(note);
  await page.getByRole("button", { name: "Save capture" }).tap();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.getByRole("button", { name: "Generate synthesis" }).tap();
  await expect(page.getByText(/signal[s]? captured/i)).toBeVisible();

  await page.getByRole("button", { name: "Generate proposals" }).tap();
  await expect(
    page.getByRole("heading", { name: "Clarify next attention point" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit & commit" }).first().tap();
  await expect(page.getByRole("button", { name: "Bold" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Italic" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Underline" })).toBeVisible();
  await page.getByRole("button", { name: "AI draft" }).tap();
  await page.getByLabel("Commitment title").fill("Confirm travel follow-up");
  await page
    .getByRole("textbox", { name: "Commitment body" })
    .fill("Send the travel follow-up before lunch.");
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

  await page.getByRole("button", { name: "Open menu" }).tap();

  await expect(page.getByRole("navigation", { name: "Mobile menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Capture" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Events" })).toBeVisible();

  await page.getByRole("link", { name: "Events" }).tap();
  await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Signal log" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Event" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Detail" })).toBeVisible();

  await page.screenshot({ path: "test-results/mobile-home-menu.png", fullPage: true });
});
