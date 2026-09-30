import { normalizeReference } from '../../src/domain/bible.ts';
import {
  AIError,
  isRecord,
  taskTypes,
  type AIRequest,
  type AIContext,
  type SourceDocument,
} from '../../src/domain/ai.ts';
import type { SourceKind } from '../../src/domain/models.ts';

export const MAX_BODY_BYTES = 65536;
const fail = () => {
  throw new AIError('invalid');
};
function text(v: unknown, max: number, required = false): string {
  if (typeof v !== 'string' || (required && !v.trim())) return fail();
  if (v.length > max) throw new AIError('too-large');
  return v.trim();
}
function documents(value: unknown, kind: SourceKind): SourceDocument[] {
  if (!Array.isArray(value) || value.length > 12) return fail();
  return value.map((doc) => {
    if (!isRecord(doc) || !isRecord(doc.source) || doc.source.kind !== kind)
      return fail();
    const source = doc.source;
    if (kind === 'SCRIPTURE' && !doc.translationId) return fail();
    // Client metadata is never promoted to verified provenance.
    return {
      id: text(doc.id, 100, true),
      text: text(doc.text, 24000, true),
      translationId:
        doc.translationId === undefined
          ? undefined
          : text(doc.translationId, 80, true),
      source: {
        kind,
        title: text(source.title, 300, true),
        isVerified: false,
        ...(source.author === undefined
          ? {}
          : { author: text(source.author, 200) }),
        ...(source.citation === undefined
          ? {}
          : { citation: text(source.citation, 500) }),
      },
    };
  });
}
export function validateRequest(value: unknown): AIRequest {
  if (
    !isRecord(value) ||
    !taskTypes.includes(value.taskType as AIRequest['taskType'])
  )
    return fail();
  if (
    Object.keys(value).some(
      (k) =>
        ![
          'taskType',
          'prompt',
          'context',
          'options',
          'bible',
          'conversation',
        ].includes(k),
    )
  )
    return fail();
  let conversation: AIRequest['conversation'];
  if (value.conversation !== undefined) {
    if (!Array.isArray(value.conversation) || value.conversation.length > 4)
      return fail();
    conversation = value.conversation.map((turn) => {
      if (
        !isRecord(turn) ||
        Object.keys(turn).some((k) => !['question', 'answer'].includes(k))
      )
        return fail();
      return {
        question: text(turn.question, 6000, true),
        answer: text(turn.answer, 32000, true),
      };
    });
    if (
      conversation.reduce(
        (n, t) => n + t.question.length + t.answer.length,
        0,
      ) > 32000
    )
      throw new AIError('too-large');
  }
  let bible: AIRequest['bible'];
  if (value.bible !== undefined) {
    if (
      !isRecord(value.bible) ||
      Object.keys(value.bible).some((k) => k !== 'references') ||
      !Array.isArray(value.bible.references) ||
      !value.bible.references.length ||
      value.bible.references.length > 6
    )
      return fail();
    const references = value.bible.references.map((r) =>
      typeof r === 'string' ? normalizeReference(r) : null,
    );
    if (references.some((r) => !r)) return fail();
    bible = { references: [...new Set(references as string[])] };
  }
  const context: AIContext = {};
  if (value.context !== undefined) {
    if (!isRecord(value.context)) return fail();
    const c = value.context;
    if (
      Object.keys(c).some(
        (k) =>
          ![
            'passageReference',
            'translationIds',
            'scripture',
            'commentary',
            'historicalSources',
            'userNotes',
            'sermon',
            'study',
          ].includes(k),
      )
    )
      return fail();
    if (JSON.stringify(c).length > 36000) throw new AIError('too-large');
    if (c.passageReference !== undefined)
      context.passageReference = text(c.passageReference, 200);
    if (c.translationIds !== undefined) {
      if (!Array.isArray(c.translationIds) || c.translationIds.length > 5)
        return fail();
      context.translationIds = c.translationIds.map((t) => text(t, 80, true));
    }
    if (c.sermon !== undefined) context.sermon = text(c.sermon, 30000);
    if (c.study !== undefined) context.study = text(c.study, 30000);
    if (c.scripture !== undefined)
      context.scripture = documents(c.scripture, 'SCRIPTURE');
    if (c.commentary !== undefined)
      context.commentary = documents(c.commentary, 'COMMENTARY');
    if (c.historicalSources !== undefined)
      context.historicalSources = documents(
        c.historicalSources,
        'PRIMARY HISTORICAL SOURCE',
      );
    if (c.userNotes !== undefined)
      context.userNotes = documents(c.userNotes, 'USER NOTE');
  }
  if (value.taskType === 'discussion-guide' && !context.sermon?.trim())
    return fail();
  const options: NonNullable<AIRequest['options']> = {
    temperature: 0.3,
    maxTokens: 2048,
  };
  if (value.options !== undefined) {
    if (
      !isRecord(value.options) ||
      Object.keys(value.options).some(
        (k) => !['temperature', 'maxTokens'].includes(k),
      )
    )
      return fail();
    const { temperature, maxTokens } = value.options;
    if (temperature !== undefined) {
      if (
        typeof temperature !== 'number' ||
        !Number.isFinite(temperature) ||
        temperature < 0 ||
        temperature > 1
      )
        return fail();
      options.temperature = temperature;
    }
    if (maxTokens !== undefined) {
      if (
        typeof maxTokens !== 'number' ||
        !Number.isInteger(maxTokens) ||
        maxTokens < 64 ||
        maxTokens > 2048
      )
        return fail();
      options.maxTokens = maxTokens;
    }
  }
  return {
    taskType: value.taskType as AIRequest['taskType'],
    ...(bible ? { bible } : {}),
    ...(conversation ? { conversation } : {}),
    prompt: text(value.prompt, 6000, true),
    context,
    options,
  };
}
export async function readRequest(request: Request): Promise<AIRequest> {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    return fail();
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES)
    throw new AIError('too-large');
  const reader = request.body?.getReader();
  if (!reader) return fail();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AIError('too-large');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return fail();
  }
  return validateRequest(json);
}
