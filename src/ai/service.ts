import type { AIProvider } from '../domain/models.ts';
import { AIError, defaultAIProviderId, type AIRequest } from '../domain/ai.ts';

export function createAIService(
  providers: AIProvider[],
  defaultId = defaultAIProviderId,
) {
  const registry = new Map(providers.map((p) => [p.id, p]));
  const provider = (id = defaultId) => {
    const selected = registry.get(id);
    if (!selected) throw new AIError('setup-required');
    return selected;
  };
  return {
    provider,
    isAvailable: (id?: string) => provider(id).isAvailable(),
    generate: (request: AIRequest, signal?: AbortSignal, id?: string) =>
      provider(id).generate(request, signal),
  };
}
