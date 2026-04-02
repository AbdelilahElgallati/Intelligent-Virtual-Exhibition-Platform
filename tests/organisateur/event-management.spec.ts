import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Organizer - Advanced Event Management', () => {
  test.use({ storageState: users.organisateur.storageState });

  test('Organizer can manage sessions, assignments and visitor registration', async ({ page }) => {
    // 1. Assign Conference to Enterprise
    await page.goto('/organizer/events');
    const salonLink = page.locator('a[href*="/organizer/events/"]').first();
    const href = await salonLink.getAttribute('href');
    const salonId = href?.split('/').pop();
    
    if (salonId) {
      await page.goto(`/organizer/events/${salonId}`);
      
      // Go to agenda tab
      const agendaTab = page.locator('button:has-text("Agenda"), button:has-text("Planning")');
      await agendaTab.click();
      
      // Add a session and assign to enterprise
      await page.click('button:has-text("Add"), button:has-text("Ajouter")');
      const modal = page.locator('.modal, [role="dialog"]');
      await modal.locator('input[name="title"]').fill(`B2B Conference ${Date.now()}`);
      
      // Assign to enterprise if select exists
      const entSelect = modal.locator('select[name="enterprise_id"], select#enterprise_id');
      if (await entSelect.isVisible()) {
        await entSelect.selectOption({ label: 'Test Company 1' });
      }
      
      await modal.locator('button[type="submit"]').click();
      await expect.soft(page.locator('text=Session added, Success')).toBeVisible();
      
      // 2. Manage Visitor Join Requests
      // Depending on implementation, this might be in event-join-requests or within event detail
      await page.goto(`/organizer/events/${salonId}`);
      const visitorRequestsTab = page.locator('button:has-text("Visitors"), button:has-text("Requests"), button:has-text("Inscriptions")');
      if (await visitorRequestsTab.isVisible()) {
        await visitorRequestsTab.click();
        
        // Find a pending visitor request
        const pendingVisitor = page.locator('tr:has-text("PENDING"), .request-card:has-text("PENDING")').first();
        if (await pendingVisitor.isVisible()) {
          await pendingVisitor.locator('button:has-text("Approve"), button:has-text("Accepter")').click();
          await expect.soft(page.locator('text=Visitor approved, Success')).toBeVisible();
        }
      }
      
      // 3. View Analytics Report
      await page.goto(`/organizer/events/${salonId}/analytics`);
      await expect(page.locator('canvas, svg, .analytics-grid')).toBeVisible();
      await expect(page.locator('text=Traffic, Engagement, Leads, Registered')).toBeVisible();
      
      // Export report if button exists
      const exportBtn = page.locator('button:has-text("Export"), button:has-text("Report"), button:has-text("PDF")');
      if (await exportBtn.isVisible()) {
        await exportBtn.click();
        await expect.soft(page.locator('text=Report generated, Exporting...')).toBeVisible();
      }
    }
  });
});
