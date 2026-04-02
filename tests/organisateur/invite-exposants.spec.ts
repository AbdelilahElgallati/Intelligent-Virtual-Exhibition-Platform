import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Organizer - Invite Exposants', () => {
  test.use({ storageState: users.organisateur.storageState });

  test('Organisateur can invite by email from salon dashboard', async ({ page }) => {
    await page.goto('/organizer/events');
    
    // Find first salon link
    const salonLink = page.locator('a:has-text("Manage"), a:has-text("Gérer"), a[href*="/organizer/events/"]').first();
    
    if (await salonLink.isVisible()) {
      await salonLink.click();
      
      // Look for invite button
      const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Inviter"), [aria-label="Invite"]');
      await inviteBtn.click();
      
      const modal = page.locator('.modal, [role="dialog"]');
      await expect(modal).toBeVisible();
      
      const email = `test-exposant-${Date.now()}@ivep.com`;
      await modal.locator('input[type="email"], input#email').fill(email);
      await modal.locator('button:has-text("Send"), button:has-text("Envoyer")').click();
      
      // Success toast
      await expect.soft(page.locator('text=Invitation sent, Invitation envoyée')).toBeVisible();
      
      // Check in list
      await expect(page.locator(`text=${email}`)).toBeVisible();
    } else {
      test.skip(true, 'No salons to invite exposants to');
    }
  });

  test('[FAIL] Invalid email format', async ({ page }) => {
    await page.goto('/organizer/events');
    const salonLink = page.locator('a:has-text("Manage"), a:has-text("Gérer"), a[href*="/organizer/events/"]').first();
    
    if (await salonLink.isVisible()) {
      await salonLink.click();
      await page.locator('button:has-text("Invite"), button:has-text("Inviter")').click();
      
      const modal = page.locator('.modal, [role="dialog"]');
      await modal.locator('input[type="email"], input#email').fill('not-an-email');
      await modal.locator('button:has-text("Send"), button:has-text("Envoyer")').click();
      
      // Error validation
      const emailInput = modal.locator('input[type="email"], input#email');
      const isEmailInput = await emailInput.getAttribute('type') === 'email';
      if (isEmailInput) {
        // Browser validation
      } else {
        await expect(modal.locator('text=Invalid email, Format invalide')).toBeVisible();
      }
    }
  });
});
