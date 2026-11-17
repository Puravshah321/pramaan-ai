import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const PAGES = [
  { name: "home", path: "/" },
  { name: "guide", path: "/guide" },
  { name: "models", path: "/models" },
  { name: "benchmark", path: "/benchmark" },
  { name: "results", path: "/results" },
  { name: "recommend", path: "/recommend" },
  { name: "try-it", path: "/try-it" },
];

test.describe("All 7 Pages Health & Layout", () => {
  for (const pageInfo of PAGES) {
    test(`Page ${pageInfo.name} at desktop and mobile`, async ({ page }, testInfo) => {
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      page.on("requestfailed", (req) => {
        failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
      });

      await page.goto(pageInfo.path, { waitUntil: "networkidle" });

      // Check no console errors
      expect(consoleErrors).toEqual([]);

      // Check no failed network requests
      expect(failedRequests).toEqual([]);

      // Check no horizontal scroll overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Check header visibility
      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Ensure docs/images directory exists
      const imagesDir = path.resolve(process.cwd(), "../docs/images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // Save screenshot
      const isMobile = testInfo.project.name === "mobile";
      const filename = isMobile
        ? `${pageInfo.name}-mobile.png`
        : `${pageInfo.name}-desktop.png`;
      const screenshotPath = path.join(imagesDir, filename);

      await page.screenshot({ path: screenshotPath, fullPage: false });
    });
  }
});
