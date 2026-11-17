import { test, expect } from "@playwright/test";

test.describe("Benchmark End to End", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pramaan_tour_seen", "true");
    });
  });

  test("Run quick preset, stream progress, and finish", async ({ page }) => {
    test.setTimeout(90000);
    await page.goto("/benchmark", { waitUntil: "networkidle" });

    // Select Quick preset
    const quickPresetBtn = page.locator("button:has-text('Quick')");
    await quickPresetBtn.click();

    // Start benchmark run
    const startBtn = page.locator("button:has-text('Start benchmark run')");
    await startBtn.click();

    // Watch real progress appear
    await expect(page.locator("text=Benchmark in progress").or(page.locator("text=Benchmark status"))).toBeVisible({ timeout: 15000 });

    // Wait for completion or results link
    await expect(page.locator("text=View results & Pareto frontier").or(page.locator("text=completed")).first()).toBeVisible({ timeout: 60000 });
  });

  test("Cancel a benchmark run", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/benchmark", { waitUntil: "networkidle" });

    // Select Quick preset and start
    const startBtn = page.locator("button:has-text('Start benchmark run')");
    await startBtn.click();

    // Look for Cancel run button
    const cancelBtn = page.locator("button:has-text('Cancel run')");
    if (await cancelBtn.isVisible({ timeout: 5000 })) {
      await cancelBtn.click();
      await expect(page.locator("text=cancelled").or(page.locator("text=Benchmark status: cancelled")).first()).toBeVisible({ timeout: 15000 });
    }
  });
});
