import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page and show the title', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('h1');
    const text = await title.textContent();
    console.log('DEBUG H1 TEXT:', text);
    await expect(title).toBeVisible();
    await expect(title).toHaveText(/AI 주식 분석 도구/);
  });

  test('should have a search input and button', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input');
    await expect(input).toBeVisible();
    const button = page.locator('button[type="submit"]');
    await expect(button).toBeVisible();
  });

  test('sidebar should show account status labels', async ({ page }) => {
    await page.goto('/');
    // Check for "계정" heading in sidebar
    await expect(page.getByText('계정')).toBeVisible();
    // Check for login button text
    await expect(page.getByText('Google 로그인')).toBeVisible();
  });
});
