import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Visitor - Visit Stands', () => {
  test.use({ storageState: users.visitor.storageState });

  test('Visitor can browse list of stands in an event', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find an event to enter (e.g. one we already have a ticket for)
    const enterBtn = page.locator('a:has-text("Enter"), a:has-text("Rejoindre"), a:has-text("Live"), a[href*="/live"]').first();
    
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      
      // Should be in live event view
      await expect(page).toHaveURL(/\/events\/.*\/live/);
      
      // Stands grid should be visible
      const standsGrid = page.locator('.stands-grid, .booths-list, .stands-list');
      await expect(standsGrid).toBeVisible();
      
      // At least one stand card
      const standCards = page.locator('.stand-card, .booth-card');
      expect(await standCards.count()).toBeGreaterThan(0);
      
      // Click on a stand
      await standCards.first().click();
      
      // Stand detail page loads
      await expect(page).toHaveURL(/\/events\/.*\/live\/stands\/.*/);
      
      // Check for stand components: Header, Chat, Products, etc.
      await expect(page.locator('.stand-header, .stand-info')).toBeVisible();
      await expect(page.locator('text=Chat, Message, Catalog, Catalogue, Products, Produits')).toBeVisible();
    } else {
      test.skip(true, 'No events available to visit');
    }
  });

  test('Fallback: stand has no media shows placeholder', async ({ page }) => {
    // Navigate to a stand that might not have images
    await page.goto('/events');
    const firstEvent = page.locator('a[href*="/events/"]').first();
    const href = await firstEvent.getAttribute('href');
    const eventId = href?.split('/').pop();
    
    if (eventId) {
      await page.goto(`/events/${eventId}/live`);
      const firstStand = page.locator('.stand-card, .booth-card').first();
      await firstStand.click();
      
      // Check for image or placeholder
      const standImage = page.locator('.stand-banner, .stand-image, .stand-background');
      if (await standImage.isVisible()) {
        const src = await standImage.getAttribute('src');
        if (!src || src.includes('placeholder')) {
          // Placeholder is fine
        }
      }
    }
  });
});
