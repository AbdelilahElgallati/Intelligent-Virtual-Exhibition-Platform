import { expect, test } from '@playwright/test';
import { ensurePathLoadsWithoutLoginRedirect, hasRoleCredentials, loginAs } from './helpers/auth';

test.describe('Feature surfaces by role', () => {
  test('visitor sees live/event/chat related surfaces', async ({ page }) => {
    test.skip(!hasRoleCredentials('visitor'), 'Missing visitor credentials');
    await loginAs(page, 'visitor');
    await ensurePathLoadsWithoutLoginRedirect(page, '/events');
    await ensurePathLoadsWithoutLoginRedirect(page, '/dashboard/orders');
  });

  test('enterprise sees meeting and request surfaces', async ({ page }) => {
    test.skip(!hasRoleCredentials('enterprise'), 'Missing enterprise credentials');
    await loginAs(page, 'enterprise');
    await ensurePathLoadsWithoutLoginRedirect(page, '/enterprise/communications');
    await ensurePathLoadsWithoutLoginRedirect(page, '/enterprise/product-requests');
  });

  test('organizer sees event lifecycle surfaces', async ({ page }) => {
    test.skip(!hasRoleCredentials('organizer'), 'Missing organizer credentials');
    await loginAs(page, 'organizer');
    await ensurePathLoadsWithoutLoginRedirect(page, '/organizer/events');

    // Check that organizer events page rendered meaningful content.
    await expect(page.locator('body')).toContainText(/event|events/i);
  });
});
