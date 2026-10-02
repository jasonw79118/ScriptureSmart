const books =
  'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split(
    '|',
  );
const pattern = `(${[...books].sort((a, b) => b.length - a.length).join('|')})\\s+(\\d{1,3})(?::(\\d{1,3})(?:[-\\u2013](\\d{1,3}))?)?`;
export function normalizeReference(value: string): string | null {
  const m = new RegExp(`^${pattern}$`, 'i').exec(value.trim());
  if (
    !m ||
    +m[2] < 1 ||
    +m[2] > 150 ||
    (m[3] && (+m[3] < 1 || +m[3] > 176)) ||
    (m[4] && (+m[4] < +m[3] || +m[4] > 176))
  )
    return null;
  const book = books.find((b) => b.toLowerCase() === m[1].toLowerCase())!;
  return `${book} ${+m[2]}${m[3] ? `:${+m[3]}${m[4] ? `-${+m[4]}` : ''}` : ''}`;
}
export function testamentForReference(reference: string): 'old' | 'new' | null {
  const normalized = normalizeReference(reference);
  if (!normalized) return null;
  const book = normalized.replace(/\s+\d.*$/, '');
  return books.indexOf(book) < 39 ? 'old' : 'new';
}
export function suggestedReferences(prompt: string, passage = ''): string[] {
  if (
    /\badopt(?:ion|ed)?\b/i.test(prompt) &&
    /\b(Paul|Ephesians|Romans|Galatians)\b/i.test(prompt)
  )
    return [
      'Ephesians 1:3-14',
      'Romans 8:14-30',
      'Romans 9:1-5',
      'Galatians 4:1-7',
    ];
  const found = Array.from(
    prompt.matchAll(new RegExp(`\\b${pattern}\\b`, 'gi')),
    (m) => normalizeReference(m[0])!,
  ).filter(Boolean);
  return [
    ...new Set(
      found.length
        ? found
        : [normalizeReference(passage)].filter((r): r is string => !!r),
    ),
  ].slice(0, 6);
}
export interface RetrievedPassage {
  reference: string;
  translation: 'WEB';
  text: string;
  url: string;
}
export const passageURL = (reference: string) =>
  `https://bible-api.com/${encodeURIComponent(reference)}?translation=web&single_chapter_book_matching=indifferent`;
