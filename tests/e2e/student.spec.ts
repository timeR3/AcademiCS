import { test, expect } from '@playwright/test';

test.describe('Student E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('user', JSON.stringify({
        id: '3',
        name: 'Student User',
        email: 'student@example.com',
        roles: ['student'],
        status: 'active'
      }));
    });
    await page.reload();
  });

  test('should see student dashboard', async ({ page }) => {
    await expect(page.getByText(/Hola de nuevo/i)).toBeVisible();
  });

  test('should see priorities section', async ({ page }) => {
    await expect(page.getByText(/Prioridades de hoy/i)).toBeVisible();
  });
});
