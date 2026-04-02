import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';
import { fillStripeCheckout, fillStripeDeclined, waitForStripeRedirect } from '../helpers/stripe.helper';

test.describe('Visitor - Buy Ticket (Stripe)', () => {
  test.use({ storageState: users.visitor.storageState });

  test('Visitor buys a ticket with valid test card', async ({ page }) => {
    await page.goto('/events');
    
    // Find an event card with a buy button
    const buyBtn = page.locator('button:has-text("Acheter"), button:has-text("Buy"), button:has-text("Ticket")').first();
    
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      
      // Redirect to Stripe
      await fillStripeCheckout(page);
      
      // Redirect back to success page
      await waitForStripeRedirect(page);
      
      // Check for ticket confirmation
      await expect(page.locator('text=Ticket confirmed, Ticket acheté, Confirmation')).toBeVisible();
    } else {
      test.skip(true, 'No events with tickets available to buy');
    }
  });

  test('[FAIL] Fills declined card', async ({ page }) => {
    await page.goto('/events');
    const buyBtn = page.locator('button:has-text("Acheter"), button:has-text("Buy")').first();
    
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      await fillStripeDeclined(page);
    }
  });

  test('[FAIL] Incomplete card number', async ({ page }) => {
    await page.goto('/events');
    const buyBtn = page.locator('button:has-text("Acheter"), button:has-text("Buy")').first();
    
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      
      await page.waitForSelector('iframe[src*="stripe.com"]', { timeout: 15000 });
      const cardNumberInput = page.locator('input#cardNumber');
      await cardNumberInput.fill('4242'); // Incomplete
      
      await page.click('button[type="submit"]');
      
      // Stripe should show validation error
      await expect(page.locator('text=incomplete, invalid, error')).toBeVisible();
    }
  });
});
