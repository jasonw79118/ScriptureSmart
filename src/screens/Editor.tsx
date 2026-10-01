import { AssistantPanel } from '../ai/AssistantPanel';
import { useState, type ReactNode } from 'react';
import type { DocumentKind, Draft } from '../domain/models';
import { sections } from '../data/seed';
import { Badge } from '../components';
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
  const studioTitles = {
    sermon: 'Sermon Builder',
    study: 'Bible Study Studio',
    guide: 'Discussion Guide Studio',
  };
  const matching = drafts.filter((d) => d.kind === kind);
  const draft = matching.find((d) => d.id === selectedId);
  const [active, setActive] = useState(sections[kind][0]);
  const update = (part: Partial<Draft>) =>
    draft && save({ ...draft, ...part, updatedAt: timestamp() });
  const filled = draft
    ? sections[kind].filter((name) => draft.sections[name]?.trim()).length
    : 0;

  if (!draft)
    return (
      <div className="studio-index">
        <section className="studio-hero image-hero teaching-hero">
          <div>
            <span className="eyebrow">CREATE</span>
            <h1>{studioTitles[kind]}</h1>
            <p>
              Shape sermons, studies, and group guides in a writing environment
              built around Scripture, research, prayer, and careful revision.
            </p>
            <button className="button primary" onClick={() => create(kind)}>
              New {labels[kind].toLowerCase()} →
            </button>
          </div>
          <div className="studio-stage-card">
            <span>1</span>
            <strong>Build</strong>
            <small>Start with a passage, theme, or question.</small>
          </div>
        </section>
        <section className="studio-draft-shelf">
          <div className="section-heading">
            <h2>Drafts in progress</h2>
            <span className="muted">Saved on this device</span>
          </div>
          {cards(matching)}
        </section>
      </div>
    );

  return (
    <div className="writing-studio-shell">
      <section className="studio-hero compact image-hero teaching-hero">
        <div>
          <span className="eyebrow">
            PRAY · STUDY · STRUCTURE · WRITE · EQUIP
          </span>
          <h1>{draft.title || `Untitled ${labels[kind].toLowerCase()}`}</h1>
          <p>
            {draft.passage ||
              'Choose a passage, then build the idea, outline, application, and next steps.'}
          </p>
        </div>
        <div className="studio-progress" aria-label="Writing progress">
          {['Build', 'Refine', 'Prepare', 'Share'].map((step, index) => (
            <span
              className={index <= Math.min(filled, 3) ? 'active' : ''}
              key={step}
            >
              {index + 1}. {step}
            </span>
          ))}
        </div>
      </section>
      <div className="studio-toolbar">
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
      </div>
      <div className="studio-workspace">
        <aside className="studio-outline" aria-label="Draft sections">
          <span className="eyebrow">Draft map</span>
          {sections[kind].map((s, i) => (
            <button
              key={s}
              className={s === active ? 'selected' : ''}
              onClick={() => setActive(s)}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {s}
              {draft.sections[s]?.trim() && <i aria-label="Has content" />}
            </button>
          ))}
        </aside>
        <main className="manuscript-page" aria-label="Writing area">
          <div className="manuscript-meta">
            <Badge>{draft.sample ? 'Sample draft' : 'Personal draft'}</Badge>
            <span>{labels[kind]}</span>
          </div>
          <label>
            {kind === 'sermon'
              ? 'Sermon title'
              : kind === 'study'
                ? 'Study title'
                : 'Guide title'}
            <input
              className="title-input"
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <div className="two-columns">
            <label>
              Primary passage
              <input
                value={draft.passage}
                placeholder="e.g. Ephesians 1:3-14"
                onChange={(e) => update({ passage: e.target.value })}
              />
            </label>
            <label>
              Series
              <input
                value={draft.sections.Series ?? ''}
                placeholder="Optional teaching series"
                onChange={(e) =>
                  update({
                    sections: { ...draft.sections, Series: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <label className="writing-label">
            {active}
            <textarea
              className="manuscript"
              aria-label={active}
              placeholder={
                active === 'Main outline'
                  ? 'I.\nII.\nIII.'
                  : `Begin your ${active.toLowerCase()} here...`
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
        </main>
        <aside className="studio-ai-rail">
          <div className="rail-heading">
            <span className="eyebrow">ScriptureSmart AI</span>
            <h2>Research & Inspiration</h2>
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
                      'Suggest Outline',
                      'Create Discussion Questions',
                      'Summarize Research',
                      'Improve Clarity',
                      'Ask ScriptureSmart',
                    ]
                  : [
                      'Suggest observation questions',
                      'Suggest interpretation questions',
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
                        context: { sermon: draft.sections['Sermon material'] },
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
                  [active]: [draft.sections[active], '[AI SYNTHESIS]\n' + text]
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
        </aside>
      </div>
    </div>
  );
}
