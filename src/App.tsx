import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  DocumentKind,
  Draft,
  Note,
  TableItem,
  Preferences,
} from './domain/models';
import { sampleDrafts, sampleTable } from './data/seed';
import { useLocalStore } from './data/storage';
import {
  PassageWorkspace,
  Editor,
  TableWorkspace,
  Library,
  Connections,
  Settings,
} from './Screens';
import './App.css';
import './community/community.css';
import './redesign.css';
import { useCommunity } from './community/CommunityContext';
import { ChurchPage } from './community/ChurchPage';
import { LoginPage } from './community/LoginPage';
import { Onboarding } from './community/Onboarding';
import { GroupFinder } from './community/GroupFinder';
import type { ModuleKey } from './community/models';
import { GroupsPage } from './community/GroupsPage';
import { ChurchImage } from './community/ChurchBrand';
import {
  validDrafts,
  validNotes,
  validTable,
  validPreferences,
} from './data/validation';
import { navigate, timestamp } from './utils';
import {
  defaultComparisonTranslationId,
  defaultTranslationId,
  supportedComparisonIds,
  supportedTranslationId,
} from './domain/providers';
export type Route =
  | 'onboarding'
  | 'find-group'
  | 'dashboard'
  | 'study'
  | 'sermons'
  | 'bible-studies'
  | 'guide'
  | 'church'
  | 'member-login'
  | 'groups'
  | 'table'
  | 'library'
  | 'research'
  | 'connections'
  | 'settings';
const nav: { id: Route; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: 'Home' },
  { id: 'study', label: 'Study', icon: 'Book' },
  { id: 'research', label: 'Explore', icon: 'Search' },
  { id: 'sermons', label: 'Create', icon: 'Write' },
  { id: 'groups', label: 'Groups', icon: 'Group' },
  { id: 'library', label: 'Library', icon: 'Library' },
];
const allRoutes: Route[] = [
  ...nav.map((n) => n.id),
  'onboarding',
  'find-group',
  'bible-studies',
  'guide',
  'church',
  'member-login',
  'table',
  'connections',
  'settings',
];
const labels = {
  sermon: 'Sermon',
  study: 'Bible study',
  guide: 'Discussion guide',
};
function routeFromHash(): Route {
  const route = location.hash.slice(1).split('/')[0];
  return allRoutes.includes(route as Route) ? (route as Route) : 'dashboard';
}
function NavGlyph({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    Home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z" /></>,
    Book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20" /></>,
    Search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /><path d="M8 11h5M10.5 8.5v5" /></>,
    Write: <><path d="m4 16.5-.9 4.4 4.4-.9L20 7.5 16.5 4z" /><path d="m14.8 5.7 3.5 3.5" /></>,
    Group: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.2 2.6-5.5 6-5.5s6 2.3 6 5.5M17 5.5a3 3 0 0 1 0 5.8M18 14.7c2.1.6 3.2 2.4 3.2 4.8" /></>,
    Library: <><path d="M4 4h4v16H4zM10 4h4v16h-4zM17 5l3.5 14M17 5l3.8-1" /></>,
    More: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.Book}</svg>;
}
function App() {
  const community = useCommunity();
  const groupLabel = community.church?.group_label_plural ?? 'Groups';
  const churchUrl = community.church?.website_url ?? '#church';
  const churchSource = community.data.church_sources?.find((source) => source.churchId === community.church?.id);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 720px)').matches,
  );
  const navigationRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const resize = () => {
      setMobile(query.matches);
      if (!query.matches) setMenu(false);
    };
    query.addEventListener('change', resize);
    return () => query.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!mobile || !menu) return;
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () =>
      Array.from(
        navigationRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), select',
        ) ?? [],
      );
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === 'Tab') {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      menuButton?.focus();
    };
  }, [menu, mobile]);
  const [drafts, saveDrafts, draftError] = useLocalStore<Draft[]>(
    'ss.drafts.v1',
    sampleDrafts,
    validDrafts,
  );
  const [notes, saveNotes, noteError] = useLocalStore<Note[]>(
    'ss.notes.v1',
    [],
    validNotes,
  );
  const [table, saveTable, tableError] = useLocalStore<TableItem[]>(
    'ss.table.v1',
    sampleTable,
    validTable,
  );
  const [settings, saveSettings, settingsError] = useLocalStore<Preferences>(
    'ss.settings.v1',
    {
      name: 'Friend',
      translation: defaultTranslationId,
      comparisons: [defaultComparisonTranslationId],
      tradition: 'Not specified',
      statement: '',
      showOthers: true,
    },
    validPreferences,
  );
  const [selectedId, setSelectedId] = useState('');
  const [passage, setPassage] = useState('Ephesians 1:3–14');
  const [notice, setNotice] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const [studyQuestion, setStudyQuestion] = useState('');
  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title = `${nav.find((n) => n.id === route)?.label ?? (route === 'onboarding' ? 'Church connection' : 'Discussion Guide')} · ScriptureSmart`;
  }, [route]);
  function go(next: Route) {
    navigate(next);
    setMenu(false);
  }
  function startHomeStudy(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const referencePattern =
      /^[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+(?::\d+)?(?:\s*[-–]\s*\d+(?::\d+)?)?$/;
    if (referencePattern.test(trimmed)) {
      setPassage(trimmed);
      setStudyQuestion(`Explain ${trimmed}`);
    } else {
      setStudyQuestion(trimmed);
    }
    go('study');
  }
  function openDraft(draft: Draft) {
    setSelectedId(draft.id);
    go(
      draft.kind === 'sermon'
        ? 'sermons'
        : draft.kind === 'study'
          ? 'bible-studies'
          : 'guide',
    );
  }
  function create(kind: DocumentKind) {
    if (
      !allowed(
        kind === 'sermon'
          ? 'sermons'
          : kind === 'study'
            ? 'bible-studies'
            : 'guide',
      )
    ) {
      setNotice('Your church administrator has not enabled this section.');
      return;
    }
    const draft: Draft = {
      id: crypto.randomUUID(),
      kind,
      title: `Untitled ${labels[kind].toLowerCase()}`,
      passage: '',
      sections: {},
      updatedAt: timestamp(),
    };
    saveDrafts([draft, ...drafts]);
    openDraft(draft);
  }
  function sendToTable(text: string, kind: TableItem['kind'] = 'note') {
    saveTable([
      {
        id: crypto.randomUUID(),
        groupId: 'sample-group',
        kind,
        text,
        passage,
        forGroupNight: false,
        replies: [],
      },
      ...table,
    ]);
    setNotice('Added to your local Table.');
  }
  function allowed(r: Route) {
    if (!community.configured) return true;
    const key =
      r === 'find-group' ? 'groups' : r === 'table' ? 'discussion' : r;
    return (
      ![
        'study',
        'sermons',
        'bible-studies',
        'guide',
        'research',
        'library',
        'groups',
        'discussion',
      ].includes(key) || community.canModule(key as ModuleKey)
    );
  }
  const onboarding =
    community.needsChurch &&
    !['church', 'member-login', 'onboarding'].includes(route);
  const error = draftError || noteError || tableError || settingsError;
  function draftCards(items: Draft[]): ReactNode {
    return (
      <div className="document-grid">
        {items.map((d) => (
          <button
            className="document-card"
            key={d.id}
            onClick={() => openDraft(d)}
          >
            <div className={`document-icon ${d.kind}`}>
              <NavGlyph name={d.kind === 'sermon' ? 'Write' : d.kind === 'study' ? 'Book' : 'Library'} />
            </div>
            <div className="card-kicker">
              {labels[d.kind]} {d.sample && <span>· Sample</span>}
            </div>
            <h3>{d.title}</h3>
            <p>{d.passage || 'Add a passage'}</p>
            <div className="card-footer">
              <span>Draft</span>
              <span>Continue writing ↗</span>
            </div>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div
      className="app-shell"
      data-church-theme={
        community.church?.name === 'Redeemer Christian Church'
          ? 'redeemer'
          : undefined
      }
      style={
        {
          '--church-accent': community.church?.accent ?? '#35553d',
          '--ss-home-image': `url("${import.meta.env.BASE_URL}images/home-study.webp")`,
          '--ss-study-image': `url("${import.meta.env.BASE_URL}images/study-desk.webp")`,
          '--ss-explore-image': `url("${import.meta.env.BASE_URL}images/explore-library.webp")`,
          '--ss-sermon-image': `url("${import.meta.env.BASE_URL}images/sermon-writing.webp")`,
          '--ss-group-image': `url("${import.meta.env.BASE_URL}images/gospel-community.webp")`,
        } as import('react').CSSProperties
      }
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside
        id="site-navigation"
        ref={navigationRef}
        inert={mobile && !menu}
        className={`sidebar ${menu ? 'is-open' : ''}`}
      >
        <button
          className="navigation-close"
          aria-label="Close navigation menu"
          onClick={() => setMenu(false)}
        >
          Close menu <span aria-hidden="true">&times;</span>
        </button>
        <a className="brand" href="#dashboard" aria-label="ScriptureSmart home">
          <svg className="brand-symbol" viewBox="0 0 52 46" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7c8-2 14 0 21 5 7-5 13-7 21-5v31c-8-2-14 0-21 5-7-5-13-7-21-5z" />
            <path d="M26 12v31M11 13v18c5-1 9 0 13 3M41 13v18c-5-1-9 0-13 3M2 3v34M50 3v34" />
          </svg>
          <span>
            Scripture<span className="brand-light">Smart</span>
            <small>DEEPER SCRIPTURE. BRIGHTER LIFE.</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {nav
            .filter((n) => allowed(n.id))
            .map((n, i) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                aria-current={route === n.id ? 'page' : undefined}
                className={`${route === n.id ? 'active' : ''} ${i === 5 ? 'nav-divider' : ''}`}
                onClick={() => setMenu(false)}
              >
                <NavGlyph name={n.icon} />
                {n.id === 'groups' ? groupLabel : n.label}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="sidebar-verse">
            “Your word is a lamp to my feet and a light to my path.”
            <small>PSALM 119:105</small>
          </p>
          <div className="sidebar-church">
            <a href={churchUrl} target={churchUrl.startsWith('http') ? '_blank' : undefined} rel={churchUrl.startsWith('http') ? 'noopener noreferrer' : undefined} title={community.church ? `Visit ${community.church.name} website` : 'Church website'}>
              <ChurchImage church={community.church} source={churchSource} />
              <span><strong>{community.church?.name ?? 'Choose your church'}</strong><small>{community.church?.city ?? 'Church workspace'}</small></span>
            </a>
            <details className="sidebar-utilities">
              <summary><NavGlyph name="More" /> Workspace & account</summary>
              <a href="#table">The Table <span>{table.length}</span></a>
              <a href="#church">Church workspace</a>
              <a href="#connections">Connections</a>
              <a href="#settings">Settings</a>
              <a href="#member-login">Member login</a>
              <span className="local-pill"><i /> Local preview · {settings.name}</span>
            </details>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell" inert={mobile && menu}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={menuButtonRef}
              aria-controls="site-navigation"
              className="mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              Menu
            </button>
            <span className="mobile-route-name">{nav.find((n) => n.id === route)?.label ?? 'Workspace'}</span>
          </div>
          <div className="topbar-right">
            <button className="search-shortcut" onClick={() => go('library')} aria-label="Search your library">
              <NavGlyph name="Search" /> <span>Search</span>
            </button>
            <a
              className="top-church-selector"
              href={churchUrl}
              target={churchUrl.startsWith('http') ? '_blank' : undefined}
              rel={churchUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
              title={
                community.church
                  ? `Visit ${community.church.name} website`
                  : 'Church workspace'
              }
            >
              <ChurchImage church={community.church} source={churchSource} className="church-avatar" />
              <span>
                <strong>{community.church?.name ?? 'Church workspace'}</strong>
                <small>{community.church?.city ?? ''}</small>
              </span>
            </a>
            <details className="top-utilities">
              <summary aria-label="Open workspace settings"><span className="account-avatar">{settings.name.charAt(0).toUpperCase()}</span></summary>
              <div><strong>{settings.name}</strong><a href="#connections">Connections</a><a href="#settings">Settings</a><a href="#member-login">Member login</a></div>
            </details>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </div>
          )}
          {onboarding ? (
            <Onboarding />
          ) : !allowed(route) ? (
            <section className="panel">
              <h1>Section unavailable</h1>
              <p>Your church administrator can enable this section for you.</p>
              <a href="#church">Church workspace</a>
            </section>
          ) : (
            <>
              {route === 'onboarding' && <Onboarding />}
              {route === 'find-group' && <GroupFinder />}
              {route === 'dashboard' && (
                <>
                  <section className="home-study-hero">
                    <div className="home-hero-copy">
                      <span className="hero-eyebrow">A SCRIPTURE STUDY WORKSPACE</span>
                      <h1>What are you studying today?</h1>
                      <p>
                        Ask a question. Explore a passage. Prepare a sermon. Grow together.
                      </p>
                      <form
                        className="home-ask-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          startHomeStudy(homeQuery);
                        }}
                      >
                        <label className="sr-only" htmlFor="home-study-query">
                          Ask anything about the Bible
                        </label>
                        <input
                          id="home-study-query"
                          value={homeQuery}
                          onChange={(event) => setHomeQuery(event.target.value)}
                          placeholder="Ask anything about the Bible..."
                        />
                        <label className="sr-only" htmlFor="home-translation">Preferred translation</label>
                        <select id="home-translation" aria-label="Preferred Bible translation" value={supportedTranslationId(settings.translation)} onChange={(event) => saveSettings({ ...settings, translation: event.target.value })}>
                          {[defaultTranslationId, ...supportedComparisonIds([], defaultTranslationId), 'WEBUS', 'FBV', 'LSV', 'WMB', 'CPDV', 'TCENT'].filter((id, index, items) => items.indexOf(id) === index).map((id) => <option key={id} value={id}>{id}</option>)}
                        </select>
                        <button className="button primary" aria-label="Start studying">→</button>
                      </form>
                      <div
                        className="prompt-pills"
                        aria-label="Quick study prompts"
                      >
                        {[
                          'Explain Ephesians 2:8-10',
                          'What does the Bible say about anxiety?',
                          'Compare the Gospels',
                          'Help me prepare a sermon',
                        ].map((prompt) => (
                          <button
                            className="text-button"
                            key={prompt}
                            onClick={() => {
                              setHomeQuery(prompt);
                              startHomeStudy(prompt);
                            }}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                  <section className="pathway-grid" aria-label="Study pathways">
                    {[
                      [
                        'Study Scripture',
                        'Ask questions, explore passages, compare translations, and study deeply.',
                        () => go('study'),
                      ],
                      [
                        'Prepare to Teach',
                        'Build sermons, Bible studies, teaching notes, and discussion guides.',
                        () => create('sermon'),
                      ],
                      [
                        'Explore Resources',
                        'Browse commentary categories, church history, creeds, notes, and related resources.',
                        () => go('research'),
                      ],
                      [
                        'Study Together',
                        'Open groups, shared studies, The Table, meals, kids planning, and logistics.',
                        () => go('groups'),
                      ],
                    ].map(([title, description, action], index) => (
                      <button
                        className={`pathway-card pathway-card-${index + 1}`}
                        key={title as string}
                        onClick={action as () => void}
                      >
                        <span className="pathway-card-icon"><NavGlyph name={['Book', 'Write', 'Search', 'Group'][index]} /></span>
                        <strong>{title as string}</strong>
                        <small>{description as string}</small>
                      </button>
                    ))}
                  </section>
                  <div className="study-overview-grid">
                    <section className="panel editorial-panel">
                      <div className="section-heading">
                        <h2>Continue Studying</h2>
                        <button
                          className="text-button"
                          onClick={() => go('library')}
                        >
                          View library →
                        </button>
                      </div>
                      {draftCards(
                        [...drafts]
                          .sort((a, b) =>
                            b.updatedAt.localeCompare(a.updatedAt),
                          )
                          .slice(0, 3),
                      )}
                    </section>
                    <section className="panel editorial-panel recent-passages-panel">
                      <h2>Recent Passages</h2>
                      <div className="recent-passage-list">
                        {[...new Set([passage, ...notes.map((item) => item.passage).filter(Boolean)])].slice(0, 4).map((reference) => <button key={reference} onClick={() => { setPassage(reference); go('study'); }}><span className="recent-book-mark"><NavGlyph name="Book" /></span><span><strong>{reference}</strong><small>{reference === passage ? 'Current passage' : 'From your saved notes'}</small></span><span className="recent-arrow">→</span></button>)}
                        <button onClick={() => go('library')}><span className="recent-book-mark"><NavGlyph name="Library" /></span><span><strong>Your saved notes</strong><small>{notes.length} personal notes</small></span><span className="recent-arrow">→</span></button>
                      </div>
                    </section>
                  </div>
                  <section className="resource-strip">
                    <div>
                      <span className="eyebrow">
                        EXPLORE SCRIPTURE FROM EVERY ANGLE
                      </span>
                      <h2>A richer view of God’s Word</h2>
                    </div>
                    {[
                      'Commentaries',
                      'Cross References',
                      'Original Languages',
                      'Church History',
                      'Maps & Timelines',
                      'Topics & Themes',
                    ].map((item) => (
                      <button key={item} onClick={() => go('research')}>
                        {item}
                      </button>
                    ))}
                  </section>
                </>
              )}
              {route === 'study' && (
                <PassageWorkspace
                  passage={passage}
                  setPassage={setPassage}
                  preferred={supportedTranslationId(settings.translation)}
                  comparisons={supportedComparisonIds(
                    settings.comparisons,
                    supportedTranslationId(settings.translation),
                  )}
                  notes={notes}
                  saveNotes={saveNotes}
                  send={sendToTable}
                  connect={() => go('connections')}
                  initialQuestion={studyQuestion}
                />
              )}
              {(['sermons', 'bible-studies', 'guide'] as Route[]).includes(
                route,
              ) && (
                <Editor
                  key={route}
                  kind={
                    route === 'sermons'
                      ? 'sermon'
                      : route === 'bible-studies'
                        ? 'study'
                        : 'guide'
                  }
                  drafts={drafts}
                  selectedId={selectedId}
                  select={setSelectedId}
                  create={create}
                  save={(d) =>
                    saveDrafts(drafts.map((old) => (old.id === d.id ? d : old)))
                  }
                  cards={draftCards}
                />
              )}
              {route === 'church' && <ChurchPage />}
              {route === 'member-login' && <LoginPage />}
              {route === 'groups' && <GroupsPage />}
              {route === 'table' && (
                <TableWorkspace items={table} save={saveTable} />
              )}
              {(route === 'library' || route === 'research') && (
                <Library
                  research={route === 'research'}
                  drafts={drafts}
                  notes={notes}
                  cards={draftCards}
                  openStudy={(p) => {
                    setPassage(p);
                    go('study');
                  }}
                />
              )}
              {route === 'connections' && <Connections />}
              {route === 'settings' && (
                <Settings
                  settings={settings}
                  save={saveSettings}
                  backup={{
                    version: 1,
                    drafts,
                    notes,
                    table,
                    settings,
                    community: community.data,
                  }}
                />
              )}
            </>
          )}
          <footer>
            <span className="footer-brand">SS ScriptureSmart</span>
            <span>Rooted in Scripture. Thoughtful by design.</span>
            <span>Foundation preview</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default App;
