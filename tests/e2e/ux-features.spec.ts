import { expect, test } from "@playwright/test";

const APP_URL = "http://127.0.0.1:5174";

test.describe("UX onboarding and upload feedback", () => {
  test("shows about modal before authentication and opens real policy summaries", async ({ page }) => {
    await page.goto(APP_URL);

    await expect(page.getByRole("dialog", { name: "About Spendo" })).toBeVisible();
    await expect(page.getByText("Spendo helps you understand where your money goes")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).first().click();

    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.getByLabel("Email").fill("founder@example.com");
    await page.getByRole("button", { name: "Send Verification Code" }).click();
    await page.getByLabel("Verification code digit 1").fill("123456");
    await page.getByRole("button", { name: "Verify Email" }).click();

    await page.getByRole("button", { name: "User Terms" }).click();
    await expect(page.getByRole("dialog", { name: "Spendo User Terms" })).toBeVisible();
    await expect(page.getByText("Effective June 1, 2026")).toBeVisible();
    await expect(page.getByText("Upload only financial statements you own")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).first().click();

    await page.getByRole("button", { name: "Cookies Policy" }).click();
    await expect(page.getByRole("dialog", { name: "Spendo Cookies Policy" })).toBeVisible();
    await expect(page.getByText("does not use advertising cookies")).toBeVisible();
  });

  test("shows interactive money facts while a statement upload is processing", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "spendo.auth.users",
        JSON.stringify([
          {
            email: "demo@example.com",
            password: "password123",
            acceptedTermsAt: new Date().toISOString(),
            acceptedCookiesAt: new Date().toISOString(),
          },
        ]),
      );
      window.localStorage.setItem("spendo.auth.session", "demo@example.com");
    });

    await page.route("**/api/v1/upload", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ filename: "statement.xlsx", total_transactions: 2 }),
      });
    });
    await page.route("**/api/v1/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transactions: [], total: 0 }),
      });
    });
    await page.route("**/api/v1/summary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ summaries: [], top_merchants: [] }),
      });
    });
    await page.route("**/api/v1/categories", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ categories: [] }),
      });
    });

    await page.goto(APP_URL);
    const fileInput = page.locator("#file-input");
    await fileInput.setInputFiles({
      name: "statement.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("test file"),
    });

    await expect(page.getByText("Money Challenge")).toBeVisible();
    await expect(page.getByText("A recurring 25 ILS monthly charge becomes how much over one year?")).toBeVisible();
    await page.getByRole("button", { name: /300 ILS/ }).click();
    await expect(page.getByText("Correct. +10 points")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next money challenge" })).toBeVisible();
  });
});
