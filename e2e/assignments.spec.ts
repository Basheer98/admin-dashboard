import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test.describe("Assignments (Fielders)", () => {
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

  test("assignments page loads and shows filter or table", async ({
    page,
  }) => {
    await page.goto("/assignments");
    await expect(
      page.getByRole("heading", { name: /fielders/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/filter fielders/i),
    ).toBeVisible();
  });
});
