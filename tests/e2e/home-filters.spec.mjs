import { test, expect } from '@playwright/test';
import { hasAuthState, STORAGE_STATE_PATH } from './helpers/auth.mjs';

// These tests need a logged-in storageState, which Base44's Google OAuth
// flow can't be replayed from a script. Capture once manually:
//
//   npx playwright codegen https://bugun-ne-var.base44.app \
//       --save-storage tests/e2e/.auth/user.json
//
// Then commit nothing under .auth/ — keep it gitignored.

test.describe('home — bugün / yarın filter', () => {
  test.skip(!hasAuthState(), 'auth state missing — see helpers/auth.mjs comment');

  test.use({ storageState: STORAGE_STATE_PATH });

  test('switching between bugün and yarın does not show the same event in both', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^bug.n$/i }).click();
    await page.waitForLoadState('networkidle');
    const todayTitles = await page
      .locator('[data-event-card] [data-event-title]')
      .allTextContents();

    await page.getByRole('button', { name: /^yar.n$/i }).click();
    await page.waitForLoadState('networkidle');
    const tomorrowTitles = await page
      .locator('[data-event-card] [data-event-title]')
      .allTextContents();

    // The whole point: an event that legitimately belongs to "today" must
    // never also appear under "yarın". The filter logic is unit-tested in
    // src/lib/filterEvents.test.js — this E2E catches the wiring layer
    // (Home.jsx still passes through applyTimeFilter, chips still toggle
    // timeFilter state, etc).
    const overlap = todayTitles.filter((t) => tomorrowTitles.includes(t));
    expect(overlap, `events seen in both filters: ${overlap.join(', ')}`).toEqual([]);
  });
});
