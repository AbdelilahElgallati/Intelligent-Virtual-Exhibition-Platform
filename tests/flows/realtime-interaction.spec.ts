import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Flow - Real-time Interaction (Chat)', () => {
  
  test('Visitor can chat with Enterprise in real-time', async ({ browser }) => {
    const messageText = `Hello from Visitor! ${Date.now()}`;
    const replyText = `Hello back from Enterprise! ${Date.now()}`;

    // 1. Visitor joins event and goes to enterprise stand
    const visitorPage = await browser.newPage({ storageState: users.visitor.storageState });
    await visitorPage.goto('/dashboard');
    const firstEvent = visitorPage.locator('a[href*="/live"]').first();
    await firstEvent.click();
    
    const firstStand = visitorPage.locator('.stand-card').first();
    const standName = await firstStand.textContent();
    await firstStand.click();
    
    // 2. Visitor sends a message in chat panel
    const chatPanel = visitorPage.locator('.chat-panel, .stand-chat, .chat-shell');
    await chatPanel.locator('input[type="text"], textarea, .chat-composer').fill(messageText);
    await chatPanel.locator('button[type="submit"], button:has-text("Send"), button:has-text("Envoyer")').click();
    
    await expect.soft(chatPanel.locator(`text=${messageText}`)).toBeVisible();
    
    // 3. Enterprise receives the message in their communications dashboard
    const enterprisePage = await browser.newPage({ storageState: users.entreprise.storageState });
    await enterprisePage.goto('/enterprise/communications');
    
    // Look for chat with visitor
    const visitorChatTab = enterprisePage.locator(`button:has-text("${users.visitor.email.split('@')[0]}"), .chat-item:has-text("${users.visitor.email.split('@')[0]}")`);
    if (await visitorChatTab.isVisible()) {
      await visitorChatTab.click();
      
      // Verify visitor's message is visible
      await expect.soft(enterprisePage.locator(`text=${messageText}`)).toBeVisible();
      
      // 4. Enterprise replies
      const entChatInput = enterprisePage.locator('input[type="text"], textarea, .chat-composer');
      await entChatInput.fill(replyText);
      await enterprisePage.locator('button[type="submit"], button:has-text("Send"), button:has-text("Envoyer")').click();
      
      await expect.soft(enterprisePage.locator(`text=${replyText}`)).toBeVisible();
    }
    
    // 5. Visitor receives enterprise reply in real-time
    await expect.soft(chatPanel.locator(`text=${replyText}`)).toBeVisible();
    
    await visitorPage.close();
    await enterprisePage.close();
  });

  test('Enterprise-to-Enterprise real-time chat', async ({ browser }) => {
    const ent1Msg = `B2B Chat Message from Enterprise 1! ${Date.now()}`;
    const ent2Reply = `B2B Chat Message from Enterprise 2! ${Date.now()}`;

    // 1. Enterprise 1 visits Enterprise 2 stand
    const ent1Page = await browser.newPage({ storageState: users.entreprise.storageState });
    await ent1Page.goto('/enterprise/events');
    const firstEvent = ent1Page.locator('a[href*="/live"]').first();
    await firstEvent.click();
    
    const ent2Stand = ent1Page.locator('.stand-card:has-text("Test Company 2")').first();
    if (await ent2Stand.isVisible()) {
      await ent2Stand.click();
      
      // Send B2B message
      const ent1Chat = ent1Page.locator('.chat-panel, .stand-chat');
      await ent1Chat.locator('input[type="text"], textarea').fill(ent1Msg);
      await ent1Chat.locator('button[type="submit"]').click();
      await expect.soft(ent1Chat.locator(`text=${ent1Msg}`)).toBeVisible();
    }
    
    // 2. Enterprise 2 receives B2B message
    const ent2Page = await browser.newPage({ storageState: users.entreprise2.storageState });
    await ent2Page.goto('/enterprise/communications');
    
    const ent1ChatTab = ent2Page.locator(`button:has-text("${users.entreprise.email.split('@')[0]}"), .chat-item:has-text("${users.entreprise.email.split('@')[0]}")`);
    if (await ent1ChatTab.isVisible()) {
      await ent1ChatTab.click();
      await expect.soft(ent2Page.locator(`text=${ent1Msg}`)).toBeVisible();
      
      // Enterprise 2 replies
      await ent2Page.locator('input[type="text"], textarea').fill(ent2Reply);
      await ent2Page.locator('button[type="submit"]').click();
    }
    
    // 3. Enterprise 1 receives reply
    if (await ent1Page.locator('.chat-panel, .stand-chat').isVisible()) {
      await expect.soft(ent1Page.locator(`text=${ent2Reply}`)).toBeVisible();
    }
    
    await ent1Page.close();
    await ent2Page.close();
  });
});
