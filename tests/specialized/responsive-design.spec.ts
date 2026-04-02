import { test, expect, devices } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Specialized - Responsive Design', () => {
  test.use({ storageState: users.visitor.storageState });

  const viewports = [
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    test(`Responsive layout check: ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      await page.goto('/dashboard');
      
      // 1. Navbar should be responsive
      const navbar = page.locator('nav, .navbar, .header');
      await expect(navbar).toBeVisible();
      
      if (viewport.width < 768) {
        // Hamburger menu for mobile
        const hamburger = page.locator('button[aria-label="Menu"], .hamburger, .menu-toggle');
        if (await hamburger.isVisible()) {
          await hamburger.click();
          // Sidebar or menu should appear
          const menu = page.locator('.mobile-menu, .sidebar, [role="navigation"]');
          await expect(menu).toBeVisible();
        }
      } else {
        // Desktop menu items should be visible
        const menuItems = page.locator('nav a, .nav-item');
        expect(await menuItems.count()).toBeGreaterThan(0);
      }
      
      // 2. Main content should fit
      const mainContent = page.locator('main, .content-container');
      await expect(mainContent).toBeVisible();
      const box = await mainContent.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(viewport.width);
      
      // 3. Grid layouts should adapt
      await page.goto('/events');
      const grid = page.locator('.events-grid, .grid');
      if (await grid.isVisible()) {
        const gridBox = await grid.boundingBox();
        expect(gridBox?.width).toBeLessThanOrEqual(viewport.width);
      }
      
      // 4. No horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 1); // Allow 1px for rounding
    });
  }
});
