import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';
import path from 'path';
import fs from 'fs';

test.describe('Exposant - Profile Completion', () => {
  test.use({ storageState: users.entreprise.storageState });

  const testLogoPath = path.join(__dirname, 'test-logo.png');
  const testBannerPath = path.join(__dirname, 'test-banner.jpg');

  test.beforeAll(async () => {
    fs.writeFileSync(testLogoPath, 'fake-logo-content');
    fs.writeFileSync(testBannerPath, 'fake-banner-content');
  });

  test.afterAll(async () => {
    if (fs.existsSync(testLogoPath)) fs.unlinkSync(testLogoPath);
    if (fs.existsSync(testBannerPath)) fs.unlinkSync(testBannerPath);
  });

  test('Enterprise can complete their profile with logo, banner and business tags', async ({ page }) => {
    await page.goto('/enterprise/profile');
    
    // 1. Update basic info
    await page.fill('input[name="industry"]', 'Information Technology');
    await page.fill('input[name="website"]', 'https://test-enterprise.com');
    await page.fill('input[name="linkedin"]', 'https://linkedin.com/company/test-enterprise');
    
    // 2. Location
    await page.fill('input[name="country"]', 'Morocco');
    await page.fill('input[name="city"]', 'Casablanca');
    
    // 3. Contact Info
    await page.fill('input[name="contact_email"]', 'contact@test-enterprise.com');
    await page.fill('input[name="contact_phone"]', '+212600000000');
    
    // 4. Business Tags
    await page.fill('input[name="tags"], input#tags', 'AI, Cloud, SaaS, B2B');
    
    // 5. Upload Logo
    const logoInput = page.locator('input[type="file"]').first();
    await logoInput.setInputFiles(testLogoPath);
    await expect.soft(page.locator('text=Logo uploaded')).toBeVisible();
    
    // 6. Upload Banner
    const bannerInput = page.locator('input[type="file"]').last();
    await bannerInput.setInputFiles(testBannerPath);
    await expect.soft(page.locator('text=Banner uploaded')).toBeVisible();
    
    // 7. Save Profile
    await page.click('button:has-text("Save Changes"), button:has-text("Enregistrer")');
    await expect.soft(page.locator('text=Profile updated, Success')).toBeVisible();
    
    // 8. Verify persistence
    await page.reload();
    await expect(page.locator('input[name="industry"]')).toHaveValue('Information Technology');
    await expect(page.locator('input[name="city"]')).toHaveValue('Casablanca');
    await expect(page.locator('input[name="contact_email"]')).toHaveValue('contact@test-enterprise.com');
  });
});
