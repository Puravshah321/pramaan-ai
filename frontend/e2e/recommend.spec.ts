import { test, expect } from "@playwright/test";

test.describe("Recommend Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pramaan_tour_seen", "true");
      sessionStorage.setItem("hf_banner_dismissed", "true");
    });
  });

  test("Shows hardware presets, auto-detected chip, and honest recommendation", async ({ page }) => {
    await page.goto("/recommend", { waitUntil: "domcontentloaded" });

    // Verify header
    await expect(page.locator("h1:has-text('Hardware-Aware Recommendations')")).toBeVisible({ timeout: 10000 });

    // Verify auto-detected machine or preset chip
    const chipSelector = page.locator("button:has-text('Your Machine')").or(page.locator("button:has-text('RTX 3060')"));
    await expect(chipSelector.first()).toBeVisible({ timeout: 10000 });

    // Verify RTX 3060 preset exists
    const rtx3060Preset = page.locator("button:has-text('RTX 3060')");
    await expect(rtx3060Preset.first()).toBeVisible({ timeout: 10000 });

    // Click RTX 3060 preset
    await rtx3060Preset.first().click();

    // Verify usable budget updates to 10 GB
    await expect(page.locator("text=10 GB").first()).toBeVisible({ timeout: 10000 });

    // Verify manual slider is hidden by default
    const memorySlider = page.locator("input[aria-label='Custom memory limit in GB']");
    await expect(memorySlider).not.toBeVisible();

    // Click 'Custom Limits' button to reveal manual slider
    const customBtn = page.locator("button:has-text('Custom Limits')");
    await customBtn.click();
    await expect(memorySlider).toBeVisible({ timeout: 10000 });

    // Verify latency disclaimer is visible
    const disclaimer = page.locator("text=Latency Measurement Integrity");
    await expect(disclaimer).toBeVisible({ timeout: 10000 });

    // Verify recommendation card or admitted limits
    const winnerCard = page.locator("text=Recommended configuration").or(page.locator("text=No configuration fits within these limits"));
    await expect(winnerCard.first()).toBeVisible({ timeout: 15000 });
  });
});
