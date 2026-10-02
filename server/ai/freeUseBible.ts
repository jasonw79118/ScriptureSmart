import { bookNameFromUsfm, referenceToUsfm } from './youversion.ts';

const root = 'https://bible.helloao.org/api';
const cache = new Map<string, { expires: number; value: unknown }>();
const ttl = 30 * 60 * 1000;
type Ref = { reference: string; score?: number };
type Word = {
  verse: number;
  text?: string;
  strongs?: string[];
  lemma?: string;
  morph?: string;
  srcloc?: string;
  occurrences?: number;
};
type Commentary = {
  id: string;
  name: string;
  text: string;
  website?: string;
  licenseUrl?: string;
};
export interface OpenBibleResearch {
  openTranslation: { id: string; verses: { verse: number; text: string }[] };
  references: Ref[];
  words: Word[];
  commentaries: Commentary[];
  entities: { type: 'people' | 'places' | 'events'; name: string }[];
  unavailable: string[];
  source: 'Free Use Bible API';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
async function get(path: string, transport: typeof fetch): Promise<unknown> {
  const url = `${root}/${path}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value;
  const response = await transport(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw Error('open-research-unavailable');
  const raw = await response.text();
  if (raw.length > 500_000) throw Error('open-research-oversized');
  const data: unknown = JSON.parse(raw);
  if (cache.size > 128) cache.clear();
  cache.set(url, { expires: Date.now() + ttl, value: data });
  return data;
}
function referenceParts(reference: string) {
  const usfm = referenceToUsfm(reference);
  if (!usfm) return null;
  const match =
    /^([A-Z0-9]{3})\.(\d+)(?:\.(\d+)(?:-(?:(?:[A-Z0-9]{3}\.)?\d+\.)?(\d+))?)?$/.exec(
      usfm,
    );
  if (!match) return null;
  return {
    book: match[1],
    chapter: Number(match[2]),
    first: Number(match[3] ?? 1),
    last: Number(match[4] ?? match[3] ?? 999),
  };
}
function makeRef(
  book: unknown,
  chapter: unknown,
  verse: unknown,
  endVerse?: unknown,
) {
  if (
    typeof book !== 'string' ||
    typeof chapter !== 'number' ||
    typeof verse !== 'number'
  )
    return null;
  const bookName = bookNameFromUsfm(`${book}.1`);
  return bookName
    ? `${bookName} ${chapter}:${verse}${typeof endVerse === 'number' ? `-${endVerse}` : ''}`
    : null;
}

export async function retrieveOpenBibleResearch({
  reference,
  transport = globalThis.fetch.bind(globalThis),
}: {
  reference: string;
  transport?: typeof fetch;
}): Promise<OpenBibleResearch> {
  const parts = referenceParts(reference);
  if (!parts) throw Error('invalid-research-reference');
  const unavailable: string[] = [];
  const [
    crossResult,
    chapterResult,
    wordsResult,
    commentaryResult,
    entityResult,
  ] = await Promise.allSettled([
    get(`d/open-cross-ref/${parts.book}/${parts.chapter}.json`, transport),
    get(`BSB/${parts.book}/${parts.chapter}.json`, transport),
    get(`BSB/${parts.book}/${parts.chapter}.words.json`, transport),
    get('available_commentaries.json', transport),
    get(`d/theographic/${parts.book}/${parts.chapter}.json`, transport),
  ]);
  const references: Ref[] = [];
  const openVerses: { verse: number; text: string }[] = [];
  const chapterText = new Map<number, string[]>();
  if (
    chapterResult.status === 'fulfilled' &&
    isRecord(chapterResult.value) &&
    isRecord(chapterResult.value.chapter) &&
    Array.isArray(chapterResult.value.chapter.content)
  ) {
    for (const verse of chapterResult.value.chapter.content) {
      if (
        !isRecord(verse) ||
        verse.type !== 'verse' ||
        typeof verse.number !== 'number' ||
        verse.number < parts.first ||
        verse.number > parts.last ||
        !Array.isArray(verse.content)
      )
        continue;
      const text = verse.content
        .map((item) =>
          typeof item === 'string'
            ? item
            : isRecord(item) && typeof item.text === 'string'
              ? item.text
              : '',
        )
        .filter(Boolean)
        .join('');
      if (text)
        openVerses.push({ verse: verse.number, text: text.slice(0, 2000) });
      chapterText.set(
        verse.number,
        verse.content.map((item) =>
          typeof item === 'string'
            ? item
            : isRecord(item) && typeof item.text === 'string'
              ? item.text
              : '',
        ),
      );
    }
  }
  if (
    crossResult.status === 'fulfilled' &&
    isRecord(crossResult.value) &&
    isRecord(crossResult.value.chapter) &&
    Array.isArray(crossResult.value.chapter.content)
  ) {
    for (const verse of crossResult.value.chapter.content) {
      if (
        !isRecord(verse) ||
        typeof verse.verse !== 'number' ||
        verse.verse < parts.first ||
        verse.verse > parts.last ||
        !Array.isArray(verse.references)
      )
        continue;
      for (const item of verse.references) {
        if (!isRecord(item)) continue;
        const ref = makeRef(item.book, item.chapter, item.verse, item.endVerse);
        if (ref && !references.some((x) => x.reference === ref))
          references.push({
            reference: ref,
            ...(typeof item.score === 'number' ? { score: item.score } : {}),
          });
        if (references.length >= 40) break;
      }
      if (references.length >= 40) break;
    }
  } else unavailable.push('Cross references');
  let words: Word[] = [];
  if (
    wordsResult.status === 'fulfilled' &&
    isRecord(wordsResult.value) &&
    isRecord(wordsResult.value.verses)
  ) {
    for (const [verseText, list] of Object.entries(wordsResult.value.verses)) {
      const verse = Number(verseText);
      if (verse < parts.first || verse > parts.last || !Array.isArray(list))
        continue;
      for (const w of list) {
        if (!isRecord(w)) continue;
        const entry: Word = { verse };
        if (
          Number.isInteger(w.contentIndex) &&
          Number.isInteger(w.start) &&
          Number.isInteger(w.end)
        ) {
          const chunk = chapterText.get(verse)?.[w.contentIndex as number];
          const excerpt =
            typeof chunk === 'string' &&
            (w.start as number) >= 0 &&
            (w.end as number) > (w.start as number) &&
            (w.end as number) <= chunk.length
              ? chunk.slice(w.start as number, w.end as number)
              : '';
          if (excerpt) entry.text = excerpt.slice(0, 100);
        }
        if (Array.isArray(w.strongs))
          entry.strongs = w.strongs
            .filter((v): v is string => typeof v === 'string')
            .slice(0, 3);
        if (typeof w.lemma === 'string') entry.lemma = w.lemma.slice(0, 120);
        if (typeof w.morph === 'string') entry.morph = w.morph.slice(0, 80);
        if (typeof w.srcloc === 'string') entry.srcloc = w.srcloc.slice(0, 100);
        if (typeof w.occurrences === 'number')
          entry.occurrences = w.occurrences;
        if (Object.keys(entry).length > 1) words.push(entry);
        if (words.length >= 250) break;
      }
    }
  }
  if (!words.length) unavailable.push('Original-language annotations');
  const commentaries: Commentary[] = [];
  if (
    commentaryResult.status === 'fulfilled' &&
    isRecord(commentaryResult.value) &&
    Array.isArray(commentaryResult.value.commentaries)
  ) {
    const candidates = commentaryResult.value.commentaries
      .filter(
        (c): c is Record<string, unknown> =>
          isRecord(c) && typeof c.id === 'string' && typeof c.name === 'string',
      )
      .slice(0, 8);
    const books = await Promise.allSettled(
      candidates.map(async (c) => ({
        c,
        data: await get(
          `c/${encodeURIComponent(c.id as string)}/books.json`,
          transport,
        ),
      })),
    );
    const matching = books
      .filter(
        (
          x,
        ): x is PromiseFulfilledResult<{
          c: Record<string, unknown>;
          data: unknown;
        }> => x.status === 'fulfilled',
      )
      .filter(
        (x) =>
          isRecord(x.value.data) &&
          Array.isArray(x.value.data.books) &&
          x.value.data.books.some(
            (b) =>
              isRecord(b) &&
              b.id === parts.book &&
              (typeof b.firstChapterNumber !== 'number' ||
                b.firstChapterNumber <= parts.chapter) &&
              (typeof b.lastChapterNumber !== 'number' ||
                b.lastChapterNumber >= parts.chapter),
          ),
      )
      .slice(0, 2);
    const results = await Promise.allSettled(
      matching.map(async (x) => {
        const data = await get(
          `c/${encodeURIComponent(x.value.c.id as string)}/${parts.book}/${parts.chapter}.simple.json`,
          transport,
        );
        if (!isRecord(data)) return null;
        const text = JSON.stringify(data.chapter ?? data).slice(0, 5000);
        return {
          id: x.value.c.id as string,
          name: x.value.c.name as string,
          text,
          ...(typeof x.value.c.website === 'string'
            ? { website: x.value.c.website }
            : {}),
          ...(typeof x.value.c.licenseUrl === 'string'
            ? { licenseUrl: x.value.c.licenseUrl }
            : {}),
        };
      }),
    );
    for (const result of results)
      if (result.status === 'fulfilled' && result.value)
        commentaries.push(result.value);
    if (!commentaries.length) unavailable.push('Matching commentary');
  } else unavailable.push('Commentaries');
  const entities: { type: 'people' | 'places' | 'events'; name: string }[] = [];
  if (
    entityResult.status === 'fulfilled' &&
    isRecord(entityResult.value) &&
    isRecord(entityResult.value.chapter)
  ) {
    const chapter = entityResult.value.chapter;
    for (const key of ['people', 'places', 'events'] as const)
      if (Array.isArray(chapter[key]))
        for (const entity of chapter[key])
          if (isRecord(entity) && typeof entity.name === 'string')
            entities.push({ type: key, name: entity.name.slice(0, 120) });
  } else unavailable.push('Biblical entities');
  if (crossResult.status === 'rejected') unavailable.push('Cross references');
  if (chapterResult.status === 'rejected' || !openVerses.length)
    unavailable.push('Open translation context');
  return {
    openTranslation: { id: 'BSB', verses: openVerses },
    references,
    words,
    commentaries,
    entities: entities
      .filter(
        (item, index) =>
          entities.findIndex(
            (other) => other.type === item.type && other.name === item.name,
          ) === index,
      )
      .slice(0, 40),
    unavailable: [...new Set(unavailable)],
    source: 'Free Use Bible API',
  };
}
