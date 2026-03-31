import { test, expect } from '@playwright/test';

test.describe('Admin E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Admin User',
        email: 'admin@example.com',
        roles: ['admin'],
        status: 'active'
      }));
    });
    await page.reload();
  });

  test('should see admin dashboard', async ({ page }) => {
    await expect(page.getByText(/Modo Administrador/i)).toBeVisible();
    await expect(page.getByText(/Estadísticas/i).first()).toBeVisible();
  });

  test('should navigate to courses management', async ({ page }) => {
     await page.getByText(/Cursos/i).first().click();
     await expect(page.getByText(/Gestión de Cursos/i)).toBeVisible();
  });

  test('should navigate to user management', async ({ page }) => {
     await page.getByText(/Usuarios/i).first().click();
     await expect(page.getByText(/Gestión de Usuarios/i)).toBeVisible();
  });
});
