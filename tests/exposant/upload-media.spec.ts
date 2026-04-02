import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';
import fs from 'fs';
import path from 'path';

test.describe('Exposant - Upload Media', () => {
  test.use({ storageState: users.entreprise.storageState });

  // Create a dummy test image
  const testImagePath = path.join(__dirname, 'test-image.png');
  const largeImagePath = path.join(__dirname, 'large-image.jpg');
  const invalidFilePath = path.join(__dirname, 'test-script.exe');

  test.beforeAll(async () => {
    // Create dummy files for testing
    fs.writeFileSync(testImagePath, 'fake-image-content');
    fs.writeFileSync(largeImagePath, Buffer.alloc(11 * 1024 * 1024)); // > 10MB
    fs.writeFileSync(invalidFilePath, 'fake-exe-content');
  });

  test.afterAll(async () => {
    // Cleanup
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
    if (fs.existsSync(largeImagePath)) fs.unlinkSync(largeImagePath);
    if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
  });

  test('Exposant can upload an image to their stand', async ({ page }) => {
    await page.goto('/enterprise/events');
    const manageBtn = page.locator('a:has-text("Stand"), a[href*="/stand"]').first();
    
    if (await manageBtn.isVisible()) {
      await manageBtn.click();
      
      // Look for upload area
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testImagePath);
      
      // Wait for upload progress/success
      await expect.soft(page.locator('text=Upload successful, Image ajoutée, Success')).toBeVisible();
      
      // Verify image appears in gallery
      const gallery = page.locator('.gallery, .media-list, .images-grid');
      await expect(gallery.locator('img')).toBeVisible();
    }
  });

  test('[FAIL] Upload file > 10MB', async ({ page }) => {
    await page.goto('/enterprise/events');
    const manageBtn = page.locator('a:has-text("Stand"), a[href*="/stand"]').first();
    
    if (await manageBtn.isVisible()) {
      await manageBtn.click();
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largeImagePath);
      
      // Error message
      await expect(page.locator('text=File too large, File is too large, 10MB')).toBeVisible();
    }
  });

  test('[FAIL] Upload unsupported format', async ({ page }) => {
    await page.goto('/enterprise/events');
    const manageBtn = page.locator('a:has-text("Stand"), a[href*="/stand"]').first();
    
    if (await manageBtn.isVisible()) {
      await manageBtn.click();
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);
      
      // Error message
      await expect(page.locator('text=Invalid file type, Invalid format, Format non supporté')).toBeVisible();
    }
  });
});
