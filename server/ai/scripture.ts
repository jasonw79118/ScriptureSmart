import { AIError, isRecord } from '../../src/domain/ai.ts';
import {
  normalizeReference,
  passageURL,
  type RetrievedPassage,
} from '../../src/domain/bible.ts';
// Small isolate-local cache; only public Bible text is cached, never user prompts.
const cache = new Map<string, { expires: number; value: RetrievedPassage }>();
export interface PublicBiblePassage {
  reference: string;
  translationId: 'KJV';
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

export async function retrieveKjvPassage(
  {
    reference: rawReference,
    transport = globalThis.fetch.bind(globalThis),
  }: {
    reference: string;
    transport?: typeof fetch;
  },
): Promise<PublicBiblePassage> {
  const reference = normalizeReference(rawReference);
  if (!reference) throw new AIError('invalid');
  const url = new URL(passageURL(reference));
  url.searchParams.set('translation', 'kjv');
  let value: unknown;
  try {
    const response = await transport(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Error('KJV source unavailable');
    const body = await response.text();
    if (body.length > 100000) throw Error('KJV response oversized');
    value = JSON.parse(body);
  } catch {
    throw new AIError('scripture-unavailable');
  }
  if (
    !isRecord(value) ||
    value.translation_id !== 'kjv' ||
    !Array.isArray(value.verses) ||
    !value.verses.length ||
    value.verses.length > 176
  )
    throw new AIError('scripture-unavailable');
  const match = /^(.*) (\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(reference)!;
  const first = match[3] ? +match[3] : 1;
  const last = match[3] ? +(match[4] ?? match[3]) : null;
  if (last && value.verses.length !== last - first + 1)
    throw new AIError('scripture-unavailable');
  const lines = value.verses.map((verse, index) => {
    if (
      !isRecord(verse) ||
      verse.book_name !== match[1] ||
      verse.chapter !== +match[2] ||
      verse.verse !== first + index ||
      typeof verse.text !== 'string' ||
      !verse.text.trim() ||
      verse.text.length > 4000
    )
      throw new AIError('scripture-unavailable');
    return `${verse.chapter}:${verse.verse} ${verse.text.trim()}`;
  });
  const text = lines.join('\n');
  if (text.length > 24000) throw new AIError('too-large');
  return {
    reference,
    translationId: 'KJV',
    text,
    attribution: 'King James Version (KJV), public-domain text.',
    sourceUrl: url.toString(),
    rights: {
      displayAllowed: true,
      aiContextAllowed: true,
      cachingAllowed: true,
      localStorageAllowed: true,
      commercialUseAllowed: true,
    },
  };
}

export async function retrievePassages(
  references: string[],
  transport: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<RetrievedPassage[]> {
  const results: RetrievedPassage[] = [];
  const deadline = AbortSignal.timeout(12000);
  for (const raw of references) {
    const reference = normalizeReference(raw);
    if (!reference) throw new AIError('invalid');
    const hit = cache.get(reference);
    if (hit && hit.expires > Date.now()) {
      results.push(hit.value);
      continue;
    }
    const url = passageURL(reference);
    let value: unknown;
    try {
      const response = await transport(url, {
        redirect: 'manual',
        signal: deadline,
      });
      if (!response.ok) throw Error('Bible provider unavailable');
      const body = await response.text();
      if (body.length > 100000) throw Error('Oversized Bible response');
      value = JSON.parse(body);
    } catch {
      throw new AIError('scripture-unavailable');
    }
    if (
      !isRecord(value) ||
      value.translation_id !== 'web' ||
      !Array.isArray(value.verses) ||
      !value.verses.length ||
      value.verses.length > 176
    )
      throw new AIError('scripture-unavailable');
    const match = /^(.*) (\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(reference)!;
    const first = match[3] ? +match[3] : 1;
    const last = match[3] ? +(match[4] ?? match[3]) : null;
    if (last && value.verses.length !== last - first + 1)
      throw new AIError('scripture-unavailable');
    const lines = value.verses.map((v, i) => {
      if (
        !isRecord(v) ||
        v.book_name !== match[1] ||
        v.chapter !== +match[2] ||
        v.verse !== first + i ||
        typeof v.text !== 'string' ||
        !v.text.trim() ||
        v.text.length > 4000
      )
        throw new AIError('scripture-unavailable');
      return `${v.chapter}:${v.verse} ${v.text.trim()}`;
    });
    const passage: RetrievedPassage = {
      reference,
      translation: 'WEB',
      text: lines.join('\n'),
      url,
    };
    if (passage.text.length > 24000) throw new AIError('too-large');
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(reference, { expires: Date.now() + 86400000, value: passage });
    results.push(passage);
  }
  if (results.reduce((n, p) => n + p.text.length, 0) > 32000)
    throw new AIError('too-large');
  return results;
}
