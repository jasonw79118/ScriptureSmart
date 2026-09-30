import { AssistantPanel } from '../ai/AssistantPanel';
import { useState } from 'react';
import type { Note, TableItem } from '../domain/models';
import { translations } from '../domain/providers';
import { Badge, Empty, Heading } from '../components';
export function PassageWorkspace({
  passage,
  setPassage,
  preferred,
  comparisons,
  notes,
  saveNotes,
  send,
  connect,
}: {
  passage: string;
  setPassage: (p: string) => void;
  preferred: string;
  comparisons: string[];
  notes: Note[];
  saveNotes: (n: Note[]) => void;
  send: (t: string, kind?: TableItem['kind']) => void;
  connect: () => void;
}) {
  const [input, setInput] = useState(passage);
  const [tab, setTab] = useState('Scripture');
  const [note, setNote] = useState('');
  const [translation, setTranslation] = useState(preferred);
  const [comparison, setComparison] = useState(
    comparisons.find((t) => t !== preferred) ?? 'KJV',
  );
  const [validation, setValidation] = useState('');
  const tabs = [
    'Scripture',
    'Compare',
    'Original language',
    'Cross references',
    'Commentary',
    'Interpretations',
    'Notes',
  ];
  return (
    <>
      <Heading
        title="Give the passage your attention."
        subtitle="Read carefully. Follow the context. Keep your sources close."
      />
      <form
        className="passage-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !/^[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+(?::\d+)?(?:\s*[-–]\s*\d+(?::\d+)?)?$/.test(
              input.trim(),
            )
          ) {
            setValidation('Enter a reference such as Ephesians 1:3–14.');
            return;
          }
          setPassage(input.trim());
          setValidation('');
        }}
      >
        <span aria-hidden="true">▤</span>
        <label className="sr-only" htmlFor="passage">
          Bible reference
        </label>
        <input
          id="passage"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a passage, e.g. Ephesians 1:3–14"
          required
        />
        <button className="button primary">Open passage →</button>
      </form>
      {validation && <p role="alert">{validation}</p>}
      <div className="workspace-title">
        <div>
          <span className="eyebrow">PASSAGE WORKSPACE</span>
          <h2>{passage}</h2>
        </div>
        <button
          className="button secondary"
          onClick={() => send(passage, 'passage')}
        >
          Send to The Table ↗
        </button>
      </div>
      <AssistantPanel
        allowScripture
        key={`${passage}:${translation}:${comparison}`}
        baseContext={{
          passageReference: passage,
          translationIds: [translation, comparison],
        }}
        suggestions={[
          'Explain this passage',
          'Compare adoption in Ephesians 1 with other passages where Paul discusses adoption. Is adoption what is predetermined?',
          'Compare the selected translations',
          'Summarize my notes',
          'Suggest study questions',
          'Identify major interpretive questions',
          'Create sermon ideas',
        ]}
        choices={
          notes.some((n) => n.passage === passage)
            ? [
                {
                  id: 'passage-notes',
                  label: 'My saved notes for this passage',
                  context: {
                    userNotes: notes
                      .filter((n) => n.passage === passage)
                      .map((n) => ({
                        id: n.id,
                        text: n.text,
                        source: {
                          kind: 'USER NOTE' as const,
                          title: 'Personal note',
                          isVerified: false,
                        },
                      })),
                  },
                },
              ]
            : []
        }
        onInsert={(text) =>
          saveNotes([
            {
              id: crypto.randomUUID(),
              passage,
              text: '[AI SYNTHESIS]\n' + text,
              visibility: 'private',
              ownerId: 'local-user',
            },
            ...notes,
          ])
        }
      />
      <div className="tabs" aria-label="Passage tools">
        {tabs.map((t) => (
          <button aria-pressed={t === tab} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <section className="panel workspace-panel" aria-label={tab}>
        {(tab === 'Scripture' || tab === 'Compare') && (
          <>
            <div className="section-heading">
              <Badge>SCRIPTURE</Badge>
              <span className="muted">Provider required</span>
            </div>
            <div className={tab === 'Compare' ? 'two-columns' : ''}>
              {(tab === 'Compare'
                ? [translation, comparison]
                : [translation]
              ).map((t, i) => (
                <div key={i}>
                  <label>
                    {i ? 'Comparison translation' : 'Translation'}
                    <select
                      aria-label={i ? 'Comparison translation' : 'Translation'}
                      value={t}
                      onChange={(e) =>
                        i
                          ? setComparison(e.target.value)
                          : setTranslation(e.target.value)
                      }
                    >
                      {translations.map((tr) => (
                        <option key={tr.id}>{tr.id}</option>
                      ))}
                    </select>
                  </label>
                  <Empty title={`Read ${passage} in ${t}`}>
                    Connect an approved Bible provider to display licensed text
                    and attribution. No Scripture text has been loaded.
                  </Empty>
                </div>
              ))}
            </div>
            <button className="button secondary" onClick={connect}>
              Explore Bible connections →
            </button>
          </>
        )}
        {tab === 'Original language' && (
          <>
            <Badge>ORIGINAL LANGUAGE DATA</Badge>
            <Empty title="Let the original language speak">
              Greek or Hebrew terms, transliterations, lemmas, lexical
              definitions, grammar, and other occurrences will appear here when
              a licensed data source is available.
            </Empty>
          </>
        )}
        {tab === 'Cross references' && (
          <Empty title="Follow the connections">
            Verified related passages can be saved to a sermon or study once a
            cross-reference provider is connected.
          </Empty>
        )}
        {tab === 'Commentary' && (
          <>
            <h2>Research across the Christian tradition</h2>
            <p>
              Source categories describe the type of resource; they do not imply
              that a quotation or passage commentary is available.
            </p>
            <div className="research-categories">
              {[
                [
                  'Early Church',
                  'Irenaeus · Athanasius · Augustine · John Chrysostom',
                ],
                [
                  'Councils & creeds',
                  'Council of Nicaea · Primary historical sources',
                ],
                ['Reformation', 'Martin Luther · John Calvin'],
                ['Historical commentators', 'Charles Spurgeon'],
                [
                  'Modern pastoral & theological voices',
                  'C. S. Lewis · Tim Keller · John Piper',
                ],
              ].map(([title, names]) => (
                <div className="category" key={title}>
                  <h3>{title}</h3>
                  <p>{names}</p>
                  <small>Source collection not connected</small>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === 'Interpretations' && (
          <>
            <h2>Major interpretive approaches</h2>
            <Empty title="Room for thoughtful differences">
              Future research will show explanations, arguments, relevant
              passages, historical representatives, sources, and areas of
              agreement and disagreement. No interpretations have been sourced
              for this passage.
            </Empty>
          </>
        )}
        {tab === 'Notes' && (
          <>
            <Badge>USER NOTE</Badge>
            <h2>Your observations</h2>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                saveNotes([
                  {
                    id: crypto.randomUUID(),
                    passage,
                    text: note.trim(),
                    visibility: 'private',
                    ownerId: 'local-user',
                  },
                  ...notes,
                ]);
                setNote('');
              }}
            >
              <label>
                New personal note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What do you notice in the passage?"
                  required
                />
              </label>
              <button className="button primary" disabled={!note.trim()}>
                Save note
              </button>
            </form>
            {notes
              .filter((n) => n.passage === passage)
              .map((n) => (
                <article className="note-card" key={n.id}>
                  <span className="muted">Private · This device</span>
                  <p className="preserve">{n.text}</p>
                  <button className="text-button" onClick={() => send(n.text)}>
                    Send to local Table →
                  </button>
                </article>
              ))}
          </>
        )}
      </section>
      <div className="integrity-note">
        ◇ Scripture, historical sources, personal notes, and AI synthesis each
        keep their own identity.
      </div>
    </>
  );
}
