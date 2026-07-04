import { expect, test } from "@playwright/test";

test("unauthenticated mobile shell shows the Clerk sign-in entry", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: "Nudge" }).first()).toBeVisible();
  await expect(page.getByLabel("Loading Nudge")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Notes" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);

  await page.screenshot({ path: "test-results/mobile-sign-in.png", fullPage: true });
});

test("settings route keeps unauthenticated users on the sign-in entry", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("img", { name: "Nudge" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete local data" })).toHaveCount(0);
});
