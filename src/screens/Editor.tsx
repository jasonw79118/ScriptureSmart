import { AssistantPanel } from '../ai/AssistantPanel';
import { useState, type ReactNode } from 'react';
import type { DocumentKind, Draft } from '../domain/models';
import { sections } from '../data/seed';
import { Badge, Heading } from '../components';
import { exportText, timestamp } from '../utils';
export function Editor({
  kind,
  drafts,
  selectedId,
  select,
  create,
  save,
  cards,
}: {
  kind: DocumentKind;
  drafts: Draft[];
  selectedId: string;
  select: (id: string) => void;
  create: (k: DocumentKind) => void;
  save: (d: Draft) => void;
  cards: (d: Draft[]) => ReactNode;
}) {
  const labels = {
    sermon: 'Sermon',
    study: 'Bible study',
    guide: 'Discussion guide',
  };
  const matching = drafts.filter((d) => d.kind === kind);
  const draft = matching.find((d) => d.id === selectedId);
  const [active, setActive] = useState(sections[kind][0]);
  const update = (part: Partial<Draft>) =>
    draft && save({ ...draft, ...part, updatedAt: timestamp() });
  return (
    <>
      <Heading
        title={
          kind === 'sermon'
            ? 'Prepare with purpose.'
            : kind === 'study'
              ? 'Create space for discovery.'
              : 'Carry the conversation forward.'
        }
        subtitle={
          kind === 'guide'
            ? 'Paste sermon material and build an editable guide for your group.'
            : 'A structured writing space, shaped around Scripture.'
        }
      />
      <div className="editor-toolbar">
        <button className="button primary" onClick={() => create(kind)}>
          ＋ New {labels[kind].toLowerCase()}
        </button>
        {draft && (
          <>
            <button className="button secondary" onClick={() => select('')}>
              All drafts
            </button>
            <button
              className="button secondary"
              onClick={() =>
                exportText(
                  `${draft.title.replace(/[^a-z0-9]/gi, '-').slice(0, 80) || 'draft'}.txt`,
                  `${draft.title}\n${draft.passage}\n\n${sections[kind].map((s) => `${s}\n${draft.sections[s] ?? ''}`).join('\n\n')}`,
                )
              }
            >
              Export text ↓
            </button>
            <span className="muted">Edits save on this device</span>
          </>
        )}
      </div>
      {!draft ? (
        cards(matching)
      ) : (
        <div className="editor-layout">
          <aside className="editor-sections">
            <span className="eyebrow">YOUR {labels[kind].toUpperCase()}</span>
            {sections[kind].map((s, i) => (
              <button
                key={s}
                className={s === active ? 'selected' : ''}
                onClick={() => setActive(s)}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s}
                {draft.sections[s]?.trim() && (
                  <span className="filled-dot">•</span>
                )}
              </button>
            ))}
          </aside>
          <section className="panel writing-panel">
            <div className="section-heading">
              <Badge>{draft.sample ? 'Sample draft' : 'Personal draft'}</Badge>
              <span className="muted">{labels[kind]}</span>
            </div>
            <label>
              Title
              <input
                className="title-input"
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </label>
            <label>
              Primary passage
              <input
                value={draft.passage}
                placeholder="e.g. Ephesians 1:3–14"
                onChange={(e) => update({ passage: e.target.value })}
              />
            </label>
            <div className="writing-divider" />
            <label className="writing-label">
              {active}
              <textarea
                className="manuscript"
                aria-label={active}
                placeholder={
                  active === 'Main outline'
                    ? 'I.\nII.\nIII.'
                    : `Begin your ${active.toLowerCase()} here…`
                }
                value={draft.sections[active] ?? ''}
                onChange={(e) =>
                  update({
                    sections: { ...draft.sections, [active]: e.target.value },
                  })
                }
              />
            </label>
            <div className="writing-status">
              <span>
                {
                  (draft.sections[active] ?? '')
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean).length
                }{' '}
                words
              </span>
              <span>
                {draft.aiAssisted
                  ? 'Contains AI-assisted draft content'
                  : 'Your words'}
              </span>
            </div>
            <AssistantPanel
              key={`${draft.id}:${active}`}
              taskType={
                kind === 'guide'
                  ? 'discussion-guide'
                  : kind === 'study'
                    ? 'bible-study'
                    : 'sermon'
              }
              baseContext={{ passageReference: draft.passage }}
              actionLabel={
                kind === 'guide'
                  ? 'Generate Discussion Guide'
                  : 'Ask ScriptureSmart'
              }
              suggestions={
                kind === 'guide'
                  ? [
                      'Create an editable discussion guide from the selected sermon material.',
                    ]
                  : kind === 'sermon'
                    ? [
                        'Suggest an outline',
                        'Improve the central idea',
                        'Generate discussion questions',
                        'Summarize the selected research',
                        'Suggest application questions',
                        'Rewrite this section for clarity',
                      ]
                    : [
                        'Suggest an opening question',
                        'Suggest observation questions',
                        'Suggest interpretation questions',
                        'Suggest discussion questions',
                        'Suggest application questions',
                        'Suggest prayer prompts',
                      ]
              }
              choices={
                kind === 'guide'
                  ? draft.sections['Sermon material']?.trim()
                    ? [
                        {
                          id: 'sermon',
                          label: 'Sermon material',
                          context: {
                            sermon: draft.sections['Sermon material'],
                          },
                        },
                      ]
                    : []
                  : draft.sections[active]?.trim()
                    ? [
                        {
                          id: 'section',
                          label: `Selected section: ${active}`,
                          context:
                            kind === 'sermon'
                              ? { sermon: draft.sections[active] }
                              : { study: draft.sections[active] },
                        },
                      ]
                    : []
              }
              insertLabel="Insert into selected section"
              onInsert={(text) =>
                update({
                  aiAssisted: true,
                  sections: {
                    ...draft.sections,
                    [active]: [
                      draft.sections[active],
                      '[AI SYNTHESIS]\n' + text,
                    ]
                      .filter(Boolean)
                      .join('\n\n'),
                  },
                })
              }
              onReplace={(text) =>
                update({
                  aiAssisted: true,
                  sections: {
                    ...draft.sections,
                    [active]: '[AI SYNTHESIS]\n' + text,
                  },
                })
              }
              onInsertGuide={
                kind === 'guide'
                  ? (generated) =>
                      update({
                        aiAssisted: true,
                        sections: {
                          ...draft.sections,
                          ...Object.fromEntries(
                            Object.entries(generated).map(([name, text]) => [
                              name,
                              [draft.sections[name], '[AI SYNTHESIS]\n' + text]
                                .filter(Boolean)
                                .join('\n\n'),
                            ]),
                          ),
                        },
                      })
                  : undefined
              }
            />
          </section>
        </div>
      )}
    </>
  );
}
