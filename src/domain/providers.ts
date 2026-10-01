import type { BibleProvider, Translation, Source, User } from './models';

export const translations: Translation[] = [
  { id: 'BSB', name: 'Berean Standard Bible' },
  { id: 'ASV', name: 'American Standard Version' },
  { id: 'WEBUS', name: 'World English Bible, American English' },
  { id: 'FBV', name: 'Free Bible Version' },
  { id: 'LSV', name: 'Literal Standard Version' },
  { id: 'WMB', name: 'World Messianic Bible' },
  { id: 'CPDV', name: 'Catholic Public Domain Version' },
  { id: 'TCENT', name: 'Text-Critical English New Testament' },
].map((translation) => ({ ...translation, providerIds: ['youversion'], requiresLicense: false }));
translations.push(
  { id: 'ESV', name: 'English Standard Version', providerIds: ['esv'], requiresLicense: true },
  { id: 'NIV', name: 'New International Version', providerIds: ['api-bible'], requiresLicense: true },
  { id: 'KJV', name: 'King James Version', providerIds: ['api-bible'], requiresLicense: false },
  { id: 'NKJV', name: 'New King James Version', providerIds: ['api-bible'], requiresLicense: true },
);
export const defaultTranslationId = 'BSB';
export const defaultComparisonTranslationId = 'ASV';

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
  { id: 'esv', name: 'Crossway ESV API', capabilities: ['text'] },
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
} from './ai';
export type { AIProvider } from './models';
