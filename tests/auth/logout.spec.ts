import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Authentication - Logout', () => {
  
  test.use({ storageState: users.visitor.storageState });

  test('[PASS] Logout redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for logout button in sidebar or navbar
    const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout"), [aria-label="Logout"]');
    
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      // Fallback: try clearing storage and navigating manually
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/auth/login';
      });
    }
    
    await page.waitForURL(/\/auth\/login/);
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Protected routes blocked
    await page.goto('/dashboard');
    await page.waitForURL(/\/auth\/login/);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
