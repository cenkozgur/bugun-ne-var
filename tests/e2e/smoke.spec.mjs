import { test, expect } from '@playwright/test';

test.describe('cold-load smoke', () => {
  test('LoginWelcome renders the brand pre-login screen', async ({ page }) => {
    await page.goto('/');
    // LoginWelcome has Turkish copy and a "giriş" / "başla" button.
    // Keep the assertion soft — we just want to know the bundle loaded
    // without a hard error and the brand surface paints.
    await expect(page).toHaveTitle(/bug.n/i);
    await expect(page.locator('body')).toContainText(/bug.n.ne.var/i, {
      timeout: 10_000,
    });
  });

  test('no console errors on cold load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Ignore the well-known Base44 plugin "Proxy not enabled" notice and
    // any third-party noise (Stripe, fonts, analytics) — those don't
    // indicate a regression in our code.
    const ours = errors.filter(
      (e) =>
        !/Proxy not enabled/i.test(e) &&
        !/stripe|google|recaptcha|font/i.test(e)
    );
    expect(ours, ours.join('\n')).toEqual([]);
  });
});
