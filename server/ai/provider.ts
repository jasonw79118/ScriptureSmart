import type { RetrievedPassage } from '../../src/domain/bible.ts';
import {
  AIError,
  isRecord,
  validGuide,
  guideSections,
  type AIRequest,
  type AIResponse,
  type TranslationRights,
} from '../../src/domain/ai.ts';
import { messagesFor } from './instructions.ts';
import type { OpenBibleResearch } from './freeUseBible.ts';

export interface AIBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}
export interface ModelConfig {
  SCRIPTURESMART_AI_MODEL: string;
  SCRIPTURESMART_AI_FALLBACK_MODEL?: string;
}
function providerError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  const status = isRecord(error) ? error.status : undefined;
  return new AIError(
    status === 429
      ? 'rate-limit'
      : status === 404
        ? 'model-unavailable'
        : 'unavailable',
  );
}
async function run(
  binding: AIBinding,
  model: string,
  request: AIRequest,
  sources: RetrievedPassage[] = [],
  research?: {
    reference: string;
    selectedTranslationId: string;
    testament: 'old' | 'new';
    data: OpenBibleResearch;
    selected?: {
      id: string;
      name: string;
      text: string;
      rights: TranslationRights;
    };
  },
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      binding.run(model, {
        messages: messagesFor(
          request,
          sources,
          research
            ? {
                reference: research.reference,
                selectedTranslationId: research.selectedTranslationId,
                testament: research.testament,
                ...(research.selected?.rights.aiContextAllowed
                  ? {
                      selectedTranslation: {
                        id: research.selected.id,
                        name: research.selected.name,
                        text: research.selected.text,
                      },
                    }
                  : {}),
                openTranslation: research.data.openTranslation,
                crossReferences: research.data.references,
                words: research.data.words,
                commentaries: research.data.commentaries,
                entities: research.data.entities,
                unavailable: research.data.unavailable,
              }
            : undefined,
        ),
        stream: false,
        // Keep interactive Gemma requests from spending the response budget on thinking.
        ...(model === '@cf/google/gemma-4-26b-a4b-it'
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
        temperature: request.options?.temperature ?? 0.3,
        max_completion_tokens: request.options?.maxTokens ?? 2048,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AIError('timeout')), 120000);
      }),
    ]);
  } catch (error) {
    throw providerError(error);
  } finally {
    clearTimeout(timer);
  }
}
function outputText(value: unknown): string {
  if (!isRecord(value)) throw new AIError('malformed');
  // Cloudflare models use either the chat-completion shape or the legacy response field.
  const choice = Array.isArray(value.choices) ? value.choices[0] : undefined;
  if (isRecord(choice) && choice.finish_reason === 'length')
    throw new AIError('malformed');
  const message =
    isRecord(choice) && isRecord(choice.message) ? choice.message : undefined;
  const text = message?.content ?? value.response;
  if (typeof text !== 'string' || !text.trim() || text.length > 50000)
    throw new AIError('malformed');
  return text.trim();
}
export async function generateWithBinding(
  binding: AIBinding,
  config: ModelConfig,
  request: AIRequest,
  sources: RetrievedPassage[] = [],
  research?: {
    reference: string;
    selectedTranslationId: string;
    testament: 'old' | 'new';
    selected?: {
      id: string;
      text: string;
      attribution: string;
      sourceUrl: string;
      name: string;
      fumsToken?: string;
      rights: TranslationRights;
    };
    comparisons: {
      id: string;
      name: string;
      text: string;
      attribution: string;
      sourceUrl: string;
      fumsToken?: string;
      rights: TranslationRights;
    }[];
    data: OpenBibleResearch;
  },
): Promise<AIResponse> {
  let model = config.SCRIPTURESMART_AI_MODEL;
  const warnings = [
    'AI synthesis can contain errors. Review Scripture, source attributions, and theological claims before using this draft.',
    sources.length
      ? research
        ? 'Bible passages were retrieved in the World English Bible (public domain). Open research resources, when returned, are identified separately. Interpretive summaries are AI synthesis.'
        : 'Bible passages were retrieved in the World English Bible (public domain). Interpretive summaries are AI synthesis; no additional commentary or original-language research was retrieved.'
      : 'No external WEB passage retrieval was requested. Supplied source attributions have not been independently verified.',
    ...(research
      ? research.data.unavailable.map(
          (item) =>
            `${item} could not be loaded from the open research service.`,
        )
      : []),
    ...(research && !research.data.words.length
      ? [
          'Original-language word annotations are unavailable for this passage in the connected open dataset.',
        ]
      : []),
  ];
  let raw: unknown;
  try {
    raw = await run(binding, model, request, sources, research);
  } catch (error) {
    // No retries for timeouts, limits, malformed output, or general provider failures.
    if (
      !(error instanceof AIError) ||
      error.code !== 'model-unavailable' ||
      !config.SCRIPTURESMART_AI_FALLBACK_MODEL ||
      config.SCRIPTURESMART_AI_FALLBACK_MODEL === model
    )
      throw error;
    model = config.SCRIPTURESMART_AI_FALLBACK_MODEL;
    raw = await run(binding, model, request, sources, research);
    warnings.push('The configured fallback model was used.');
  }
  let text = outputText(raw);
  let sections: AIResponse['sections'];
  if (request.taskType === 'discussion-guide') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
      );
    } catch {
      throw new AIError('malformed');
    }
    if (!isRecord(parsed) || !validGuide(parsed.sections))
      throw new AIError('malformed');
    sections = parsed.sections;
    text = guideSections.map((k) => `${k}\n${sections![k]}`).join('\n\n');
  }
  return {
    text,
    ...(sources.length ? { scriptureSources: sources } : {}),
    sections,
    kind: 'AI SYNTHESIS',
    provider: 'scripturesmart-ai',
    model,
    createdAt: new Date().toISOString(),
    warnings,
    ...(research
      ? {
          bibleResearch: {
            reference: research.reference,
            testament: research.testament,
            ...(research.selected
              ? {
                  selectedTranslation: {
                    id: research.selected.id,
                    name: research.selected.name,
                    text: research.selected.text,
                    attribution: research.selected.attribution,
                    sourceUrl: research.selected.sourceUrl,
                    rights: research.selected.rights,
                    ...(research.selected.fumsToken
                      ? { fumsToken: research.selected.fumsToken }
                      : {}),
                  },
                }
              : {}),
            comparisonTranslations: research.comparisons,
            openTranslation: research.data.openTranslation,
            crossReferences: research.data.references,
            originalLanguage: {
              language:
                research.testament === 'old'
                  ? ('Hebrew' as const)
                  : ('Greek' as const),
              words: research.data.words,
            },
            commentaries: research.data.commentaries,
            entities: research.data.entities,
            unavailable: research.data.unavailable,
            source: research.data.source,
          },
        }
      : {}),
  };
}
