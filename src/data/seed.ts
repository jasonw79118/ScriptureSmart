import type { Draft, TableItem } from '../domain/models';
export const sampleDrafts: Draft[] = [
  {
    id: 'sample-study',
    kind: 'study',
    title: 'Our identity in Christ',
    passage: 'Ephesians 1:3–14',
    sections: {
      'Main idea':
        'Explore the passage together and note how Paul describes our identity in Christ.',
      'Opening question':
        'When has belonging to a community changed the way you see yourself?',
    },
    updatedAt: '2026-09-27T12:00:00Z',
    sample: true,
  },
  {
    id: 'sample-sermon',
    kind: 'sermon',
    title: 'A life rooted in grace',
    passage: 'Ephesians 2:1–10',
    sections: {
      'Central idea':
        'Working thought: grace shapes both our identity and our response.',
      'Main outline':
        'I. Our need for grace\nII. The gift of grace\nIII. A life shaped by grace',
    },
    updatedAt: '2026-09-26T12:00:00Z',
    sample: true,
  },
  {
    id: 'sample-guide',
    kind: 'guide',
    title: 'Practicing a living faith',
    passage: 'James 2:14–26',
    sections: {
      Opening: 'Where have you seen faith expressed through everyday actions?',
    },
    updatedAt: '2026-09-25T12:00:00Z',
    sample: true,
  },
];
export const sampleTable: TableItem[] = [
  {
    id: 'sample-question',
    groupId: 'sample-group',
    kind: 'question',
    text: 'How does belonging to Christ shape the way we welcome others?',
    passage: 'Ephesians 1:3–14',
    forGroupNight: true,
    replies: [],
    sample: true,
  },
];
export const sections = {
  sermon: [
    'Central idea',
    'Additional passages',
    'Context',
    'Observations',
    'Translation notes',
    'Original-language notes',
    'Commentary research',
    'Illustrations',
    'Main outline',
    'Applications',
    'Conclusion',
    'Prayer / response',
    'Private notes',
  ],
  study: [
    'Main idea',
    'Opening question',
    'Read',
    'Observation questions',
    'Interpretation questions',
    'Discussion questions',
    'Application questions',
    'Prayer',
    'Leader notes',
    'Additional resources',
  ],
  guide: [
    'Sermon material',
    'Opening',
    'Read',
    'Observe',
    'Interpret',
    'Discuss',
    'Apply',
    'Pray',
  ],
};
