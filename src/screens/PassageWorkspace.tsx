import { AssistantPanel, type ContextChoice } from '../ai/AssistantPanel';
import { useEffect, useState } from 'react';
import type { Note, TableItem } from '../domain/models';
import { translations } from '../domain/providers';
import { Badge, Empty, Heading } from '../components';
import { getBiblePassage, type BiblePassageResult } from '../ai/bibleClient';
import { AIError } from '../domain/ai';
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
    comparisons.find((t) => t !== preferred) ?? 'ASV',
  );
  const [validation, setValidation] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [passageTexts, setPassageTexts] = useState<
    Record<string, BiblePassageResult>
  >({});
  const [passageErrors, setPassageErrors] = useState<Record<string, string>>(
    {},
  );
  const [loadingPassages, setLoadingPassages] = useState<
    Record<string, boolean>
  >({});
  const noteChoices = (n: Note): ContextChoice[] => [
    {
      id: `note-${n.id}`,
      label: 'This saved note',
      context: {
        userNotes: [
          {
            id: n.id,
            text: n.text,
            source: {
              kind: 'USER NOTE' as const,
              title: 'Selected saved note',
              isVerified: false,
            },
          },
        ],
      },
    },
  ];
  const tabs = [
    'Scripture',
    'Compare',
    'Original language',
    'Cross references',
    'Commentary',
    'Interpretations',
    'Notes',
  ];
  useEffect(() => {
    if (tab !== 'Scripture' && tab !== 'Compare') return;
    const controllers: AbortController[] = [];
    const ids = [translation, ...(tab === 'Compare' ? [comparison] : [])];
    for (const id of ids) {
      const key = `${id}:${passage}`;
      if (passageTexts[key] || loadingPassages[key] || passageErrors[key])
        continue;
      const controller = new AbortController();
      controllers.push(controller);
      setLoadingPassages((current) => ({ ...current, [key]: true }));
      setPassageErrors((current) => ({ ...current, [key]: '' }));
      void getBiblePassage(passage, id, controller.signal)
        .then((result) =>
          setPassageTexts((current) => ({ ...current, [key]: result })),
        )
        .catch((error) =>
          setPassageErrors((current) => ({
            ...current,
            [key]:
              error instanceof AIError
                ? error.message
                : 'Bible text could not be loaded.',
          })),
        )
        .finally(() =>
          setLoadingPassages((current) => ({ ...current, [key]: false })),
        );
    }
    return () => controllers.forEach((controller) => controller.abort());
  }, [
    tab,
    passage,
    translation,
    comparison,
    passageTexts,
    loadingPassages,
    passageErrors,
  ]);
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
        choices={[]}
        onInsert={(text, question) =>
          saveNotes([
            {
              id: crypto.randomUUID(),
              passage,
              text: `[AI SYNTHESIS]\nQuestion: ${question ?? 'Study chat'}\n\n${text}`,
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
                  {loadingPassages[`${t}:${passage}`] && (
                    <p>Loading {t} from YouVersion...</p>
                  )}
                  {passageErrors[`${t}:${passage}`] && (
                    <div role="alert" className="alert">
                      {passageErrors[`${t}:${passage}`]}
                    </div>
                  )}
                  {passageTexts[`${t}:${passage}`] ? (
                    <article className="note-card">
                      <h3>
                        {passageTexts[`${t}:${passage}`].reference} ({t})
                      </h3>
                      <p className="preserve">
                        {passageTexts[`${t}:${passage}`].text}
                      </p>
                      <small>
                        {passageTexts[`${t}:${passage}`].attribution}{' '}
                        <a
                          href={passageTexts[`${t}:${passage}`].sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open in YouVersion
                        </a>
                      </small>
                    </article>
                  ) : (
                    !loadingPassages[`${t}:${passage}`] &&
                    !passageErrors[`${t}:${passage}`] && (
                      <Empty title={`Read ${passage} in ${t}`}>
                        Sign in to load this passage through the connected
                        YouVersion provider.
                      </Empty>
                    )
                  )}
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
                  <div className="editor-toolbar">
                    <button
                      className="text-button"
                      onClick={() => send(n.text)}
                    >
                      Send to local Table
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        setActiveNoteId(activeNoteId === n.id ? null : n.id)
                      }
                    >
                      {activeNoteId === n.id
                        ? 'Close note question'
                        : 'Ask AI about this note'}
                    </button>
                  </div>
                  {activeNoteId === n.id && (
                    <AssistantPanel
                      key={`note-ai-${n.id}`}
                      allowScripture
                      baseContext={{
                        passageReference: passage,
                        translationIds: [translation, comparison],
                      }}
                      choices={noteChoices(n)}
                      suggestions={[
                        'What should I ask next from this note?',
                        'Help me refine this note.',
                        'What Bible passages clarify this note?',
                        'Turn this note into a study question.',
                      ]}
                      onInsert={(text, question) =>
                        saveNotes([
                          {
                            id: crypto.randomUUID(),
                            passage,
                            text: `[AI SYNTHESIS]\nQuestion: ${
                              question ?? 'Question about saved note'
                            }\nBased on note: ${n.text}\n\n${text}`,
                            visibility: 'private',
                            ownerId: 'local-user',
                          },
                          ...notes,
                        ])
                      }
                    />
                  )}
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
