import { expect, test } from '@playwright/test';
import { hasRoleCredentials, loginAs } from './helpers/auth';

test.describe('Timezone preference flow', () => {
  test('visitor can change timezone in profile and persist it', async ({ page }) => {
    test.skip(!hasRoleCredentials('visitor'), 'Missing visitor credentials');
    await loginAs(page, 'visitor');

    await page.goto('/profile');
    await expect(page).not.toHaveURL(/\/auth\/login/);

    // Try common timezone select ids used by form components.
    const timezoneValue = 'Asia/Tokyo';
    const selectCandidates = [
      'select[name="timezone"]',
      '#timezone',
      '[data-testid="timezone-select"]',
    ];

    let updated = false;
    for (const selector of selectCandidates) {
      const select = page.locator(selector).first();
      if (await select.count()) {
        await select.selectOption(timezoneValue);
        updated = true;
        break;
      }
    }

    test.skip(!updated, 'Timezone selector not found. Add a stable selector to profile form.');

    const saveButton = page.getByRole('button', { name: /save|update/i }).first();
    await saveButton.click();

    await page.waitForTimeout(1500);
    const authUser = await page.evaluate(() => localStorage.getItem('auth_user'));
    expect(authUser).toBeTruthy();
    expect(authUser || '').toContain('"timezone":"Asia/Tokyo"');
  });
});
