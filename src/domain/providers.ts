import type { BibleProvider, Translation, Source, User } from './models.ts';

export const activeTranslationIds = ['CSB', 'NLT', 'NKJV', 'KJV'] as const;
export const apiBibleTranslationIds = ['CSB', 'NLT', 'NKJV'] as const;

export const translations: Translation[] = [
  {
    id: 'CSB',
    name: 'Christian Standard Bible',
    providerIds: ['api-bible'],
    requiresLicense: true,
  },
  {
    id: 'NLT',
    name: 'New Living Translation',
    providerIds: ['api-bible'],
    requiresLicense: true,
  },
  {
    id: 'NKJV',
    name: 'New King James Version',
    providerIds: ['api-bible'],
    requiresLicense: true,
  },
  {
    id: 'KJV',
    name: 'King James Version',
    providerIds: ['public-domain'],
    requiresLicense: false,
  },
];
export const defaultTranslationId = 'CSB';
export const defaultComparisonTranslationId = 'NLT';

export function supportedTranslationId(
  id: string,
  fallback = defaultTranslationId,
): string {
  return translations.some((translation) => translation.id === id)
    ? id
    : fallback;
}

export function supportedComparisonIds(
  ids: string[],
  preferred = defaultTranslationId,
): string[] {
  const supported = ids.filter(
    (id) =>
      id !== preferred &&
      translations.some((translation) => translation.id === id),
  );
  return supported.length
    ? supported
    : [supportedTranslationId(defaultComparisonTranslationId)].filter(
        (id) => id !== preferred,
      );
}
export const bibleProviders: BibleProvider[] = [
  { id: 'youversion', name: 'YouVersion', capabilities: ['text'] },
  { id: 'api-bible', name: 'API.Bible', capabilities: ['text'] },
  {
    id: 'bible-brain',
    name: 'Bible Brain / Bible.is',
    capabilities: ['text', 'audio', 'video', 'language'],
  },
  {
    id: 'public-domain',
    name: 'Public-domain sources',
    capabilities: ['text'],
  },
];
// Contracts only. Implement adapters on a trusted server after checking provider licensing.
export interface ScriptureAdapter {
  getPassage(
    reference: string,
    translationId: string,
  ): Promise<{ text: string; source: Source; attribution: string }>;
}
export interface AIAdapter {
  synthesize(input: {
    question: string;
    sources: Source[];
    model: string;
  }): Promise<{ text: string; kind: 'AI SYNTHESIS'; sources: Source[] }>;
}
export interface AuthAdapter {
  currentUser(): Promise<User | null>;
  signOut(): Promise<void>;
}
export interface CredentialVault {
  store(
    userId: string,
    providerId: string,
    secret: string,
  ): Promise<{ credentialReference: string }>;
  revoke(credentialReference: string): Promise<void>;
}
export interface ConnectionService {
  connect(
    providerId: string,
    credential: string,
  ): Promise<{ status: 'connected'; credentialReference: string }>;
}
export const integrationStatus = 'not-configured' as const;

export type {
  AIRequest,
  AIResponse,
  AIContext,
  SourceDocument,
  SourceCitation,
} from './ai.ts';
export type { AIProvider } from './models.ts';
