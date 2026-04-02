import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Specialized - Products & Services', () => {
  test.use({ storageState: users.entreprise.storageState });

  test('Exposant can add products to their stand', async ({ page }) => {
    await page.goto('/enterprise/products');
    
    const productName = `Product ${Date.now()}`;
    await page.locator('button:has-text("Add Product"), button:has-text("Nouveau Produit"), [aria-label="Add product"]').click();
    
    const modal = page.locator('.modal, [role="dialog"]');
    await modal.locator('input[name="name"], input#name').fill(productName);
    await modal.locator('textarea[name="description"], textarea#description').fill('A cool new product.');
    await modal.locator('input[name="price"], input#price').fill('99.99');
    
    // Select stand if needed
    const standSelect = modal.locator('select[name="stand_id"], select#stand_id');
    if (await standSelect.isVisible()) {
      await standSelect.selectOption({ index: 1 });
    }
    
    await modal.locator('button[type="submit"], button:has-text("Save"), button:has-text("Enregistrer")').click();
    
    // Success toast
    await expect.soft(page.locator('text=Product added, Produit ajouté, Success')).toBeVisible();
    
    // Check in list
    await expect(page.locator(`text=${productName}`)).toBeVisible();
  });

  test('Visitor can see products in stand detail', async ({ browser }) => {
    // 1. Get a product from entreprise view
    const exposantPage = await browser.newPage({ storageState: users.entreprise.storageState });
    await exposantPage.goto('/enterprise/products');
    const productName = await exposantPage.locator('.product-name, tr td').first().textContent();
    await exposantPage.close();

    // 2. Visitor views the stand
    const visitorPage = await browser.newPage({ storageState: users.visitor.storageState });
    await visitorPage.goto('/dashboard');
    const enterBtn = visitorPage.locator('a:has-text("Enter"), a:has-text("Live")').first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      const firstStand = visitorPage.locator('.stand-card').first();
      await firstStand.click();
      
      // Go to products tab
      const productsTab = visitorPage.locator('button:has-text("Products"), button:has-text("Catalog"), button:has-text("Catalogue")');
      if (await productsTab.isVisible()) {
        await productsTab.click();
      }
      
      if (productName) {
        await expect(visitorPage.locator(`text=${productName.trim()}`)).toBeVisible();
      }
    }
    await visitorPage.close();
  });
});
