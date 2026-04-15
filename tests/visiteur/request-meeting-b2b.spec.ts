import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Visitor - Request Meeting B2B', () => {
  test.use({ storageState: users.visitor.storageState });

  test('Visitor can request a B2B meeting with an exposant', async ({ page }) => {
    await page.goto('/dashboard');
    const enterBtn = page.locator('a:has-text("Enter"), a:has-text("Live")').first();
    
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      
      const firstStand = page.locator('.stand-card, .booth-card').first();
      await firstStand.click();
      
      // Look for request meeting button
      const requestBtn = page.locator('button:has-text("Request Meeting"), button:has-text("Rendez-vous"), button:has-text("Contact"), [aria-label="Request meeting"]');
      await requestBtn.click();
      
      // Meeting form modal
      const modal = page.locator('.modal, [role="dialog"]');
      await expect(modal).toBeVisible();
      
      await modal.locator('input[name="subject"], input#subject').fill('Discuss potential partnership');
      
      // Select a time slot if any
      const timeSlots = modal.locator('.time-slot, .slot-button, [aria-label*="Time slot"]');
      if (await timeSlots.count() > 0) {
        await timeSlots.first().click();
      }
      
      await modal.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Envoyer")').click();
      
      // Success confirmation
      await expect.soft(page.locator('text=Request sent, Votre demande a été envoyée, Success')).toBeVisible();
      
      // Check in visitor meetings list
      await page.goto('/dashboard/meetings');
      await expect(page.locator('text=Discuss potential partnership')).toBeVisible();
      await expect(page.locator('text=PENDING, En attente')).first().toBeVisible();
    } else {
      test.skip(true, 'No events available to request meetings in');
    }
  });

  test('[FAIL] Submit without selecting time', async ({ page }) => {
    await page.goto('/dashboard');
    const enterBtn = page.locator('a:has-text("Enter"), a:has-text("Live")').first();
    
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.locator('.stand-card, .booth-card').first().click();
      await page.locator('button:has-text("Request Meeting")').click();
      
      const modal = page.locator('.modal, [role="dialog"]');
      await modal.locator('input[name="subject"], input#subject').fill('No time selected test');
      
      // Skip selecting time slot
      await modal.locator('button[type="submit"]').click();
      
      // Error message
      await expect(modal.locator('text=Please select a time, Veuillez choisir un créneau, Time slot is required')).toBeVisible();
    }
  });
});
