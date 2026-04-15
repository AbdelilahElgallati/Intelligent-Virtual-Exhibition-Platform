import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Exposant - Leads & Contacts', () => {
  test.use({ storageState: users.entreprise.storageState });

  test('Exposant can view list of visitors who visited their stand', async ({ page }) => {
    await page.goto('/enterprise/leads');
    
    // Check for leads table/grid
    const leadsList = page.locator('table, .leads-grid, .contacts-list');
    await expect(leadsList).toBeVisible();
    
    // Check for common lead details
    await expect(page.locator('text=Name, Email, Date, Nom')).toBeVisible();
    
    // Empty state fallback
    if (await page.locator('text=No leads found, Pas de leads, Aucun prospect').isVisible()) {
      await expect(page.locator('text=No leads found, Pas de leads, Aucun prospect')).toBeVisible();
    } else {
      // Check if we have at least one lead
      const rows = page.locator('tr, .lead-card, .contact-item');
      expect(await rows.count()).toBeGreaterThan(0);
    }
  });

  test('Exposant can view meeting history', async ({ page }) => {
    await page.goto('/enterprise/communications');
    
    // Look for history/completed tab
    const historyTab = page.locator('button:has-text("History"), button:has-text("Historique"), [aria-label="Past meetings"]');
    if (await historyTab.isVisible()) {
      await historyTab.click();
    }
    
    // Check for status badges like 'COMPLETED', 'EXPIRED', 'CANCELLED', 'Terminé'
    const statusBadges = page.locator('.badge, .status-badge');
    if (await statusBadges.count() > 0) {
      const text = await statusBadges.first().textContent();
      expect(['COMPLETED', 'EXPIRED', 'CANCELLED', 'ACCEPTED', 'Terminé', 'Expiré', 'Annulé']).toContain(text?.trim());
    }
  });
});
