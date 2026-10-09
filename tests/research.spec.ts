import { test, expect } from '@playwright/test';

test('study chat gathers selected translation and sourced open research', async ({
  page,
}) => {
  await page.route('**/v1/account', (route) =>
    route.fulfill({
      status: 200,
      json: {
        $id: 'research-user',
        email: 'member@example.test',
        emailVerification: true,
        status: true,
      },
    }),
  );
  await page.route('**/v1/account/jwts', (route) =>
    route.fulfill({ status: 201, json: { jwt: 'mock-user-jwt' } }),
  );
  await page.route('**/api/bible/status', (route) =>
    route.fulfill({
      json: {
        available: true,
        provider: 'ScriptureSmart Bible providers',
        translations: [
          { id: 'CSB', name: 'Christian Standard Bible' },
          { id: 'NLT', name: 'New Living Translation' },
          { id: 'NKJV', name: 'New King James Version' },
          { id: 'KJV', name: 'King James Version' },
          { id: 'WEB', name: 'World English Bible' },
        ],
      },
    }),
  );
  await page.route('**/api/bible/research?*', (route) =>
    route.fulfill({
      json: {
        openTranslation: { id: 'BSB', verses: [] },
        references: [
          { reference: 'Romans 8:15', score: 91 },
          { reference: 'Galatians 4:5', score: 86 },
        ],
        words: [
          {
            verse: 5,
            text: 'adoption',
            lemma: 'huiothesia',
            strongs: ['G5206'],
            morph: 'N-NSF',
          },
        ],
        commentaries: [
          {
            id: 'sample-commentary',
            name: 'Open commentary sample',
            text: 'A sourced commentary excerpt for the passage.',
            website: 'https://example.test/commentary',
            licenseUrl: 'https://example.test/license',
          },
        ],
        entities: [
          { type: 'people', name: 'Paul' },
          { type: 'places', name: 'Ephesus' },
        ],
        unavailable: [],
        source: 'Free Use Bible API',
      },
    }),
  );
  await page.route('**/api/bible/passage?*', (route) =>
    route.fulfill({
      json: {
        reference: 'Ephesians 1:3-14',
        translationId: 'CSB',
        text: 'He predestined us to adoption as sons and daughters.',
        attribution: 'CSB mock edition',
        sourceUrl: 'https://api.bible/',
        fumsToken: 'mock-view-token',
        rights: {
          displayAllowed: true,
          aiContextAllowed: false,
          cachingAllowed: false,
          localStorageAllowed: false,
          commercialUseAllowed: false,
        },
      },
    }),
  );
  let requestBody: Record<string, unknown> | undefined;
  await page.route('**/api/ai/generate', (route) => {
    requestBody = route.request().postDataJSON();
    return route.fulfill({
      json: {
        text: 'Paul describes adoption as a purpose of God’s saving work.',
        provider: 'scripturesmart-ai',
        model: 'mock-model',
        createdAt: '2026-10-02T12:00:00Z',
        kind: 'AI SYNTHESIS',
        bibleResearch: {
          reference: 'Ephesians 1:3-14',
          testament: 'new',
          selectedTranslation: {
            id: 'CSB',
            name: 'Christian Standard Bible',
            text: 'He predestined us to adoption as sons and daughters.',
            attribution: 'CSB mock edition',
            sourceUrl: 'https://api.bible/',
            fumsToken: 'mock-view-token',
            rights: {
              displayAllowed: true,
              aiContextAllowed: false,
              cachingAllowed: false,
              localStorageAllowed: false,
              commercialUseAllowed: false,
            },
          },
          comparisonTranslations: [],
          openTranslation: {
            id: 'BSB',
            verses: [{ verse: 5, text: 'He predestined us for adoption.' }],
          },
          crossReferences: [
            { reference: 'Romans 8:15' },
            { reference: 'Galatians 4:5' },
          ],
          originalLanguage: {
            language: 'Greek',
            words: [
              {
                verse: 5,
                text: 'predestined',
                lemma: 'proorizō',
                strongs: ['G4309'],
                morph: 'V-AAI-3S',
              },
            ],
          },
          commentaries: [],
          entities: [{ type: 'people', name: 'Paul' }],
          unavailable: ['Matching commentary'],
          source: 'Free Use Bible API',
        },
      },
    });
  });

  await page.goto('/#study');
  await expect(page.locator('.scripture-text')).toContainText(
    'He predestined us to adoption as sons and daughters.',
  );
  await page.locator('#cross-references summary').click();
  await expect(page.locator('#cross-references')).toContainText('Romans 8:15');
  await page.locator('#commentary-insights summary').click();
  await expect(page.locator('#commentary-insights')).toContainText(
    'A sourced commentary excerpt for the passage.',
  );
  await page.locator('#original-language summary').click();
  await expect(page.locator('#original-language')).toContainText('huiothesia');
  await page.locator('#reading-plans summary').click();
  await expect(page.locator('#reading-plans')).toContainText(
    'Session 2: Romans 8:15',
  );
  await page.locator('#maps-timelines summary').click();
  await expect(page.locator('#maps-timelines')).toContainText('Ephesus');
  const prompt =
    'Compare adoption in Ephesians 1 with other areas Paul discussed adoption. Is adoption predetermined?';
  await page.getByRole('textbox', { name: 'Study question' }).fill(prompt);
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(
    page.getByText('Passage research · Ephesians 1:3-14'),
  ).toBeVisible();
  const chatResearch = page.locator('.ai-chat-thread');
  await expect(chatResearch.getByText('Romans 8:15')).toBeVisible();
  await expect(chatResearch.getByText('Galatians 4:5')).toBeVisible();
  await expect(chatResearch.getByText('Greek → English (1)')).toBeVisible();
  await page
    .locator('summary')
    .filter({ hasText: 'People, places, and events' })
    .click();
  await expect(chatResearch.getByText('Paul · people')).toBeVisible();
  expect(requestBody?.context).toMatchObject({
    passageReference: 'Ephesians 1:3–14',
    translationIds: ['KJV', 'WEB'],
  });
  expect(requestBody?.bible).toMatchObject({
    references: [
      'Ephesians 1:3-14',
      'Romans 8:14-30',
      'Romans 9:1-5',
      'Galatians 4:1-7',
    ],
  });
  expect(JSON.stringify(requestBody)).not.toContain(
    'He predestined us to adoption as sons and daughters.',
  );

  await page.setViewportSize({ width: 900, height: 1000 });
  const positions = await page.evaluate(() => {
    const resources = document
      .querySelector('.study-tool-rail')!
      .getBoundingClientRect();
    const assistant = document
      .querySelector('.study-desk-layout > .ai-assistant')!
      .getBoundingClientRect();
    return { resourcesTop: resources.top, assistantBottom: assistant.bottom };
  });
  expect(positions.resourcesTop).toBeGreaterThanOrEqual(
    positions.assistantBottom,
  );

  await page.reload();
  await page.getByText('Chat history (1)', { exact: true }).click();
  await page
    .getByRole('button', { name: /Compare adoption in Ephesians 1/ })
    .click();
  await expect(
    page.getByText('Paul describes adoption as a purpose'),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Study question' })
    .fill('How does that connect to grace?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(
    page.getByText('Paul describes adoption as a purpose'),
  ).toHaveCount(2);
  expect(requestBody?.conversation).toEqual([
    {
      question: prompt,
      answer: 'Paul describes adoption as a purpose of God’s saving work.',
    },
  ]);
  await page.getByRole('button', { name: 'Send to Sermon Build' }).click();
  await expect(page).toHaveURL(/#sermons$/);
  await page.getByRole('button', { name: /Observations/ }).click();
  await expect(page.getByLabel('Observations')).toContainText(
    'Question 1: Compare adoption in Ephesians 1',
  );
  await expect(page.getByLabel('Observations')).toContainText(
    'Question 2: How does that connect to grace?',
  );
});
