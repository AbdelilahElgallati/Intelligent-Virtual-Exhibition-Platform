import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Admin - Manage Salons', () => {
  test.use({ storageState: users.admin.storageState });

  test('Admin can view list of all salons', async ({ page }) => {
    await page.goto('/admin/events');
    
    // Wait for the table or list to be visible
    const eventList = page.locator('table, .events-grid, .events-list');
    await expect(eventList).toBeVisible();
    
    // Check if we have at least headers or empty state
    if (await page.locator('text=No salons found, No events yet, Aucune exposition').isVisible()) {
      await expect(page.locator('text=No salons found, No events yet, Aucune exposition')).toBeVisible();
    } else {
      // Check for status column
      await expect(page.locator('text=Status, État')).toBeVisible();
    }
  });

  test('Admin sees salon status', async ({ page }) => {
    await page.goto('/admin/events');
    
    // Look for status badges
    const statusBadges = page.locator('.badge, .status-badge, [class*="badge"]');
    if (await statusBadges.count() > 0) {
      const text = await statusBadges.first().textContent();
      expect(['PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED', 'DRAFT', 'En attente', 'Approuvé', 'Rejeté']).toContain(text?.trim());
    }
  });
});
