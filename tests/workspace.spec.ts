import { test, expect } from '@playwright/test';
test('all routes render without overflow or runtime errors', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of [
    'dashboard',
    'study',
    'sermons',
    'bible-studies',
    'guide',
    'groups',
    'table',
    'library',
    'research',
    'connections',
    'settings',
  ]) {
    await page.goto(`/#${route}`);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto('/#dashboard');
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Library' })
      .click();
    await expect(page.locator('h1')).toHaveText('A home for your work.');
  }
  expect(errors).toEqual([]);
});
test('draft editing, reload, search and text export', async ({ page }) => {
  await page.goto('/#sermons');
  await page.getByRole('button', { name: 'New sermon' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Grace in daily life');
  await page
    .getByLabel('Primary passage', { exact: true })
    .fill('Ephesians 2:1–10');
  await page
    .getByLabel('Central idea', { exact: true })
    .fill('A working observation for my sermon.');
  await page.reload();
  await page.getByRole('button', { name: /Grace in daily life/ }).click();
  await expect(page.getByLabel('Central idea', { exact: true })).toHaveValue(
    'A working observation for my sermon.',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export text' }).click();
  expect((await download).suggestedFilename()).toBe('Grace-in-daily-life.txt');
  await page.goto('/#library');
  await page.getByRole('textbox', { name: 'Search library' }).fill('daily');
  await expect(
    page.getByRole('button', { name: /Grace in daily life/ }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '1 results' })).toBeVisible();
});
test('passage notes and Table contributions persist', async ({ page }) => {
  await page.goto('/#study');
  await page.getByLabel('Bible reference').fill('John 15:1-8');
  await page.getByRole('button', { name: 'Open passage' }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page
    .getByLabel('New personal note')
    .fill('How does abiding shape our daily life?');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.getByRole('button', { name: 'Send to local Table' }).click();
  await page.goto('/#table');
  await expect(
    page.getByText('How does abiding shape our daily life?', { exact: true }),
  ).toBeVisible();
  const post = page
    .locator('article')
    .filter({ hasText: 'How does abiding shape our daily life?' });
  await post
    .getByRole('textbox')
    .fill('Bring this question to our next gathering.');
  await post.getByRole('button', { name: 'Reply', exact: true }).click();
  await post
    .getByRole('button', { name: 'Save for group night', exact: false })
    .click();
  await page.reload();
  await expect(
    page.getByText('Bring this question to our next gathering.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Group night only').check();
  await expect(
    page.getByText('How does abiding shape our daily life?', { exact: true }),
  ).toBeVisible();
});
test('provider credentials remain unavailable and preferences persist', async ({
  page,
}) => {
  await page.goto('/#connections');
  await page
    .getByRole('button', { name: 'Connection details' })
    .first()
    .click();
  await expect(page.getByLabel('API credential preview')).toBeDisabled();
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.goto('/#settings');
  await page.getByLabel('Display name').fill('Jordan');
  await page
    .getByLabel('Preferred translation', { exact: true })
    .selectOption('NIV');
  await page.reload();
  await expect(page.getByLabel('Display name')).toHaveValue('Jordan');
  await page.goto('/#study');
  await expect(page.getByLabel('Translation', { exact: true })).toHaveValue(
    'NIV',
  );
});

test('Bible study and discussion-guide sections stay editable', async ({
  page,
}, info) => {
  await page.goto('/#bible-studies');
  await page
    .getByRole('button', { name: 'New bible study', exact: false })
    .click();
  await page.getByLabel('Title', { exact: true }).fill('A study for our group');
  await page.getByRole('button', { name: /Observation questions/ }).click();
  await page
    .getByLabel('Observation questions', { exact: true })
    .fill('Which words repeat in this passage?');
  await page.reload();
  await page.getByRole('button', { name: /A study for our group/ }).click();
  await page.getByRole('button', { name: /Observation questions/ }).click();
  await expect(
    page.getByLabel('Observation questions', { exact: true }),
  ).toHaveValue('Which words repeat in this passage?');
  await page.goto('/#guide');
  await page.getByRole('button', { name: /New discussion guide/ }).click();
  await page
    .getByLabel('Sermon material', { exact: true })
    .fill('My own sermon manuscript, ready for group discussion.');
  await page.getByRole('button', { name: /Opening/ }).click();
  await page
    .getByLabel('Opening', { exact: true })
    .fill('What stood out to you as we read?');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Generate Discussion Guide' }),
  ).toBeEnabled();
  await expect(page.getByLabel('Opening', { exact: true })).toHaveValue(
    'What stood out to you as we read?',
  );
  await page.screenshot({
    path: `test-results/editor-${info.project.name}.png`,
    fullPage: true,
  });
});

test('invalid saved data is preserved and reported without a crash', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('ss.drafts.v1', '{"unexpected":"keep this"}'),
  );
  await page.goto('/#sermons');
  await expect(page.getByRole('alert')).toContainText(
    'Existing storage will be preserved',
  );
  await page.getByRole('button', { name: /New sermon/ }).click();
  await page.getByLabel('Title', { exact: true }).fill('Recoverable new work');
  expect(await page.evaluate(() => localStorage.getItem('ss.drafts.v1'))).toBe(
    '{"unexpected":"keep this"}',
  );
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Recoverable new work',
  );
});
