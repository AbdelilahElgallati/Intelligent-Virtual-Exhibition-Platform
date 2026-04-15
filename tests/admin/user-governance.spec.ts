import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Admin - Governance and User Management', () => {
  test.use({ storageState: users.admin.storageState });

  test('Admin can manage account requests and governance', async ({ page }) => {
    // 1. Manage Organizer Registrations
    await page.goto('/admin/organizer-registrations');
    
    // Look for pending organizer requests
    const pendingOrgRow = page.locator('tr:has-text("PENDING"), .request-card:has-text("PENDING")').first();
    
    if (await pendingOrgRow.isVisible()) {
      await pendingOrgRow.locator('button:has-text("Approve"), button:has-text("Approuver")').click();
      await expect.soft(page.locator('text=Organizer approved, Success')).toBeVisible();
    }
    
    // 2. Manage Enterprise Registrations (Enterprises joining platform)
    await page.goto('/admin/organizations');
    const pendingEntRow = page.locator('tr:has-text("PENDING"), .org-card:has-text("PENDING")').first();
    if (await pendingEntRow.isVisible()) {
      await pendingEntRow.locator('button:has-text("Approve"), button:has-text("Approuver")').click();
      await expect.soft(page.locator('text=Organization approved, Success')).toBeVisible();
    }
    
    // 3. User Detail & Suspend
    await page.goto('/admin/users');
    const userRow = page.locator(`tr:has-text("${users.visitor.email}")`);
    if (await userRow.isVisible()) {
      await userRow.click();
      
      const suspendBtn = page.locator('button:has-text("Suspend"), button:has-text("Suspendre")');
      const activateBtn = page.locator('button:has-text("Activate"), button:has-text("Activer")');
      
      if (await suspendBtn.isVisible()) {
        await suspendBtn.click();
        await expect.soft(page.locator('text=User updated, User suspended, Success')).toBeVisible();
        await expect(page.locator('text=Suspended, Inactif')).toBeVisible();
        // Reactivate back
        await activateBtn.click();
        await expect.soft(page.locator('text=User updated, User activated, Success')).toBeVisible();
        await expect(page.locator('text=Active, Actif')).toBeVisible();
      }
    }
    
    // 4. Audit Logs
    await page.goto('/admin/audit');
    await expect(page.locator('table, .audit-list')).toBeVisible();
    // Check for recent audit entries
    await expect(page.locator('text=Action, User, Timestamp, Event, Utilisateur')).toBeVisible();
  });
});
