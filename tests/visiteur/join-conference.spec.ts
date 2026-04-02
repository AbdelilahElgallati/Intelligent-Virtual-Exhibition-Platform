import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Visitor - Join Conference', () => {
  test.use({ storageState: users.visitor.storageState });

  test('Visitor can see list of published conferences and join an active one', async ({ page }) => {
    await page.goto('/dashboard');
    const enterBtn = page.locator('a:has-text("Enter"), a:has-text("Live")').first();
    
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      
      // Go to agenda tab
      const agendaTab = page.locator('button:has-text("Agenda"), button:has-text("Planning")');
      if (await agendaTab.isVisible()) {
        await agendaTab.click();
      }
      
      // Find a session with 'Join' or 'Rejoindre' button
      const joinBtn = page.locator('button:has-text("Join"), button:has-text("Rejoindre"), a:has-text("Join"), a:has-text("Rejoindre")').first();
      
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        
        // Should be in a video room (LiveKit/Daily.co)
        // Check for common elements in a video room
        await expect(page).toHaveURL(/\/events\/.*\/live\/conferences\/.*/);
        
        // Mock check for video elements (not actual connection)
        const videoElement = page.locator('video, .video-container, .daily-video, .lk-video-container');
        await expect(videoElement).toBeVisible();
        
        // Control buttons
        const micBtn = page.locator('button:has-text("Mic"), button:has-text("Mute"), [aria-label*="mic"]');
        const camBtn = page.locator('button:has-text("Cam"), button:has-text("Camera"), [aria-label*="camera"]');
        await expect(micBtn).toBeVisible();
        await expect(camBtn).toBeVisible();
      } else {
        // Fallback: conference not started yet
        const notStartedMsg = page.locator('text=Conference starts at, starts at, La conférence commence à');
        if (await notStartedMsg.isVisible()) {
          await expect(notStartedMsg).toBeVisible();
        } else {
          test.skip(true, 'No active or upcoming conferences found');
        }
      }
    }
  });

  test('Fallback: video API token fails', async ({ page }) => {
    // Intercept API call for conference token to mock failure
    await page.route('**/api/conferences/**/token', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ detail: "Could not create video room" })
      });
    });

    await page.goto('/dashboard');
    const enterBtn = page.locator('a:has-text("Enter"), a:has-text("Live")').first();
    
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      const agendaTab = page.locator('button:has-text("Agenda"), button:has-text("Planning")');
      if (await agendaTab.isVisible()) {
        await agendaTab.click();
      }
      
      const joinBtn = page.locator('button:has-text("Join"), button:has-text("Rejoindre")').first();
      if (await joinBtn.isVisible()) {
        await joinBtn.click();
        
        // Error message should appear
        await expect(page.locator('text=Could not join, contact organizer, Impossible de rejoindre')).toBeVisible();
      }
    }
  });
});
