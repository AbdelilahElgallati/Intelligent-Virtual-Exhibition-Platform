import { expect, Page } from '@playwright/test';

type Role = 'admin' | 'organizer' | 'enterprise' | 'visitor';

type RoleConfig = {
  emailEnv: string;
  passwordEnv: string;
  defaultPath: string;
};

const ROLE_CONFIG: Record<Role, RoleConfig> = {
  admin: {
    emailEnv: 'IVEP_ADMIN_EMAIL',
    passwordEnv: 'IVEP_ADMIN_PASSWORD',
    defaultPath: '/admin',
  },
  organizer: {
    emailEnv: 'IVEP_ORGANIZER_EMAIL',
    passwordEnv: 'IVEP_ORGANIZER_PASSWORD',
    defaultPath: '/organizer',
  },
  enterprise: {
    emailEnv: 'IVEP_ENTERPRISE_EMAIL',
    passwordEnv: 'IVEP_ENTERPRISE_PASSWORD',
    defaultPath: '/enterprise',
  },
  visitor: {
    emailEnv: 'IVEP_VISITOR_EMAIL',
    passwordEnv: 'IVEP_VISITOR_PASSWORD',
    defaultPath: '/',
  },
};

export function hasRoleCredentials(role: Role): boolean {
  const cfg = ROLE_CONFIG[role];
  return Boolean(process.env[cfg.emailEnv] && process.env[cfg.passwordEnv]);
}

export async function loginAs(page: Page, role: Role): Promise<void> {
  const cfg = ROLE_CONFIG[role];
  const email = process.env[cfg.emailEnv];
  const password = process.env[cfg.passwordEnv];

  if (!email || !password) {
    throw new Error(`Missing ${cfg.emailEnv}/${cfg.passwordEnv}`);
  }

  await page.goto('/auth/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(new RegExp(cfg.defaultPath === '/' ? '^.*/$|^.*/dashboard' : cfg.defaultPath));
}

export async function ensurePathLoadsWithoutLoginRedirect(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).not.toHaveURL(/\/auth\/login/);
}
