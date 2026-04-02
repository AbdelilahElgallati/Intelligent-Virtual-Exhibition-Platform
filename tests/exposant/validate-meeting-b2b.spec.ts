import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Exposant - Validate Meeting B2B', () => {
  test.use({ storageState: users.entreprise.storageState });

  test('Exposant sees incoming meeting request and can accept it', async ({ page }) => {
    await page.goto('/enterprise/communications');
    
    // Look for pending requests tab/section
    const pendingTab = page.locator('button:has-text("Pending"), button:has-text("En attente"), [aria-label="Pending meetings"]');
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
    }
    
    // Find a pending request row
    const pendingRow = page.locator('tr:has-text("PENDING"), .meeting-card:has-text("PENDING"), .meeting-item:has-text("En attente")').first();
    
    if (await pendingRow.isVisible()) {
      await pendingRow.locator('button:has-text("Accept"), button:has-text("Accepter"), [aria-label="Accept meeting"]').click();
      
      // Success toast
      await expect.soft(page.locator('text=Meeting accepted, Rendez-vous accepté')).toBeVisible();
      
      // Status should update to accepted
      await expect(pendingRow.locator('text=ACCEPTED, Accepter')).toBeVisible();
      
      // Check for room URL/token in detail
      await pendingRow.click();
      const roomLink = page.locator('a[href*="daily.co"], a[href*="livekit"], a:has-text("Join"), a:has-text("Rejoindre")');
      await expect(roomLink).toBeVisible();
    } else {
      test.skip(true, 'No pending meeting requests to accept');
    }
  });

  test('Exposant can reject a meeting request', async ({ page }) => {
    await page.goto('/enterprise/communications');
    
    const pendingRow = page.locator('tr:has-text("PENDING"), .meeting-card:has-text("PENDING"), .meeting-item:has-text("En attente")').first();
    
    if (await pendingRow.isVisible()) {
      await pendingRow.locator('button:has-text("Reject"), button:has-text("Refuser"), [aria-label="Reject meeting"]').click();
      
      // Modal for reason if any
      const modal = page.locator('.modal, [role="dialog"]');
      if (await modal.isVisible()) {
        await modal.locator('textarea, input').fill('Schedule conflict');
        await modal.locator('button:has-text("Confirm"), button:has-text("Refuser")').click();
      }
      
      await expect.soft(page.locator('text=Meeting rejected, Rendez-vous refusé')).toBeVisible();
      await expect(pendingRow.locator('text=REJECTED, Refusé')).toBeVisible();
    }
  });
});
