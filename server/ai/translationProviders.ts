import { referenceToUsfm } from './youversion.ts';

export interface LicensedBiblePassage {
  reference: string;
  translationId: string;
  text: string;
  attribution: string;
  sourceUrl: string;
  fumsToken?: string;
  rights: {
    displayAllowed: boolean;
    aiContextAllowed: boolean;
    cachingAllowed: boolean;
    localStorageAllowed: boolean;
    commercialUseAllowed: boolean;
  };
}

const apiBibleIds = ['CSB', 'NLT', 'NKJV'] as const;
const apiBibleRoot = 'https://rest.api.bible/v1';
const apiBibleSite = 'https://api.bible/';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() && value.length <= max
    ? value.trim()
    : null;
}

function apiBiblePassageRoute(
  reference: string,
): { kind: 'chapters' | 'passages'; id: string } | null {
  const usfm = referenceToUsfm(reference);
  if (!usfm) return null;
  const chapter = /^([A-Z0-9]{3}\.\d+)$/.exec(usfm);
  if (chapter) return { kind: 'chapters', id: chapter[1] };
  const match = /^([A-Z0-9]{3})\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(usfm);
  if (!match) return null;
  const [, book, chapterNumber, first, last] = match;
  return {
    kind: 'passages',
    id: `${book}.${chapterNumber}.${first}${last ? `-${book}.${chapterNumber}.${last}` : ''}`,
  };
}

async function apiBibleRequest(
  key: string,
  path: string,
  transport: typeof fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await transport(`${apiBibleRoot}${path}`, {
      headers: { 'api-key': key },
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw Error('api-bible-unavailable');
  }
  if (response.status === 403) throw Error('api-bible-license-required');
  if (!response.ok) throw Error('api-bible-unavailable');
  try {
    const raw = await response.text();
    if (raw.length > 150000) throw Error('oversized');
    return JSON.parse(raw);
  } catch {
    throw Error('api-bible-unavailable');
  }
}

async function apiBibleMetadata(
  apiKey: string,
  translationId: string,
  transport: typeof fetch,
): Promise<Record<string, unknown> | null> {
  const query = new URLSearchParams({
    language: 'eng',
    abbreviation: translationId,
    'include-full-details': 'true',
  });
  const body = await apiBibleRequest(apiKey, `/bibles?${query}`, transport);
  if (!record(body) || !Array.isArray(body.data)) return null;
  const bible = body.data.find(
    (entry) =>
      record(entry) &&
      (entry.abbreviation?.toString().toUpperCase() === translationId ||
        entry.abbreviationLocal?.toString().toUpperCase() === translationId),
  );
  if (!record(bible)) return null;
  return bible;
}

export async function listApiBibleTranslations({
  apiKey,
  transport = globalThis.fetch.bind(globalThis),
}: {
  apiKey?: string;
  transport?: typeof fetch;
}): Promise<{ id: string; name: string }[]> {
  if (!apiKey?.trim()) return [];
  const results: ({ id: string; name: string } | null)[] = await Promise.all(
    apiBibleIds.map(async (id) => {
      try {
        const bible = await apiBibleMetadata(apiKey, id, transport);
        if (!bible || typeof bible.id !== 'string') return null;
        const name = boundedText(bible.name, 120) ?? id;
        return { id, name };
      } catch {
        return null;
      }
    }),
  );
  return results.filter(
    (item): item is { id: string; name: string } => item !== null,
  );
}

async function findApiBibleId(
  apiKey: string,
  translationId: string,
  transport: typeof fetch,
): Promise<string> {
  if (!apiBibleIds.includes(translationId as (typeof apiBibleIds)[number]))
    throw Error('invalid-api-bible-request');
  const bible = await apiBibleMetadata(apiKey, translationId, transport);
  if (!record(bible) || typeof bible.id !== 'string')
    throw Error('api-bible-license-required');
  return bible.id;
}

export async function retrieveApiBiblePassage({
  apiKey,
  reference,
  translationId,
  transport = globalThis.fetch.bind(globalThis),
}: {
  apiKey?: string;
  reference: string;
  translationId: string;
  transport?: typeof fetch;
}): Promise<LicensedBiblePassage> {
  if (!apiKey?.trim()) throw Error('api-bible-not-configured');
  const passage = apiBiblePassageRoute(reference);
  if (!passage) throw Error('invalid-api-bible-request');
  const bibleId = await findApiBibleId(apiKey, translationId, transport);
  const query = new URLSearchParams({
    'content-type': 'text',
    'include-titles': 'false',
    'include-verse-numbers': 'true',
    'fums-version': '3',
  });
  const body = await apiBibleRequest(
    apiKey,
    `/bibles/${encodeURIComponent(bibleId)}/${passage.kind}/${encodeURIComponent(passage.id)}?${query}`,
    transport,
  );
  if (!record(body) || !record(body.data)) throw Error('api-bible-unavailable');
  const text = boundedText(body.data.content, 50000);
  if (!text) throw Error('api-bible-unavailable');
  const copyright = boundedText(body.data.copyright, 2000);
  return {
    reference: boundedText(body.data.reference, 300) ?? reference,
    translationId,
    text,
    attribution: copyright ?? `${translationId} text provided by API.Bible.`,
    sourceUrl: apiBibleSite,
    rights: {
      displayAllowed: true,
      aiContextAllowed: false,
      cachingAllowed: false,
      localStorageAllowed: false,
      // The present key/license's commercial use has not been verified here.
      commercialUseAllowed: false,
    },
    ...(record(body.meta) && typeof body.meta.fumsToken === 'string'
      ? { fumsToken: body.meta.fumsToken }
      : {}),
  };
}
