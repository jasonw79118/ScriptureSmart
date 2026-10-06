const bookUsfm: Record<string, string> = {
  Genesis: 'GEN',
  Exodus: 'EXO',
  Leviticus: 'LEV',
  Numbers: 'NUM',
  Deuteronomy: 'DEU',
  Joshua: 'JOS',
  Judges: 'JDG',
  Ruth: 'RUT',
  '1 Samuel': '1SA',
  '2 Samuel': '2SA',
  '1 Kings': '1KI',
  '2 Kings': '2KI',
  '1 Chronicles': '1CH',
  '2 Chronicles': '2CH',
  Ezra: 'EZR',
  Nehemiah: 'NEH',
  Esther: 'EST',
  Job: 'JOB',
  Psalms: 'PSA',
  Proverbs: 'PRO',
  Ecclesiastes: 'ECC',
  'Song of Solomon': 'SNG',
  Isaiah: 'ISA',
  Jeremiah: 'JER',
  Lamentations: 'LAM',
  Ezekiel: 'EZK',
  Daniel: 'DAN',
  Hosea: 'HOS',
  Joel: 'JOL',
  Amos: 'AMO',
  Obadiah: 'OBA',
  Jonah: 'JON',
  Micah: 'MIC',
  Nahum: 'NAM',
  Habakkuk: 'HAB',
  Zephaniah: 'ZEP',
  Haggai: 'HAG',
  Zechariah: 'ZEC',
  Malachi: 'MAL',
  Matthew: 'MAT',
  Mark: 'MRK',
  Luke: 'LUK',
  John: 'JHN',
  Acts: 'ACT',
  Romans: 'ROM',
  '1 Corinthians': '1CO',
  '2 Corinthians': '2CO',
  Galatians: 'GAL',
  Ephesians: 'EPH',
  Philippians: 'PHP',
  Colossians: 'COL',
  '1 Thessalonians': '1TH',
  '2 Thessalonians': '2TH',
  '1 Timothy': '1TI',
  '2 Timothy': '2TI',
  Titus: 'TIT',
  Philemon: 'PHM',
  Hebrews: 'HEB',
  James: 'JAS',
  '1 Peter': '1PE',
  '2 Peter': '2PE',
  '1 John': '1JN',
  '2 John': '2JN',
  '3 John': '3JN',
  Jude: 'JUD',
  Revelation: 'REV',
};

export const youVersionTranslations = [
  { id: 'CSB', name: 'Christian Standard Bible' },
  { id: 'NLT', name: 'New Living Translation' },
  { id: 'NKJV', name: 'New King James Version' },
  { id: 'BSB', name: 'Berean Standard Bible' },
  { id: 'ASV', name: 'American Standard Version' },
  { id: 'WEBUS', name: 'World English Bible, American English' },
  { id: 'FBV', name: 'Free Bible Version' },
  { id: 'LSV', name: 'Literal Standard Version' },
  { id: 'WMB', name: 'World Messianic Bible' },
  { id: 'CPDV', name: 'Catholic Public Domain Version' },
  { id: 'TCENT', name: 'Text-Critical English New Testament' },
] as const;

const youVersionBibleIds: Record<string, number> = {
  ASV: 12,
  BSB: 3034,
  CPDV: 42,
  FBV: 1932,
  LSV: 2660,
  TCENT: 3427,
  WEBUS: 206,
  WMB: 1209,
};

export interface YouVersionPassage {
  reference: string;
  translationId: string;
  text: string;
  attribution: string;
  sourceUrl: string;
  rights: {
    displayAllowed: boolean;
    aiContextAllowed: boolean;
    cachingAllowed: boolean;
    localStorageAllowed: boolean;
    commercialUseAllowed: boolean;
  };
}

const activeYouVersionIds = ['CSB', 'NLT', 'NKJV'] as const;
type ActiveYouVersionId = (typeof activeYouVersionIds)[number];
const youVersionApiRoot = 'https://api.youversion.com/v1';

async function listEnglishBibles(
  apiKey: string,
  transport: typeof fetch,
): Promise<Record<string, unknown>[]> {
  const bibles: Record<string, unknown>[] = [];
  let pageToken = '';
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ language_ranges: 'en', page_size: '100' });
    if (pageToken) query.set('page_token', pageToken);
    let response: Response;
    try {
      response = await transport(`${youVersionApiRoot}/bibles?${query}`, {
        headers: { 'X-YVP-App-Key': apiKey },
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw Error('youversion-unavailable');
    }
    if (!response.ok)
      throw Error(
        response.status === 401
          ? 'youversion-unauthorized'
          : response.status === 403
            ? 'youversion-forbidden'
            : 'youversion-unavailable',
      );
    let body: unknown;
    try {
      const raw = await response.text();
      if (raw.length > 150000) throw Error('oversized');
      body = JSON.parse(raw);
    } catch {
      throw Error('youversion-unavailable');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw Error('youversion-unavailable');
    const record = body as Record<string, unknown>;
    if (!Array.isArray(record.data)) throw Error('youversion-unavailable');
    for (const item of record.data) {
      if (item && typeof item === 'object' && !Array.isArray(item))
        bibles.push(item as Record<string, unknown>);
    }
    const next = record.next_page_token;
    if (typeof next !== 'string' || !next || next.length > 1000) break;
    pageToken = next;
  }
  return bibles;
}

function bibleAbbreviation(bible: Record<string, unknown>): string {
  const value = bible.abbreviation ?? bible.localized_abbreviation;
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function bibleNumericId(bible: Record<string, unknown>): number | null {
  const value = typeof bible.id === 'number' ? bible.id : Number(bible.id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function listYouVersionTranslations({
  apiKey,
  transport = globalThis.fetch.bind(globalThis),
}: {
  apiKey?: string;
  transport?: typeof fetch;
}): Promise<{ id: ActiveYouVersionId; name: string }[]> {
  if (!apiKey?.trim()) return [];
  const bibles = await listEnglishBibles(apiKey, transport);
  return activeYouVersionIds.flatMap((id) => {
    const bible = bibles.find((item) => bibleAbbreviation(item) === id);
    if (!bible || !bibleNumericId(bible)) return [];
    const title = bible.title ?? bible.name;
    const name = typeof title === 'string' && title.trim() ? title.trim() : id;
    return [{ id, name: name.slice(0, 120) }];
  });
}

export function referenceToUsfm(reference: string): string | null {
  const match = /^(.*) (\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(reference);
  if (!match) return null;
  const book = bookUsfm[match[1]];
  if (!book) return null;
  const chapter = +match[2];
  const firstVerse = match[3] ? +match[3] : null;
  const lastVerse = match[4] ? +match[4] : null;
  if (!firstVerse) return `${book}.${chapter}`;
  return `${book}.${chapter}.${firstVerse}${lastVerse ? `-${lastVerse}` : ''}`;
}

export function bookNameFromUsfm(usfm: string): string | null {
  const code = /^([A-Z0-9]{3})\./.exec(usfm)?.[1];
  return code
    ? (Object.entries(bookUsfm).find(([, value]) => value === code)?.[0] ??
        null)
    : null;
}

function plainText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() && value.length <= max
    ? value.trim()
    : null;
}

export async function retrieveYouVersionPassage({
  apiKey,
  reference,
  translationId,
  transport = globalThis.fetch.bind(globalThis),
}: {
  apiKey?: string;
  reference: string;
  translationId: string;
  transport?: typeof fetch;
}): Promise<YouVersionPassage> {
  if (!apiKey?.trim()) throw Error('youversion-not-configured');
  let bibleId: number | undefined = youVersionBibleIds[translationId];
  if (!bibleId && activeYouVersionIds.includes(translationId as ActiveYouVersionId)) {
    const bibles = await listEnglishBibles(apiKey, transport);
    const bible = bibles.find((item) => bibleAbbreviation(item) === translationId);
    bibleId = bible ? (bibleNumericId(bible) ?? undefined) : undefined;
  }
  const usfm = referenceToUsfm(reference);
  if (!bibleId || !usfm) throw Error('invalid-youversion-request');
  let response: Response;
  try {
    response = await transport(
      `https://api.youversion.com/v1/bibles/${bibleId}/passages/${encodeURIComponent(usfm)}?format=text`,
      {
        headers: { 'X-YVP-App-Key': apiKey },
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
      },
    );
  } catch {
    throw Error('youversion-unavailable');
  }
  if (!response.ok) throw Error('youversion-unavailable');
  let body: unknown;
  try {
    const raw = await response.text();
    if (raw.length > 100000) throw Error('oversized');
    body = JSON.parse(raw);
  } catch {
    throw Error('youversion-unavailable');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw Error('youversion-unavailable');
  const record = body as Record<string, unknown>;
  const text = plainText(record.content, 50000);
  const returnedReference = plainText(record.reference, 300) ?? reference;
  if (!text) throw Error('youversion-unavailable');
  return {
    reference: returnedReference,
    translationId,
    text,
    attribution: `${translationId} text provided by YouVersion. Follow Bible version copyright and display terms.`,
    sourceUrl: `https://www.bible.com/bible/${bibleId}/${usfm}`,
    rights: {
      displayAllowed: true,
      aiContextAllowed: false,
      cachingAllowed: false,
      localStorageAllowed: false,
      commercialUseAllowed: false,
    },
  };
}
