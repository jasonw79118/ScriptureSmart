import type { Draft, Note, TableItem } from '../domain/models';
import type { Preferences } from '../domain/models';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
export const validDrafts = (v: unknown): v is Draft[] =>
  Array.isArray(v) &&
  v.every(
    (d) =>
      object(d) &&
      text(d.id) &&
      ['sermon', 'study', 'guide'].includes(String(d.kind)) &&
      text(d.title) &&
      text(d.passage) &&
      object(d.sections) &&
      Object.values(d.sections).every(text) &&
      text(d.updatedAt),
  );
export const validNotes = (v: unknown): v is Note[] =>
  Array.isArray(v) &&
  v.every(
    (n) =>
      object(n) &&
      text(n.id) &&
      text(n.passage) &&
      text(n.text) &&
      text(n.ownerId) &&
      ['private', 'group'].includes(String(n.visibility)),
  );
export const validTable = (v: unknown): v is TableItem[] =>
  Array.isArray(v) &&
  v.every(
    (i) =>
      object(i) &&
      text(i.id) &&
      text(i.groupId) &&
      text(i.text) &&
      ['question', 'passage', 'resource', 'note', 'sermon-excerpt'].includes(
        String(i.kind),
      ) &&
      typeof i.forGroupNight === 'boolean' &&
      Array.isArray(i.replies) &&
      i.replies.every((r) => object(r) && text(r.id) && text(r.text)),
  );
export const validPreferences = (v: unknown): v is Preferences =>
  object(v) &&
  text(v.name) &&
  text(v.translation) &&
  Array.isArray(v.comparisons) &&
  v.comparisons.every(text) &&
  text(v.tradition) &&
  text(v.statement) &&
  typeof v.showOthers === 'boolean' &&
  (v.defaultAIProvider === undefined ||
    v.defaultAIProvider === 'scripturesmart-ai');
