import { AssistantPanel, type ContextChoice } from '../ai/AssistantPanel';
import { useEffect, useState } from 'react';
import type { Note, TableItem } from '../domain/models';
import {
  defaultComparisonTranslationId,
  defaultTranslationId,
  translations,
} from '../domain/providers';
import { Badge, Empty } from '../components';
import { getBiblePassage, type BiblePassageResult } from '../ai/bibleClient';
import { AIError } from '../domain/ai';
import { testamentForReference } from '../domain/bible';
import { reportApiBibleViews } from '../ai/fums';

export function PassageWorkspace({
  passage,
  setPassage,
  preferred,
  availableTranslationIds,
  comparisons,
  notes,
  saveNotes,
  send,
  connect,
  initialQuestion = '',
  fumsUserId,
}: {
  passage: string;
  setPassage: (p: string) => void;
  preferred: string;
  availableTranslationIds: string[];
  comparisons: string[];
  notes: Note[];
  saveNotes: (n: Note[]) => void;
  send: (t: string, kind?: TableItem['kind']) => void;
  connect: () => void;
  initialQuestion?: string;
  fumsUserId?: string;
}) {
  const availableTranslations = translations.filter((item) =>
    availableTranslationIds.includes(item.id),
  );
  const initialTranslation = availableTranslationIds.includes(preferred)
    ? preferred
    : (availableTranslationIds[0] ?? defaultTranslationId);
  const initialComparison =
    comparisons.find(
      (id) => id !== initialTranslation && availableTranslationIds.includes(id),
    ) ??
    availableTranslationIds.find((id) => id !== initialTranslation) ??
    defaultComparisonTranslationId;
  const [input, setInput] = useState(passage);
  const [tab, setTab] = useState('Scripture');
  const [note, setNote] = useState('');
  const [translation, setTranslation] = useState(initialTranslation);
  const [comparison, setComparison] = useState(initialComparison);
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

  useEffect(() => {
    const nextTranslation = availableTranslationIds.includes(preferred)
      ? preferred
      : (availableTranslationIds[0] ?? defaultTranslationId);
    setTranslation(nextTranslation);
    setComparison(
      comparisons.find(
        (id) => id !== nextTranslation && availableTranslationIds.includes(id),
      ) ??
        availableTranslationIds.find((id) => id !== nextTranslation) ??
        defaultComparisonTranslationId,
    );
  }, [preferred, comparisons, availableTranslationIds]);

  const noteChoices = (n: Note[]): ContextChoice[] =>
    n.map((item) => ({
      id: `note-${item.id}`,
      label: 'Saved note',
      context: {
        userNotes: [
          {
            id: item.id,
            text: item.text,
            source: {
              kind: 'USER NOTE' as const,
              title: 'Selected saved note',
              isVerified: false,
            },
          },
        ],
      },
    }));

  useEffect(() => {
    const controllers: AbortController[] = [];
    const ids = tab === 'Compare' ? [translation, comparison] : [translation];
    for (const id of ids) {
      const key = `${id}:${passage}`;
      if (passageTexts[key] || loadingPassages[key] || passageErrors[key])
        continue;
      const controller = new AbortController();
      controllers.push(controller);
      setLoadingPassages((current) => ({ ...current, [key]: true }));
      setPassageErrors((current) => ({ ...current, [key]: '' }));
      void getBiblePassage(passage, id, controller.signal)
        .then((result) => {
          setPassageTexts((current) => ({ ...current, [key]: result }));
          void reportApiBibleViews([result.fumsToken], fumsUserId);
        })
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
    fumsUserId,
    passageTexts,
    loadingPassages,
    passageErrors,
  ]);

  const renderText = (id: string) => {
    const key = `${id}:${passage}`;
    const result = passageTexts[key];
    if (loadingPassages[key])
      return (
        <p className="scripture-loading">
          Opening this passage from the selected Bible provider…
        </p>
      );
    if (passageErrors[key])
      return (
        <div role="alert" className="scripture-error">
          <strong>Passage unavailable</strong>
          <p>{passageErrors[key]}</p>
          <button className="text-button" onClick={connect}>
            View Bible connections
          </button>
        </div>
      );
    if (!result)
      return (
        <p className="scripture-loading">Loading the selected translation…</p>
      );
    return (
      <>
        <p className="scripture-text preserve">{result.text}</p>
        <div className="scripture-attribution">
          <span>{result.attribution}</span>
          <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">
            Open API.Bible ↗
          </a>
        </div>
        {result.rights && (
          <small className="muted">
            This version is displayed from the API.Bible response. It is not
            sent to AI or saved in browser storage; commercial permission is not
            confirmed in this connection.
          </small>
        )}
      </>
    );
  };

  const jumpTo = (id: string) => {
    const target = document.getElementById(id);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const saveNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
  };

  return (
    <section className="study-desk-page">
      <header className="study-desk-banner image-hero">
        <span className="eyebrow">SCRIPTURESMART STUDY DESK</span>
        <h1>Study Desk</h1>
        <p>Read deeply. Explore widely. Apply faithfully.</p>
      </header>

      <div className="study-desk-layout">
        <aside className="study-tool-rail" aria-label="Study resources">
          <div className="resource-rail-heading">
            <strong>Resources</strong>
            <span>Study shelf</span>
          </div>
          <label className="resource-search">
            Search resources
            <input
              placeholder="Search resources…"
              onChange={(event) => {
                const query = event.target.value.toLowerCase();
                document
                  .querySelectorAll<HTMLElement>('.resource-rail-list button')
                  .forEach((button) => {
                    button.hidden =
                      !!query &&
                      !button.textContent?.toLowerCase().includes(query);
                  });
              }}
            />
          </label>
          <details open>
            <summary>Bible</summary>
            <div className="resource-rail-list">
              <button onClick={() => jumpTo('translation-choices')}>
                Translations
              </button>
              <button
                disabled={availableTranslations.length < 2}
                onClick={() =>
                  setTab(tab === 'Compare' ? 'Scripture' : 'Compare')
                }
              >
                Parallel Bible
              </button>
              <button onClick={() => jumpTo('study-notes')}>
                Saved Passages
              </button>
              <button onClick={() => jumpTo('reading-plans')}>
                Reading Plans
              </button>
            </div>
          </details>
          <details open>
            <summary>Study Tools</summary>
            <div className="resource-rail-list">
              <button onClick={() => jumpTo('commentary-insights')}>
                Commentaries
              </button>
              <button onClick={() => jumpTo('cross-references')}>
                Cross References
              </button>
              <button onClick={() => jumpTo('church-history')}>
                Church History
              </button>
              <button onClick={() => jumpTo('original-language')}>
                Original Languages
              </button>
              <button onClick={() => jumpTo('maps-timelines')}>
                Maps & Timelines
              </button>
              <button onClick={() => jumpTo('cross-references')}>
                Topics & Themes
              </button>
              <button onClick={() => jumpTo('commentary-insights')}>
                Dictionaries
              </button>
              <button onClick={() => jumpTo('commentary-insights')}>
                Illustrations
              </button>
            </div>
          </details>
          <details open>
            <summary>My Content</summary>
            <div className="resource-rail-list">
              <button onClick={() => jumpTo('study-notes')}>
                My Notes <span>{notes.length}</span>
              </button>
              <button onClick={() => jumpTo('study-notes')}>Highlights</button>
              <button onClick={() => jumpTo('study-notes')}>Bookmarks</button>
              <a href="#sermons">My Sermons</a>
            </div>
          </details>
        </aside>

        <div className="study-reader">
          <form
            className="passage-search"
            onSubmit={(event) => {
              event.preventDefault();
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
            <label className="sr-only" htmlFor="passage">
              Bible reference
            </label>
            <input
              id="passage"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Search or open a Bible passage…"
              required
            />
            <button className="button primary">
              Open passage <span aria-hidden="true">→</span>
            </button>
          </form>
          {validation && (
            <p role="alert" className="inline-error">
              {validation}
            </p>
          )}

          <article className="scripture-paper">
            <div className="scripture-breadcrumb">
              <button onClick={() => setInput(passage)}>‹</button>
              <span>Scripture</span>
              <span>›</span>
              <strong>{passage}</strong>
              <button onClick={() => send(passage, 'passage')}>
                Send to The Table ↗
              </button>
            </div>
            <div className="scripture-title">
              <span className="eyebrow">SCRIPTURE</span>
              <h2>{passage.split(':')[0]}</h2>
              <p>Read and study the passage in context</p>
            </div>
            <div
              className="translation-choices"
              id="translation-choices"
              aria-label="Available translations"
            >
              {availableTranslations.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={translation === item.id}
                  className={translation === item.id ? 'selected' : ''}
                  onClick={() => {
                    setTranslation(item.id);
                    setTab('Scripture');
                  }}
                >
                  {item.id}
                </button>
              ))}
              <button
                disabled={availableTranslations.length < 2}
                aria-pressed={tab === 'Compare'}
                className={
                  tab === 'Compare'
                    ? 'selected compare-choice'
                    : 'compare-choice'
                }
                onClick={() =>
                  setTab(tab === 'Compare' ? 'Scripture' : 'Compare')
                }
              >
                ＋ Compare
              </button>
            </div>
            <div
              className={`scripture-reading ${tab === 'Compare' ? 'is-comparing' : ''}`}
            >
              {[translation, ...(tab === 'Compare' ? [comparison] : [])].map(
                (id, index) => (
                  <section
                    className="translation-column"
                    key={`${id}-${index}`}
                  >
                    {tab === 'Compare' && (
                      <label className="translation-select-label">
                        {index ? 'Compare with' : 'Translation'}
                        <select
                          aria-label={
                            index ? 'Comparison translation' : 'Translation'
                          }
                          value={id}
                          onChange={(event) =>
                            index
                              ? setComparison(event.target.value)
                              : setTranslation(event.target.value)
                          }
                        >
                          {availableTranslations.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.id}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {renderText(id)}
                  </section>
                ),
              )}
            </div>
          </article>

          <div className="research-disclosures">
            <details id="cross-references" open={tab === 'Cross references'}>
              <summary>
                <span className="disclosure-icon">⌘</span>
                <span>
                  <strong>Cross References</strong>
                  <small>Related passages across Scripture</small>
                </span>
                <span className="disclosure-count">Explore</span>
              </summary>
              <Empty title="Follow the connections">
                Verified related passages will appear here when a
                cross-reference source is connected. ScriptureSmart AI can also
                help find related passages in the chat panel.
              </Empty>
            </details>
            <details id="commentary-insights" open={tab === 'Commentary'}>
              <summary>
                <span className="disclosure-icon">▤</span>
                <span>
                  <strong>Commentary Insights</strong>
                  <small>Research from verified sources</small>
                </span>
                <span className="disclosure-count">Sources</span>
              </summary>
              <Empty title="Commentary sources are not connected">
                No historical or modern commentary is currently available in the
                connected resource library. ScriptureSmart AI can discuss
                interpretive questions, clearly labeled as AI synthesis.
              </Empty>
            </details>
            <details id="church-history" open={tab === 'Interpretations'}>
              <summary>
                <span className="disclosure-icon">⌂</span>
                <span>
                  <strong>Church History</strong>
                  <small>Early Christian writings and creeds</small>
                </span>
                <span className="disclosure-count">Sources</span>
              </summary>
              <Empty title="Historical sources are not connected">
                No primary historical documents have been retrieved for this
                passage yet.
              </Empty>
            </details>
            <details id="original-language" open={tab === 'Original language'}>
              <summary>
                <span className="disclosure-icon">ΑΩ</span>
                <span>
                  <strong>
                    {testamentForReference(passage) === 'old'
                      ? 'Hebrew → English'
                      : 'Greek → English'}
                  </strong>
                  <small>
                    Word-level data is shown with AI study results when supplied
                    by the source
                  </small>
                </span>
                <span className="disclosure-count">Explore</span>
              </summary>
              <Empty title="Open original-language annotations appear with a Bible research answer">
                Some chapters include Strong’s identifiers, lemmas, or
                morphology. Transliteration and gloss are shown only if the
                source provides them; unavailable lexical fields are left blank.
              </Empty>
            </details>
            <details id="reading-plans">
              <summary>
                <span className="disclosure-icon">◷</span>
                <span>
                  <strong>Reading Plans</strong>
                  <small>Guided reading over time</small>
                </span>
                <span className="disclosure-count">Explore</span>
              </summary>
              <Empty title="No reading plan is connected">
                Reading plan content will appear when a verified source is
                available.
              </Empty>
            </details>
            <details id="maps-timelines">
              <summary>
                <span className="disclosure-icon">⌖</span>
                <span>
                  <strong>Maps & Timelines</strong>
                  <small>Geography and historical context</small>
                </span>
                <span className="disclosure-count">Explore</span>
              </summary>
              <Empty title="Map resources are not connected">
                Verified maps and historical timelines have not been added to
                this workspace.
              </Empty>
            </details>
            <details id="study-notes" open={tab === 'Notes'}>
              <summary>
                <span className="disclosure-icon">▧</span>
                <span>
                  <strong>My Notes</strong>
                  <small>Your reflections and study notes</small>
                </span>
                <span className="disclosure-count">
                  {notes.filter((item) => item.passage === passage).length}
                </span>
              </summary>
              <div className="study-notes-content">
                <form className="form-stack" onSubmit={saveNote}>
                  <label>
                    New personal note
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="What do you notice in the passage?"
                      required
                    />
                  </label>
                  <button className="button primary" disabled={!note.trim()}>
                    Save note
                  </button>
                </form>
                {notes
                  .filter((item) => item.passage === passage)
                  .map((item) => (
                    <article
                      className="note-card study-note-card"
                      key={item.id}
                    >
                      <div className="note-meta">
                        <Badge>USER NOTE</Badge>
                        <span>Private · This device</span>
                      </div>
                      <p className="preserve">{item.text}</p>
                      <div className="editor-toolbar">
                        <button
                          className="text-button"
                          onClick={() => send(item.text)}
                        >
                          Send to The Table
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            setActiveNoteId(
                              activeNoteId === item.id ? null : item.id,
                            )
                          }
                        >
                          {activeNoteId === item.id
                            ? 'Close note questions'
                            : 'Ask AI about this note'}
                        </button>
                      </div>
                      {activeNoteId === item.id && (
                        <AssistantPanel
                          key={`note-ai-${item.id}`}
                          allowScripture
                          fumsUserId={fumsUserId}
                          baseContext={{
                            passageReference: passage,
                            translationIds: [translation, comparison],
                          }}
                          choices={noteChoices([item])}
                          suggestions={[
                            'Review my note',
                            'Find passages that clarify this note',
                            'Identify a question I have not resolved',
                            'Organize this note into a teaching outline',
                          ]}
                          onInsert={(text, question) =>
                            saveNotes([
                              {
                                id: crypto.randomUUID(),
                                passage,
                                text: `[AI SYNTHESIS]\nQuestion: ${question ?? 'Question about saved note'}\nBased on note: ${item.text}\n\n${text}`,
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
                {notes.length > 0 && (
                  <div className="note-review-actions">
                    <span>Ask AI to review your notes</span>
                    <AssistantPanel
                      key={`notes-review-${passage}`}
                      allowScripture
                      fumsUserId={fumsUserId}
                      baseContext={{
                        passageReference: passage,
                        translationIds: [translation, comparison],
                      }}
                      choices={noteChoices(
                        notes.filter((item) => item.passage === passage),
                      )}
                      suggestions={[
                        'Summarize my notes',
                        'Identify recurring themes',
                        'Find unresolved questions',
                        'Organize my notes into a sermon outline',
                        'Suggest supporting passages',
                      ]}
                      onInsert={(text, question) =>
                        saveNotes([
                          {
                            id: crypto.randomUUID(),
                            passage,
                            text: `[AI SYNTHESIS]\nQuestion: ${question ?? 'Review my notes'}\n\n${text}`,
                            visibility: 'private',
                            ownerId: 'local-user',
                          },
                          ...notes,
                        ])
                      }
                    />
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>

        <AssistantPanel
          allowScripture
          fumsUserId={fumsUserId}
          key={`${passage}:${translation}:${comparison}`}
          baseContext={{
            passageReference: passage,
            translationIds: [translation, comparison],
          }}
          initialPrompt={initialQuestion}
          suggestions={[
            'Explain this passage',
            'Compare translations',
            'What did early Christians say?',
            'Explore key Greek words',
            'Build teaching notes',
            'Help me apply this passage',
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
      </div>
      <div className="integrity-note">
        Scripture, verified resources, personal notes, and AI synthesis remain
        clearly identified.
      </div>
    </section>
  );
}
