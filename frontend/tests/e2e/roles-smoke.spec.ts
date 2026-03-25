import { test } from '@playwright/test';
import { ensurePathLoadsWithoutLoginRedirect, hasRoleCredentials, loginAs } from './helpers/auth';

test.describe('Role smoke tests', () => {
  test('admin role pages', async ({ page }) => {
    test.skip(!hasRoleCredentials('admin'), 'Missing admin credentials');
    await loginAs(page, 'admin');
    await ensurePathLoadsWithoutLoginRedirect(page, '/admin');
    await ensurePathLoadsWithoutLoginRedirect(page, '/admin/events');
    await ensurePathLoadsWithoutLoginRedirect(page, '/admin/users');
  });

  test('organizer role pages', async ({ page }) => {
    test.skip(!hasRoleCredentials('organizer'), 'Missing organizer credentials');
    await loginAs(page, 'organizer');
    await ensurePathLoadsWithoutLoginRedirect(page, '/organizer');
    await ensurePathLoadsWithoutLoginRedirect(page, '/organizer/events');
    await ensurePathLoadsWithoutLoginRedirect(page, '/organizer/notifications');
  });

  test('enterprise role pages', async ({ page }) => {
    test.skip(!hasRoleCredentials('enterprise'), 'Missing enterprise credentials');
    await loginAs(page, 'enterprise');
    await ensurePathLoadsWithoutLoginRedirect(page, '/enterprise');
    await ensurePathLoadsWithoutLoginRedirect(page, '/enterprise/communications');
    await ensurePathLoadsWithoutLoginRedirect(page, '/enterprise/events');
  });

  test('visitor role pages', async ({ page }) => {
    test.skip(!hasRoleCredentials('visitor'), 'Missing visitor credentials');
    await loginAs(page, 'visitor');
    await ensurePathLoadsWithoutLoginRedirect(page, '/dashboard');
    await ensurePathLoadsWithoutLoginRedirect(page, '/events');
    await ensurePathLoadsWithoutLoginRedirect(page, '/favorites');
  });
});
