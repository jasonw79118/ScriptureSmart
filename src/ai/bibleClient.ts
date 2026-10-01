import { AIError, isRecord } from '../domain/ai';
import { getAIUserToken } from './auth';
import { account } from '../community/client';

export interface BiblePassageResult {
  reference: string;
  translationId: string;
  text: string;
  attribution: string;
  sourceUrl: string;
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
  const response = await fetch(url, {
    credentials: 'omit',
    signal: AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(30000),
    ]),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new AIError(
      response.status === 401
        ? 'sign-in'
        : response.status === 403
          ? 'forbidden'
          : response.status === 429
            ? 'rate-limit'
            : 'scripture-unavailable',
    );
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
  };
}
