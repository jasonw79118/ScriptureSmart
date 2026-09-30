import { test, expect, type Route } from '@playwright/test';
const answer = {
  text: 'AI SYNTHESIS: A suggested outline.',
  provider: 'scripturesmart-ai',
  model: 'mock-model',
  kind: 'AI SYNTHESIS',
  createdAt: '2026-09-29T12:00:00Z',
  warnings: ['Review before using this draft.'],
};
test.beforeEach(async ({ page }) => {
  await page.route('**/v1/account', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        $id: 'ai-user',
        email: 'member@example.test',
        emailVerification: true,
        status: true,
      }),
    }),
  );
  await page.route('**/v1/account/jwts', (r) =>
    r.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ jwt: 'mock-user-jwt' }),
    }),
  );
  await page.route('**/api/ai/status', (r) =>
    r.fulfill({ json: { available: true, provider: 'scripturesmart-ai' } }),
  );
});
test('built-in assistant is the default and external websites stay optional', async ({
  page,
}) => {
  await page.goto('/#settings');
  await expect(page.getByLabel('Default AI Provider')).toHaveValue(
    'scripturesmart-ai',
  );
  await page.goto('/#connections');
  await expect(
    page.getByRole('heading', { name: 'ScriptureSmart AI', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Available · Ready to ask', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Open ChatGPT (new tab)' }),
  ).toBeVisible();
  await page.route('**/api/ai/status', (r) =>
    r.fulfill({ json: { available: false } }),
  );
  await page.reload();
  await expect(
    page.getByText('Service unavailable · Administrator setup may be required'),
  ).toBeVisible();
});
test('sermon generation sends only selected context and never overwrites without an explicit action', async ({
  page,
}) => {
  let body: Record<string, unknown> = {};
  await page.route('**/api/ai/generate', (r) => {
    body = r.request().postDataJSON();
    return r.fulfill({ json: answer });
  });
  await page.goto('/#sermons');
  await page.getByRole('button', { name: 'New sermon' }).click();
  await page
    .getByRole('textbox', { name: 'Central idea', exact: true })
    .fill('Keep my original central idea.');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Editable AI draft' }),
  ).toHaveValue(answer.text);
  expect(JSON.stringify(body)).not.toContain('Keep my original central idea.');
  await expect(
    page.getByRole('textbox', { name: 'Central idea', exact: true }),
  ).toHaveValue('Keep my original central idea.');
  await page
    .getByRole('checkbox', { name: 'Selected section: Central idea' })
    .check();
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Editable AI draft' }),
  ).toBeVisible();
  expect(body.context).toEqual({
    passageReference: '',
    sermon: 'Keep my original central idea.',
  });
  expect(JSON.stringify(body)).not.toContain('sample-sermon');
  await page
    .getByRole('textbox', { name: 'Editable AI draft' })
    .fill('My reviewed AI suggestion.');
  await page
    .getByRole('button', { name: 'Insert into selected section' })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Central idea', exact: true }),
  ).toHaveValue(
    /Keep my original central idea\.[\s\S]*My reviewed AI suggestion\./,
  );
  await page
    .getByRole('button', { name: 'Replace selected section', exact: true })
    .click();
  await page.getByRole('button', { name: 'Keep existing section' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Central idea', exact: true }),
  ).toHaveValue(/Keep my original/);
  await page
    .getByRole('button', { name: 'Replace selected section', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Central idea', exact: true }),
  ).toHaveValue('[AI SYNTHESIS]\nMy reviewed AI suggestion.');
});
test('discussion guide generation produces seven editable sections and preserves prior material', async ({
  page,
}, info) => {
  const names = [
    'Opening',
    'Read',
    'Observe',
    'Interpret',
    'Discuss',
    'Apply',
    'Pray',
  ];
  let calls = 0;
  await page.route('**/api/ai/generate', (r) => {
    calls++;
    return r.fulfill({
      json: {
        ...answer,
        sections: Object.fromEntries(names.map((k) => [k, `Draft ${k}`])),
      },
    });
  });
  await page.goto('/#guide');
  await page.getByRole('button', { name: 'New discussion guide' }).click();
  await page
    .getByRole('textbox', { name: 'Sermon material', exact: true })
    .fill('Our sermon discusses hospitality and welcoming neighbors.');
  await page
    .locator('.editor-sections')
    .getByRole('button', { name: /Opening/ })
    .click();
  await page
    .getByRole('textbox', { name: 'Opening', exact: true })
    .fill('My original opening.');
  await page
    .locator('.editor-sections')
    .getByRole('button', { name: /Sermon material/ })
    .click();
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await page.getByRole('button', { name: 'Generate Discussion Guide' }).click();
  await expect(page.getByRole('alert')).toContainText('select it below');
  expect(calls).toBe(0);
  await page
    .getByRole('checkbox', { name: 'Sermon material', exact: true })
    .check();
  await page.getByRole('button', { name: 'Generate Discussion Guide' }).click();
  for (const name of names)
    await expect(
      page.getByRole('textbox', { name: `${name} AI draft`, exact: true }),
    ).toHaveValue(`Draft ${name}`);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('ss.drafts.v1')!).find(
          (d: { title: string }) => d.title === 'Untitled discussion guide',
        ).sections.Opening,
    ),
  ).toBe('My original opening.');
  await page
    .getByRole('textbox', { name: 'Opening AI draft' })
    .fill('Reviewed opening.');
  await page.getByRole('button', { name: 'Insert guide sections' }).click();
  await page
    .locator('.editor-sections')
    .getByRole('button', { name: /Opening/ })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Opening', exact: true }),
  ).toHaveValue('My original opening.\n\n[AI SYNTHESIS]\nReviewed opening.');
  await page.screenshot({
    path: `test-results/ai-guide-${info.project.name}.png`,
    fullPage: true,
  });
});
test('failed AI requests leave Bible-study content intact and can be retried', async ({
  page,
}) => {
  await page.route('**/api/ai/generate', (r) =>
    r.fulfill({
      status: 429,
      json: {
        code: 'rate-limit',
        message: 'DO NOT DISPLAY RAW INTERNAL SECRET',
      },
    }),
  );
  await page.goto('/#bible-studies');
  await page.getByRole('button', { name: 'New bible study' }).click();
  await page
    .getByRole('textbox', { name: 'Main idea', exact: true })
    .fill('Keep this study.');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'current AI request limit',
  );
  await expect(
    page.getByText('DO NOT DISPLAY RAW INTERNAL SECRET'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Main idea', exact: true }),
  ).toHaveValue('Keep this study.');
  await page.route('**/api/ai/generate', (r) => r.fulfill({ json: answer }));
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Editable AI draft' }),
  ).toBeVisible();
});
test('passage assistant saves only a reviewed answer and supports cancellation', async ({
  page,
}) => {
  await page.route('**/api/ai/generate', (r) => r.fulfill({ json: answer }));
  await page.goto('/#study');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Editable AI draft' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Insert into notes' }).click();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.locator('.note-card')).toContainText('[AI SYNTHESIS]');
  let pending: Route | undefined;
  await page.route('**/api/ai/generate', (route) => {
    pending = route;
  });
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'ScriptureSmart is working…' }),
  ).toBeDisabled();
  await expect.poll(() => !!pending).toBe(true);
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await pending!.abort().catch(() => {});
  await expect(
    page.getByText('Request cancelled. Your document is unchanged.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Ask ScriptureSmart', exact: true }),
  ).toBeEnabled();
});

test('signed-out status asks for login, but a service failure does not', async ({
  page,
}) => {
  await page.route('**/v1/account', (r) =>
    r.fulfill({ status: 401, json: { message: 'No session' } }),
  );
  await page.goto('/#connections');
  await expect(
    page.getByText('Available \u00b7 Sign in to ask', { exact: true }),
  ).toBeVisible();
  await page.route('**/api/ai/generate', (r) =>
    r.fulfill({ status: 503, json: { code: 'unavailable' } }),
  );
  await page.goto('/#study');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  await expect(
    page.getByRole('alert').getByRole('link', { name: 'Member sign-in' }),
  ).toHaveCount(0);
  await page.route('**/v1/account/jwts', (r) =>
    r.fulfill({ status: 401, json: { code: 401, message: 'Expired' } }),
  );
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('alert').getByRole('link', { name: 'Member sign-in' }),
  ).toBeVisible();
});

test('adoption question retrieves a reviewable passage list and displays WEB sources', async ({
  page,
}) => {
  let requested: { bible?: { references: string[] } } = {};
  await page.route('**/api/ai/generate', (r) => {
    requested = r.request().postDataJSON();
    return r.fulfill({
      json: {
        ...answer,
        scriptureSources: [
          {
            reference: 'Ephesians 1:5',
            translation: 'WEB',
            text: '1:5 Public passage fixture.',
            url: 'https://bible-api.com/Ephesians%201%3A5?translation=web&single_chapter_book_matching=indifferent',
          },
        ],
      },
    });
  });
  await page.goto('/#study');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Ask ScriptureSmart prompt' })
    .fill(
      'Compare Adoption in Ephesians 1 to other areas that Paul discussed Adoption, is the adoption process really what is predetermined here?',
    );
  await expect(page.getByLabel('Passages to retrieve')).toHaveValue(
    'Ephesians 1:3-14; Romans 8:14-30; Romans 9:1-5; Galatians 4:1-7',
  );
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Bible passages used' }),
  ).toBeVisible();
  expect(requested.bible?.references).toEqual([
    'Ephesians 1:3-14',
    'Romans 8:14-30',
    'Romans 9:1-5',
    'Galatians 4:1-7',
  ]);
  await page.getByText('Ephesians 1:5 (WEB)', { exact: true }).click();
  await expect(
    page.getByText('1:5 Public passage fixture.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/bible-study-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.route('**/api/ai/generate', (r) =>
    r.fulfill({ status: 503, json: { code: 'scripture-unavailable' } }),
  );
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Bible text could not be retrieved',
  );
  await expect(
    page.getByRole('textbox', { name: 'Editable AI draft' }),
  ).toHaveCount(0);
});

test('study follow-ups keep context, preserve answers on failure, and reset explicitly', async ({
  page,
}) => {
  const bodies: any[] = [];
  let fail = false;
  await page.route('**/api/ai/generate', (r) => {
    bodies.push(r.request().postDataJSON());
    return fail
      ? r.fulfill({ status: 503, json: { code: 'unavailable' } })
      : r.fulfill({
          json: {
            ...answer,
            text:
              bodies.length === 1
                ? 'First adoption answer.'
                : 'Follow-up explanation.',
          },
        });
  });
  await page.goto('/#study');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Ask ScriptureSmart prompt' })
    .fill('Compare adoption in Ephesians 1 with Paul.');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(page.getByLabel('Editable AI draft')).toHaveValue(
    'First adoption answer.',
  );
  await page.getByLabel('Editable AI draft').fill('Reviewed adoption answer.');
  await page
    .getByLabel('Follow-up question')
    .fill('What do you mean by the goal?');
  fail = true;
  await page
    .getByRole('button', { name: 'Ask follow-up', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  await expect(page.getByLabel('Editable AI draft')).toHaveValue(
    'Reviewed adoption answer.',
  );
  await expect(page.getByLabel('Follow-up question')).toHaveValue(
    'What do you mean by the goal?',
  );
  fail = false;
  await page
    .getByRole('button', { name: 'Ask follow-up', exact: true })
    .click();
  await expect(page.getByLabel('Editable AI draft')).toHaveValue(
    'Follow-up explanation.',
  );
  expect(bodies[2].conversation).toEqual([
    {
      question: 'Compare adoption in Ephesians 1 with Paul.',
      answer: 'Reviewed adoption answer.',
    },
  ]);
  expect(bodies[2].bible).toEqual(bodies[0].bible);
  await page
    .getByText('Earlier questions and answers (1)', { exact: true })
    .click();
  await expect(
    page.getByText('Reviewed adoption answer.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/follow-up-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Start new conversation' }).click();
  await expect(page.getByLabel('Editable AI draft')).toHaveCount(0);
  await page.getByLabel('Ask ScriptureSmart prompt').fill('Explain John 1:1.');
  await page
    .getByRole('button', { name: 'Ask ScriptureSmart', exact: true })
    .click();
  await expect(page.getByLabel('Editable AI draft')).toBeVisible();
  expect(bodies.at(-1).conversation).toBeUndefined();
});
