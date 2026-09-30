import { test, expect } from '@playwright/test';
test('responsive routes fit small phones, tablets and desktop windows', async ({
  page,
}) => {
  await page.route('**/v1/account', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"code":401}',
    }),
  );
  for (const width of [320, 390, 768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      'dashboard',
      'church',
      'member-login',
      'onboarding',
      'find-group',
      'groups',
      'study',
      'sermons',
      'settings',
    ]) {
      await page.goto(`/#${route}`);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(overflow.scroll, `${route} at ${width}px`).toBeLessThanOrEqual(
        width + 1,
      );
    }
  }
});

test('mobile navigation supports touch, keyboard dismissal and rotation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#groups');
  const drawer = page.locator('#site-navigation');
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  await expect(drawer).toHaveAttribute('inert', '');
  await toggle.click();
  await expect(
    page.getByRole('button', { name: 'Close navigation menu' }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.getByRole('link', { name: 'Settings' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await drawer.getByRole('link', { name: 'Find a group' }).click();
  await expect(page.locator('h1')).toHaveText('Find your people.');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(drawer).not.toHaveAttribute('inert', '');
  await expect(
    drawer.getByRole('link', { name: 'Find a group' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(page.locator('.main-shell')).not.toHaveAttribute('inert', '');
});

test('phone group forms and touch controls stay readable and within the viewport', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#groups');
  await page
    .getByRole('button', { name: 'Plan a gathering', exact: true })
    .click();
  await page.getByLabel('Meeting date').fill('2026-10-04');
  await page.getByLabel('Meeting time').fill('16:00');
  await page
    .getByRole('button', { name: 'Save gathering', exact: true })
    .click();
  await page.getByLabel('Main dish', { exact: true }).fill('Chicken and rice');
  await page
    .getByRole('button', { name: 'Set main dish', exact: true })
    .click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);
  const size = await page
    .getByLabel('Main dish', { exact: true })
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  for (const label of [
    'Discussion',
    'Food needs',
    'Members',
    'Group details',
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      label,
    ).toBeLessThanOrEqual(321);
  }
  await page.screenshot({
    path: `test-results/narrow-phone-${info.project.name}.png`,
    fullPage: true,
  });
});
