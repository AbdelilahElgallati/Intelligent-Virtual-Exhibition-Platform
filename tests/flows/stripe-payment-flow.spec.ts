import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';
import { fillStripeCheckout, waitForStripeRedirect } from '../helpers/stripe.helper';

test.describe('Flow - Stripe Payment', () => {
  test.use({ storageState: users.visitor.storageState });

  test('Full Stripe payment flow from event list to paid ticket', async ({ page }) => {
    await page.goto('/events');
    
    // 1. Choose an event with ticket price
    const eventCard = page.locator('.event-card').filter({ hasText: '€' }).first();
    if (await eventCard.isVisible()) {
      await eventCard.locator('button:has-text("Buy"), button:has-text("Acheter")').click();
      
      // 2. Redirect to Stripe
      await fillStripeCheckout(page);
      
      // 3. Wait for success redirect
      await waitForStripeRedirect(page);
      
      // 4. Verify ticket status via API polling or UI check
      // Polling GET /tickets/my-tickets for max 10s
      await expect(async () => {
        await page.goto('/dashboard/orders');
        const latestOrder = page.locator('tr, .order-card').first();
        await expect(latestOrder.locator('text=PAID, Payé, Success')).toBeVisible();
      }).toPass({ timeout: 15000 });
      
      await expect(page.locator('text=Ticket confirmed')).toBeVisible();
    } else {
      test.skip(true, 'No paid events available for testing');
    }
  });
});
