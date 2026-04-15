import { test, expect } from '@playwright/test';
import { users } from '../fixtures/users';

test.describe('Flow - Full Salon Lifecycle', () => {
  
  test('Complete business flow from creation to B2B meeting', async ({ browser }) => {
    const salonName = `E2E Expo ${Date.now()}`;
    let salonId = '';

    // 1. Organizer creates a salon
    const organizerPage = await browser.newPage({ storageState: users.organisateur.storageState });
    await organizerPage.goto('/organizer/events/new');
    await organizerPage.fill('input[name="name"]', salonName);
    await organizerPage.fill('textarea[name="description"]', 'Full lifecycle test.');
    await organizerPage.fill('input[name="start_date"]', new Date().toISOString().split('T')[0]);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await organizerPage.fill('input[name="end_date"]', nextWeek.toISOString().split('T')[0]);
    await organizerPage.click('button[type="submit"]');
    await organizerPage.waitForURL(/\/organizer\/events\//);
    salonId = organizerPage.url().split('/').pop() || '';
    await organizerPage.screenshot({ path: 'test-results/screenshots/1-organizer-created.png' });
    await organizerPage.close();

    // 2. Admin approves the salon
    const adminPage = await browser.newPage({ storageState: users.admin.storageState });
    await adminPage.goto('/admin/events');
    const pendingRow = adminPage.locator(`tr:has-text("${salonName}")`);
    await pendingRow.locator('button:has-text("Approve")').click();
    await expect(pendingRow.locator('text=APPROVED')).toBeVisible();
    await adminPage.screenshot({ path: 'test-results/screenshots/2-admin-approved.png' });
    await adminPage.close();

    // 3. Organizer invites Exposant
    const organizerPage2 = await browser.newPage({ storageState: users.organisateur.storageState });
    await organizerPage2.goto(`/organizer/events/${salonId}`);
    await organizerPage2.locator('button:has-text("Invite")').click();
    await organizerPage2.locator('input[type="email"]').fill(users.entreprise.email);
    await organizerPage2.locator('button:has-text("Send")').click();
    await expect.soft(organizerPage2.locator('text=Invitation sent')).toBeVisible();
    await organizerPage2.screenshot({ path: 'test-results/screenshots/3-organizer-invited.png' });
    await organizerPage2.close();

    // 4. Exposant sets up their stand
    const exposantPage = await browser.newPage({ storageState: users.entreprise.storageState });
    await exposantPage.goto('/enterprise/events');
    const manageStandBtn = exposantPage.locator(`a[href*="/events/${salonId}/stand"]`);
    if (await manageStandBtn.isVisible()) {
      await manageStandBtn.click();
      await exposantPage.fill('input[name="name"]', `Stand for ${salonName}`);
      await exposantPage.click('button[type="submit"]');
      await expect.soft(exposantPage.locator('text=Stand updated')).toBeVisible();
    }
    await exposantPage.screenshot({ path: 'test-results/screenshots/4-exposant-stand-setup.png' });
    await exposantPage.close();

    // 5. Visitor buys a ticket (API shortcut)
    // In a full flow test, we might skip Stripe to focus on the business logic
    const visitorPage = await browser.newPage({ storageState: users.visitor.storageState });
    // Use API to grant ticket if possible, or just visit if free
    await visitorPage.goto(`/events/${salonId}/live`);
    await visitorPage.screenshot({ path: 'test-results/screenshots/5-visitor-live.png' });

    // 6. Visitor requests a B2B meeting
    const firstStand = visitorPage.locator('.stand-card').first();
    await firstStand.click();
    await visitorPage.locator('button:has-text("Request Meeting")').click();
    await visitorPage.locator('input[name="subject"]').fill('E2E Meeting');
    const firstSlot = visitorPage.locator('.time-slot').first();
    if (await firstSlot.isVisible()) await firstSlot.click();
    await visitorPage.locator('button[type="submit"]').click();
    await expect.soft(visitorPage.locator('text=Request sent')).toBeVisible();
    await visitorPage.screenshot({ path: 'test-results/screenshots/6-visitor-requested-meeting.png' });
    await visitorPage.close();

    // 7. Exposant accepts the meeting
    const exposantPage2 = await browser.newPage({ storageState: users.entreprise.storageState });
    await exposantPage2.goto('/enterprise/communications');
    const pendingMeeting = exposantPage2.locator('tr:has-text("E2E Meeting")');
    await pendingMeeting.locator('button:has-text("Accept")').click();
    await expect(pendingMeeting.locator('text=ACCEPTED')).toBeVisible();
    await exposantPage2.screenshot({ path: 'test-results/screenshots/7-exposant-accepted-meeting.png' });
    
    // 8. Verify room URL exists
    await pendingMeeting.click();
    const joinBtn = exposantPage2.locator('a:has-text("Join")');
    await expect(joinBtn).toBeVisible();
    const href = await joinBtn.getAttribute('href');
    expect(href).toMatch(/daily.co|livekit|room|meetings/);
    await exposantPage2.close();
  });
});
