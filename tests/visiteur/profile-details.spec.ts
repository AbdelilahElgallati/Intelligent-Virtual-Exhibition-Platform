import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Visitor - Profile Management', () => {
  test.use({ storageState: users.visitor.storageState });

  test('Visitor can update their detailed profile and interests', async ({ page }) => {
    await page.goto('/profile');
    
    // 1. Basic Info
    await page.fill('input[name="full_name"]', 'John Visitor Doe');
    await page.fill('textarea[name="bio"]', 'I am a tech enthusiast looking for AI and Cloud solutions.');
    
    // 2. Professional Details
    await page.fill('input[name="job_title"]', 'CTO');
    await page.fill('input[name="company"]', 'Innovate Tech Corp');
    await page.selectOption('select[name="experience_level"]', 'Senior');
    
    // 3. Language & Timezone
    await page.selectOption('select[name="language"]', 'English');
    await page.selectOption('select[name="timezone"]', 'Africa/Casablanca');
    
    // 4. Interests (Multi-select)
    // Deselect all then select some
    const interestChips = page.locator('button:has-text("AI"), button:has-text("Tech"), button:has-text("Cloud")');
    if (await interestChips.count() > 0) {
      await interestChips.first().click();
      await interestChips.nth(1).click();
    }
    
    // 5. Notification Settings
    const recommendationsToggle = page.locator('button[role="switch"][aria-checked="true"]').first();
    if (await recommendationsToggle.isVisible()) {
      await recommendationsToggle.click();
      await expect(recommendationsToggle).toHaveAttribute('aria-checked', 'false');
    }
    
    // 6. Save Profile
    await page.click('button:has-text("Save Changes"), button:has-text("Enregistrer")');
    await expect.soft(page.locator('text=Profile updated, Success')).toBeVisible();
    
    // 7. Verify persistence
    await page.reload();
    await expect(page.locator('input[name="full_name"]')).toHaveValue('John Visitor Doe');
    await expect(page.locator('input[name="job_title"]')).toHaveValue('CTO');
    await expect(page.locator('input[name="company"]')).toHaveValue('Innovate Tech Corp');
  });
});
