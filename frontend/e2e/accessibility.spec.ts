import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/guide", "/models", "/benchmark", "/results", "/recommend", "/try-it"];

test.describe("Axe Accessibility Audits", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pramaan_tour_seen", "true");
    });
  });

  for (const p of PAGES) {
    test(`Axe scan on ${p}`, async ({ page }) => {
      await page.goto(p);
      await page.waitForLoadState("domcontentloaded");
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical"
      );

      expect(criticalViolations).toEqual([]);
    });
  }
});
