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

const youVersionBibleIds: Record<string, number> = {
  KJV: 1,
  ESV: 59,
  NIV: 111,
  NKJV: 114,
  CSB: 1713,
  BSB: 3034,
};

export interface YouVersionPassage {
  reference: string;
  translationId: string;
  text: string;
  attribution: string;
  sourceUrl: string;
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
  const bibleId = youVersionBibleIds[translationId];
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
  };
}
