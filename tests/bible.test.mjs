import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReference,
  suggestedReferences,
  passageURL,
} from '../src/domain/bible.ts';
import { retrievePassages } from '../server/ai/scripture.ts';
import {
  referenceToUsfm,
  retrieveYouVersionPassage,
} from '../server/ai/youversion.ts';
import { validateRequest } from '../server/ai/validation.ts';
import { generateWithBinding } from '../server/ai/provider.ts';
import {
  retrieveApiBiblePassage,
} from '../server/ai/translationProviders.ts';
import { parseAIResponse } from '../src/domain/ai.ts';

test('adoption questions select the curated Pauline passages, other topics use explicit references', () => {
  assert.deepEqual(
    suggestedReferences(
      'Compare Adoption in Ephesians 1 to other areas Paul discussed Adoption',
    ),
    ['Ephesians 1:3-14', 'Romans 8:14-30', 'Romans 9:1-5', 'Galatians 4:1-7'],
  );
  assert.deepEqual(
    suggestedReferences('Compare John 1:1-5 with Genesis 1:1-3'),
    ['John 1:1-5', 'Genesis 1:1-3'],
  );
  assert.equal(normalizeReference('https://evil.test'), null);
  assert.equal(normalizeReference('Romans 8:30-1'), null);
  assert.equal(normalizeReference('Romans 0'), null);
  assert.equal(normalizeReference('Ephesians 1:3\u201314'), 'Ephesians 1:3-14');
});
test('Bible request boundary rejects URLs, excessive lists and forged provider controls', () => {
  const base = { taskType: 'general', prompt: 'Compare adoption' };
  for (const bible of [
    { references: ['https://evil.test'] },
    { references: Array(7).fill('John 1') },
    { references: ['John 1'], translation: 'NASB' },
  ])
    assert.throws(() => validateRequest({ ...base, bible }));
  assert.deepEqual(
    validateRequest({ ...base, bible: { references: ['romans 8:14-17'] } })
      .bible.references,
    ['Romans 8:14-17'],
  );
});
test('retrieval uses a fixed WEB endpoint, validates verse identity and fails on redirects or missing verses', async () => {
  const passage = await retrievePassages(
    ['Ephesians 1:5'],
    async (url, init) => {
      assert.equal(url, passageURL('Ephesians 1:5'));
      assert.equal(init.redirect, 'manual');
      return Response.json({
        translation_id: 'web',
        verses: [
          {
            book_name: 'Ephesians',
            chapter: 1,
            verse: 5,
            text: 'Test fixture text.',
          },
        ],
      });
    },
  );
  assert.equal(passage[0].text, '1:5 Test fixture text.');
  await assert.rejects(
    retrievePassages(['Romans 8:14-17'], async () =>
      Response.json({
        translation_id: 'web',
        verses: [
          { book_name: 'Romans', chapter: 8, verse: 14, text: 'Partial' },
        ],
      }),
    ),
    (e) => e.code === 'scripture-unavailable',
  );
  await assert.rejects(
    retrievePassages(
      ['Galatians 4:5'],
      async () => new Response(null, { status: 302 }),
    ),
    (e) => e.code === 'scripture-unavailable',
  );
  await assert.rejects(
    retrievePassages(['John 1:1'], async () =>
      Response.json({
        translation_id: 'kjv',
        verses: [
          {
            book_name: 'John',
            chapter: 1,
            verse: 1,
            text: 'Wrong translation',
          },
        ],
      }),
    ),
    (e) => e.code === 'scripture-unavailable',
  );
});
test('retrieved passages enter the model with provenance and remain reviewable in the response', async () => {
  const sources = [
    {
      reference: 'Ephesians 1:5',
      translation: 'WEB',
      text: '1:5 Test fixture text.',
      url: passageURL('Ephesians 1:5'),
    },
  ];
  let messages;
  const result = await generateWithBinding(
    {
      run: async (_, args) => {
        messages = args.messages;
        return {
          response:
            'AI SYNTHESIS: A qualified interpretation (Ephesians 1:5, WEB).',
        };
      },
    },
    { SCRIPTURESMART_AI_MODEL: '@cf/test' },
    { taskType: 'general', prompt: 'Compare adoption' },
    sources,
  );
  assert.deepEqual(JSON.parse(messages[1].content).retrievedScripture, sources);
  assert.match(messages[0].content, /corporate-election/);
  assert.deepEqual(
    parseAIResponse(result, 'general').scriptureSources,
    sources,
  );
  assert.throws(() =>
    parseAIResponse(
      {
        ...result,
        scriptureSources: [{ ...sources[0], url: 'javascript:alert(1)' }],
      },
      'general',
    ),
  );
});

test('YouVersion passage retrieval converts references and keeps the app key server-side', async () => {
  assert.equal(referenceToUsfm('John 3:16'), 'JHN.3.16');
  assert.equal(referenceToUsfm('Romans 8:14-17'), 'ROM.8.14-17');
  let seen;
  const passage = await retrieveYouVersionPassage({
    apiKey: 'secret-app-key',
    reference: 'John 3:16',
    translationId: 'BSB',
    transport: async (url, init) => {
      seen = { url, init };
      return Response.json({
        id: 'JHN.3.16',
        content: 'For God so loved the world.',
        reference: 'John 3:16',
      });
    },
  });
  assert.equal(
    seen.url,
    'https://api.youversion.com/v1/bibles/3034/passages/JHN.3.16?format=text',
  );
  assert.equal(seen.init.headers['X-YVP-App-Key'], 'secret-app-key');
  assert.equal(seen.init.redirect, 'manual');
  assert.equal(passage.text, 'For God so loved the world.');
  assert.equal(passage.translationId, 'BSB');
  await assert.rejects(
    retrieveYouVersionPassage({
      apiKey: '',
      reference: 'John 3:16',
      translationId: 'BSB',
    }),
  );
  await assert.rejects(
    retrieveYouVersionPassage({
      apiKey: 'secret',
      reference: 'John 3:16',
      translationId: 'UNKNOWN',
    }),
  );
});

test('API.Bible resolves only licensed versions and requests plain passage text server-side', async () => {
  const calls = [];
  const passage = await retrieveApiBiblePassage({
    apiKey: 'private-api-bible-key',
    reference: 'John 3:16-17',
    translationId: 'NKJV',
    transport: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/bibles?'))
        return Response.json({
          data: [{ id: 'nkjv-version', abbreviation: 'NKJV', name: 'New King James Version' }],
        });
      return Response.json({
        data: {
          content: '16 For God so loved the world. 17 For God did not send His Son.',
          reference: 'John 3:16-17',
          copyright: 'Scripture quotations are from the NKJV.',
        },
        meta: { fumsToken: 'fums-view-token' },
      });
    },
  });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /abbreviation=NKJV/);
  assert.equal(calls[0].init.headers['api-key'], 'private-api-bible-key');
  assert.match(calls[1].url, /JHN\.3\.16-JHN\.3\.17/);
  assert.match(calls[1].url, /content-type=text/);
  assert.match(calls[1].url, /fums-version=3/);
  assert.equal(passage.translationId, 'NKJV');
  assert.match(passage.attribution, /NKJV/);
  assert.equal(passage.fumsToken, 'fums-view-token');
  assert.ok(!JSON.stringify(passage).includes('private-api-bible-key'));
});
