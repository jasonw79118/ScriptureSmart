import type { SermonNotesEntry } from '../domain/models';
import { exportText, timestamp } from '../utils';

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function newEntry(): SermonNotesEntry {
  return {
    id: crypto.randomUUID(),
    date: localDate(),
    speaker: '',
    title: '',
    passage: '',
    keyVerse: '',
    mainIdea: '',
    notes: '',
    application: '',
    questions: '',
    updatedAt: timestamp(),
  };
}

export function SermonNotes({
  entries,
  save,
  selectedId,
  select,
  openStudy,
}: {
  entries: SermonNotesEntry[];
  save: (entries: SermonNotesEntry[]) => void;
  selectedId: string;
  select: (id: string) => void;
  openStudy: (passage: string) => void;
}) {
  const current =
    entries.find((entry) => entry.id === selectedId) ??
    [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  function createEntry() {
    const entry = newEntry();
    save([entry, ...entries]);
    select(entry.id);
  }

  function update<K extends keyof SermonNotesEntry>(
    field: K,
    value: SermonNotesEntry[K],
  ) {
    if (!current) return;
    save(
      entries
        .map((entry) =>
          entry.id === current.id
            ? { ...entry, [field]: value, updatedAt: timestamp() }
            : entry,
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  function removeCurrent() {
    if (!current) return;
    if (
      !window.confirm(
        `Delete sermon notes for ${current.title || current.date}? This cannot be undone.`,
      )
    )
      return;
    const remaining = entries.filter((entry) => entry.id !== current.id);
    save(remaining);
    select(remaining[0]?.id ?? '');
  }

  return (
    <div className="sermon-notes-page">
      <header className="sermon-notes-hero image-hero">
        <span className="eyebrow">LISTEN · NOTICE · REMEMBER</span>
        <h1>Sunday Sermon Notes</h1>
        <p>Keep the message, Scripture, and next steps together.</p>
      </header>

      <div className="sermon-notes-layout">
        <aside className="sermon-notes-shelf" aria-label="Saved sermon notes">
          <div className="sermon-notes-shelf-heading">
            <div>
              <span className="eyebrow">YOUR NOTES</span>
              <h2>Messages</h2>
            </div>
            <button className="button primary" onClick={createEntry}>
              New notes
            </button>
          </div>
          {entries.length ? (
            <div className="sermon-notes-list">
              {[...entries]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((entry) => (
                  <button
                    key={entry.id}
                    className="sermon-notes-list-item"
                    aria-current={entry.id === selectedId ? 'true' : undefined}
                    onClick={() => select(entry.id)}
                  >
                    <span>{entry.date || 'Date not set'}</span>
                    <strong>{entry.title || 'Untitled sermon notes'}</strong>
                    <small>
                      {[entry.speaker, entry.passage]
                        .filter(Boolean)
                        .join(' · ') || 'Add speaker and Scripture'}
                    </small>
                  </button>
                ))}
            </div>
          ) : (
            <p className="sermon-notes-shelf-empty">
              Your saved Sunday messages will appear here.
            </p>
          )}
          <p className="sermon-notes-storage-note">
            Notes save on this device as you type.
          </p>
        </aside>

        {current ? (
          <article className="sermon-notes-editor">
            <div className="sermon-notes-editor-heading">
              <div>
                <span className="eyebrow">LISTENING NOTES</span>
                <h2>{current.title || 'New sermon notes'}</h2>
              </div>
              <span className="sermon-notes-saved">Saved on this device</span>
            </div>

            <div className="sermon-notes-meta-grid">
              <label>
                Sunday / service date
                <input
                  type="date"
                  value={current.date}
                  onChange={(event) => update('date', event.target.value)}
                />
              </label>
              <label>
                Pastor or speaker
                <input
                  value={current.speaker}
                  onChange={(event) => update('speaker', event.target.value)}
                  placeholder="Who is preaching?"
                />
              </label>
              <label className="sermon-notes-title-field">
                Message title
                <input
                  value={current.title}
                  onChange={(event) => update('title', event.target.value)}
                  placeholder="Add a title as you listen"
                />
              </label>
              <label>
                Main Scripture
                <input
                  value={current.passage}
                  onChange={(event) => update('passage', event.target.value)}
                  placeholder="e.g. Romans 8:1–11"
                />
              </label>
              <label>
                Key verse
                <input
                  value={current.keyVerse}
                  onChange={(event) => update('keyVerse', event.target.value)}
                  placeholder="Verse or reference to remember"
                />
              </label>
            </div>

            <label className="sermon-notes-field">
              Main idea
              <textarea
                rows={3}
                value={current.mainIdea}
                onChange={(event) => update('mainIdea', event.target.value)}
                placeholder="What is the central point of the message?"
              />
            </label>
            <label className="sermon-notes-field sermon-notes-listening-field">
              Notes from the message
              <textarea
                rows={11}
                value={current.notes}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="Capture the outline, examples, repeated ideas, and anything you want to remember…"
              />
            </label>
            <div className="sermon-notes-lower-grid">
              <label className="sermon-notes-field">
                Personal application
                <textarea
                  rows={5}
                  value={current.application}
                  onChange={(event) =>
                    update('application', event.target.value)
                  }
                  placeholder="What might you believe, change, or practice?"
                />
              </label>
              <label className="sermon-notes-field">
                Questions and follow-up
                <textarea
                  rows={5}
                  value={current.questions}
                  onChange={(event) => update('questions', event.target.value)}
                  placeholder="Questions to study, discuss, or pray about…"
                />
              </label>
            </div>

            <div className="sermon-notes-actions">
              {current.passage.trim() && (
                <button
                  className="button secondary"
                  onClick={() => openStudy(current.passage)}
                >
                  Study {current.passage} →
                </button>
              )}
              <button
                className="button secondary"
                onClick={() =>
                  exportText(
                    `${(current.title || 'Sunday-sermon-notes')
                      .replace(/[^a-z0-9]+/gi, '-')
                      .replace(/^-|-$/g, '')}.txt`,
                    [
                      current.title || 'Sunday Sermon Notes',
                      `Date: ${current.date}`,
                      `Speaker: ${current.speaker}`,
                      `Scripture: ${current.passage}`,
                      `Key verse: ${current.keyVerse}`,
                      `Main idea:\n${current.mainIdea}`,
                      `Message notes:\n${current.notes}`,
                      `Personal application:\n${current.application}`,
                      `Questions and follow-up:\n${current.questions}`,
                    ].join('\n\n'),
                  )
                }
              >
                Export notes ↓
              </button>
              <button
                className="button text-button sermon-notes-delete"
                onClick={removeCurrent}
              >
                Delete notes
              </button>
            </div>
          </article>
        ) : (
          <section className="sermon-notes-empty panel">
            <span className="eyebrow">A PLACE TO LISTEN WELL</span>
            <h2>Keep what stood out.</h2>
            <p>
              Record the speaker, message title, Scripture, key idea, and your
              response. Your notes stay saved here so you can revisit them
              later.
            </p>
            <button className="button primary" onClick={createEntry}>
              Start Sunday notes →
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
