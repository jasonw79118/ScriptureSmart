import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('https://nyc.cloud.appwrite.io/v1/account', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 401, message: 'No session' }),
    }),
  );
});
test('Williams Group identity, location, church customization, and optional practices', async ({
  page,
}, info) => {
  await page.goto('/#groups');
  await expect(
    page.getByRole('heading', { name: 'Gospel Community Groups', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Williams Group', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Group details', exact: true })
    .click();
  await expect(
    page.getByText('13851 Hale Rd, Canyon, TX 79015', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Get directions' }),
  ).toHaveAttribute('href', /destination=13851/);
  await expect(
    page.getByText('Jason and Ryanne Williams', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Plan meals and dish sign-ups').uncheck();
  await page.getByRole('button', { name: 'Save group details' }).click();
  await page.reload();
  await page
    .getByRole('button', { name: 'Group details', exact: true })
    .click();
  await expect(
    page.getByLabel('Plan meals and dish sign-ups'),
  ).not.toBeChecked();
  await page.goto('/#church');
  await page
    .getByRole('textbox', { name: 'Group name (plural)', exact: true })
    .fill('Community Circles');
  await page.getByRole('button', { name: 'Save church identity' }).click();
  await page.goto('/#groups');
  await expect(
    page.getByRole('heading', { name: 'Community Circles', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/community-${info.project.name}.png`,
    fullPage: true,
  });
});
test('meal suggestions, allergy flags, sign-up, absence, and reply persistence', async ({
  page,
}, info) => {
  await page.goto('/#groups');
  await page
    .getByRole('button', { name: 'Plan a gathering', exact: true })
    .click();
  await page.getByLabel('Meeting date').fill('2026-10-04');
  await page.getByLabel('Meeting time').fill('16:00');
  await page
    .getByRole('button', { name: 'Save gathering', exact: true })
    .click();
  await page.getByLabel('Main dish', { exact: true }).fill('Tacos');
  await page
    .getByRole('button', { name: 'Set main dish', exact: true })
    .click();
  await expect(
    page.getByText('Cilantro-lime rice', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Food needs', exact: true }).click();
  await page.getByLabel('Who is this for?').fill('My guest');
  await page.getByLabel('Milk', { exact: true }).check();
  await page.getByLabel('I have permission to share').check();
  await page.getByRole('button', { name: 'Save food requirement' }).click();
  await page.getByRole('button', { name: 'Gatherings', exact: true }).click();
  await expect(
    page.getByText('Potential conflict: Milk', { exact: true }),
  ).toBeVisible();
  const suggestion = page
    .locator('.suggestion-row')
    .filter({ hasText: 'Cilantro-lime rice' });
  await suggestion
    .getByRole('button', { name: 'Add to menu', exact: true })
    .click();
  const dish = page
    .locator('.dish-card')
    .filter({ hasText: 'Cilantro-lime rice' });
  await dish.getByRole('button', { name: 'I’ll bring this' }).click();
  await page.getByRole('radio', { name: 'Not coming', exact: true }).check();
  await page.getByRole('button', { name: 'Save my attendance' }).click();
  await expect(
    dish.getByText('Needs reassignment · member is not coming'),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/meals-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
  await page
    .getByLabel('Your contribution', { exact: true })
    .fill('Could we discuss hospitality next week?');
  await page
    .getByRole('button', { name: 'Share with group', exact: true })
    .click();
  await page
    .getByRole('textbox', {
      name: 'Reply to Could we discuss hospitality next week?',
    })
    .fill('I can bring an idea.');
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Discussion', exact: true }).click();
  await expect(
    page.getByText('I can bring an idea.', { exact: true }),
  ).toBeVisible();
});
test('Appwrite login requests and verifies an email code without fake sessions', async ({
  page,
}) => {
  await page.route('**/account/tokens/email', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ userId: 'test-user', phrase: 'olive branch' }),
    }),
  );
  await page.route('**/account/sessions/token', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ $id: 'test-session', userId: 'test-user' }),
    }),
  );
  await page.goto('/#member-login');
  await page
    .getByLabel('Email address', { exact: true })
    .fill('test@example.test');
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click();
  await expect(page.getByText('olive branch', { exact: true })).toBeVisible();
  await page.route('https://nyc.cloud.appwrite.io/v1/account', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ $id: 'test-user', email: 'test@example.test' }),
    }),
  );
  await page.getByLabel('Email sign-in code').fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'First, find your church.' }),
  ).toBeVisible();
  await page.goto('/#member-login');
  await expect(page.getByText('Signed in as test@example.test')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Join group', exact: true }),
  ).toBeDisabled();
});
