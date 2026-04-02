import { Page, expect } from '@playwright/test';

/**
 * Fills Stripe test card 4242 4242 4242 4242.
 */
export async function fillStripeCheckout(page: Page) {
  // Wait for Stripe Checkout to load
  await page.waitForSelector('iframe[src*="stripe.com"]', { timeout: 15000 });
  
  // Fill in email if not already there
  const emailInput = page.locator('input#email');
  if (await emailInput.isVisible()) {
    await emailInput.fill('visitor-test@ivep.com');
  }

  // Fill in Card Number
  const cardNumberInput = page.locator('input#cardNumber');
  await cardNumberInput.fill('4242');
  await cardNumberInput.pressSequentially('424242424242');

  // Fill in Expiry
  const cardExpiryInput = page.locator('input#cardExpiry');
  await cardExpiryInput.fill('12');
  await cardExpiryInput.pressSequentially('34');

  // Fill in CVC
  const cardCvcInput = page.locator('input#cardCvc');
  await cardCvcInput.fill('123');

  // Fill in ZIP
  const billingZipInput = page.locator('input#billingPostalCode');
  if (await billingZipInput.isVisible()) {
    await billingZipInput.fill('10001');
  }

  // Click Pay
  await page.click('button[type="submit"]');
}

/**
 * Fills declined card 4000 0000 0000 0002.
 */
export async function fillStripeDeclined(page: Page) {
  await page.waitForSelector('iframe[src*="stripe.com"]', { timeout: 15000 });
  
  const cardNumberInput = page.locator('input#cardNumber');
  await cardNumberInput.fill('4000');
  await cardNumberInput.pressSequentially('000000000002');

  await page.locator('input#cardExpiry').fill('12');
  await page.locator('input#cardExpiry').pressSequentially('34');
  await page.locator('input#cardCvc').fill('123');
  
  await page.click('button[type="submit"]');
  
  // Verify error message
  await expect(page.locator('.Error')).toContainText('Your card was declined');
}

/**
 * Waits for success redirect after payment.
 */
export async function waitForStripeRedirect(page: Page) {
  await page.waitForURL(/\/marketplace\/success/, { timeout: 30000 });
  await expect(page.locator('h1, h2')).toContainText(['Success', 'Thank you', 'Confirmation', 'Paiement réussi']);
}
