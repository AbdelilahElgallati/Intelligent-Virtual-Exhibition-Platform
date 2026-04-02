import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Organizer - Create Salon', () => {
  test.use({ storageState: users.organisateur.storageState });

  test('Organisateur fills form and submits', async ({ page }) => {
    await page.goto('/organizer/events/new');
    
    const salonName = `Test Expo ${Date.now()}`;
    await page.fill('input[name="name"], input#name', salonName);
    await page.fill('textarea[name="description"], textarea#description', 'A professional virtual expo for testing.');
    
    // Fill dates
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 10);
    
    await page.fill('input[name="start_date"], input#start_date', startDate.toISOString().split('T')[0]);
    await page.fill('input[name="end_date"], input#end_date', endDate.toISOString().split('T')[0]);
    
    // Select category if exists
    const categorySelect = page.locator('select[name="category"], select#category');
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption({ index: 1 });
    }
    
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Créer")');
    
    // Success -> redirected to salon dashboard or list
    await page.waitForURL(new RegExp(`/organizer/events/|/organizer/events`));
    await expect(page).toHaveURL(new RegExp(`/organizer/events/|/organizer/events`));
    
    // Check if new salon is visible in list
    await page.goto('/organizer/events');
    await expect(page.locator(`text=${salonName}`)).toBeVisible();
  });

  test('[FAIL] Missing required fields', async ({ page }) => {
    await page.goto('/organizer/events/new');
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Créer")');
    
    // Check for inline validation
    const nameInput = page.locator('input[name="name"], input#name');
    const errorMsg = page.locator('text=Required, Name is required, Ce champ est obligatoire');
    
    const isRequired = await nameInput.getAttribute('required');
    if (isRequired !== null) {
      // Browser stops submission
    } else {
      await expect(errorMsg).toBeVisible();
    }
  });

  test('[FAIL] End date before start date', async ({ page }) => {
    await page.goto('/organizer/events/new');
    
    await page.fill('input[name="name"], input#name', 'Invalid Dates Expo');
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() + 5);
    
    await page.fill('input[name="start_date"], input#start_date', futureDate.toISOString().split('T')[0]);
    await page.fill('input[name="end_date"], input#end_date', pastDate.toISOString().split('T')[0]);
    
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Créer")');
    
    // Error message should appear
    await expect(page.locator('text=End date must be after start date, Date invalide')).toBeVisible();
  });
});
