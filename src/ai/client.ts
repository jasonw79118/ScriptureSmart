import { account } from '../community/client';
import { AIError } from '../domain/ai';
import { createScriptureSmartProvider } from './httpProvider';
import { createAIService } from './service';
import { getAIUserToken } from './auth';

const builtIn = createScriptureSmartProvider({
  baseURL: import.meta.env.VITE_AI_API_BASE_URL?.trim() ?? '',
  async getToken() {
    if (!account) throw new AIError('sign-in');
    return getAIUserToken(account.createJWT.bind(account));
  },
});
export const aiService = createAIService([builtIn]);
