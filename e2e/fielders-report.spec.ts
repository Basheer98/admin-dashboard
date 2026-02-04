import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test.describe("Fielder reports", () => {
  test.beforeEach(async ({ page }) => {
    if (!email || !password) {
      test.skip();
      return;
    }
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\//);
  });

  test("fielder reports page loads and shows table or empty state", async ({
    page,
  }) => {
    await page.goto("/fielders");
    await expect(
      page.getByRole("heading", { name: /fielder reports/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/one page per fielder/i),
    ).toBeVisible();
    const table = page.getByRole("table");
    const emptyMessage = page.getByText(/no fielders with assignments/i);
    await expect(table.or(emptyMessage)).toBeVisible();
  });
});
