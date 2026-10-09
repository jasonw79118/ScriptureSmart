import { normalizeReference, suggestedReferences } from '../domain/bible';
import { useEffect, useRef, useState } from 'react';
import {
  AIError,
  recentExchanges,
  type AIExchange,
  guideSections,
  type AIContext,
  type AIResponse,
  type AITaskType,
} from '../domain/ai';
import { aiService } from './client';
import { reportApiBibleViews } from './fums';
import { Badge } from '../components';
import './ai.css';
import type { StudyChat } from '../domain/models';

export interface ContextChoice {
  id: string;
  label: string;
  context: AIContext;
}

export function AssistantPanel({
  taskType = 'general',
  allowScripture = false,
  baseContext = {},
  choices = [],
  suggestions,
  initialPrompt = '',
  actionLabel = 'Ask ScriptureSmart',
  onInsert,
  insertLabel = 'Insert into notes',
  onReplace,
  onInsertGuide,
  fumsUserId,
  studyChats = [],
  onSaveStudyChat,
  onSendStudyToSermon,
  onOpenStudyChat,
}: {
  taskType?: AITaskType;
  allowScripture?: boolean;
  baseContext?: AIContext;
  choices?: ContextChoice[];
  suggestions: string[];
  initialPrompt?: string;
  actionLabel?: string;
  onInsert?: (text: string, question?: string) => void;
  insertLabel?: string;
  onReplace?: (text: string) => void;
  onInsertGuide?: (sections: NonNullable<AIResponse['sections']>) => void;
  fumsUserId?: string;
  studyChats?: StudyChat[];
  onSaveStudyChat?: (chat: StudyChat) => void;
  onSendStudyToSermon?: (chat: StudyChat) => void;
  onOpenStudyChat?: (chat: StudyChat) => void;
}) {
  const chatMode = allowScripture;
  const [isSmallScreen, setIsSmallScreen] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 720px)').matches,
  );
  const [open, setOpen] = useState(
    () =>
      chatMode &&
      !(
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 720px)').matches
      ),
  );
  const [prompt, setPrompt] = useState('');
  const [includeScripture, setIncludeScripture] = useState(allowScripture);
  const [customReferences, setCustomReferences] = useState<string | null>(null);
  const referenceText =
    customReferences ??
    suggestedReferences(prompt, baseContext.passageReference).join('; ');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [notice, setNotice] = useState('');
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [edited, setEdited] = useState('');
  const [conversation, setConversation] = useState<AIExchange[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [editedSections, setEditedSections] =
    useState<AIResponse['sections']>();
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const operation = useRef(0);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => {
      setIsSmallScreen(media.matches);
      setOpen(chatMode && !media.matches);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [chatMode]);

  useEffect(() => {
    if (!chatMode || !isSmallScreen || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [chatMode, isSmallScreen, open]);

  useEffect(
    () => () => {
      operation.current++;
      controller.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!initialPrompt.trim()) return;
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  function cancel() {
    operation.current++;
    controller.current?.abort();
    setBusy(false);
    setNotice('Request cancelled. Your document is unchanged.');
  }

  const activeSavedChat = studyChats.find((chat) => chat.id === activeChatId);

  function selectedContext() {
    const context: AIContext = {
      ...baseContext,
      ...(activeSavedChat?.passageReference
        ? { passageReference: activeSavedChat.passageReference }
        : {}),
      ...(activeSavedChat?.translationIds.length
        ? { translationIds: activeSavedChat.translationIds }
        : {}),
    };
    const activeChoices = chatMode
      ? choices
      : choices.filter((c) => selected.includes(c.id));
    for (const choice of activeChoices) {
      Object.assign(context, choice.context);
    }
    return context;
  }

  function referencesFor(question: string) {
    if (chatMode) {
      const fromQuestion = suggestedReferences(question, '');
      if (fromQuestion.length) return fromQuestion;
      if (customReferences) {
        return customReferences
          .split(';')
          .map((r) => normalizeReference(r))
          .filter((r): r is string => !!r);
      }
      return suggestedReferences(
        question,
        activeSavedChat?.passageReference ?? baseContext.passageReference,
      );
    }
    return referenceText
      .split(';')
      .map((r) => normalizeReference(r))
      .filter((r): r is string => !!r);
  }

  async function ask(isFollowUp = false) {
    const question = (isFollowUp ? followUp : prompt).trim();
    if (!question || busy) return;

    const context = selectedContext();
    if (taskType === 'discussion-guide' && !context.sermon?.trim()) {
      setError(
        'Add sermon material in the editor and select it below before generating a guide.',
      );
      return;
    }

    const references = referencesFor(question);
    if (
      includeScripture &&
      !chatMode &&
      (!references.length ||
        references.length > 6 ||
        referenceText.split(';').some((r) => !normalizeReference(r)))
    ) {
      setError(
        'Enter one to six Bible references separated by semicolons, such as Ephesians 1:3-14; Romans 8:14-30. Use full book names and a single chapter per reference.',
      );
      setNeedsSignIn(false);
      return;
    }

    const generation = ++operation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setNeedsSignIn(false);
    setNotice('');
    if (!isFollowUp) setResponse(null);
    setConfirmReplace(false);

    try {
      const reviewedConversation = conversation.map((turn, i) =>
        i === conversation.length - 1 ? { ...turn, answer: edited } : turn,
      );
      const result = await aiService.generate(
        {
          taskType,
          prompt: question,
          ...(isFollowUp
            ? { conversation: recentExchanges(reviewedConversation) }
            : {}),
          context,
          ...(includeScripture && references.length
            ? { bible: { references } }
            : {}),
        },
        abort.signal,
      );
      if (generation !== operation.current) return;
      const nextConversation = isFollowUp
        ? [...reviewedConversation, { question, answer: result.text }]
        : [{ question, answer: result.text }];
      setConversation(nextConversation);
      if (chatMode) {
        const chatId = activeChatId ?? crypto.randomUUID();
        setActiveChatId(chatId);
        onSaveStudyChat?.({
          id: chatId,
          title:
            activeSavedChat?.title ??
            nextConversation[0].question.slice(0, 100),
          passageReference:
            activeSavedChat?.passageReference ??
            baseContext.passageReference ??
            '',
          translationIds:
            activeSavedChat?.translationIds ?? baseContext.translationIds ?? [],
          exchanges: nextConversation,
          updatedAt: new Date().toISOString(),
        });
      }
      if (includeScripture) setCustomReferences(references.join('; '));
      setFollowUp('');
      if (chatMode) setPrompt('');
      setResponse(result);
      if (result.bibleResearch) {
        void reportApiBibleViews(
          [
            result.bibleResearch.selectedTranslation?.fumsToken,
            ...result.bibleResearch.comparisonTranslations.map(
              (translation) => translation.fumsToken,
            ),
          ],
          fumsUserId,
        );
      }
      setEdited(result.text);
      setEditedSections(result.sections);
    } catch (e) {
      if (generation !== operation.current || abort.signal.aborted) return;
      setNeedsSignIn(
        e instanceof AIError &&
          (e.code === 'sign-in' || e.code === 'forbidden'),
      );
      setError(
        e instanceof AIError
          ? e.message
          : 'Unable to complete this request. Please try again.',
      );
    } finally {
      if (generation === operation.current) setBusy(false);
    }
  }

  function startNewConversation() {
    cancel();
    setConversation([]);
    setActiveChatId(null);
    setResponse(null);
    setEdited('');
    setFollowUp('');
    setError('');
    setNeedsSignIn(false);
    setNotice('New conversation started. Saved notes are unchanged.');
    setCustomReferences(null);
    setSelected([]);
    setPrompt('');
  }

  function openSavedChat(chat: StudyChat) {
    setActiveChatId(chat.id);
    setConversation(chat.exchanges);
    setResponse(null);
    setEdited(chat.exchanges.at(-1)?.answer ?? '');
    setFollowUp('');
    setPrompt('');
    setError('');
    setNeedsSignIn(false);
    setNotice('Opened saved conversation. Follow-ups will continue this chat.');
    onOpenStudyChat?.(chat);
  }

  const chatForSermon: StudyChat | undefined = conversation.length
    ? {
        id: activeChatId ?? '',
        title:
          studyChats.find((chat) => chat.id === activeChatId)?.title ??
          conversation[0].question.slice(0, 100),
        passageReference:
          activeSavedChat?.passageReference ??
          baseContext.passageReference ??
          '',
        translationIds:
          activeSavedChat?.translationIds ?? baseContext.translationIds ?? [],
        exchanges: conversation,
        updatedAt: activeSavedChat?.updatedAt ?? '',
      }
    : undefined;

  const textToInsert = editedSections
    ? guideSections.map((k) => `${k}\n${editedSections[k]}`).join('\n\n')
    : edited;
  const latestQuestion = conversation.at(-1)?.question;
  const composerValue = conversation.length ? followUp : prompt;
  const setComposerValue = conversation.length ? setFollowUp : setPrompt;

  function sourcesPanel() {
    if (!response?.scriptureSources?.length) return null;
    return (
      <section aria-label="Retrieved Bible sources">
        <h3>Bible passages used</h3>
        <p>
          World English Bible (WEB), public domain. Retrieved via bible-api.com.
          These are source passages, not verification of every AI claim.
        </p>
        {response.scriptureSources.map((source) => (
          <details key={source.reference}>
            <summary>
              {source.reference} ({source.translation})
            </summary>
            <p className="preserve">{source.text}</p>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              View passage source
            </a>
          </details>
        ))}
      </section>
    );
  }

  function researchPanel() {
    const research = response?.bibleResearch;
    if (!research) return null;
    const selected = research.selectedTranslation;
    const rightsSummary = (rights: NonNullable<typeof selected>['rights']) =>
      `Rights: display ${rights.displayAllowed ? 'allowed' : 'unavailable'}; AI context ${rights.aiContextAllowed ? 'allowed' : 'not allowed'}; local saving ${rights.localStorageAllowed ? 'allowed' : 'not allowed'}; commercial use ${rights.commercialUseAllowed ? 'allowed' : 'not confirmed'}.`;
    return (
      <section
        className="bible-research-results"
        aria-label="Bible research sources"
      >
        <h3>Passage research · {research.reference}</h3>
        <p className="muted">
          The selected Bible wording is shown above. ScriptureSmart AI explains
          it in present-day English below; that explanation is AI synthesis, not
          a replacement Bible translation.
        </p>
        {selected ? (
          <details>
            <summary>
              <Badge>SELECTED TRANSLATION</Badge> {selected.id} · Retrieved text
            </summary>
            <p className="preserve">{selected.text}</p>
            <small>{selected.attribution}</small>
            <small>{rightsSummary(selected.rights)}</small>
          </details>
        ) : (
          <p>
            The selected translation could not be retrieved for this request.
          </p>
        )}
        {research.comparisonTranslations.map((item) => (
          <details key={item.id}>
            <summary>
              <Badge>TRANSLATION COMPARISON</Badge> {item.id}
            </summary>
            <p className="preserve">{item.text}</p>
            <small>{item.attribution}</small>
            <small>{rightsSummary(item.rights)}</small>
          </details>
        ))}
        <details>
          <summary>
            <Badge>FREE USE BIBLE API</Badge> {research.openTranslation.id} ·
            Open research text
          </summary>
          {research.openTranslation.verses.length ? (
            research.openTranslation.verses.map((verse) => (
              <p key={verse.verse}>
                <b>{verse.verse}</b> {verse.text}
              </p>
            ))
          ) : (
            <p>Open translation text was unavailable.</p>
          )}
        </details>
        <details open>
          <summary>
            <Badge>CROSS REFERENCE</Badge> Open Bible links (
            {research.crossReferences.length})
          </summary>
          {research.crossReferences.length ? (
            <ul>
              {research.crossReferences.map((ref) => (
                <li key={ref.reference}>
                  {ref.reference}
                  {ref.score !== undefined ? ` · score ${ref.score}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>No cross references were returned for this passage.</p>
          )}
          <small>
            Source:{' '}
            <a
              href="https://www.openbible.info/labs/cross-references/"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenBible.info dataset via Free Use Bible API
            </a>
          </small>
        </details>
        <details>
          <summary>
            <Badge>{research.originalLanguage.language.toUpperCase()}</Badge>{' '}
            {research.originalLanguage.language} → English (
            {research.originalLanguage.words.length})
          </summary>
          {research.originalLanguage.words.length ? (
            <>
              <p className="muted">
                The open dataset provides English-word anchors, Strong’s
                numbers, lemmas, or morphology where available. It does not
                provide original-script forms or direct glosses here, so those
                will not be guessed.
              </p>
              <ul>
                {research.originalLanguage.words.map((word, i) => (
                  <li key={`${word.verse}-${i}`}>
                    {word.text ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSelectedWord(i)}
                      >
                        {word.text}
                      </button>
                    ) : (
                      `Verse ${word.verse}`
                    )}
                    {word.lemma ? ` · lemma: ${word.lemma}` : ''}
                    {word.strongs?.length
                      ? ` · ${word.strongs.join(', ')}`
                      : ''}
                    {word.morph ? ` · morphology: ${word.morph}` : ''}
                    {word.occurrences
                      ? ` · occurrences: ${word.occurrences}`
                      : ''}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              Word-level annotations are not available for this passage. No
              gloss or transliteration is inferred.
            </p>
          )}
          {selectedWord !== null &&
            research.originalLanguage.words[selectedWord] && (
              <p role="status">
                Selected source word:{' '}
                {research.originalLanguage.words[selectedWord].text ??
                  `verse ${research.originalLanguage.words[selectedWord].verse}`}
                . Fields shown above come from the source; the selected
                translation wording is not a one-to-one lexical gloss.
              </p>
            )}
          <small>
            Strong’s identifiers and fields shown only when supplied by the
            source.
          </small>
        </details>
        <details>
          <summary>
            <Badge>COMMENTARY</Badge> Retrieved commentary (
            {research.commentaries.length})
          </summary>
          {research.commentaries.length ? (
            research.commentaries.map((item) => (
              <article key={item.id}>
                <h4>{item.name}</h4>
                <pre className="preserve">{item.text}</pre>
                {item.website && (
                  <a
                    href={item.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open commentary source
                  </a>
                )}
                {item.licenseUrl && (
                  <a
                    href={item.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    License and source information
                  </a>
                )}
              </article>
            ))
          ) : (
            <p>No matching commentary was returned.</p>
          )}
        </details>
        {research.entities.length > 0 && (
          <details>
            <summary>
              <Badge>FREE USE BIBLE API</Badge> People, places, and events
            </summary>
            <ul>
              {research.entities.map((entity) => (
                <li key={`${entity.type}-${entity.name}`}>
                  {entity.name} · {entity.type}
                </li>
              ))}
            </ul>
          </details>
        )}
        {research.unavailable.map((item) => (
          <p className="muted" key={item}>
            {item} are unavailable for this passage.
          </p>
        ))}
        <small>
          Source material is kept separate from the ScriptureSmart AI synthesis
          above.
        </small>
      </section>
    );
  }

  return (
    <section
      className={`panel ai-assistant${chatMode ? ' study-chat-assistant' : ''}${isSmallScreen && open ? ' mobile-chat-open' : ''}`}
    >
      <div className="section-heading">
        <div>
          <Badge>Built-in assistant</Badge>
          <h2>{chatMode ? 'Ask ScriptureSmart' : 'ScriptureSmart AI'}</h2>
          {chatMode && (
            <p>
              Ask follow-up questions. Recent conversations stay in this browser
              and do not sync to other devices.
            </p>
          )}
        </div>
        {(!chatMode || isSmallScreen) && (
          <button
            className={`button secondary${chatMode ? ' mobile-chat-toggle' : ''}`}
            aria-expanded={open}
            onClick={() => {
              if (busy && !open) cancel();
              setOpen(!open);
            }}
          >
            {open
              ? chatMode
                ? 'Close chat'
                : 'Close assistant'
              : chatMode
                ? 'Open chat'
                : 'Ask ScriptureSmart'}
          </button>
        )}
      </div>
      {open && (
        <div className={chatMode ? 'ai-chat' : 'form-stack'}>
          {chatMode ? (
            <>
              {studyChats.length > 0 && (
                <details className="ai-chat-history">
                  <summary>Chat history ({studyChats.length})</summary>
                  <div className="ai-chat-history-list">
                    {studyChats.map((chat) => (
                      <button
                        className="button secondary"
                        key={chat.id}
                        aria-current={
                          activeChatId === chat.id ? 'true' : undefined
                        }
                        disabled={busy}
                        onClick={() => openSavedChat(chat)}
                      >
                        <strong>{chat.title}</strong>
                        <span>{chat.passageReference || 'General study'}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              {conversation.length === 0 && (
                <div className="ai-chat-empty">
                  {suggestions.slice(0, 4).map((s) => (
                    <button
                      className="button secondary"
                      key={s}
                      disabled={busy}
                      onClick={() => setPrompt(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p>
                Send a question and the source material you choose. Review the
                draft before inserting it. Bible retrieval uses the passage list
                below when enabled. Commentary is not connected.
              </p>
              <div className="ai-suggestions" aria-label="Suggested AI prompts">
                {suggestions.map((s) => (
                  <button
                    className="button secondary"
                    key={s}
                    disabled={busy}
                    onClick={() => setPrompt(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label>
                Ask ScriptureSmart
                <textarea
                  placeholder={
                    chatMode && baseContext.passageReference
                      ? `Ask a question about ${baseContext.passageReference}...`
                      : undefined
                  }
                  aria-label="Ask ScriptureSmart prompt"
                  value={prompt}
                  maxLength={6000}
                  rows={4}
                  disabled={busy}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
              {allowScripture && (
                <fieldset disabled={busy}>
                  <legend>Bible sources for this question</legend>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={includeScripture}
                      onChange={(e) => setIncludeScripture(e.target.checked)}
                    />
                    Retrieve Bible passages (World English Bible)
                  </label>
                  {includeScripture && (
                    <>
                      <label>
                        Passages to retrieve
                        <textarea
                          aria-label="Passages to retrieve"
                          rows={3}
                          value={referenceText}
                          onChange={(e) => setCustomReferences(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setCustomReferences(null)}
                      >
                        Suggest passages from my question
                      </button>
                      <p>
                        WEB is public domain. These references are sent to
                        bible-api.com; your question and notes are not. Up to
                        six passages, separated by semicolons.
                      </p>
                    </>
                  )}
                </fieldset>
              )}
              <fieldset disabled={busy}>
                <legend>Context to send</legend>
                <p>
                  {baseContext.passageReference
                    ? `Passage reference: ${baseContext.passageReference}. `
                    : ''}
                  {baseContext.translationIds?.length
                    ? `Translation names: ${baseContext.translationIds.join(', ')}. `
                    : ''}
                  Names and references do not include the source text.
                </p>
                {choices.map((choice) => (
                  <div key={choice.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={selected.includes(choice.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, choice.id]
                              : selected.filter((id) => id !== choice.id),
                          )
                        }
                      />
                      {choice.label}
                    </label>
                    <details>
                      <summary>Preview {choice.label.toLowerCase()}</summary>
                      <pre className="ai-context-preview">
                        {JSON.stringify(choice.context, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
                {!choices.length && (
                  <p>
                    No saved content is selected. Your prompt, reference
                    information, and any enabled Bible passages will be used.
                  </p>
                )}
              </fieldset>
              <small>
                Selected content is sent to the hosted AI service when you press{' '}
                {actionLabel}. It does not include your other drafts, church
                discussions, or unselected notes.
              </small>
              <div className="editor-toolbar">
                <button
                  className="button primary"
                  disabled={busy || !prompt.trim()}
                  onClick={() => void ask()}
                >
                  {busy ? 'ScriptureSmart is working...' : actionLabel}
                </button>
                {busy && (
                  <button className="button secondary" onClick={cancel}>
                    Cancel request
                  </button>
                )}
              </div>
              {busy && (
                <p className="muted" role="status">
                  {baseContext.passageReference
                    ? `Studying ${baseContext.passageReference}. `
                    : ''}
                  Retrieving your selected translation and available open Bible
                  research, then preparing the ScriptureSmart AI synthesis…
                </p>
              )}
            </>
          )}

          {error && (
            <div role="alert" className="alert">
              {error} <a href="#connections">AI service status</a>
              {needsSignIn && (
                <>
                  {' '}
                  - <a href="#member-login">Member sign-in</a>
                </>
              )}
            </div>
          )}
          {notice && <p role="status">{notice}</p>}

          {(response || (chatMode && conversation.length > 0)) && (
            <section
              className={chatMode ? 'ai-chat-thread' : 'ai-result form-stack'}
              aria-label={chatMode ? 'Study chat' : 'AI draft review'}
            >
              {chatMode ? (
                conversation.map((turn, i) => (
                  <article className="ai-chat-turn" key={i}>
                    <div className="ai-chat-message user">
                      <p>{turn.question}</p>
                    </div>
                    <div className="ai-chat-message assistant">
                      <Badge>AI SYNTHESIS</Badge>
                      <p className="preserve">
                        {i === conversation.length - 1 ? edited : turn.answer}
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <>
                  {allowScripture && conversation.length > 1 && (
                    <details>
                      <summary>
                        Earlier questions and answers ({conversation.length - 1}
                        )
                      </summary>
                      {conversation.slice(0, -1).map((turn, i) => (
                        <article key={i} className="note-card">
                          <h4>{turn.question}</h4>
                          <p className="preserve">{turn.answer}</p>
                        </article>
                      ))}
                    </details>
                  )}
                  {allowScripture && conversation.length > 0 && (
                    <h3>{conversation[conversation.length - 1].question}</h3>
                  )}
                  <Badge>AI SYNTHESIS - Draft for review</Badge>
                </>
              )}

              {response?.warnings?.map((w, i) => (
                <p className="muted" key={i}>
                  {w}
                </p>
              ))}
              {sourcesPanel()}
              {researchPanel()}

              {editedSections ? (
                guideSections.map((k) => (
                  <label key={k}>
                    {k} draft
                    <textarea
                      aria-label={`${k} AI draft`}
                      value={editedSections[k]}
                      onChange={(e) => {
                        setEditedSections({
                          ...editedSections,
                          [k]: e.target.value,
                        });
                        setConfirmReplace(false);
                      }}
                      rows={4}
                    />
                  </label>
                ))
              ) : !chatMode ? (
                <label>
                  Editable AI draft
                  <textarea
                    aria-label="Editable AI draft"
                    value={edited}
                    onChange={(e) => {
                      setEdited(e.target.value);
                      setConfirmReplace(false);
                    }}
                    rows={10}
                  />
                </label>
              ) : null}

              <div className="editor-toolbar">
                {onInsertGuide && editedSections && (
                  <button
                    className="button primary"
                    onClick={() => {
                      onInsertGuide(editedSections);
                      setNotice(
                        'AI sections appended to your guide. Existing content was kept.',
                      );
                    }}
                  >
                    Insert guide sections
                  </button>
                )}
                {onInsert && (
                  <button
                    className="button secondary"
                    disabled={!textToInsert.trim()}
                    onClick={() => {
                      onInsert(textToInsert, latestQuestion);
                      setNotice(
                        chatMode
                          ? 'Answer saved to your notes.'
                          : 'AI draft inserted. You can continue editing it in your document.',
                      );
                    }}
                  >
                    {chatMode ? 'Save answer to notes' : insertLabel}
                  </button>
                )}
                {chatMode && onSendStudyToSermon && chatForSermon && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      onSendStudyToSermon(chatForSermon);
                      setNotice('Study conversation sent to Sermon Build.');
                    }}
                  >
                    Send to Sermon Build
                  </button>
                )}
                {onReplace && (
                  <button
                    className="button secondary"
                    disabled={!textToInsert.trim()}
                    onClick={() => setConfirmReplace(true)}
                  >
                    Replace selected section
                  </button>
                )}
              </div>

              {confirmReplace && (
                <div className="subtle-box">
                  <p>
                    This replaces the current section with the reviewed AI
                    draft.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => {
                      onReplace?.(textToInsert);
                      setConfirmReplace(false);
                      setNotice('Selected section replaced by your request.');
                    }}
                  >
                    Confirm replacement
                  </button>{' '}
                  <button
                    className="button secondary"
                    onClick={() => setConfirmReplace(false)}
                  >
                    Keep existing section
                  </button>
                </div>
              )}

              {!chatMode && allowScripture && (
                <section
                  className="form-stack"
                  aria-label="Continue this study"
                >
                  <h3>Ask a follow-up</h3>
                  {error && <p className="alert">{error}</p>}
                  <p>
                    The latest four exchanges, your current edited answer, and
                    the selected Bible passages are used. Earlier answers remain
                    AI synthesis.
                  </p>
                  <label>
                    Follow-up question
                    <textarea
                      aria-label="Follow-up question"
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
                      rows={3}
                      maxLength={6000}
                      disabled={busy}
                      placeholder="What do you mean by adoption as the goal?"
                    />
                  </label>
                  <div className="editor-toolbar">
                    <button
                      className="button primary"
                      disabled={busy || !followUp.trim()}
                      onClick={() => void ask(true)}
                    >
                      {busy ? 'Working on your follow-up...' : 'Ask follow-up'}
                    </button>
                    <button
                      className="button secondary"
                      onClick={startNewConversation}
                    >
                      Start new conversation
                    </button>
                    {busy && (
                      <button className="button secondary" onClick={cancel}>
                        Cancel follow-up
                      </button>
                    )}
                  </div>
                </section>
              )}

              {response && (
                <details>
                  <summary>Advanced response information</summary>
                  <p>
                    Provider: {response.provider}
                    <br />
                    Model: {response.model}
                    <br />
                    Generated: {response.createdAt}
                  </p>
                </details>
              )}
            </section>
          )}

          {chatMode && (
            <section className="ai-chat-composer" aria-label="Study question">
              <label className="sr-only" htmlFor="study-chat-prompt">
                Study question
              </label>
              <textarea
                id="study-chat-prompt"
                aria-label="Study question"
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                rows={3}
                maxLength={6000}
                disabled={busy}
                placeholder="Ask anything about this passage or topic..."
              />
              <div className="editor-toolbar">
                <button
                  className="button primary"
                  disabled={busy || !composerValue.trim()}
                  onClick={() => void ask(conversation.length > 0)}
                >
                  {busy ? 'ScriptureSmart is working...' : 'Send'}
                </button>
                {conversation.length > 0 && (
                  <button
                    className="button secondary"
                    onClick={startNewConversation}
                  >
                    New chat
                  </button>
                )}
                {busy && (
                  <button className="button secondary" onClick={cancel}>
                    Cancel
                  </button>
                )}
              </div>
              <small>
                ScriptureSmart finds relevant Bible passages automatically and
                shows the passages it used after each answer.
              </small>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
