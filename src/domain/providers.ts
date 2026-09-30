import type { BibleProvider, Translation, Source, User } from './models';

export const translations: Translation[] = [
  'ESV',
  'CSB',
  'NIV',
  'KJV',
  'NKJV',
].map((id) => ({
  id,
  name: id,
  providerIds: [],
  requiresLicense: id !== 'KJV',
}));
export const bibleProviders: BibleProvider[] = [
  { id: 'youversion', name: 'YouVersion', capabilities: ['text'] },
  {
    id: 'bible-brain',
    name: 'Bible Brain / Bible.is',
    capabilities: ['text', 'audio', 'video', 'language'],
  },
  { id: 'esv', name: 'ESV API', capabilities: ['text'] },
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
