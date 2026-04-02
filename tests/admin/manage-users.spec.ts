import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Admin - Manage Users', () => {
  test.use({ storageState: users.admin.storageState });

  test('Admin can list all users', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Check table headers
    await expect(page.locator('text=Email, Role, Status, Rôle, État')).toBeVisible();
    
    // Check if test users are listed
    await expect(page.locator(`text=${users.organisateur.email}`)).toBeVisible();
    await expect(page.locator(`text=${users.visitor.email}`)).toBeVisible();
  });

  test('Admin can deactivate a user account', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Find visitor user row
    const visitorRow = page.locator(`tr:has-text("${users.visitor.email}")`);
    
    if (await visitorRow.isVisible()) {
      // Toggle active status
      const deactivateBtn = visitorRow.locator('button:has-text("Deactivate"), button:has-text("Désactiver"), [aria-label="Deactivate"]');
      await deactivateBtn.click();
      
      // Confirm dialog if any
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Confirmer")');
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
      
      // Wait for success toast
      await expect.soft(page.locator('text=User updated, User deactivated, Utilisateur mis à jour')).toBeVisible();
      
      // Status should update to inactive
      await expect(visitorRow.locator('text=Inactive, Inactif, DESACTIVÉ')).toBeVisible();
      
      // Reactivate for other tests
      await visitorRow.locator('button:has-text("Activate"), button:has-text("Activer"), [aria-label="Activate"]').click();
      await expect(visitorRow.locator('text=Active, Actif')).toBeVisible();
    }
  });
});
