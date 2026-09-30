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
import { Badge } from './components';
import './App.css';
import './community/community.css';
import { useCommunity } from './community/CommunityContext';
import { ChurchPage } from './community/ChurchPage';
import { LoginPage } from './community/LoginPage';
import { Onboarding } from './community/Onboarding';
import { GroupFinder } from './community/GroupFinder';
import type { ModuleKey } from './community/models';
import { GroupsPage } from './community/GroupsPage';
import {
  validDrafts,
  validNotes,
  validTable,
  validPreferences,
} from './data/validation';
import { navigate, timestamp } from './utils';
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
  { id: 'dashboard', label: 'Dashboard', icon: '◫' },
  { id: 'study', label: 'Study', icon: '▤' },
  { id: 'sermons', label: 'Sermons', icon: '♧' },
  { id: 'bible-studies', label: 'Bible Studies', icon: '▥' },
  { id: 'church', label: 'Our Church', icon: '⌂' },
  { id: 'member-login', label: 'Member login', icon: '♙' },
  { id: 'find-group', label: 'Find a group', icon: '◎' },
  { id: 'groups', label: 'Groups', icon: '♧' },
  { id: 'table', label: 'The Table', icon: '⊞' },
  { id: 'library', label: 'Library', icon: '▱' },
  { id: 'research', label: 'Research', icon: '⌕' },
  { id: 'connections', label: 'Connections', icon: '⌘' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];
const labels = {
  sermon: 'Sermon',
  study: 'Bible study',
  guide: 'Discussion guide',
};
function routeFromHash(): Route {
  const route = location.hash.slice(1).split('/')[0];
  return [...nav.map((n) => n.id), 'guide', 'onboarding'].includes(route)
    ? (route as Route)
    : 'dashboard';
}
function App() {
  const community = useCommunity();
  const groupLabel = community.church?.group_label_plural ?? 'Groups';
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
      translation: 'ESV',
      comparisons: ['KJV'],
      tradition: 'Not specified',
      statement: '',
      showOthers: true,
    },
    validPreferences,
  );
  const [selectedId, setSelectedId] = useState('');
  const [passage, setPassage] = useState('Ephesians 1:3–14');
  const [notice, setNotice] = useState('');
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
              {d.kind === 'sermon' ? '♧' : d.kind === 'study' ? '▤' : '☷'}
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
        <a className="brand" href="#dashboard">
          <span className="brand-symbol">▥</span>
          <span>
            Scripture<span className="brand-light">Smart</span>
            <small>YOUR STUDY WORKSPACE</small>
          </span>
        </a>
        <a className="church-nav-identity" href="#church">
          <strong>{community.church?.name ?? 'Church workspace'}</strong>
          <small>{community.church?.city}</small>
        </a>
        <nav aria-label="Main navigation">
          {nav
            .filter((n) => allowed(n.id))
            .map((n, i) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                aria-current={route === n.id ? 'page' : undefined}
                className={`${route === n.id ? 'active' : ''} ${i === 8 ? 'nav-divider' : ''}`}
                onClick={() => setMenu(false)}
              >
                <span className="nav-icon">{n.icon}</span>
                {n.id === 'groups' ? groupLabel : n.label}
                {n.id === 'table' && (
                  <span className="nav-count">{table.length}</span>
                )}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-pill">
            <span /> Local workspace
          </div>
          <p>
            Your next insight starts
            <br />
            with a closer look.
          </p>
          <div className="profile">
            <span className="avatar">
              {settings.name.charAt(0).toUpperCase()}
            </span>
            <div>
              {settings.name}
              <small>Personal account · Preview</small>
            </div>
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
          <div className="breadcrumb">
            <button
              ref={menuButtonRef}
              aria-controls="site-navigation"
              className="mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              ☰
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>
              {nav.find((n) => n.id === route)?.label ??
                (route === 'onboarding'
                  ? 'Church connection'
                  : 'Discussion Guide')}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="preview-label">LOCAL PREVIEW</span>
            <button className="search-shortcut" onClick={() => go('library')}>
              ⌕ <span>Find in library</span>
            </button>
            <span className="avatar small">
              {settings.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="preview-banner">
            <span>◇</span> Personal study drafts are local. Open your church
            workspace for group planning; your edits stay in this browser.
          </div>
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
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">A LITTLE SPACE TO GO DEEPER</div>
                      <h1>Welcome to your study.</h1>
                      <p>Study deeply. Teach faithfully. Grow together.</p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => go('study')}
                    >
                      ＋ Study a passage
                    </button>
                  </div>
                  <section className="hero">
                    <div className="hero-content">
                      <span className="hero-eyebrow">
                        OPEN THE WORD. MAKE ROOM FOR DISCOVERY.
                      </span>
                      <h2>
                        Good study begins
                        <br />
                        with a thoughtful question.
                      </h2>
                      <p>
                        Bring your Scripture, notes, and research together.
                        <br className="desktop-break" /> Give your next study
                        the space it deserves.
                      </p>
                      <button
                        className="button cream"
                        onClick={() => go('study')}
                      >
                        Explore a passage <span>→</span>
                      </button>
                    </div>
                    <div className="book-art" aria-hidden="true">
                      <div className="art-orbit orbit-one" />
                      <div className="art-orbit orbit-two" />
                      <div className="book">
                        <div className="book-left">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                        <div className="book-right">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                        <div className="bookmark" />
                      </div>
                      <span className="art-star">✧</span>
                      <span className="art-caption">ROOTED IN SCRIPTURE</span>
                    </div>
                  </section>
                  <section
                    className="quick-actions"
                    aria-label="Create content"
                  >
                    <button onClick={() => create('sermon')}>
                      <span className="action-icon">♧</span>
                      <div>
                        <strong>Build a sermon</strong>
                        <small>From passage to proclamation</small>
                      </div>
                      <span>↗</span>
                    </button>
                    <button onClick={() => create('study')}>
                      <span className="action-icon">▤</span>
                      <div>
                        <strong>Create a Bible study</strong>
                        <small>Make space for discovery</small>
                      </div>
                      <span>↗</span>
                    </button>
                    <button onClick={() => create('guide')}>
                      <span className="action-icon">☷</span>
                      <div>
                        <strong>Sermon to discussion</strong>
                        <small>Continue the conversation</small>
                      </div>
                      <span>↗</span>
                    </button>
                  </section>
                  <div className="section-heading">
                    <h2>Pick up where you left off</h2>
                    <button
                      className="text-button"
                      onClick={() => go('library')}
                    >
                      View library →
                    </button>
                  </div>
                  {draftCards(
                    [...drafts]
                      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                      .slice(0, 3),
                  )}
                  <div className="dashboard-bottom">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Around The Table</h2>
                        <Badge>
                          {community.configured
                            ? 'Church community'
                            : 'Local planning'}
                        </Badge>
                      </div>
                      <div className="group-summary">
                        <div className="group-art">♧</div>
                        <div>
                          <h3>{community.group?.name ?? 'Your group'}</h3>
                          <p>
                            {community.group?.rhythm ??
                              'Plan your next gathering'}
                          </p>
                        </div>
                      </div>
                      <div className="discussion-preview">
                        <span className="eyebrow">
                          A QUESTION TO BRING TOGETHER
                        </span>
                        <p>
                          {table[0]?.text ??
                            'Bring your first question to The Table.'}
                        </p>
                        <span className="muted">
                          {table.length} local items · No live group activity
                        </span>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => go('table')}
                      >
                        Open The Table →
                      </button>
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Your study toolkit</h2>
                        <span className="muted">
                          Check service availability
                        </span>
                      </div>
                      <div className="toolkit-row">
                        <span className="tool-icon">▤</span>
                        <div>
                          <strong>Bible providers</strong>
                          <small>Bring your preferred translations</small>
                        </div>
                        <span className="status-dot" />
                      </div>
                      <div className="toolkit-row">
                        <span className="tool-icon">✧</span>
                        <div>
                          <strong>ScriptureSmart AI</strong>
                          <small>Built-in assistance for your study</small>
                        </div>
                        <span className="status-dot" />
                      </div>
                      <button
                        className="button secondary wide"
                        onClick={() => go('connections')}
                      >
                        Explore connections ↗
                      </button>
                    </section>
                  </div>
                  <div className="section-heading">
                    <h2>On your desk</h2>
                  </div>
                  <div className="inline-links">
                    <button onClick={() => go('study')}>
                      Recent passage · {passage} →
                    </button>
                    <button onClick={() => go('research')}>
                      Saved research · {notes.length} notes →
                    </button>
                    <button onClick={() => go('groups')}>
                      {groupLabel} · Plan meals and attendance →
                    </button>
                  </div>
                </>
              )}
              {route === 'study' && (
                <PassageWorkspace
                  passage={passage}
                  setPassage={setPassage}
                  preferred={settings.translation}
                  comparisons={settings.comparisons}
                  notes={notes}
                  saveNotes={saveNotes}
                  send={sendToTable}
                  connect={() => go('connections')}
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
            <span className="footer-brand">▥ ScriptureSmart</span>
            <span>Rooted in Scripture. Thoughtful by design.</span>
            <span>Foundation preview</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default App;
