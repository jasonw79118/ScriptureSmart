import { useState, type ReactNode } from 'react';
import type { Draft, Note } from '../domain/models';
import { Badge, Empty } from '../components';

const resourceFilters = [
  'All Resources',
  'Scripture',
  'Commentary',
  'Church History',
  'Modern Voices',
  'Sermons',
  'My Library',
];

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
      .filter(Boolean)
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

  if (!research)
    return (
      <section className="library-room">
        <div className="library-hero image-hero library-image">
          <span className="eyebrow">LIBRARY</span>
          <h1>Your study archive</h1>
          <p>
            Sermons, studies, discussion guides, and passage notes stay together
            so your work can keep growing over time.
          </p>
          <div className="filter-bar library-search">
            <input
              aria-label="Search library"
              placeholder="Search your library..."
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
        </div>
        <div className="section-heading">
          <h2>{foundDrafts.length + foundNotes.length} saved items</h2>
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
      </section>
    );

  const resourceSections = [
    {
      title: 'Scripture',
      eyebrow: 'Passages, books, and themes',
      items: ['Open Ephesians 1', 'Explore Romans 8', 'Themes in adoption'],
      live: true,
    },
    {
      title: 'Historical Commentary',
      eyebrow: 'Source collections',
      items: ['Chrysostom', 'Calvin', 'Spurgeon'],
      live: false,
    },
    {
      title: 'Early Church',
      eyebrow: 'Primary historical sources',
      items: ['Didache', 'Ignatius', 'Polycarp', 'Irenaeus'],
      live: false,
    },
    {
      title: 'Councils & Creeds',
      eyebrow: 'Historic doctrinal summaries',
      items: ['Nicene Creed', 'Chalcedonian Definition', 'Apostles’ Creed'],
      live: false,
    },
    {
      title: 'Your Church / Your Notes',
      eyebrow: 'Connected workspace content',
      items: [
        `${drafts.length} drafts`,
        `${notes.length} notes`,
        'Group resources',
      ],
      live: true,
    },
  ];

  return (
    <section className="explore-library">
      <div className="library-hero image-hero library-image">
        <span className="eyebrow">EXPLORE</span>
        <h1>A Richer View of God’s Word</h1>
        <p>
          Search passages, doctrines, topics, and saved work while keeping real
          sources clearly separated from notes and AI synthesis.
        </p>
        <div className="filter-bar library-search">
          <input
            aria-label="Search library"
            placeholder="Search a passage, doctrine, topic, or question..."
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
        <div className="resource-filter-pills" aria-label="Resource filters">
          {resourceFilters.map((name) => (
            <button key={name}>{name}</button>
          ))}
        </div>
      </div>
      <div className="resource-section-grid">
        {resourceSections.map((section) => (
          <article className="resource-collection-card" key={section.title}>
            <span className="eyebrow">{section.eyebrow}</span>
            <h2>{section.title}</h2>
            <div>
              {section.items.map((item) => (
                <button
                  key={item}
                  onClick={() =>
                    section.title === 'Scripture'
                      ? openStudy(
                          item.replace('Open ', '').replace('Explore ', ''),
                        )
                      : undefined
                  }
                >
                  {item}
                </button>
              ))}
            </div>
            <Badge>
              {section.live
                ? 'Available workspace content'
                : 'Planned source collection'}
            </Badge>
          </article>
        ))}
      </div>
      <section className="panel editorial-panel">
        <div className="section-heading">
          <h2>{foundDrafts.length + foundNotes.length} matching saved items</h2>
          <span className="muted">Local library search</span>
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
            External commentary and historical libraries are not connected yet,
            so no outside results are simulated.
          </Empty>
        )}
      </section>
      <section className="source-integrity-band">
        <div>
          <span className="eyebrow">SOURCE INTEGRITY</span>
          <h2>Every source keeps its own identity.</h2>
          <p>
            Scripture, historical sources, commentary, sermons, user notes, and
            AI synthesis remain labeled separately.
          </p>
        </div>
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
    </section>
  );
}
