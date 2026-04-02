import { chromium, FullConfig } from '@playwright/test';
import { users, UserRole } from './tests/fixtures/users';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  console.log('🚀 Starting global setup...');

  // Ensure auth directory exists
  const authDir = path.resolve('playwright/.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  
  for (const roleKey of Object.keys(users) as UserRole[]) {
    const user = users[roleKey];
    console.log(`👤 Processing ${roleKey} (${user.email})...`);

    // Skip registration - assume test accounts exist in database
    // If they don't exist, tests will fail gracefully

    // Login via UI and save storage state
    const page = await browser.newPage();
    try {
      await page.goto(`${baseURL}/auth/login`);
      
      // Wait for page to load
      await page.waitForSelector('input[name="email"]', { timeout: 5000 });
      
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.locator('form button[type="submit"]').click();

      // Wait for login to complete - check if we navigated away from login
      await page.waitForURL((url) => !url.toString().includes('/auth/login'), { timeout: 10000 });
      
      // Save state
      await page.context().storageState({ path: user.storageState });
      console.log(`✅ Saved auth state for ${roleKey} to ${user.storageState}`);
    } catch (error: any) {
      console.warn(`⚠️ Login failed for ${roleKey}:`, error.message);
      // Still save empty state to avoid test blocking
      const emptyContext = await browser.newContext();
      await emptyContext.storageState({ path: user.storageState });
      await emptyContext.close();
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('🏁 Global setup completed!');
}

export default globalSetup;
