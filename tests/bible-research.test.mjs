import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveOpenBibleResearch } from '../server/ai/freeUseBible.ts';
import { retrieveApiBiblePassage } from '../server/ai/translationProviders.ts';
import { testamentForReference } from '../src/domain/bible.ts';
import { reportApiBibleViews } from '../src/ai/fums.ts';

test('the canonical book list separates Old and New Testament references', () => {
  assert.equal(testamentForReference('Genesis 3:1-5'), 'old');
  assert.equal(testamentForReference('Malachi 4'), 'old');
  assert.equal(testamentForReference('Matthew 1'), 'new');
  assert.equal(testamentForReference('Revelation 22:1'), 'new');
  assert.equal(testamentForReference('not a reference'), null);
});

test('API.Bible FUMS view tokens are deduplicated and reported only by the browser tracker', async () => {
  const previousWindow = globalThis.window;
  const calls = [];
  globalThis.window = { fums: (...args) => calls.push(args) };
  try {
    await reportApiBibleViews(['view-token', 'view-token', undefined]);
    assert.deepEqual(calls, [['trackView', ['view-token']]]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('API.Bible discovers each active translation from the authorized Bible list', async () => {
  const requested = [];
  const responses = [];
  for (const id of ['NASB', 'CSB', 'NKJV', 'KJV']) {
    const passage = await retrieveApiBiblePassage({
      apiKey: 'private-server-key',
      reference: 'John 3:16',
      translationId: id,
      transport: async (url, init) => {
        requested.push({ url: String(url), init });
        if (String(url).includes('/bibles?'))
          return Response.json({
            data: [
              {
                id: `discovered-${id}`,
                abbreviation: id,
                name: `${id} licensed edition`,
              },
            ],
          });
        return Response.json({
          data: {
            content: 'A selected passage.',
            reference: 'John 3:16',
            copyright: `${id} attribution`,
          },
        });
      },
    });
    responses.push(passage);
    assert.equal(passage.translationId, id);
    assert.match(requested.at(-1).url, new RegExp(`discovered-${id}`));
  }
  assert.equal(requested.length, 8);
  assert.ok(
    requested.every(
      ({ init }) => init.headers['api-key'] === 'private-server-key',
    ),
  );
  assert.ok(!JSON.stringify(responses).includes('private-server-key'));
});

test('unlicensed API.Bible versions fail without revealing upstream errors', async () => {
  await assert.rejects(
    retrieveApiBiblePassage({
      apiKey: 'private-server-key',
      reference: 'John 3:16',
      translationId: 'NASB',
      transport: async () => new Response('license denied', { status: 403 }),
    }),
    /api-bible-license-required/,
  );
});

test('Free Use Bible research returns sourced open text, cross references, annotations, entities and commentary status', async () => {
  const research = await retrieveOpenBibleResearch({
    reference: 'Ephesians 1:3-4',
    transport: async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/d/open-cross-ref/EPH/1.json'))
        return Response.json({
          chapter: {
            content: [
              {
                verse: 3,
                references: [{ book: 'ROM', chapter: 8, verse: 15, score: 77 }],
              },
              { verse: 4, references: [{ book: 'GAL', chapter: 4, verse: 5 }] },
              {
                verse: 5,
                references: [{ book: 'JHN', chapter: 1, verse: 12 }],
              },
            ],
          },
        });
      if (path.endsWith('/BSB/EPH/1.json'))
        return Response.json({
          chapter: {
            content: [
              {
                type: 'verse',
                number: 3,
                content: ['Blessed be the God and Father.'],
              },
              { type: 'verse', number: 4, content: ['He chose us in Him.'] },
            ],
          },
        });
      if (path.endsWith('/BSB/EPH/1.words.json'))
        return Response.json({
          verses: {
            3: [
              {
                contentIndex: 0,
                start: 0,
                end: 7,
                strongs: ['G2127'],
                lemma: 'eulogeō',
                morph: 'V-AAI-3S',
                occurrences: 8,
              },
            ],
            4: [{ strongs: ['G1586'], srcloc: 'UGNT:1', occurrences: 22 }],
          },
        });
      if (path.endsWith('/available_commentaries.json'))
        return Response.json({ commentaries: [] });
      if (path.endsWith('/d/theographic/EPH/1.json'))
        return Response.json({
          chapter: { people: [{ name: 'Paul' }], places: [], events: [] },
        });
      throw new Error(`Unexpected external URL: ${path}`);
    },
  });
  assert.equal(research.source, 'Free Use Bible API');
  assert.deepEqual(
    research.openTranslation.verses.map((v) => v.verse),
    [3, 4],
  );
  assert.deepEqual(
    research.references.map((r) => r.reference),
    ['Romans 8:15', 'Galatians 4:5'],
  );
  assert.equal(research.words[0].lemma, 'eulogeō');
  assert.equal(research.words[0].text, 'Blessed');
  assert.deepEqual(research.words[0].strongs, ['G2127']);
  assert.deepEqual(research.entities, [{ type: 'people', name: 'Paul' }]);
  assert.deepEqual(research.commentaries, []);
  assert.ok(research.unavailable.includes('Matching commentary'));
});

test('open research keeps results when word annotations, cross references or commentary sources fail', async () => {
  const research = await retrieveOpenBibleResearch({
    reference: 'Genesis 1:1',
    transport: async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/BSB/GEN/1.json'))
        return Response.json({
          chapter: {
            content: [
              { type: 'verse', number: 1, content: ['In the beginning.'] },
            ],
          },
        });
      throw new Error(`Unavailable ${path}`);
    },
  });
  assert.equal(research.openTranslation.verses[0].text, 'In the beginning.');
  assert.deepEqual(research.references, []);
  assert.deepEqual(research.words, []);
  assert.ok(research.unavailable.includes('Cross references'));
  assert.ok(research.unavailable.includes('Original-language annotations'));
  assert.ok(research.unavailable.includes('Matching commentary'));
});
