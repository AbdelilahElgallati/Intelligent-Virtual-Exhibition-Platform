import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Admin - Event Lifecycle & Monitoring', () => {
  test.use({ storageState: users.admin.storageState });

  test('Admin can control event status and monitor live activity', async ({ page }) => {
    // 1. Lifecycle Control (Start/Stop/Pause)
    await page.goto('/admin/events');
    
    // Find an approved event that can be started
    const approvedRow = page.locator('tr:has-text("APPROVED"), .event-card:has-text("APPROVED")').first();
    
    if (await approvedRow.isVisible()) {
      await approvedRow.click();
      
      const startBtn = page.locator('button:has-text("Start"), button:has-text("Démarrer")');
      const pauseBtn = page.locator('button:has-text("Pause"), button:has-text("Pause")');
      const stopBtn = page.locator('button:has-text("Stop"), button:has-text("Terminer")');
      
      if (await startBtn.isVisible()) {
        await startBtn.click();
        await expect.soft(page.locator('text=Event status updated, Status: LIVE')).toBeVisible();
        await expect(page.locator('text=LIVE')).toBeVisible();
      }
      
      if (await pauseBtn.isVisible()) {
        await pauseBtn.click();
        await expect.soft(page.locator('text=Event status updated, Status: PAUSED')).toBeVisible();
        await expect(page.locator('text=PAUSED')).toBeVisible();
        // Resume
        await startBtn.click();
      }
      
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        // Confirm dialog if any
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Terminer")');
        if (await confirmBtn.isVisible()) await confirmBtn.click();
        
        await expect.soft(page.locator('text=Event status updated, Status: CLOSED, Status: ENDED')).toBeVisible();
        await expect(page.locator('text=CLOSED, ENDED')).toBeVisible();
      }
    }
    
    // 2. Live Monitoring Dashboard
    await page.goto('/admin/monitoring');
    
    // Check for real-time stats cards
    await expect(page.locator('text=Active Visitors, Live Meetings, Chat Messages, Active Stands')).toBeVisible();
    await expect(page.locator('.stat-value, .monitoring-card')).toBeVisible();
    
    // Check for incident logs
    await page.goto('/admin/incidents');
    await expect(page.locator('table, .incident-list')).toBeVisible();
    await expect(page.locator('text=Type, Severity, Message, Status, Sévérité')).toBeVisible();
    
    // Check if we can view an incident
    const incidentRow = page.locator('tr, .incident-card').first();
    if (await incidentRow.isVisible()) {
      await incidentRow.click();
      await expect(page.locator('.incident-detail, .modal')).toBeVisible();
      await expect(page.locator('text=Details, Investigation, History')).toBeVisible();
    }
  });
});
