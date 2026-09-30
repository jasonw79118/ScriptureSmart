import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/v1/account', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"code":401,"message":"No session"}',
    }),
  );
});
test('AI services open personal accounts without credentials or automatic prompt sharing', async ({
  page,
}) => {
  await page.goto('/#connections');
  for (const [name, url] of [
    ['ChatGPT', 'https://chatgpt.com/'],
    ['Claude', 'https://claude.ai/'],
    ['Grok', 'https://grok.com/'],
  ]) {
    const link = page.getByRole('link', {
      name: `Open ${name} (new tab)`,
      exact: true,
    });
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    });
  });
  await page
    .getByRole('textbox', { name: 'Study prompt', exact: true })
    .fill('Help me study Psalm 23.');
  await page
    .getByRole('button', { name: 'Copy study prompt', exact: true })
    .click();
  await expect(
    page.locator('.ai-prompt-panel').getByRole('status'),
  ).toContainText('Prompt copied');
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toBe('Help me study Psalm 23.');
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Study prompt', exact: true }),
  ).not.toHaveValue('Help me study Psalm 23.');
});
test('copy failure offers manual copying on a phone or restricted browser', async ({
  page,
}, info) => {
  await page.goto('/#connections');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error('Clipboard blocked');
        },
      },
    });
  });
  await page
    .getByRole('textbox', { name: 'Study prompt', exact: true })
    .fill('Explain the context of Philippians 2.');
  await page
    .getByRole('button', { name: 'Copy study prompt', exact: true })
    .click();
  await expect(
    page.locator('.ai-prompt-panel').getByRole('status'),
  ).toContainText('Automatic copying is unavailable');
  await expect(
    page.getByRole('textbox', { name: 'Study prompt', exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/ai-services-${info.project.name}.png`,
    fullPage: true,
  });
});
