import { retrievePassages } from './scripture.ts';
import {
  listYouVersionTranslations,
  retrieveYouVersionPassage,
  youVersionTranslations,
} from './youversion.ts';
import { AIError, isRecord, type AIErrorCode } from '../../src/domain/ai.ts';
import { normalizeReference } from '../../src/domain/bible.ts';
import { testamentForReference } from '../../src/domain/bible.ts';
import {
  activeTranslationIds,
  youVersionTranslationIds,
} from '../../src/domain/providers.ts';
import { readRequest } from './validation.ts';
import { retrieveOpenBibleResearch } from './freeUseBible.ts';
import { retrieveKjvPassage } from './scripture.ts';
import {
  generateWithBinding,
  type AIBinding,
  type ModelConfig,
} from './provider.ts';

interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}
export interface Env extends ModelConfig {
  AI: AIBinding;
  AI_USER_LIMIT: RateLimiter;
  AI_GLOBAL_LIMIT: RateLimiter;
  APPWRITE_ENDPOINT: string;
  APPWRITE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string;
  YOUVERSION_API?: string;
}
const statusCodes: Record<AIErrorCode, number> = {
  'auth-unavailable': 503,
  'scripture-unavailable': 503,
  'translation-unavailable': 404,
  'setup-required': 503,
  'sign-in': 401,
  forbidden: 403,
  invalid: 400,
  'too-large': 413,
  'rate-limit': 429,
  'model-unavailable': 503,
  unavailable: 503,
  network: 503,
  timeout: 504,
  malformed: 502,
};
function ready(env: Env) {
  try {
    const endpoint = new URL(env.APPWRITE_ENDPOINT);
    return (
      !!env.AI?.run &&
      !!env.AI_USER_LIMIT?.limit &&
      !!env.AI_GLOBAL_LIMIT?.limit &&
      endpoint.protocol === 'https:' &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.search &&
      !endpoint.hash &&
      !!env.APPWRITE_PROJECT_ID &&
      !!env.SCRIPTURESMART_AI_MODEL?.startsWith('@cf/') &&
      !!env.ALLOWED_ORIGINS
    );
  } catch {
    return false;
  }
}
class AccountVerificationError extends AIError {
  readonly diagnostic: string;
  constructor(diagnostic: string) {
    super('auth-unavailable');
    this.diagnostic = diagnostic;
  }
}
export async function verifiedUser(
  request: Request,
  env: Env,
  transport: typeof fetch,
): Promise<string> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ') || auth.length > 8192 || auth.length < 16)
    throw new AIError('sign-in');
  let response: Response;
  try {
    response = await transport(
      `${env.APPWRITE_ENDPOINT.replace(/\/$/, '')}/account`,
      {
        headers: {
          'X-Appwrite-Project': env.APPWRITE_PROJECT_ID,
          'X-Appwrite-JWT': auth.slice(7),
        },
        // Workers reject redirect: 'error'. Manual mode keeps JWTs off redirect targets;
        // non-2xx responses below fail closed.
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch (error) {
    throw new AccountVerificationError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'account-timeout'
        : error instanceof Error && /illegal invocation/i.test(error.message)
          ? 'account-fetch-invocation'
          : 'account-network',
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new AIError('sign-in');
  if (!response.ok)
    throw new AccountVerificationError(`account-http-${response.status}`);
  let user: unknown;
  try {
    user = await response.json();
  } catch (error) {
    throw new AccountVerificationError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'account-timeout'
        : 'account-network',
    );
  }
  if (
    !isRecord(user) ||
    typeof user.$id !== 'string' ||
    !user.$id ||
    user.emailVerification !== true ||
    user.status !== true
  )
    throw new AIError('forbidden');
  return user.$id;
}
// A single hook for future durable user/month/church allowances. These bindings
// provide short-window abuse controls, not precise billing or monthly quotas.
export async function checkAllowance(env: Env, userId: string) {
  if (!(await env.AI_USER_LIMIT.limit({ key: `user:${userId}` })).success)
    throw new AIError('rate-limit');
}
export function createWorker(
  transport: typeof fetch = globalThis.fetch.bind(globalThis),
) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const path = new URL(request.url).pathname;
      const origin = request.headers.get('origin');
      const allowed = (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      const cors: Record<string, string> =
        origin && allowed.includes(origin)
          ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
          : {};
      const headers = {
        ...cors,
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
      };
      const json = (
        body: unknown,
        status = 200,
        extra: Record<string, string> = {},
      ) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...headers, ...extra },
        });
      if (origin && !allowed.includes(origin))
        return json({ code: 'forbidden' }, 403);
      if (
        ![
          '/api/ai/status',
          '/api/ai/generate',
          '/api/bible/status',
          '/api/bible/passage',
        ].includes(path)
      )
        return json({ code: 'invalid' }, 404);
      if (request.method === 'OPTIONS')
        return new Response(null, {
          status: 204,
          headers: {
            ...headers,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Max-Age': '600',
          },
        });
      if (path === '/api/ai/status' && request.method === 'GET')
        return json({ available: ready(env), provider: 'scripturesmart-ai' });
      if (path === '/api/bible/status' && request.method === 'GET') {
        let youVersionActiveTranslations: Awaited<
          ReturnType<typeof listYouVersionTranslations>
        > = [];
        let youVersionStatus:
          | 'connected'
          | 'not-configured'
          | 'unauthorized'
          | 'not-approved'
          | 'unavailable' = env.YOUVERSION_API?.trim()
          ? 'connected'
          : 'not-configured';
        if (env.YOUVERSION_API?.trim()) {
          try {
            youVersionActiveTranslations = await listYouVersionTranslations({
              apiKey: env.YOUVERSION_API,
              transport,
            });
            if (!youVersionActiveTranslations.length)
              youVersionStatus = 'not-approved';
          } catch (error) {
            youVersionStatus =
              error instanceof Error && error.message === 'youversion-unauthorized'
                ? 'unauthorized'
                : error instanceof Error && error.message === 'youversion-forbidden'
                  ? 'not-approved'
                  : 'unavailable';
          }
        }
        const translations = [
          { id: 'KJV', name: 'King James Version' },
          ...youVersionActiveTranslations,
        ];
        return json({
          available: ready(env) && translations.length > 0,
          provider: 'ScriptureSmart Bible providers',
          translations,
          youVersionStatus,
          unavailableTranslationIds: youVersionTranslationIds.filter(
            (id) => !translations.some((item) => item.id === id),
          ),
        });
      }
      if (path === '/api/bible/passage' && request.method === 'GET') {
        try {
          if (!ready(env)) throw new AIError('setup-required');
          if (
            !(await env.AI_GLOBAL_LIMIT.limit({ key: 'all-requests' })).success
          )
            throw new AIError('rate-limit');
          const userId = await verifiedUser(request, env, transport);
          await checkAllowance(env, userId);
          const url = new URL(request.url);
          const reference = url.searchParams.get('reference') ?? '';
          const translationId = url.searchParams.get('translationId') ?? '';
          const normalized = normalizeReference(reference);
          if (!normalized || !/^[A-Z0-9]{2,8}$/.test(translationId))
            throw new AIError('invalid');
          let passage;
          if (translationId === 'KJV') {
            passage = await retrieveKjvPassage({
              reference: normalized,
              transport,
            });
          } else if (youVersionTranslations.some((item) => item.id === translationId)) {
            passage = await retrieveYouVersionPassage({
              apiKey: env.YOUVERSION_API,
              reference: normalized,
              translationId,
              transport,
            });
          } else {
            throw new AIError('translation-unavailable');
          }
          return json(passage);
        } catch (error) {
          const safe =
            error instanceof AIError
              ? error
              : error instanceof Error &&
                  [
                    'youversion-not-configured',
                    'youversion-unavailable',
                    'youversion-unauthorized',
                    'youversion-forbidden',
                    'invalid-youversion-request',
                  ].includes(error.message)
                ? new AIError('translation-unavailable')
                : new AIError('scripture-unavailable');
          return json(
            { code: safe.code, message: safe.message },
            statusCodes[safe.code],
            safe.code === 'rate-limit' ? { 'Retry-After': '60' } : {},
          );
        }
      }
      if (path !== '/api/ai/generate' || request.method !== 'POST')
        return json({ code: 'invalid' }, 405, {
          Allow: path.endsWith('status')
            ? 'GET'
            : path.endsWith('passage')
              ? 'GET'
              : 'POST',
        });
      try {
        if (!ready(env)) throw new AIError('setup-required');
        // Global backstop also limits unauthenticated pressure on Appwrite.
        if (!(await env.AI_GLOBAL_LIMIT.limit({ key: 'all-requests' })).success)
          throw new AIError('rate-limit');
        const userId = await verifiedUser(request, env, transport);
        await checkAllowance(env, userId);
        const input = await readRequest(request);
        let sources: Awaited<ReturnType<typeof retrievePassages>> = [];
        let webRetrievalFailed = false;
        if (input.bible) {
          try {
            sources = await retrievePassages(input.bible.references, transport);
          } catch (error) {
            if (
              !(error instanceof AIError) ||
              error.code !== 'scripture-unavailable'
            )
              throw error;
            // WEB is supplemental. Continue to licensed translation and open research.
            webRetrievalFailed = true;
          }
        }
        const reference = normalizeReference(
          input.context?.passageReference ?? input.bible?.references[0] ?? '',
        );
        const translationId = input.context?.translationIds?.[0] ?? '';
        let bibleResearch:
          Parameters<typeof generateWithBinding>[4] | undefined;
        let researchFailure = false;
        if (
          input.bible &&
          reference &&
          activeTranslationIds.includes(
            translationId as (typeof activeTranslationIds)[number],
          )
        ) {
          const testament = testamentForReference(reference);
          if (testament) {
            const translationIds = (
              input.context?.translationIds ?? [translationId]
            )
              .filter((id) =>
                activeTranslationIds.includes(
                  id as (typeof activeTranslationIds)[number],
                ),
              )
              .slice(0, 4);
            const [selectedResults, openResult] = await Promise.all([
              Promise.allSettled(
                (translationIds.length ? translationIds : [translationId]).map(
                  (id) =>
                    id === 'KJV'
                      ? retrieveKjvPassage({ reference, transport })
                      : retrieveYouVersionPassage({
                          apiKey: env.YOUVERSION_API,
                          reference,
                          translationId: id,
                          transport,
                        }),
                ),
              ),
              Promise.allSettled([
                retrieveOpenBibleResearch({ reference, transport }),
              ]),
            ]);
            const selectedResult = selectedResults[0];
            const researchResult = openResult[0];
            const toSelected = (
              item: PromiseSettledResult<
                Awaited<ReturnType<typeof retrieveKjvPassage>>
                | Awaited<ReturnType<typeof retrieveYouVersionPassage>>
              >,
            ) =>
              item.status === 'fulfilled'
                ? {
                    id: item.value.translationId,
                    name: item.value.translationId,
                    text: item.value.text,
                    attribution: item.value.attribution,
                    sourceUrl: item.value.sourceUrl,
                    rights: item.value.rights,
                    ...('fumsToken' in item.value &&
                    typeof item.value.fumsToken === 'string'
                      ? { fumsToken: item.value.fumsToken }
                      : {}),
                  }
                : null;
            const comparisonTranslations = selectedResults
              .slice(1)
              .flatMap((item) => {
                const translated = toSelected(item);
                return translated ? [translated] : [];
              });
            if (
              selectedResults.some((item) => item.status === 'fulfilled') ||
              researchResult.status === 'fulfilled'
            ) {
              bibleResearch = {
                reference,
                selectedTranslationId: translationId,
                testament,
                ...(toSelected(
                  selectedResult,
                )
                  ? {
                      selected: toSelected(
                        selectedResult,
                      )!,
                    }
                  : {}),
                comparisons: comparisonTranslations,
                data:
                  researchResult.status === 'fulfilled'
                    ? researchResult.value
                    : {
                        openTranslation: { id: 'BSB', verses: [] },
                        references: [],
                        words: [],
                        commentaries: [],
                        entities: [],
                        unavailable: ['Open research data'],
                        source: 'Free Use Bible API' as const,
                      },
              };
              if (
                selectedResults.some((item) => item.status === 'rejected') ||
                researchResult.status === 'rejected'
              )
                researchFailure = true;
            } else {
              researchFailure = true;
            }
          }
        }
        const result = await generateWithBinding(
          env.AI,
          env,
          input,
          sources,
          bibleResearch,
        );
        return json({
          ...result,
          ...(researchFailure || webRetrievalFailed
            ? {
                warnings: [
                  ...(result.warnings ?? []),
                  ...(webRetrievalFailed
                    ? [
                        'The World English Bible source did not load. ScriptureSmart continued with other available Bible research.',
                      ]
                    : []),
                  ...(researchFailure
                    ? [
                        'The selected translation or open research could not be fully loaded. AI synthesis continued with available sources.',
                      ]
                    : []),
                ],
              }
            : {}),
        });
      } catch (error) {
        const safe =
          error instanceof AIError ? error : new AIError('unavailable');
        // Never log prompts, JWTs, raw provider errors, or Appwrite responses.
        return json(
          {
            code: safe.code,
            message: safe.message,
            ...(error instanceof AccountVerificationError
              ? { diagnostic: error.diagnostic }
              : {}),
          },
          statusCodes[safe.code],
          safe.code === 'rate-limit' ? { 'Retry-After': '60' } : {},
        );
      }
    },
  };
}
export default createWorker();
