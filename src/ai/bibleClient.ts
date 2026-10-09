import { AIError, aiErrors, isRecord, type AIErrorCode } from '../domain/ai';
import { getAIUserToken } from './auth';
import { account } from '../community/client';

export interface BibleProviderStatus {
  available: boolean;
  provider: string;
  translations: { id: string; name: string }[];
  unavailableTranslationIds?: string[];
  apiBibleStatus?:
    | 'connected'
    | 'not-configured'
    | 'unauthorized'
    | 'not-approved'
    | 'unavailable';
}

export interface BiblePassageResult {
  reference: string;
  translationId: string;
  text: string;
  attribution: string;
  sourceUrl: string;
  fumsToken?: string;
  rights?: {
    displayAllowed: boolean;
    aiContextAllowed: boolean;
    cachingAllowed: boolean;
    localStorageAllowed: boolean;
    commercialUseAllowed: boolean;
  };
}

const root =
  import.meta.env.VITE_AI_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';

export async function getBiblePassage(
  reference: string,
  translationId: string,
  signal?: AbortSignal,
): Promise<BiblePassageResult> {
  if (!account) throw new AIError('sign-in');
  const token = await getAIUserToken(account.createJWT.bind(account));
  const url = new URL(`${root}/api/bible/passage`, window.location.origin);
  url.searchParams.set('reference', reference);
  url.searchParams.set('translationId', translationId);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
    30000,
  );
  const abortFromCaller = () =>
    controller.abort(
      signal?.reason ?? new DOMException('Aborted', 'AbortError'),
    );
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'omit',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) throw new AIError('timeout');
    if (error instanceof AIError) throw error;
    throw new AIError('bible-network');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
  if (!response.ok) {
    let serverCode = '';
    try {
      const body: unknown = await response.json();
      serverCode =
        isRecord(body) && typeof body.code === 'string' ? body.code : '';
    } catch {
      serverCode = '';
    }
    let code: AIErrorCode =
      response.status === 401
        ? 'sign-in'
        : response.status === 403
          ? 'forbidden'
          : response.status === 429
            ? 'rate-limit'
            : 'scripture-unavailable';
    if (Object.hasOwn(aiErrors, serverCode)) code = serverCode as AIErrorCode;
    throw new AIError(code);
  }
  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    typeof body.reference !== 'string' ||
    typeof body.translationId !== 'string' ||
    typeof body.text !== 'string' ||
    typeof body.attribution !== 'string' ||
    typeof body.sourceUrl !== 'string'
  )
    throw new AIError('malformed');
  return {
    reference: body.reference,
    translationId: body.translationId,
    text: body.text,
    attribution: body.attribution,
    sourceUrl: body.sourceUrl,
    ...(typeof body.fumsToken === 'string'
      ? { fumsToken: body.fumsToken }
      : {}),
    ...(isRecord(body.rights)
      ? {
          rights: {
            displayAllowed: body.rights.displayAllowed === true,
            aiContextAllowed: body.rights.aiContextAllowed === true,
            cachingAllowed: body.rights.cachingAllowed === true,
            localStorageAllowed: body.rights.localStorageAllowed === true,
            commercialUseAllowed: body.rights.commercialUseAllowed === true,
          },
        }
      : {}),
  };
}

export async function getBibleResearch(
  reference: string,
  signal?: AbortSignal,
): Promise<OpenBibleResearchResult> {
  if (!account) throw new AIError('sign-in');
  const token = await getAIUserToken(account.createJWT.bind(account));
  const url = new URL(`${root}/api/bible/research`, window.location.origin);
  url.searchParams.set('reference', reference);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
    30000,
  );
  const abortFromCaller = () =>
    controller.abort(
      signal?.reason ?? new DOMException('Aborted', 'AbortError'),
    );
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'omit',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (controller.signal.aborted) throw new AIError('timeout');
    if (error instanceof AIError) throw error;
    throw new AIError('bible-network');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
  if (!response.ok) {
    let serverCode = '';
    try {
      const body: unknown = await response.json();
      serverCode =
        isRecord(body) && typeof body.code === 'string' ? body.code : '';
    } catch {
      serverCode = '';
    }
    let code: AIErrorCode =
      response.status === 401
        ? 'sign-in'
        : response.status === 403
          ? 'forbidden'
          : response.status === 429
            ? 'rate-limit'
            : 'scripture-unavailable';
    if (Object.hasOwn(aiErrors, serverCode)) code = serverCode as AIErrorCode;
    throw new AIError(code);
  }
  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    body.source !== 'Free Use Bible API' ||
    !isRecord(body.openTranslation) ||
    typeof body.openTranslation.id !== 'string' ||
    !Array.isArray(body.openTranslation.verses) ||
    !Array.isArray(body.references) ||
    !Array.isArray(body.words) ||
    !Array.isArray(body.commentaries) ||
    !Array.isArray(body.entities) ||
    !Array.isArray(body.unavailable)
  )
    throw new AIError('malformed');
  return {
    openTranslation: {
      id: body.openTranslation.id,
      verses: body.openTranslation.verses.filter(
        (item): item is { verse: number; text: string } =>
          isRecord(item) &&
          typeof item.verse === 'number' &&
          typeof item.text === 'string',
      ),
    },
    references: body.references.filter(
      (item): item is { reference: string; score?: number } =>
        isRecord(item) &&
        typeof item.reference === 'string' &&
        (item.score === undefined || typeof item.score === 'number'),
    ),
    words: body.words.filter(
      (item): item is OpenBibleResearchResult['words'][number] =>
        isRecord(item) &&
        typeof item.verse === 'number' &&
        (item.text === undefined || typeof item.text === 'string') &&
        (item.lemma === undefined || typeof item.lemma === 'string') &&
        (item.morph === undefined || typeof item.morph === 'string') &&
        (item.occurrences === undefined ||
          typeof item.occurrences === 'number') &&
        (item.strongs === undefined ||
          (Array.isArray(item.strongs) &&
            item.strongs.every((value) => typeof value === 'string'))),
    ),
    commentaries: body.commentaries.filter(
      (item): item is OpenBibleResearchResult['commentaries'][number] =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.text === 'string' &&
        (item.website === undefined || typeof item.website === 'string') &&
        (item.licenseUrl === undefined || typeof item.licenseUrl === 'string'),
    ),
    entities: body.entities.filter(
      (item): item is OpenBibleResearchResult['entities'][number] =>
        isRecord(item) &&
        ['people', 'places', 'events'].includes(String(item.type)) &&
        typeof item.name === 'string',
    ),
    unavailable: body.unavailable.filter(
      (item): item is string => typeof item === 'string',
    ),
    source: 'Free Use Bible API',
  };
}

export async function getBibleProviderStatus(
  signal?: AbortSignal,
): Promise<BibleProviderStatus> {
  const url = new URL(`${root}/api/bible/status`, window.location.origin);
  const response = await fetch(url, {
    credentials: 'omit',
    signal: AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(10000),
    ]),
  });
  if (!response.ok) throw new AIError('network');
  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    typeof body.available !== 'boolean' ||
    typeof body.provider !== 'string' ||
    !Array.isArray(body.translations)
  )
    throw new AIError('malformed');
  const translations = body.translations.filter(
    (translation): translation is { id: string; name: string } =>
      isRecord(translation) &&
      typeof translation.id === 'string' &&
      typeof translation.name === 'string',
  );
  return {
    available: body.available,
    provider: body.provider,
    translations,
    unavailableTranslationIds: Array.isArray(body.unavailableTranslationIds)
      ? body.unavailableTranslationIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : [],
    ...(typeof body.apiBibleStatus === 'string' &&
    [
      'connected',
      'not-configured',
      'unauthorized',
      'not-approved',
      'unavailable',
    ].includes(body.apiBibleStatus)
      ? {
          apiBibleStatus: body.apiBibleStatus as NonNullable<
            BibleProviderStatus['apiBibleStatus']
          >,
        }
      : {}),
  };
}
export interface OpenBibleResearchResult {
  openTranslation: { id: string; verses: { verse: number; text: string }[] };
  references: { reference: string; score?: number }[];
  words: {
    verse: number;
    text?: string;
    strongs?: string[];
    lemma?: string;
    morph?: string;
    occurrences?: number;
  }[];
  commentaries: {
    id: string;
    name: string;
    text: string;
    website?: string;
    licenseUrl?: string;
  }[];
  entities: { type: 'people' | 'places' | 'events'; name: string }[];
  unavailable: string[];
  source: 'Free Use Bible API';
}
