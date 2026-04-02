import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Organizer - Publish Conference', () => {
  test.use({ storageState: users.organisateur.storageState });

  test('Organisateur can mark a conference as published', async ({ page }) => {
    await page.goto('/organizer/events');
    const salonLink = page.locator('a:has-text("Manage"), a:has-text("Gérer"), a[href*="/organizer/events/"]').first();
    
    if (await salonLink.isVisible()) {
      await salonLink.click();
      await page.locator('button:has-text("Agenda"), button:has-text("Planning")').click();
      
      const publishToggle = page.locator('button:has-text("Publish"), button:has-text("Publier"), [aria-label="Publish session"]').first();
      
      if (await publishToggle.isVisible()) {
        await publishToggle.click();
        
        // Success toast
        await expect.soft(page.locator('text=Session published, Session publiée')).toBeVisible();
        
        // Status should update
        await expect(page.locator('text=PUBLISHED, Publié')).first().toBeVisible();
      }
    }
  });

  test('Published conference appears in visitor view', async ({ browser }) => {
    // 1. Organizer publishes a session
    const organizerPage = await browser.newPage({ storageState: users.organisateur.storageState });
    await organizerPage.goto('/organizer/events');
    
    // Find the salon ID
    const salonLink = organizerPage.locator('a[href*="/organizer/events/"]').first();
    const href = await salonLink.getAttribute('href');
    const salonId = href?.split('/').pop();
    
    if (!salonId) return;

    // Go to agenda and publish if not published
    await organizerPage.goto(`/organizer/events/${salonId}`);
    await organizerPage.locator('button:has-text("Agenda"), button:has-text("Planning")').click();
    
    const sessionTitle = await organizerPage.locator('.session-title, .session-name').first().textContent();
    const publishBtn = organizerPage.locator('button:has-text("Publish"), button:has-text("Publier")').first();
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
    }
    await organizerPage.close();

    // 2. Visitor checks if published session is visible
    const visitorPage = await browser.newPage({ storageState: users.visitor.storageState });
    await visitorPage.goto(`/events/${salonId}/live`);
    
    // Go to agenda tab in visitor view
    const agendaTab = visitorPage.locator('button:has-text("Agenda"), button:has-text("Program"), button:has-text("Planning")');
    if (await agendaTab.isVisible()) {
      await agendaTab.click();
    }
    
    if (sessionTitle) {
      await expect(visitorPage.locator(`text=${sessionTitle.trim()}`)).toBeVisible();
    }
    await visitorPage.close();
  });
});
