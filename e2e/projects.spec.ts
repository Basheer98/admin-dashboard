import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test.describe("Projects", () => {
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

  test("can create a new project", async ({ page }) => {
    await page.goto("/projects");
    await expect(
      page.getByRole("heading", { name: /projects/i }),
    ).toBeVisible();

    await page.getByLabel(/project id/i).fill("P.TEST001");
    await page.getByLabel(/client name/i).selectOption("");
    await page.getByPlaceholder(/enter new client name/i).fill("Test Client");
    await page.getByLabel(/location/i).fill("Test Location");
    await page.getByLabel(/total sqft/i).fill("10000");
    await page.getByLabel(/company rate per sqft/i).fill("0.03");
    await page.getByRole("button", { name: /save project/i }).click();

    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByText("P.TEST001")).toBeVisible();
    await expect(page.getByText("Test Client")).toBeVisible();
  });
});
