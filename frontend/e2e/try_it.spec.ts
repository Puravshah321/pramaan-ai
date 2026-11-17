import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Try It End to End", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("pramaan_tour_seen", "true");
    });
  });

  test("Upload PDF, prepare, ask question, and read answer with evidence", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/try-it", { waitUntil: "networkidle" });

    // Switch to Upload tab
    const uploadTabBtn = page.locator("button:has-text('Upload (PDF, TXT, MD)')");
    await uploadTabBtn.click();

    // Upload PDF fixture
    const fileInput = page.locator("input[type='file']");
    const pdfPath = path.resolve(process.cwd(), "e2e/fixtures/test_doc.pdf");
    await fileInput.setInputFiles(pdfPath);

    // Click Prepare document
    const prepareBtn = page.locator("button:has-text('Prepare document')");
    await prepareBtn.click();

    // Verify ready badge or prepare message
    await expect(page.locator("text=Ready").or(page.locator("text=Document prepared!")).first()).toBeVisible({ timeout: 15000 });

    // Fill question
    const questionInput = page.locator("input[placeholder*='Ask any factual question']");
    await questionInput.fill("What does Pramaan AI evaluate?");

    // Click Ask question
    const askBtn = page.locator("button:has-text('Ask question')");
    await askBtn.click();

    // Verify answer card appears
    await expect(page.locator("text=Generated Answer")).toBeVisible({ timeout: 25000 });

    // Verify reliability badge exists
    const badge = page.locator("text=Reliable").or(page.locator("text=Uncertain")).or(page.locator("text=Unreliable"));
    await expect(badge.first()).toBeVisible();

    // Verify retrieved chunks appear
    await expect(page.locator("text=Passage").first()).toBeVisible();
  });
});
