import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Exposant - Detailed Product & Service Management', () => {
  test.use({ storageState: users.entreprise.storageState });

  test('Exposant can manage full product/service catalog', async ({ page }) => {
    await page.goto('/enterprise/products');
    
    // 1. Add New Product
    const productName = `Product ${Date.now()}`;
    await page.click('button:has-text("Add Product"), button:has-text("Nouveau Produit")');
    
    await page.fill('input[name="name"]', productName);
    await page.fill('textarea[name="description"]', 'A detailed product description.');
    await page.fill('input[name="price"]', '150.50');
    await page.selectOption('select[name="currency"]', 'MAD');
    await page.fill('input[name="stock"]', '50');
    await page.selectOption('select[name="type"]', 'product');
    
    await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Enregistrer")');
    await expect.soft(page.locator(`text=${productName}`)).toBeVisible();
    
    // 2. Add New Service
    const serviceName = `Service ${Date.now()}`;
    await page.click('button:has-text("Add Product"), button:has-text("Nouveau Produit")');
    
    await page.fill('input[name="name"]', serviceName);
    await page.fill('textarea[name="description"]', 'A specialized service description.');
    await page.fill('input[name="price"]', '500');
    await page.selectOption('select[name="type"]', 'service');
    
    await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Enregistrer")');
    await expect.soft(page.locator(`text=${serviceName}`)).toBeVisible();
    
    // 3. Edit Product
    const productRow = page.locator(`tr:has-text("${productName}"), .product-card:has-text("${productName}")`);
    await productRow.locator('button:has-text("Edit"), button:has-text("Modifier")').click();
    
    const updatedName = `${productName} (Updated)`;
    await page.fill('input[name="name"]', updatedName);
    await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Enregistrer")');
    
    await expect.soft(page.locator(`text=${updatedName}`)).toBeVisible();
    
    // 4. Delete Product
    const updatedRow = page.locator(`tr:has-text("${updatedName}"), .product-card:has-text("${updatedName}")`);
    await updatedRow.locator('button:has-text("Delete"), button:has-text("Supprimer")').click();
    
    // Handle confirmation dialog if any
    page.on('dialog', dialog => dialog.accept());
    
    await expect(page.locator(`text=${updatedName}`)).not.toBeVisible();
  });
});
