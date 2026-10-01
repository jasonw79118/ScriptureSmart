import { useMemo, useState, type ReactNode } from 'react';
import type { Draft, Note } from '../domain/models';
import { Badge, Empty } from '../components';
import { useCommunity } from '../community/CommunityContext';

const resourceFilters = ['All Resources', 'Scripture', 'Commentary', 'Church History', 'Modern Voices', 'Sermons', 'My Library'];
const passageStarters = [
  { reference: 'Ephesians 1', title: 'Ephesians', detail: 'Identity, grace, and adoption in Christ', image: 'scripture-a' },
  { reference: 'Romans 8', title: 'Romans', detail: 'Life in the Spirit and hope in Christ', image: 'scripture-b' },
  { reference: 'Psalm 23', title: 'Psalms', detail: 'Prayer, worship, and the life of faith', image: 'scripture-c' },
  { reference: 'John 1', title: 'The Gospel of John', detail: 'The Word made flesh', image: 'scripture-d' },
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
  const [resourceFilter, setResourceFilter] = useState('All Resources');
  const community = useCommunity();
  const churchSource = community.data.church_sources?.find((item) => item.churchId === community.church?.id);
  const sourcedItems = churchSource?.items ?? [];
  const term = query.trim().toLowerCase();
  const match = (value: string) => !term || value.toLowerCase().includes(term);
  const foundDrafts = drafts.filter((draft) =>
    (filter === 'all' || filter === draft.kind) &&
    match(`${draft.title} ${draft.passage} ${Object.values(draft.sections).join(' ')}`),
  );
  const foundNotes = notes.filter((note) =>
    (filter === 'all' || filter === 'note') && match(`${note.passage} ${note.text}`),
  );
  const exactPassage = /^[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+(?::\d+)?(?:\s*[-–]\s*\d+(?::\d+)?)?$/.test(query.trim());
  const shownStarters = passageStarters.filter((item) => match(`${item.reference} ${item.title} ${item.detail}`));

  if (!research) {
    return (
      <section className="library-room">
        <header className="library-hero image-hero">
          <span className="eyebrow">YOUR LIBRARY</span>
          <h1>Your study archive</h1>
          <p>Sermons, Bible studies, discussion guides, and passage notes stay together as your study grows.</p>
          <form className="library-search" onSubmit={(event) => { event.preventDefault(); if (exactPassage) openStudy(query.trim()); }}>
            <input aria-label="Search your library" placeholder="Search saved notes and studies…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select aria-label="Filter saved content" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All saved work</option><option value="sermon">Sermons</option><option value="study">Bible studies</option><option value="guide">Discussion guides</option><option value="note">Personal notes</option>
            </select>
            <button className="button primary">Search</button>
          </form>
        </header>
        <section className="library-saved-section">
          <div className="section-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>{foundDrafts.length + foundNotes.length} saved items</h2></div><span className="muted">Saved on this device</span></div>
          {cards(foundDrafts)}
          <div className="personal-note-grid">{foundNotes.map((note) => <button className="personal-note-card" key={note.id} onClick={() => openStudy(note.passage)}><Badge>USER NOTE</Badge><h3>{note.passage}</h3><p>{note.text}</p><span>Open passage →</span></button>)}</div>
          {!foundDrafts.length && !foundNotes.length && <Empty title="No saved work matches this search">Your notes and drafts will appear here when you save them.</Empty>}
        </section>
      </section>
    );
  }

  const sections = useMemo(() => [
    { title: 'Scripture', key: 'Scripture', intro: 'Read the passage in its context.', variant: 'scripture', live: true },
    { title: 'Historical Commentary', key: 'Commentary', intro: 'Commentary from trusted voices through the centuries.', variant: 'history', live: false },
    { title: 'Early Church', key: 'Church History', intro: 'Writings and witness from the first generations.', variant: 'early', live: false },
    { title: 'Councils & Creeds', key: 'Church History', intro: 'Historic statements of Christian faith.', variant: 'creeds', live: false },
    { title: 'Modern Voices', key: 'Modern Voices', intro: 'Contemporary pastoral and theological resources.', variant: 'modern', live: false },
    { title: 'Your Church / Your Notes', key: 'My Library', intro: 'Resources connected to your church and personal workspace.', variant: 'church', live: true },
  ], []);
  const visibleSections = sections.filter((section) =>
    (resourceFilter === 'All Resources' || section.key === resourceFilter || (resourceFilter === 'Sermons' && section.key === 'My Library')) &&
    match(`${section.title} ${section.intro}`),
  );

  return (
    <section className="explore-library">
      <header className="library-hero image-hero">
        <div className="explore-hero-copy"><span className="eyebrow">EXPLORE</span><h1>A Richer View of God’s Word</h1><p>Scripture · history · theology · wisdom · for today</p></div>
        <form className="library-search" onSubmit={(event) => { event.preventDefault(); if (exactPassage) openStudy(query.trim()); }}>
          <label className="sr-only" htmlFor="resource-search">Search resources</label>
          <input id="resource-search" placeholder="Search a passage, doctrine, topic, or question…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="button primary" aria-label="Search resources">→</button>
        </form>
        {exactPassage && <button className="explore-open-passage" onClick={() => openStudy(query.trim())}>Open {query.trim()} in Study →</button>}
        <nav className="resource-filter-pills" aria-label="Resource filters">
          {resourceFilters.map((name) => <button key={name} aria-pressed={resourceFilter === name} onClick={() => setResourceFilter(name)}>{name}</button>)}
        </nav>
      </header>

      {visibleSections.map((section) => <section className={`explore-section explore-${section.variant}`} key={section.title}>
        <header className="explore-section-heading"><div><span className="eyebrow">{section.variant === 'scripture' ? 'BIBLE TEXT' : section.variant === 'church' ? 'CONNECTED CONTENT' : 'RESOURCE COLLECTION'}</span><h2>{section.title}</h2><p>{section.intro}</p></div>{section.live && <span className="source-availability">Available in your workspace</span>}</header>
        {section.variant === 'scripture' && <div className="scripture-resource-grid">{shownStarters.map((item) => <button className={`scripture-resource-card ${item.image}`} key={item.reference} onClick={() => openStudy(item.reference)}><span className="resource-image" /><span className="resource-card-copy"><small>PASSAGE</small><strong>{item.title}</strong><span>{item.detail}</span><b>{item.reference} <i>→</i></b></span></button>)}</div>}
        {section.variant === 'church' && <div className="church-resource-grid">
          {sourcedItems.filter((item) => match(`${item.title} ${item.sourceType}`)).map((item) => <a className="church-resource-card" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" key={`${item.sourceUrl}-${item.title}`}>{item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}<small>{item.sourceType.replace('-', ' ').toUpperCase()}</small><strong>{item.title}</strong><span>Open source ↗</span></a>)}
          {foundDrafts.filter((draft) => match(`${draft.title} ${draft.passage}`)).map((draft) => <article className="personal-note-card" key={draft.id}><Badge>{draft.kind.toUpperCase()}{draft.sample ? ' · SAMPLE' : ''}</Badge><h3>{draft.title}</h3><p>{draft.passage || 'Passage not set'}</p></article>)}
          {foundNotes.slice(0, 4).map((note) => <button className="personal-note-card" key={note.id} onClick={() => openStudy(note.passage)}><Badge>USER NOTE</Badge><h3>{note.passage}</h3><p>{note.text}</p><span>Open passage →</span></button>)}
          {!sourcedItems.length && !foundDrafts.length && !foundNotes.length && <Empty title="Your church and notes will appear here">No church updates or personal notes have been synced to this workspace yet. Church website content will only appear when a verified source is connected.</Empty>}
        </div>}
        {!section.live && <div className="resource-unavailable"><span className="resource-emblem">{section.variant === 'history' ? '▤' : section.variant === 'early' ? '⌂' : section.variant === 'creeds' ? '✦' : '◉'}</span><div><strong>Source collection not connected</strong><p>No licensed or verified {section.title.toLowerCase()} resources are available in this workspace yet. No quotations or source records are being simulated.</p></div><a href="#connections">View connections →</a></div>}
      </section>)}

      {(resourceFilter === 'All Resources' || resourceFilter === 'Sermons' || resourceFilter === 'My Library') && <section className="explore-my-library"><div className="explore-section-heading"><div><span className="eyebrow">PERSONAL WORKSPACE</span><h2>Your Library</h2><p>Continue work that you have saved.</p></div><span>{foundDrafts.length + foundNotes.length} items</span></div>{cards(foundDrafts.filter((draft) => resourceFilter !== 'Sermons' || draft.kind === 'sermon'))}<div className="personal-note-grid">{foundNotes.slice(0, 4).map((note) => <button className="personal-note-card" key={note.id} onClick={() => openStudy(note.passage)}><Badge>USER NOTE</Badge><h3>{note.passage}</h3><p>{note.text}</p><span>Open passage →</span></button>)}</div>{!foundDrafts.length && !foundNotes.length && <Empty title="Your saved library is ready">Saved sermons, studies, and notes will appear here.</Empty>}</section>}

      <footer className="source-integrity-band"><div><span className="eyebrow">SOURCE INTEGRITY</span><h2>Every source keeps its identity.</h2><p>Scripture, historical sources, commentary, sermons, personal notes, and AI synthesis remain clearly distinguished.</p></div><div className="source-tags">{['SCRIPTURE', 'HISTORICAL SOURCE', 'COMMENTARY', 'SERMON', 'USER NOTE', 'AI SYNTHESIS'].map((item) => <Badge key={item}>{item}</Badge>)}</div></footer>
      {churchSource?.lastSyncedAt && <small className="source-sync-time">Church sources last checked {new Date(churchSource.lastSyncedAt).toLocaleDateString()}</small>}
    </section>
  );
}
