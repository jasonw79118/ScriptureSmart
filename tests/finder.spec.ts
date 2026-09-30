import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('https://nyc.cloud.appwrite.io/v1/account', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"code":401,"message":"No session"}',
    }),
  );
});
test('finder explains family fit without exposing a home address and publishes approved contact details', async ({
  page,
}) => {
  await page.goto('/#find-group');
  await page.getByLabel('Household / life stage').selectOption('married');
  await page.getByLabel('Will children join you?').selectOption('yes');
  await page.getByLabel('Preferred meeting day').selectOption('Sunday');
  await expect(page.getByText('Welcomes your household stage')).toBeVisible();
  await expect(
    page.getByText('Matches your preferred meeting day'),
  ).toBeVisible();
  await expect(
    page.getByText('Distance unknown', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('13851 Hale Rd', { exact: false })).toHaveCount(
    0,
  );
  await page.goto('/#groups');
  await page
    .getByRole('button', { name: 'Group details', exact: true })
    .click();
  await page.getByLabel('Leader contact email').fill('leader@example.test');
  await page.getByLabel('Preferred contact method').selectOption('email');
  await page.getByLabel('The leader approves sharing').check();
  await page.getByRole('button', { name: 'Save group listing' }).click();
  await page.goto('/#find-group');
  await expect(
    page.getByRole('link', { name: 'Email Jason Williams' }),
  ).toHaveAttribute('href', 'mailto:leader@example.test');
  await page.screenshot({
    path: `test-results/finder-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('church search requires a named membership request and shows pending review', async ({
  page,
}) => {
  await page.goto('/#groups');
  await page
    .getByRole('button', { name: 'Group details', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save group details' }).click();
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('ss.community.v2')!);
    d.churches.push({
      ...d.churches[0],
      id: 'second-church',
      name: 'Test Church',
      owner_id: 'another-admin',
    });
    localStorage.setItem('ss.community.v2', JSON.stringify(d));
  });
  await page.goto('/#onboarding');
  await page.reload();
  await page.getByLabel('Church name or city').fill('Test Church');
  await page.getByRole('button', { name: 'Find churches' }).click();
  await page.getByRole('radio').check();
  await page
    .getByLabel('Your name', { exact: true })
    .fill('Preview church member');
  await page.getByRole('button', { name: 'Request church membership' }).click();
  await expect(
    page.getByText('Awaiting church administrator approval.'),
  ).toBeVisible();
});
