import { AIError, isRecord } from '../domain/ai.ts';

export async function getAIUserToken(
  createJWT: () => Promise<{ jwt: string }>,
) {
  try {
    const result = await createJWT();
    if (!result.jwt) throw new AIError('auth-unavailable');
    return result.jwt;
  } catch (error) {
    if (error instanceof AIError) throw error;
    const status = isRecord(error) ? error.code : undefined;
    throw new AIError(
      status === 401
        ? 'sign-in'
        : status === 429
          ? 'rate-limit'
          : 'auth-unavailable',
    );
  }
}
