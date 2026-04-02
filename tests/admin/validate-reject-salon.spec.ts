import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Admin - Validate/Reject Salon', () => {
  test.use({ storageState: users.admin.storageState });

  test('Admin approves a pending salon', async ({ page }) => {
    await page.goto('/admin/events');
    
    // Find a pending salon
    const pendingRow = page.locator('tr:has-text("PENDING"), tr:has-text("En attente")').first();
    
    if (await pendingRow.isVisible()) {
      await pendingRow.locator('button:has-text("Approve"), button:has-text("Approuver"), [aria-label="Approve"]').click();
      
      // Check for success toast or status update
      await expect.soft(page.locator('text=Salon approved, Exposition approuvée, Success')).toBeVisible();
      
      // Wait for status to update
      await expect(pendingRow.locator('text=APPROVED, Approuvé')).toBeVisible();
    } else {
      test.skip(true, 'No pending salons to approve');
    }
  });

  test('Admin rejects a salon with a reason', async ({ page }) => {
    await page.goto('/admin/events');
    
    const pendingRow = page.locator('tr:has-text("PENDING"), tr:has-text("En attente")').first();
    
    if (await pendingRow.isVisible()) {
      await pendingRow.locator('button:has-text("Reject"), button:has-text("Rejeter"), [aria-label="Reject"]').click();
      
      // Modal should appear for rejection reason
      const modal = page.locator('.modal, [role="dialog"]');
      await expect(modal).toBeVisible();
      
      await modal.locator('textarea, input#reason').fill('Insufficient documentation');
      await modal.locator('button:has-text("Confirm"), button:has-text("Rejeter")').click();
      
      await expect.soft(page.locator('text=Salon rejected, Exposition rejetée')).toBeVisible();
      await expect(pendingRow.locator('text=REJECTED, Rejeté')).toBeVisible();
    } else {
      test.skip(true, 'No pending salons to reject');
    }
  });

  test('Admin cannot approve an already-approved salon', async ({ page }) => {
    await page.goto('/admin/events');
    
    const approvedRow = page.locator('tr:has-text("APPROVED"), tr:has-text("Approuvé")').first();
    
    if (await approvedRow.isVisible()) {
      const approveBtn = approvedRow.locator('button:has-text("Approve"), button:has-text("Approuver")');
      if (await approveBtn.isVisible()) {
        await expect(approveBtn).toBeDisabled();
      } else {
        // Button is hidden, which is also fine
        await expect(approveBtn).not.toBeVisible();
      }
    }
  });
});
