import {
  normalizeReference,
  passageURL,
  type RetrievedPassage,
} from './bible.ts';
import type { Source, SourceKind } from './models.ts';

export const defaultAIProviderId = 'scripturesmart-ai';
export const taskTypes = [
  'general',
  'sermon',
  'bible-study',
  'discussion-guide',
  'research',
  'summary',
  'translation-analysis',
] as const;
export type AITaskType = (typeof taskTypes)[number];
export const guideSections = [
  'Opening',
  'Read',
  'Observe',
  'Interpret',
  'Discuss',
  'Apply',
  'Pray',
] as const;
export type GuideSection = (typeof guideSections)[number];
export interface SourceDocument {
  id: string;
  source: Source;
  text: string;
  translationId?: string;
}
export interface AIContext {
  passageReference?: string;
  translationIds?: string[];
  scripture?: SourceDocument[];
  commentary?: SourceDocument[];
  historicalSources?: SourceDocument[];
  userNotes?: SourceDocument[];
  sermon?: string;
  study?: string;
}
export interface AIExchange {
  question: string;
  answer: string;
}
export function recentExchanges(exchanges: AIExchange[]): AIExchange[] {
  const kept: AIExchange[] = [];
  let size = 0;
  for (const turn of exchanges.slice(-4).reverse()) {
    const length = turn.question.length + turn.answer.length;
    if (size + length > 32000) break;
    kept.unshift(turn);
    size += length;
  }
  if (exchanges.length && !kept.length) throw new AIError('too-large');
  return kept;
}
export interface AIRequest {
  conversation?: AIExchange[];
  taskType: AITaskType;
  bible?: { references: string[] };
  prompt: string;
  context?: AIContext;
  options?: { temperature?: number; maxTokens?: number };
}
export interface SourceCitation {
  sourceId: string;
  kind: SourceKind;
  title: string;
  citation?: string;
}
export interface AIResponse {
  text: string;
  scriptureSources?: RetrievedPassage[];
  provider: string;
  model: string;
  createdAt: string;
  kind: 'AI SYNTHESIS';
  sections?: Record<GuideSection, string>;
  citations?: SourceCitation[];
  warnings?: string[];
}
export const aiErrors = {
  'scripture-unavailable':
    'The Bible text could not be retrieved. Please retry or choose fewer passages. No source-based answer was generated.',
  'auth-unavailable':
    'ScriptureSmart AI could not verify your current account session. The account service may be unavailable; please retry. This does not necessarily mean you are signed out.',
  'setup-required':
    'ScriptureSmart AI is not available yet. The site administrator needs to finish AI service setup.',
  'sign-in':
    'Sign in with your ScriptureSmart account to use the built-in assistant.',
  forbidden:
    'Verify your email and sign in again before using ScriptureSmart AI.',
  invalid: 'Check your prompt and selected context, then try again.',
  'too-large':
    'This request is too large. Shorten the prompt or select less source material.',
  'rate-limit':
    'You have reached the current AI request limit. Please wait a minute and try again.',
  'model-unavailable':
    'The configured AI model is unavailable. Please try later or contact your site administrator.',
  unavailable:
    'ScriptureSmart AI is temporarily unavailable. Please try again later.',
  network:
    'Unable to reach ScriptureSmart AI. Check your connection and try again.',
  timeout: 'ScriptureSmart AI took too long to respond. Try a shorter request.',
  malformed:
    'ScriptureSmart AI returned an incomplete response. Your work is unchanged; please try again.',
} as const;
export type AIErrorCode = keyof typeof aiErrors;
export class AIError extends Error {
  readonly code: AIErrorCode;
  constructor(code: AIErrorCode) {
    super(aiErrors[code]);
    this.name = 'AIError';
    this.code = code;
  }
}
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function validGuide(
  value: unknown,
): value is Record<GuideSection, string> {
  return (
    isRecord(value) &&
    Object.keys(value).length === guideSections.length &&
    guideSections.every(
      (k) =>
        typeof value[k] === 'string' &&
        !!value[k].trim() &&
        value[k].length <= 12000,
    )
  );
}
export function parseAIResponse(
  value: unknown,
  taskType: AITaskType,
): AIResponse {
  if (
    !isRecord(value) ||
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.length > 50000 ||
    typeof value.provider !== 'string' ||
    typeof value.model !== 'string' ||
    typeof value.createdAt !== 'string' ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    value.kind !== 'AI SYNTHESIS' ||
    (value.sections !== undefined && !validGuide(value.sections)) ||
    (taskType === 'discussion-guide' && !validGuide(value.sections)) ||
    (value.warnings !== undefined &&
      (!Array.isArray(value.warnings) ||
        value.warnings.some((w) => typeof w !== 'string')))
  )
    throw new AIError('malformed');
  if (
    value.scriptureSources !== undefined &&
    (!Array.isArray(value.scriptureSources) ||
      value.scriptureSources.length > 6 ||
      value.scriptureSources.some(
        (p) =>
          !isRecord(p) ||
          typeof p.reference !== 'string' ||
          normalizeReference(p.reference) !== p.reference ||
          p.translation !== 'WEB' ||
          typeof p.text !== 'string' ||
          !p.text.trim() ||
          p.text.length > 24000 ||
          p.url !== passageURL(p.reference),
      ))
  )
    throw new AIError('malformed');
  // Only the known response fields enter the UI. Retrieved citations are not yet implemented.
  return {
    text: value.text,
    scriptureSources: value.scriptureSources as RetrievedPassage[] | undefined,
    provider: value.provider,
    model: value.model,
    createdAt: value.createdAt,
    kind: 'AI SYNTHESIS',
    sections: value.sections as AIResponse['sections'],
    warnings: value.warnings as string[] | undefined,
  };
}
