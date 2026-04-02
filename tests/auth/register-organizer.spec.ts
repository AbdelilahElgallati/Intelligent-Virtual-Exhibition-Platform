import { test, expect } from '@playwright/test';

test.describe('Authentication - Organizer Registration', () => {
  
  test('Organizer can sign up with all detailed fields', async ({ page }) => {
    await page.goto('/auth/register');
    
    // Choose Organizer role
    const organizerTab = page.locator('button:has-text("Organizer"), button:has-text("Organisateur")');
    if (await organizerTab.isVisible()) {
      await organizerTab.click();
    } else {
      const roleSelect = page.locator('select[name="role"]');
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption('organizer');
      }
    }
    
    const email = `new-organizer-${Date.now()}@test.com`;
    
    // Fill Registration Form
    await page.fill('input[name="full_name"]', 'New Organizer User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="username"]', email.split('@')[0]);
    
    // Organizer specific fields
    await page.fill('input[name="org_name"]', 'New Organizer Co');
    await page.selectOption('select[name="org_type"]', 'Company');
    await page.fill('input[name="org_country"]', 'Morocco');
    
    await page.click('button[type="submit"]:has-text("Sign Up"), button[type="submit"]:has-text("Register")');
    
    // Redirect to login or pending approval page
    await page.waitForURL(new RegExp(`/auth/login|/pending-approval|/dashboard`));
    await expect(page).toHaveURL(new RegExp(`/auth/login|/pending-approval|/dashboard`));
  });
});
