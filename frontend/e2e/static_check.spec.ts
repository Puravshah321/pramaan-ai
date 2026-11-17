import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Static Content Integrity Check", () => {
  test("No fake, simulated, or placeholder data in frontend/src", () => {
    const srcDir = path.resolve(process.cwd(), "src");

    function scanFiles(dir: string, fileList: string[] = []): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanFiles(fullPath, fileList);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const files = scanFiles(srcDir);
    const forbiddenWords = ["simulated", "calibrated", "mock"];
    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Check forbidden words (case insensitive)
        for (const word of forbiddenWords) {
          const regex = new RegExp(`\\b${word}\\b`, "i");
          if (regex.test(line)) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              match: word,
            });
          }
        }

        // Check for placeholder word outside of input placeholder attributes and tailwind classes
        const placeholderMatches = line.match(/\bplaceholder\b/gi);
        if (placeholderMatches) {
          const isAttributeOrClass = /placeholder\s*=\s*["']/.test(line) || /placeholder:/.test(line);
          if (!isAttributeOrClass) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              match: "placeholder text",
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
