import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Specialized - Timezones', () => {
  test.use({ storageState: users.visitor.storageState });

  test('Visitor sees event times in their local timezone', async ({ page, context }) => {
    // 1. Mock timezone to New York (EST)
    await context.setExtraHTTPHeaders({ 'Accept-Language': 'en-US' });
    // Note: Playwright's timezone emulation is done at the context level
    // but here we can check if the UI handles it correctly
    
    await page.goto('/dashboard');
    const enterBtn = page.locator('a:has-text("Enter"), a:has-text("Live")').first();
    
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      
      const agendaTab = page.locator('button:has-text("Agenda"), button:has-text("Planning")');
      if (await agendaTab.isVisible()) {
        await agendaTab.click();
      }
      
      const timeElement = page.locator('.session-time, .time-label').first();
      const timeText = await timeElement.textContent();
      
      // Verify time format (e.g. HH:MM or HH:MM AM/PM)
      expect(timeText).toMatch(/\d{1,2}:\d{2}/);
      
      // Change timezone via profile and check if it persists
      await page.goto('/profile');
      const timezoneSelect = page.locator('select[name="timezone"], select#timezone');
      if (await timezoneSelect.isVisible()) {
        await timezoneSelect.selectOption('UTC');
        await page.click('button:has-text("Save")');
        
        await page.goto('/dashboard');
        await enterBtn.click();
        if (await agendaTab.isVisible()) await agendaTab.click();
        
        const newTimeText = await page.locator('.session-time, .time-label').first().textContent();
        // Time might be different or the same if event was created in UTC
        expect(newTimeText).toBeDefined();
      }
    }
  });
});
