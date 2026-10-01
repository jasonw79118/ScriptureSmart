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
import { Badge } from '../components';
import './ai.css';

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
}) {
  const chatMode = allowScripture;
  const [open, setOpen] = useState(chatMode);
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
  const [followUp, setFollowUp] = useState('');
  const [editedSections, setEditedSections] =
    useState<AIResponse['sections']>();
  const [confirmReplace, setConfirmReplace] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const operation = useRef(0);

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

  function selectedContext() {
    const context: AIContext = { ...baseContext };
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
      return suggestedReferences(question, baseContext.passageReference);
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
      setConversation(
        isFollowUp
          ? [...reviewedConversation, { question, answer: result.text }]
          : [{ question, answer: result.text }],
      );
      if (includeScripture) setCustomReferences(references.join('; '));
      setFollowUp('');
      if (chatMode) setPrompt('');
      setResponse(result);
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
            <summary>{source.reference} (WEB)</summary>
            <p className="preserve">{source.text}</p>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              View passage source
            </a>
          </details>
        ))}
      </section>
    );
  }

  return (
    <section className="panel ai-assistant">
      <div className="section-heading">
        <div>
          <Badge>Built-in assistant</Badge>
          <h2>{chatMode ? 'Study Chat' : 'ScriptureSmart AI'}</h2>
        </div>
        {!chatMode && (
          <button
            className="button secondary"
            aria-expanded={open}
            onClick={() => {
              if (busy) cancel();
              setOpen(!open);
            }}
          >
            {open ? 'Close assistant' : 'Ask ScriptureSmart'}
          </button>
        )}
      </div>
      {open && (
        <div className={chatMode ? 'ai-chat' : 'form-stack'}>
          {chatMode ? (
            <>
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

          {response && (
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

              {response.warnings?.map((w, i) => (
                <p className="muted" key={i}>
                  {w}
                </p>
              ))}
              {sourcesPanel()}

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
