import { useState, type ReactNode } from 'react';
import type { Draft, Note } from '../domain/models';
import { Badge, Empty, Heading } from '../components';
export function Library({
  research,
  drafts,
  notes,
  cards,
  openStudy,
}: {
  research: boolean;
  drafts: Draft[];
  notes: Note[];
  cards: (d: Draft[]) => ReactNode;
  openStudy: (p: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const match = (s: string) =>
    query
      .toLowerCase()
      .split(/\s+/)
      .every((term) => s.toLowerCase().includes(term));
  const foundDrafts = drafts.filter(
    (d) =>
      (filter === 'all' || filter === d.kind) &&
      match(`${d.title} ${d.passage} ${Object.values(d.sections).join(' ')}`),
  );
  const foundNotes = notes.filter(
    (n) =>
      (filter === 'all' || filter === 'note') &&
      match(`${n.passage} ${n.text}`),
  );
  return (
    <>
      <Heading
        title={research ? 'Follow your curiosity.' : 'A home for your work.'}
        subtitle={
          research
            ? 'Search your local work. Every insight should keep its source.'
            : 'Your sermons, studies, discussion guides, and passage notes, together.'
        }
      />
      <div className="filter-bar">
        <input
          aria-label="Search library"
          placeholder={
            research
              ? 'Search a passage or topic, e.g. Ephesians adoption'
              : 'Search your library…'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Content type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All content</option>
          <option value="sermon">Sermons</option>
          <option value="study">Bible studies</option>
          <option value="guide">Discussion guides</option>
          <option value="note">Personal notes</option>
        </select>
      </div>
      {research && (
        <div className="subtle-box">
          <strong>Local workspace search</strong>
          <p>
            External Scripture, language data, church archives, books, articles,
            councils, creeds, and commentary collections are not connected. No
            external results are being simulated.
          </p>
        </div>
      )}
      <div className="section-heading">
        <h2>{foundDrafts.length + foundNotes.length} results</h2>
        <span className="muted">Saved on this device</span>
      </div>
      {cards(foundDrafts)}
      {foundNotes.map((n) => (
        <button
          className="panel library-note"
          key={n.id}
          onClick={() => openStudy(n.passage)}
        >
          <Badge>USER NOTE</Badge>
          <h3>{n.passage}</h3>
          <p>{n.text}</p>
          <span className="text-button">Open passage →</span>
        </button>
      ))}
      {!foundDrafts.length && !foundNotes.length && (
        <Empty title="No matching work yet">
          Try a different search or create a draft to begin your library.
        </Empty>
      )}
      {research && (
        <section className="panel integrity-panel">
          <h2>Sources deserve clarity.</h2>
          <p>
            Direct quotations will require identifiable citations. AI wording
            will always be labeled as synthesis.
          </p>
          <div className="source-tags">
            {[
              'SCRIPTURE',
              'ORIGINAL LANGUAGE DATA',
              'PRIMARY HISTORICAL SOURCE',
              'COMMENTARY',
              'SERMON',
              'USER NOTE',
              'AI SYNTHESIS',
            ].map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
