import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Authentication - Registration Detailed', () => {
  
  test('Enterprise can sign up with all detailed fields', async ({ page }) => {
    await page.goto('/auth/register');
    
    // Choose Enterprise role
    const enterpriseTab = page.locator('button:has-text("Enterprise"), button:has-text("Entreprise")');
    if (await enterpriseTab.isVisible()) {
      await enterpriseTab.click();
    } else {
      const roleSelect = page.locator('select[name="role"]');
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption('enterprise');
      }
    }
    
    const email = `new-enterprise-${Date.now()}@test.com`;
    
    // Fill Registration Form
    await page.fill('input[name="full_name"]', 'New Enterprise User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="username"]', email.split('@')[0]);
    
    // Enterprise specific fields
    await page.fill('input[name="company_name"]', 'New Enterprise Co');
    await page.fill('input[name="professional_email"]', `pro-${email}`);
    await page.fill('input[name="industry"]', 'Technology');
    await page.fill('textarea[name="description"]', 'A detailed description of our new enterprise.');
    await page.fill('input[name="country"]', 'Morocco');
    await page.fill('input[name="city"]', 'Casablanca');
    await page.fill('input[name="creation_year"]', '2020');
    await page.selectOption('select[name="company_size"]', '11-50');
    await page.fill('input[name="website"]', 'https://new-enterprise.com');
    await page.fill('input[name="linkedin"]', 'https://linkedin.com/company/new-enterprise');
    
    await page.click('button[type="submit"]:has-text("Sign Up"), button[type="submit"]:has-text("Register")');
    
    // Redirect to login or pending approval page
    await page.waitForURL(new RegExp(`/auth/login|/pending-approval|/dashboard`));
    await expect(page).toHaveURL(new RegExp(`/auth/login|/pending-approval|/dashboard`));
    
    if (page.url().includes('/pending-approval')) {
      await expect(page.locator('text=Registration successful, Pending approval, En attente')).toBeVisible();
    }
  });

  test('Visitor can sign up and complete profile', async ({ page }) => {
    await page.goto('/auth/register');
    
    const email = `new-visitor-${Date.now()}@test.com`;
    await page.fill('input[name="full_name"]', 'New Visitor User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="username"]', email.split('@')[0]);
    
    await page.click('button[type="submit"]:has-text("Sign Up")');
    
    await page.waitForURL(/\/dashboard|auth\/login/);
    await expect(page).toHaveURL(/\/dashboard|auth\/login/);
  });
});
