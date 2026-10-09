import { AssistantPanel, type ContextChoice } from '../ai/AssistantPanel';
import { useEffect, useRef, useState } from 'react';
import type { Note, StudyChat, TableItem } from '../domain/models';
import {
  defaultComparisonTranslationId,
  defaultTranslationId,
  translations,
} from '../domain/providers';
import { Badge, Empty } from '../components';
import {
  getBiblePassage,
  getBibleResearch,
  type BiblePassageResult,
  type OpenBibleResearchResult,
} from '../ai/bibleClient';
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
  studyChats,
  saveStudyChat,
  sendStudyToSermon,
  openStudyChat,
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
  studyChats: StudyChat[];
  saveStudyChat: (chat: StudyChat) => void;
  sendStudyToSermon: (chat: StudyChat) => void;
  openStudyChat: (chat: StudyChat) => void;
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
  const [inputState, setInputState] = useState({ passage, value: passage });
  const input = inputState.passage === passage ? inputState.value : passage;
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
  const [passageRetry, setPassageRetry] = useState(0);
  const [openResearch, setOpenResearch] =
    useState<OpenBibleResearchResult | null>(null);
  const [openResearchLoading, setOpenResearchLoading] = useState(false);
  const [openResearchError, setOpenResearchError] = useState('');
  const inFlightPassages = useRef(new Map<string, AbortController>());
  const passageTextsRef = useRef(passageTexts);
  const passageErrorsRef = useRef(passageErrors);

  useEffect(() => {
    passageTextsRef.current = passageTexts;
  }, [passageTexts]);

  useEffect(() => {
    passageErrorsRef.current = passageErrors;
  }, [passageErrors]);

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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setOpenResearch(null);
    setOpenResearchError('');
    setOpenResearchLoading(true);
    void getBibleResearch(passage, controller.signal)
      .then((research) => {
        if (active) setOpenResearch(research);
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setOpenResearchError(
          error instanceof AIError
            ? error.message
            : 'Passage research could not be loaded.',
        );
      })
      .finally(() => {
        if (active) setOpenResearchLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [passage, fumsUserId]);

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
    const requestKeys: string[] = [];
    const inFlight = inFlightPassages.current;
    let active = true;
    const ids = tab === 'Compare' ? [translation, comparison] : [translation];
    for (const id of ids) {
      const key = `${id}:${passage}`;
      if (
        passageTextsRef.current[key] ||
        passageErrorsRef.current[key] ||
        inFlight.has(key)
      )
        continue;
      const controller = new AbortController();
      controllers.push(controller);
      requestKeys.push(key);
      inFlight.set(key, controller);
      setLoadingPassages((current) => ({ ...current, [key]: true }));
      setPassageErrors((current) => ({ ...current, [key]: '' }));
      void getBiblePassage(passage, id, controller.signal)
        .then((result) => {
          if (!active) return;
          setPassageTexts((current) => ({ ...current, [key]: result }));
          void reportApiBibleViews([result.fumsToken], fumsUserId);
        })
        .catch((error) => {
          if (!active || controller.signal.aborted) return;
          setPassageErrors((current) => ({
            ...current,
            [key]:
              error instanceof AIError
                ? error.message
                : 'Bible text could not be loaded.',
          }));
        })
        .finally(() => {
          if (inFlight.get(key) === controller) inFlight.delete(key);
          if (active)
            setLoadingPassages((current) => ({ ...current, [key]: false }));
        });
    }
    return () => {
      active = false;
      controllers.forEach((controller, index) => {
        controller.abort();
        const key = requestKeys[index];
        if (inFlight.get(key) === controller) inFlight.delete(key);
      });
    };
  }, [tab, passage, translation, comparison, fumsUserId, passageRetry]);

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
          {id === 'KJV' || id === 'WEB' ? (
            <button
              className="text-button"
              onClick={() => {
                setPassageErrors((current) => ({ ...current, [key]: '' }));
                setPassageRetry((retry) => retry + 1);
              }}
            >
              Try loading again
            </button>
          ) : (
            <>
              <button
                className="text-button"
                onClick={() => {
                  setPassageErrors((current) => ({ ...current, [key]: '' }));
                  setPassageRetry((retry) => retry + 1);
                }}
              >
                Try loading again
              </button>
              <button className="text-button" onClick={connect}>
                View Bible connections
              </button>
            </>
          )}
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
            {result.translationId === 'KJV' || result.translationId === 'WEB'
              ? 'Open public-domain source ↗'
              : 'Open API.Bible ↗'}
          </a>
        </div>
        {result.rights && (
          <small className="muted">
            {result.rights.aiContextAllowed
              ? 'The source allows this text in AI study.'
              : 'This text is for display only and is not sent to AI.'}{' '}
            {result.rights.localStorageAllowed
              ? 'Browser saving is permitted by the source.'
              : 'It is not saved in browser storage.'}
            {!result.rights.commercialUseAllowed &&
              ' Commercial permission is not confirmed.'}
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
  const planReferences = [
    passage,
    ...(openResearch?.references ?? []).map((item) => item.reference),
  ]
    .filter((reference, index, all) => all.indexOf(reference) === index)
    .slice(0, 7);

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
              onChange={(event) =>
                setInputState({ passage, value: event.target.value })
              }
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
              <button
                onClick={() => setInputState({ passage, value: passage })}
              >
                ‹
              </button>
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
              <p>
                Start with the King James Version, then switch to the World
                English Bible for a modern-English reading.
              </p>
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
              {openResearchLoading ? (
                <p role="status">Finding sourced cross-references…</p>
              ) : openResearchError ? (
                <p role="alert">{openResearchError}</p>
              ) : openResearch?.references.length ? (
                <div className="study-source-results">
                  <p>
                    Related references from {openResearch.source}. Select one to
                    open it in the reader.
                  </p>
                  <ul>
                    {openResearch.references.slice(0, 20).map((item) => (
                      <li key={item.reference}>
                        <button
                          className="text-button"
                          onClick={() => setPassage(item.reference)}
                        >
                          {item.reference}
                        </button>
                        {item.score !== undefined && (
                          <small>Source score: {item.score}</small>
                        )}
                      </li>
                    ))}
                  </ul>
                  <small>Scores are provided by the source dataset.</small>
                </div>
              ) : (
                <Empty title="No cross-references returned for this passage">
                  The connected open research source did not return related
                  references for this range.
                </Empty>
              )}
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
              {openResearchLoading ? (
                <p role="status">Checking available commentary…</p>
              ) : openResearchError ? (
                <p role="alert">{openResearchError}</p>
              ) : openResearch?.commentaries.length ? (
                <div className="study-source-results">
                  {openResearch.commentaries.map((item) => (
                    <article key={item.id}>
                      <h3>{item.name}</h3>
                      <pre className="preserve">{item.text}</pre>
                      {item.website && (
                        <a href={item.website} target="_blank" rel="noreferrer">
                          Open source
                        </a>
                      )}{' '}
                      {item.licenseUrl && (
                        <a
                          href={item.licenseUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          License information
                        </a>
                      )}
                    </article>
                  ))}
                  <small>
                    Retrieved commentary is separate from AI synthesis.
                  </small>
                </div>
              ) : (
                <Empty title="No matching commentary returned">
                  The connected open research source did not provide a
                  commentary excerpt for this passage.
                </Empty>
              )}
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
              <div className="study-source-results">
                <p>
                  Passage-specific historical documents are not retrieved yet.
                  Browse these libraries of early Christian writings and Bible
                  study resources:
                </p>
                <ul>
                  <li>
                    <a
                      href="https://ccel.org/fathers"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Early Church Fathers · CCEL
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://bereanbibles.com/about-berean-study-bible/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      About the Berean Study Bible
                    </a>
                  </li>
                </ul>
                <small>
                  These links are reference resources, not claims that a source
                  discusses this exact passage.
                </small>
              </div>
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
              {openResearchLoading ? (
                <p role="status">Checking available word annotations…</p>
              ) : openResearchError ? (
                <p role="alert">{openResearchError}</p>
              ) : openResearch?.words.length ? (
                <div className="study-source-results">
                  <ul>
                    {openResearch.words.map((word, index) => (
                      <li key={`${word.verse}-${index}`}>
                        <strong>{word.text || `Verse ${word.verse}`}</strong>
                        {word.lemma && <span> · lemma: {word.lemma}</span>}
                        {word.strongs?.length ? (
                          <span> · {word.strongs.join(', ')}</span>
                        ) : null}
                        {word.morph && <span> · morphology: {word.morph}</span>}
                        {word.occurrences !== undefined && (
                          <span> · occurrences: {word.occurrences}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <small>
                    Source annotations. Original-script forms, transliteration,
                    and glosses are not supplied for every word; missing fields
                    are not guessed.
                  </small>
                </div>
              ) : (
                <Empty title="Open original-language annotations appear with a Bible research answer">
                  Some chapters include Strong’s identifiers, lemmas, or
                  morphology. Transliteration and gloss are shown only if the
                  source provides them; unavailable lexical fields are left
                  blank.
                </Empty>
              )}
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
              {openResearchLoading ? (
                <p role="status">Building a passage reading path…</p>
              ) : openResearchError ? (
                <p role="alert">{openResearchError}</p>
              ) : (
                <div className="study-source-results">
                  <p>
                    Suggested seven-session reading path using this passage and
                    returned cross-references. This is assembled from source
                    data, not a published reading plan.
                  </p>
                  <ol>
                    {planReferences.map((reference, index) => (
                      <li key={reference}>
                        <span>Session {index + 1}: </span>
                        <button
                          className="text-button"
                          onClick={() => setPassage(reference)}
                        >
                          {reference}
                        </button>
                      </li>
                    ))}
                  </ol>
                  {planReferences.length < 7 && (
                    <small>
                      The source returned {planReferences.length - 1}{' '}
                      cross-references for this passage.
                    </small>
                  )}
                </div>
              )}
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
              {openResearchLoading ? (
                <p role="status">Looking for people, places, and events…</p>
              ) : openResearchError ? (
                <p role="alert">{openResearchError}</p>
              ) : openResearch?.entities.length ? (
                <div className="study-source-results">
                  <p>
                    People, places, and events identified by the passage
                    research source:
                  </p>
                  <ul>
                    {openResearch.entities.map((item) => (
                      <li key={`${item.type}-${item.name}`}>
                        <strong>{item.name}</strong> · {item.type}
                      </li>
                    ))}
                  </ul>
                  <small>
                    Map coordinates and dated timelines are not supplied by this
                    source.
                  </small>
                </div>
              ) : (
                <Empty title="No place or event data returned for this passage">
                  The connected source did not identify map-linked entities.
                  Coordinates and timelines are not connected yet.
                </Empty>
              )}
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
          studyChats={studyChats}
          onSaveStudyChat={saveStudyChat}
          onSendStudyToSermon={sendStudyToSermon}
          onOpenStudyChat={openStudyChat}
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
