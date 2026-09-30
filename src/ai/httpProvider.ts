import type { AIProvider } from '../domain/models.ts';
import {
  AIError,
  aiErrors,
  defaultAIProviderId,
  parseAIResponse,
  type AIErrorCode,
} from '../domain/ai.ts';

export function createScriptureSmartProvider({
  baseURL = '',
  getToken,
  transport = fetch,
}: {
  baseURL?: string;
  getToken: () => Promise<string>;
  transport?: typeof fetch;
}): AIProvider {
  const root = baseURL.replace(/\/$/, '');
  // Public endpoint configuration is allowed; credentials in URLs are not.
  let validEndpoint = true;
  if (root) {
    try {
      const url = new URL(root);
      validEndpoint =
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        (url.protocol === 'https:' ||
          (url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)));
    } catch {
      validEndpoint = false;
    }
  }
  return {
    id: defaultAIProviderId,
    name: 'ScriptureSmart AI',
    async isAvailable() {
      if (!validEndpoint) return false;
      try {
        const r = await transport(`${root}/api/ai/status`, {
          signal: AbortSignal.timeout(5000),
          credentials: 'omit',
        });
        const status: unknown = await r.json();
        return (
          r.ok &&
          !!status &&
          typeof status === 'object' &&
          'available' in status &&
          status.available === true
        );
      } catch {
        return false;
      }
    },
    async generate(request, signal) {
      try {
        if (!validEndpoint) throw new AIError('setup-required');
        signal?.throwIfAborted();
        const token = await getToken();
        if (!token) throw new AIError('sign-in');
        signal?.throwIfAborted();
        const response = await transport(`${root}/api/ai/generate`, {
          method: 'POST',
          credentials: 'omit',
          signal: AbortSignal.any([
            ...(signal ? [signal] : []),
            AbortSignal.timeout(150000),
          ]),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          let code: AIErrorCode =
            response.status === 401
              ? 'sign-in'
              : response.status === 403
                ? 'forbidden'
                : response.status === 413
                  ? 'too-large'
                  : response.status === 429
                    ? 'rate-limit'
                    : response.status === 400
                      ? 'invalid'
                      : 'unavailable';
          try {
            const error = await response.json();
            if (
              typeof error?.code === 'string' &&
              Object.hasOwn(aiErrors, error.code)
            )
              code = error.code as AIErrorCode;
          } catch {
            /* Non-JSON server errors use the safe status message. */
          }
          throw new AIError(code);
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new AIError('malformed');
        }
        return parseAIResponse(body, request.taskType);
      } catch (error) {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (error instanceof AIError) throw error;
        if (error instanceof Error && error.name === 'TimeoutError')
          throw new AIError('timeout');
        throw new AIError('network');
      }
    },
  };
}
