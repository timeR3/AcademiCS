import { test, expect } from '@playwright/test';

test.describe('Teacher E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('user', JSON.stringify({
        id: '2',
        name: 'Teacher User',
        email: 'teacher@example.com',
        roles: ['teacher'],
        status: 'active'
      }));
    });
    await page.reload();
  });

  test('should see teacher dashboard with key metrics', async ({ page }) => {
    await expect(page.getByText(/Índice estratégico/i).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /Operación/i })).toBeVisible();
    await expect(page.locator('h2').getByText(/Cursos Activos/i)).toBeVisible();
  });

  test('should navigate to course creation', async ({ page }) => {
    // Click Sidebar "Crear Curso"
    await page.getByText(/Crear Curso/i).first().click();
    await expect(page.getByText(/Crear Nuevo Curso/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Ej: Fundamentos de React Avanzado/i)).toBeVisible();
  });
});
