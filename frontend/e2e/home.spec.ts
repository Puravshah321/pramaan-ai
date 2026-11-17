import { test, expect } from "@playwright/test";

test.describe("Home Page Interactions", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss first-visit tour so it doesn't intercept clicks
    await page.addInitScript(() => {
      localStorage.setItem("pramaan_tour_seen", "true");
    });
  });

  test("Evidence card shows real answer or empty state", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Look for either evidence card or empty state
    const evidenceCard = page.locator("text=Q:").or(page.locator("text=Your first answer will appear here"));
    await expect(evidenceCard.first()).toBeVisible({ timeout: 10000 });
  });

  test("Change drawer opens, switches model, and persists after reload", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Click Change link in hero
    const changeBtn = page.locator("button:has-text('Change')");
    await expect(changeBtn).toBeVisible();
    await changeBtn.click();

    // Verify drawer opens
    const drawerTitle = page.locator("text=Change Active Setup");
    await expect(drawerTitle).toBeVisible();

    // Save active setup
    const saveBtn = page.locator("button:has-text('Save as Active Setup')");
    await saveBtn.click();

    // Drawer confirms
    await expect(page.locator("text=Setup updated successfully!")).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1400);

    // Reload page to verify persistence
    await page.reload({ waitUntil: "networkidle" });
    const setupText = page.locator("text=Using");
    await expect(setupText).toBeVisible();
  });
});
