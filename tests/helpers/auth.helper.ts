import { Page, expect } from '@playwright/test';
import { users, UserRole } from '../fixtures/users';
import fs from 'fs';
import path from 'path';

/**
 * Helper to log in via UI for specific tests that need to verify login flow.
 * Note: Most tests should use global setup and storageState.
 */
export async function loginAs(page: Page, role: UserRole) {
  const user = users[role];
  
  await page.goto('/auth/login');
  
  // Wait for the form to be ready
  await page.waitForSelector('input[name="email"]');
  
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  
  await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
  
  // Verify redirect to correct dashboard
  const expectedPath = role === 'admin' ? '/admin' : 
                       role === 'organisateur' ? '/organizer' : 
                       role === 'entreprise' || role === 'entreprise2' ? '/enterprise' : 
                       '/dashboard';
  
  await page.waitForURL(new RegExp(expectedPath));
}

/**
 * Returns JWT from saved storage state for a specific role.
 */
export function getToken(role: UserRole): string | null {
  const user = users[role];
  const statePath = path.resolve(user.storageState);
  
  if (!fs.existsSync(statePath)) {
    return null;
  }
  
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const origins = state.origins || [];
  
  for (const origin of origins) {
    const cookies = origin.cookies || [];
    const authCookie = cookies.find((c: any) => c.name === 'auth_token' || c.name === 'token');
    if (authCookie) return authCookie.value;
    
    const localStorage = origin.localStorage || [];
    const authStorage = localStorage.find((l: any) => l.name === 'auth_token' || l.name === 'token');
    if (authStorage) return authStorage.value;
  }
  
  return null;
}

/**
 * Logs out and verifies redirect to /login.
 */
export async function logout(page: Page) {
  // Look for logout button in sidebar or navbar
  const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout"), [aria-label="Logout"]');
  
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  } else {
    // Fallback: try navigating to logout if exists or clear storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/auth/login';
    });
  }
  
  await page.waitForURL(/\/auth\/login/);
}
