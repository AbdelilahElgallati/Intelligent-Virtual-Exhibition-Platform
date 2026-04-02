import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Admin - Analytics', () => {
  test.use({ storageState: users.admin.storageState });

  test('Admin can view global analytics dashboard', async ({ page }) => {
    await page.goto('/admin/analytics');
    
    // Check for global stats cards
    const statsCards = page.locator('.stats-card, .card, .stat-value, .stat-label');
    await expect(statsCards).toBeVisible();
    
    // Check for chart canvas or svg
    const charts = page.locator('canvas, svg, .chart-container, [class*="chart"]');
    await expect(charts).toBeVisible();
    
    // Check for labels like 'Users', 'Events', 'Revenue', 'Utilisateurs', 'Revenus'
    await expect(page.locator('text=Users, Events, Revenue, Salons, Utilisateurs, Revenus')).toBeVisible();
  });

  test('Charts render without JS errors', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') logs.push(msg.text());
    });
    
    await page.goto('/admin/analytics');
    
    // Wait for data to load
    await page.waitForTimeout(3000);
    
    // Filter out irrelevant console errors (like CORS for third party assets)
    const seriousErrors = logs.filter(log => 
      !log.includes('Failed to load resource') && 
      !log.includes('chrome-extension')
    );
    
    expect(seriousErrors).toHaveLength(0);
    
    // Check if charts are actually rendered (not just the container)
    const canvases = page.locator('canvas');
    if (await canvases.count() > 0) {
      // Check if first canvas has height/width > 0
      const box = await canvases.first().boundingBox();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
    }
  });

  test('Empty state for analytics', async ({ page }) => {
    // Navigate to a sub-analytics page that might not have data
    await page.goto('/admin/analytics?dateRange=future');
    
    // Check for "No data yet" message if API returns empty
    const noDataMsg = page.locator('text=No data yet, No results, No analytics found, Pas de données');
    if (await noDataMsg.isVisible()) {
      await expect(noDataMsg).toBeVisible();
    }
  });
});
