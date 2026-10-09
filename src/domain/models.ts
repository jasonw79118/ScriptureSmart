import type { AIRequest, AIResponse } from './ai.ts';
export type Role =
  | 'individual'
  | 'group-member'
  | 'group-leader'
  | 'pastor'
  | 'church-administrator';
export type SourceKind =
  | 'SCRIPTURE'
  | 'ORIGINAL LANGUAGE DATA'
  | 'PRIMARY HISTORICAL SOURCE'
  | 'COMMENTARY'
  | 'SERMON'
  | 'USER NOTE'
  | 'AI SYNTHESIS';
export interface User {
  id: string;
  name: string;
  roles: Role[];
}
export interface Church {
  id: string;
  name: string;
  theologyProfile?: {
    tradition: string;
    statement: string;
    showOtherInterpretations: boolean;
  };
}
export interface Group {
  id: string;
  churchId?: string;
  name: string;
  description: string;
  currentStudyId?: string;
  previousStudyIds: string[];
}
export interface GroupMembership {
  userId: string;
  groupId: string;
  role: 'member' | 'leader';
}
export interface Passage {
  reference: string;
  translationId: string;
}
export interface Translation {
  id: string;
  name: string;
  providerIds: string[];
  requiresLicense: boolean;
}
export interface BibleProvider {
  id: string;
  name: string;
  capabilities: ('text' | 'audio' | 'video' | 'language')[];
}
export interface AIProvider {
  isAvailable(): Promise<boolean>;
  generate(request: AIRequest, signal?: AbortSignal): Promise<AIResponse>;
  id: string;
  name: string;
}
export interface AIConnection {
  id: string;
  userId: string;
  providerId: string;
  credentialReference: string;
  model: string;
  status: 'pending' | 'connected' | 'error';
}
export interface Source {
  kind: SourceKind;
  title: string;
  author?: string;
  url?: string;
  citation?: string;
  isVerified: boolean;
}
export interface CommentarySource extends Source {
  category: 'early-church' | 'reformation' | 'historical' | 'modern';
}
export interface HistoricalSource extends Source {
  category: 'council' | 'creed' | 'primary-document';
}
export interface ResearchItem {
  id: string;
  passage: string;
  source: Source;
  text: string;
  isQuotation: boolean;
}
export interface Note {
  id: string;
  passage: string;
  text: string;
  visibility: 'private' | 'group';
  ownerId: string;
}
export interface StudyChat {
  id: string;
  title: string;
  passageReference: string;
  translationIds: string[];
  exchanges: { question: string; answer: string }[];
  updatedAt: string;
}
export type DocumentKind = 'sermon' | 'study' | 'guide';
export interface Draft {
  id: string;
  kind: DocumentKind;
  title: string;
  passage: string;
  sections: Record<string, string>;
  updatedAt: string;
  sample?: boolean;
  aiAssisted?: boolean;
}
export interface Sermon extends Draft {
  kind: 'sermon';
}
export interface Study extends Draft {
  kind: 'study';
  groupId?: string;
}
export interface DiscussionGuide extends Draft {
  kind: 'guide';
  sermonId?: string;
}
export interface Session {
  id: string;
  groupId: string;
  studyId: string;
  title: string;
  scheduledAt?: string;
}
export interface Discussion {
  id: string;
  groupId: string;
  sessionId?: string;
  title: string;
}
export interface DiscussionPost {
  id: string;
  discussionId: string;
  authorId: string;
  text: string;
  parentId?: string;
}
export interface TableItem {
  id: string;
  groupId: string;
  kind: 'question' | 'passage' | 'resource' | 'note' | 'sermon-excerpt';
  text: string;
  passage?: string;
  url?: string;
  forGroupNight: boolean;
  replies: { id: string; text: string }[];
  sample?: boolean;
}
export interface InterpretiveApproach {
  explanation: string;
  arguments: string[];
  passages: string[];
  representatives: string[];
  sources: Source[];
  agreements: string[];
  disagreements: string[];
}

export interface Preferences {
  defaultAIProvider?: string;
  name: string;
  translation: string;
  comparisons: string[];
  tradition: string;
  statement: string;
  showOthers: boolean;
}
