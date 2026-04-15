import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Exposant - Manage Stand', () => {
  test.use({ storageState: users.entreprise.storageState });

  test('Exposant can view and edit their stand page', async ({ page }) => {
    await page.goto('/enterprise/events');
    
    // Find first event to manage stand
    const manageBtn = page.locator('a:has-text("Stand"), a:has-text("Gérer Stand"), a[href*="/stand"]').first();
    
    if (await manageBtn.isVisible()) {
      await manageBtn.click();
      
      const newName = `Updated Stand Name ${Date.now()}`;
      const newDesc = 'New updated description for our stand.';
      
      await page.fill('input[name="name"], input#name', newName);
      await page.fill('textarea[name="description"], textarea#description', newDesc);
      
      await page.click('button[type="submit"], button:has-text("Save"), button:has-text("Enregistrer")');
      
      // Success toast
      await expect.soft(page.locator('text=Stand updated, Stand mis à jour, Success')).toBeVisible();
      
      // Reload and verify
      await page.reload();
      await expect(page.locator('input[name="name"], input#name')).toHaveValue(newName);
      await expect(page.locator('textarea[name="description"], textarea#description')).toHaveValue(newDesc);
    } else {
      test.skip(true, 'No events joined to manage stand');
    }
  });

  test('[FAIL] Empty name', async ({ page }) => {
    await page.goto('/enterprise/events');
    const manageBtn = page.locator('a:has-text("Stand"), a[href*="/stand"]').first();
    
    if (await manageBtn.isVisible()) {
      await manageBtn.click();
      
      await page.fill('input[name="name"], input#name', '');
      await page.click('button[type="submit"], button:has-text("Save"), button:has-text("Enregistrer")');
      
      // Validation error
      await expect(page.locator('text=Name is required, Required, Ce champ est obligatoire')).toBeVisible();
    }
  });
});
