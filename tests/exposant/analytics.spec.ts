import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Exposant - Analytics & Insights', () => {
  test.use({ storageState: users.entreprise.storageState });

  test('Exposant can view analytics and insights for their stand', async ({ page }) => {
    await page.goto('/enterprise/analytics');
    
    // Check for global analytics dashboard
    await expect(page.locator('.analytics-dashboard, .stats-grid')).toBeVisible();
    
    // Check for metrics: Traffic, Engagement, Product Clicks, Meetings
    await expect(page.locator('text=Traffic, Engagement, Product Clicks, Meetings, Visitées, Clics, Rendez-vous')).toBeVisible();
    
    // Check for charts
    await expect(page.locator('canvas, svg, .chart-container')).toBeVisible();
    
    // Check if we can filter by event
    const eventFilter = page.locator('select[name="event_id"], select#event_id');
    if (await eventFilter.isVisible()) {
      await eventFilter.selectOption({ index: 1 });
      await expect.soft(page.locator('text=Loading, Actualisation...')).toBeVisible();
    }
    
    // Check for AI recommendations (B2B Matches, Recommended Events)
    const recommendations = page.locator('.recommendations-section, .ai-insights');
    if (await recommendations.isVisible()) {
      await expect(recommendations.locator('text=Matches, Suggestions, Potential Leads')).toBeVisible();
    }
  });
});
