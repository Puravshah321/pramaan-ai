import { test, expect } from "@playwright/test";

test.describe("Recommend Page", () => {
  test("Shows real recommendation or admits limits", async ({ page }) => {
    await page.goto("/recommend", { waitUntil: "networkidle" });

    // Look for either Recommended configuration or No configuration fits
    const winnerCard = page.locator("text=Recommended configuration").or(page.locator("text=No configuration fits within these limits"));
    await expect(winnerCard.first()).toBeVisible({ timeout: 15000 });
  });
});
