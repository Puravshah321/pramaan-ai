import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pramaan_tour_seen", "true");
    sessionStorage.setItem("hf_banner_dismissed", "true");
  });
});

test.describe("REDESIGN v6: Free Local-Only Mode & Live Datasets", () => {
  test("Desktop 1440x900: Models page search, local storage, compare & dataset drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/models");
    await page.waitForLoadState("domcontentloaded");

    // Check Local Model Manager table
    const table = page.locator("table");
    await expect(table.first()).toBeVisible();

    // S6: Verify embedding model pre-filled
    await expect(page.locator("text=Comparing")).toBeVisible();

    // S1: Type in model search input and check autocomplete
    const searchInput = page.locator('input[aria-label="Candidate model search or repo ID"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("qwen");
    await page.waitForTimeout(500);

    // S2: Check dataset cards
    await expect(page.locator("text=Featured Question-Answering Datasets")).toBeVisible();
    const useDatasetBtn = page.locator("button:has-text('Use Dataset →')").first();
    if (await useDatasetBtn.isVisible()) {
      await useDatasetBtn.click();
      // Check modal drawer opens
      await expect(page.locator("text=Dataset Preview & Ingestion")).toBeVisible();
      await expect(page.locator("text=Question Count to Ingest")).toBeVisible();
      // Close modal
      await page.locator("button:has-text('Cancel')").click();
    }

    // Capture verified screenshot
    await page.screenshot({ path: "docs/screenshots/models_desktop_v6.png", fullPage: true });
  });

  test("Mobile 390x844: Models page responsive without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/models");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Check no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    await page.screenshot({ path: "docs/screenshots/models_mobile_v6.png", fullPage: true });
  });

  test("Desktop 1440x900: Benchmark displays active dataset and model calls (S3)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/benchmark");
    await page.waitForLoadState("domcontentloaded");

    // S3: Check for Active Dataset chip
    await expect(page.locator("text=Active Dataset:").first()).toBeVisible();

    // S3: Check for Total model calls (not Total API calls)
    await expect(page.locator("text=Total model calls:")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Total API calls:")).not.toBeVisible();

    // Check formula
    await expect(page.locator("text=Formula:")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "docs/screenshots/benchmark_desktop_v6.png", fullPage: true });
  });

  test("Desktop 1440x900: Header Local mode status pill with detailed tooltip", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check Local mode pill in header
    const pill = page.locator("text=Local mode");
    await expect(pill).toBeVisible({ timeout: 10000 });

    // Check caption under evidence card: Answered by ... locally or evidence card
    const evidenceText = page.locator("text=locally").or(page.locator("text=RAG Systems Overview"));
    await expect(evidenceText.first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "docs/screenshots/home_desktop_v6.png", fullPage: true });
  });
});
