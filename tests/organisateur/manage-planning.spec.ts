import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Organizer - Manage Planning', () => {
  test.use({ storageState: users.organisateur.storageState });

  test('Organisateur can add a conference slot to the agenda', async ({ page }) => {
    await page.goto('/organizer/events');
    const salonLink = page.locator('a:has-text("Manage"), a:has-text("Gérer"), a[href*="/organizer/events/"]').first();
    
    if (await salonLink.isVisible()) {
      await salonLink.click();
      
      // Look for agenda/planning tab
      const agendaTab = page.locator('button:has-text("Agenda"), button:has-text("Planning"), [aria-label="Agenda"]');
      await agendaTab.click();
      
      // Look for add session/conference button
      const addBtn = page.locator('button:has-text("Add"), button:has-text("Ajouter"), [aria-label="Add session"]');
      await addBtn.click();
      
      const modal = page.locator('.modal, [role="dialog"]');
      await expect(modal).toBeVisible();
      
      const sessionName = `Conference Slot ${Date.now()}`;
      await modal.locator('input[name="title"], input#title').fill(sessionName);
      await modal.locator('textarea[name="description"], textarea#description').fill('A great session about AI.');
      
      // Set time
      await modal.locator('input[type="time"], input#start_time').first().fill('10:00');
      await modal.locator('input[type="time"], input#end_time').first().fill('11:00');
      
      await modal.locator('button:has-text("Save"), button:has-text("Enregistrer")').click();
      
      // Success toast
      await expect.soft(page.locator('text=Session added, Session ajoutée')).toBeVisible();
      
      // Check in list
      await expect(page.locator(`text=${sessionName}`)).toBeVisible();
    } else {
      test.skip(true, 'No salons to add conferences to');
    }
  });

  test('Organisateur can edit an existing slot', async ({ page }) => {
    await page.goto('/organizer/events');
    const salonLink = page.locator('a:has-text("Manage"), a:has-text("Gérer"), a[href*="/organizer/events/"]').first();
    
    if (await salonLink.isVisible()) {
      await salonLink.click();
      await page.locator('button:has-text("Agenda"), button:has-text("Planning")').click();
      
      const editBtn = page.locator('button:has-text("Edit"), button:has-text("Modifier"), [aria-label="Edit session"]').first();
      
      if (await editBtn.isVisible()) {
        await editBtn.click();
        const updatedTitle = `Updated Session ${Date.now()}`;
        await page.locator('input[name="title"], input#title').fill(updatedTitle);
        await page.locator('button:has-text("Save"), button:has-text("Enregistrer")').click();
        
        await expect.soft(page.locator('text=Session updated, Session mise à jour')).toBeVisible();
        await expect(page.locator(`text=${updatedTitle}`)).toBeVisible();
      }
    }
  });

  test('Organisateur can delete a slot', async ({ page }) => {
    await page.goto('/organizer/events');
    const salonLink = page.locator('a:has-text("Manage"), a:has-text("Gérer"), a[href*="/organizer/events/"]').first();
    
    if (await salonLink.isVisible()) {
      await salonLink.click();
      await page.locator('button:has-text("Agenda"), button:has-text("Planning")').click();
      
      const sessionCountBefore = await page.locator('.session-card, .session-item').count();
      const deleteBtn = page.locator('button:has-text("Delete"), button:has-text("Supprimer"), [aria-label="Delete session"]').first();
      
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        
        // Confirm dialog
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Supprimer")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        
        await expect.soft(page.locator('text=Session deleted, Session supprimée')).toBeVisible();
        
        // Wait for removal
        await expect(async () => {
          const sessionCountAfter = await page.locator('.session-card, .session-item').count();
          expect(sessionCountAfter).toBeLessThan(sessionCountBefore);
        }).toPass();
      }
    }
  });
});
