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
  { id: 'dashboard', label: 'Home', icon: 'âŒ‚' },
  { id: 'study', label: 'Study', icon: 'â–¤' },
  { id: 'research', label: 'Explore', icon: 'âŒ•' },
  { id: 'sermons', label: 'Create', icon: 'âœ' },
  { id: 'groups', label: 'Groups', icon: 'â™§' },
  { id: 'library', label: 'Library', icon: 'â–±' },
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
      translation: defaultTranslationId,
      comparisons: [defaultComparisonTranslationId],
      tradition: 'Not specified',
      statement: '',
      showOthers: true,
    },
    validPreferences,
  );
  const [selectedId, setSelectedId] = useState('');
  const [passage, setPassage] = useState('Ephesians 1:3â€“14');
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
    document.title = `${nav.find((n) => n.id === route)?.label ?? (route === 'onboarding' ? 'Church connection' : 'Discussion Guide')} Â· ScriptureSmart`;
  }, [route]);
  function go(next: Route) {
    navigate(next);
    setMenu(false);
  }
  function startHomeStudy(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    const referencePattern =
      /^[1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+(?::\d+)?(?:\s*[-â€“]\s*\d+(?::\d+)?)?$/;
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
              {d.kind === 'sermon' ? 'â™§' : d.kind === 'study' ? 'â–¤' : 'â˜·'}
            </div>
            <div className="card-kicker">
              {labels[d.kind]} {d.sample && <span>Â· Sample</span>}
            </div>
            <h3>{d.title}</h3>
            <p>{d.passage || 'Add a passage'}</p>
            <div className="card-footer">
              <span>Draft</span>
              <span>Continue writing â†—</span>
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
          <span className="brand-symbol">â–¥</span>
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
              <small>Personal account Â· Preview</small>
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
              â˜°
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
              âŒ• <span>Find in library</span>
            </button>
            <span className="avatar small">
              {settings.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="preview-banner">
            <span>â—‡</span> Personal study drafts are local. Open your church
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
                Ã—
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
                      <span className="hero-eyebrow">
                        SCRIPTURESMART STUDY DESK
                      </span>
                      <h1>What are you studying today?</h1>
                      <p>
                        Ask a Bible question, open a passage, prepare to teach,
                        or gather your notes for deeper study.
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
                        <button className="button primary">Study â†’</button>
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
                    <div className="study-room-art" aria-hidden="true">
                      <div className="desk-card manuscript-card">
                        Ephesians 1
                      </div>
                      <div className="desk-card notes-card">
                        Notes + questions
                      </div>
                      <div className="lamp-glow" />
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
                    ].map(([title, description, action]) => (
                      <button
                        className="pathway-card"
                        key={title as string}
                        onClick={action as () => void}
                      >
                        <span>âœ¦</span>
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
                          View library â†’
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
                    <section className="panel editorial-panel">
                      <h2>Recent Passages</h2>
                      <div className="inline-links">
                        <button onClick={() => go('study')}>
                          {passage} â†’
                        </button>
                        <button onClick={() => go('research')}>
                          Saved notes Â· {notes.length} â†’
                        </button>
                        <button onClick={() => go('groups')}>
                          {groupLabel} Â· this week â†’
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="resource-strip">
                    <div>
                      <span className="eyebrow">
                        EXPLORE SCRIPTURE FROM EVERY ANGLE
                      </span>
                      <h2>A richer view of Godâ€™s Word</h2>
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
            <span className="footer-brand">â–¥ ScriptureSmart</span>
            <span>Rooted in Scripture. Thoughtful by design.</span>
            <span>Foundation preview</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default App;
