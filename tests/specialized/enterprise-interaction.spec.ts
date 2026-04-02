import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Specialized - Enterprise Interaction', () => {
  
  test('Two enterprises can chat and request meetings', async ({ browser }) => {
    // 1. Enterprise 1 requests a meeting with Enterprise 2
    const ent1Page = await browser.newPage({ storageState: users.entreprise.storageState });
    await ent1Page.goto('/enterprise/events');
    const firstEvent = ent1Page.locator('a[href*="/live"]').first();
    await firstEvent.click();
    
    // Find Enterprise 2 stand
    const ent2Stand = ent1Page.locator('.stand-card:has-text("Test Company 2")').first();
    if (await ent2Stand.isVisible()) {
      await ent2Stand.click();
      
      const subject = `B2B Enterprise Interaction ${Date.now()}`;
      await ent1Page.locator('button:has-text("Request Meeting")').click();
      await ent1Page.locator('input[name="subject"]').fill(subject);
      const firstSlot = ent1Page.locator('.time-slot').first();
      if (await firstSlot.isVisible()) await firstSlot.click();
      await ent1Page.locator('button[type="submit"]').click();
      await expect.soft(ent1Page.locator('text=Request sent')).toBeVisible();
      
      // Send a chat message
      const chatPanel = ent1Page.locator('.chat-panel, .stand-chat');
      if (await chatPanel.isVisible()) {
        await chatPanel.locator('input[type="text"], textarea').fill('Hello from Enterprise 1!');
        await chatPanel.locator('button[type="submit"], button:has-text("Send")').click();
        await expect.soft(chatPanel.locator('text=Hello from Enterprise 1!')).toBeVisible();
      }
    }
    await ent1Page.close();

    // 2. Enterprise 2 receives meeting and chat
    const ent2Page = await browser.newPage({ storageState: users.entreprise2.storageState });
    await ent2Page.goto('/enterprise/communications');
    
    // Check meeting
    const pendingTab = ent2Page.locator('button:has-text("Pending"), button:has-text("En attente")');
    if (await pendingTab.isVisible()) await pendingTab.click();
    await expect(ent2Page.locator(`text=B2B Enterprise Interaction`)).toBeVisible();
    
    // Check chat
    await ent2Page.goto('/enterprise/communications');
    const chatTab = ent2Page.locator('button:has-text("Chat"), button:has-text("Messages")');
    if (await chatTab.isVisible()) await chatTab.click();
    await expect(ent2Page.locator('text=Hello from Enterprise 1!')).toBeVisible();
    
    // Reply to chat
    const chatInput = ent2Page.locator('input[type="text"], textarea');
    if (await chatInput.isVisible()) {
      await chatInput.fill('Hello back from Enterprise 2!');
      await ent2Page.locator('button[type="submit"], button:has-text("Send")').click();
      await expect.soft(ent2Page.locator('text=Hello back from Enterprise 2!')).toBeVisible();
    }
    await ent2Page.close();
  });
});
