import { AccessControls } from './AccessControls';
import { DirectoryEditor } from './DirectoryEditor';
import { formValues } from './forms';
import {
  DietaryPreferences,
  MenuSuggestions,
  DishIngredients,
} from './MealPlanning';
import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import { Badge } from '../components';
import { ChurchSwitcher, CommunityStatus, Field, Panel } from './ChurchPage';
import type { Gathering, Contribution } from './models';
export function GroupsPage() {
  const c = useCommunity();
  const [tab, setTab] = useState('Overview');
  const [selectedMeeting, setSelectedMeeting] = useState('');
  const [newMeeting, setNewMeeting] = useState(false);
  const g = c.group;
  const meetings = c.data.meetings
    .filter((m) => m.group_id === g?.id)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
    );
  const meeting = meetings.find((m) => m.id === selectedMeeting) ?? meetings[0];
  const roster = c.data.members.filter((m) => m.group_id === g?.id);
  const leaders = roster.filter((m) => m.role === 'leader');
  const posts = c.data.contributions.filter((p) => p.group_id === g?.id);
  const mealSlots = meeting
    ? c.data.dishes.filter((d) => d.meeting_id === meeting.id)
    : [];
  const churchSource = c.data.church_sources?.find(
    (source) => source.churchId === c.church?.id,
  );
  const churchUrl =
    c.church?.website_url ?? churchSource?.websiteUrl ?? '#church';

  return (
    <>
      <CommunityStatus />
      {!g ? (
        <section className="group-landing-empty image-hero group-image">
          <span className="eyebrow">GROUPS</span>
          <h1>
            {c.configured && !c.session
              ? 'Your group is waiting.'
              : 'Find a place to study together.'}
          </h1>
          <p>
            Join with an invitation from your leader, find a Gospel Community,
            or create a group from your church workspace.
          </p>
          <div className="editor-toolbar">
            <a className="button primary" href="#member-login">
              Member login / join group
            </a>
            <a className="button secondary" href="#find-group">
              Find a group
            </a>
          </div>
        </section>
      ) : (
        <div className="group-experience">
          <section className="group-hero image-hero group-image">
            <div>
              <a className="text-button group-back-link" href="#groups">
                ← All Groups
              </a>
              <Badge>{c.church?.group_label ?? 'Gospel Community'}</Badge>
              <h1>{g.name}</h1>
              <p>
                {g.description ||
                  c.church?.welcome ||
                  'A community for Scripture, prayer, meals, kids, and shared life.'}
              </p>
              <div className="group-hero-facts">
                <span>{roster.length} members</span>
                <span>
                  Leaders:{' '}
                  {leaders.map((m) => m.display_name).join(', ') ||
                    'To be added'}
                </span>
                <span>{g.rhythm || 'Meeting time to be added'}</span>
                <span>{g.location || 'Location to be added'}</span>
              </div>
            </div>
            <aside className="church-identity-card">
              <a
                className="church-avatar-link"
                href={churchUrl}
                target="_blank"
                rel="noreferrer"
                title={
                  c.church ? `Visit ${c.church.name} website` : 'Church website'
                }
              >
                <span className="church-avatar">
                  {(c.church?.name ?? 'Church').charAt(0)}
                </span>
                <strong>{c.church?.name ?? 'Church website'}</strong>
              </a>
              <small>{c.church?.city ?? ''}</small>
              <ChurchSwitcher />
            </aside>
          </section>
          <nav className="group-section-tabs" aria-label="Group sections">
            {[
              'Overview',
              ...(c.canGroup('discussion') ? ['Discussion'] : []),
              'Prayer Requests',
              ...(c.canGroup('meals') ? ['Meals'] : []),
              ...(c.canGroup('kids') ? ['Kids'] : []),
              'Resources',
              'Members',
              'Settings',
            ].map((name) => (
              <button
                key={name}
                aria-pressed={tab === name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </nav>

          {tab === 'Overview' && (
            <div className="group-overview-layout">
              <main>
                <section className="overview-card next-meeting-card">
                  <span className="eyebrow">NEXT MEETING</span>
                  <h2>
                    {meeting?.title ?? 'Make room for your next gathering.'}
                  </h2>
                  <p>
                    {meeting
                      ? `${meeting.date} · ${meeting.time.slice(0, 5)} · ${g.timezone}`
                      : 'A leader can add a date, meal plan, kids plan, and attendance sign-up.'}
                  </p>
                  <div className="editor-toolbar">
                    {meeting && (
                      <button
                        className="button primary"
                        onClick={() => setTab('Meals')}
                      >
                        Plan this week
                      </button>
                    )}
                    {c.isLeader && (
                      <button
                        className="button secondary"
                        onClick={() => setNewMeeting(!newMeeting)}
                      >
                        {newMeeting
                          ? 'Cancel new gathering'
                          : 'Plan a gathering'}
                      </button>
                    )}
                  </div>
                </section>
                {newMeeting && (
                  <MeetingEditor
                    onSaved={(id) => {
                      setNewMeeting(false);
                      setSelectedMeeting(id);
                    }}
                  />
                )}
                {meeting && !newMeeting && (
                  <GatheringView key={meeting.id} meeting={meeting} />
                )}
              </main>
              <aside className="group-side-panel">
                <section className="overview-card">
                  <span className="eyebrow">CURRENT STUDY FOCUS</span>
                  <h2>{meeting?.title || 'Scripture and shared life'}</h2>
                  <p>
                    {posts.find(
                      (p) => p.kind === 'discussion' || p.kind === 'question',
                    )?.text ||
                      'Add this week’s discussion question in the Discussion tab.'}
                  </p>
                </section>
                <section className="overview-card">
                  <span className="eyebrow">MEAL PLAN</span>
                  <h2>{meeting?.meal_theme || 'Meal not set'}</h2>
                  <p>
                    {mealSlots.length} signup slots ·{' '}
                    {mealSlots.filter((d) => d.assignee_id).length} assigned
                  </p>
                </section>
                <section className="overview-card">
                  <span className="eyebrow">KIDS / CHILDCARE</span>
                  <h2>{g.age_range || 'Ages 0-14'}</h2>
                  <p>
                    {meeting?.kids_plan || 'Kids plan has not been added yet.'}
                  </p>
                </section>
                <section className="overview-card church-source-card">
                  <span className="eyebrow">
                    FROM {c.church?.name ?? 'REDEEMER CHRISTIAN CHURCH'}
                  </span>
                  <h2>Church website</h2>
                  <p>
                    Church updates can appear here when a reliable website
                    source or approved integration is connected.
                  </p>
                  <a
                    className="text-button"
                    href={churchUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit church website →
                  </a>
                </section>
              </aside>
            </div>
          )}

          {tab === 'Discussion' && c.canGroup('discussion') && (
            <Conversation kind="discussion" />
          )}
          {tab === 'Prayer Requests' && <Conversation kind="discussion" />}
          {tab === 'Meals' && c.canGroup('meals') && (
            <>
              {meeting ? (
                <MealPlan
                  meeting={meeting}
                  names={(id) =>
                    roster.find((m) => m.user_id === id)?.display_name ??
                    'Group member'
                  }
                />
              ) : (
                <p>No meeting selected.</p>
              )}
              <DietaryPreferences />
            </>
          )}
          {tab === 'Kids' && g.kids_enabled && (
            <>
              <section className="overview-card">
                <span className="eyebrow">KIDS PLANNING</span>
                <h2>Activities, supplies, supervision</h2>
                <p>
                  Expected children, activities, and important notes remain
                  visible only within existing group permissions.
                </p>
              </section>
              <Conversation kind="kids" />
            </>
          )}
          {tab === 'Resources' && (
            <section className="resource-section-grid">
              {[
                'Current study guide',
                'Sermon link',
                'Discussion questions',
                'Group documents',
              ].map((item) => (
                <article className="resource-collection-card" key={item}>
                  <span className="eyebrow">GROUP RESOURCE</span>
                  <h2>{item}</h2>
                  <p>
                    Resource upload and church integrations are planned; no
                    files are being simulated.
                  </p>
                  <Badge>Planned</Badge>
                </article>
              ))}
            </section>
          )}
          {tab === 'Members' && (
            <>
              <Members />
              {c.isLeader && <AccessControls scope="group" />}
            </>
          )}
          {tab === 'Settings' && (
            <>
              <GroupDetails />
              {c.isLeader && <DirectoryEditor key={g.id} />}
            </>
          )}
        </div>
      )}
    </>
  );
}
function GroupDetails() {
  const c = useCommunity();
  const g = c.group!;
  return (
    <div className="two-columns">
      <Panel title="When and where">
        <p>
          <strong>{g.rhythm || 'Meeting rhythm not set'}</strong>
          <br />
          {g.location || 'Location not set'}
          <br />
          {g.address}
        </p>
        <p className="preserve">
          {g.directions ||
            'Parking, entrance, and arrival instructions have not been added.'}
        </p>
        {g.address && (
          <a
            className="button secondary"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.address)}`}
            target="_blank"
            rel="noreferrer"
          >
            Get directions ↗
          </a>
        )}
        <small>
          Directions opens Google Maps with the group address. Locations are
          visible to group members in the connected app.
        </small>
        <h3>Hosts</h3>
        <p>{g.hosts || 'Hosts not set'}</p>
        <h3>Children’s ages</h3>
        <p>{g.age_range || 'Not specified'}</p>
        <h3>Group leaders</h3>
        {c.data.members
          .filter((m) => m.group_id === g.id && m.role === 'leader')
          .map((m) => (
            <p key={m.user_id}>{m.display_name}</p>
          ))}
      </Panel>
      {c.isLeader ? (
        <Panel title="Group practices">
          <form
            key={g.id}
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = formValues(e.currentTarget);
              void c.save('groups', {
                ...g,
                name: f.name,
                description: f.description,
                rhythm: f.rhythm,
                location: f.location,
                address: f.address,
                directions: f.directions,
                timezone: f.timezone,
                hosts: f.hosts,
                age_range: f.age_range,
                meals_enabled: f.meals_enabled === 'on',
                kids_enabled: f.kids_enabled === 'on',
              });
            }}
          >
            <Field name="name" label="Group name" value={g.name} required />
            <Field
              name="description"
              label="About this group"
              type="textarea"
              value={g.description}
            />
            <Field
              name="rhythm"
              label="Meeting rhythm / day and time"
              value={g.rhythm}
            />
            <Field name="hosts" label="Group hosts" value={g.hosts} />
            <Field
              name="age_range"
              label="Children’s age range"
              value={g.age_range}
            />
            <Field name="location" label="Location name" value={g.location} />
            <Field name="address" label="Street address" value={g.address} />
            <Field
              name="directions"
              label="Directions, parking, and entrance"
              type="textarea"
              value={g.directions}
            />
            <label>
              Group time zone
              <select name="timezone" defaultValue={g.timezone}>
                {[
                  'America/Chicago',
                  'America/New_York',
                  'America/Denver',
                  'America/Los_Angeles',
                  'America/Phoenix',
                  'Pacific/Honolulu',
                  'America/Anchorage',
                  'Europe/London',
                  'UTC',
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="meals_enabled"
                defaultChecked={g.meals_enabled}
              />
              Plan meals and dish sign-ups
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="kids_enabled"
                defaultChecked={g.kids_enabled}
              />
              Include kids’ time
            </label>
            <small>
              Disabling a feature hides its planning area and preserves existing
              information.
            </small>
            <button disabled={c.busy} className="button primary">
              Save group details
            </button>
          </form>
        </Panel>
      ) : (
        <Panel title="Group practices">
          <p>
            Meals:{' '}
            {g.meals_enabled
              ? 'Shared meal planning enabled'
              : 'This group does not use meal planning'}
          </p>
          <p>Kids’ time: {g.kids_enabled ? 'Enabled' : 'Not enabled'}</p>
          <p>Your leaders can update this group’s schedule and practices.</p>
        </Panel>
      )}
    </div>
  );
}
function MeetingEditor({
  meeting,
  onSaved,
}: {
  meeting?: Gathering;
  onSaved: (id: string) => void;
}) {
  const c = useCommunity();
  const g = c.group!;
  return (
    <Panel title={meeting ? 'Edit gathering' : 'Plan a gathering'}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = formValues(e.currentTarget);
          const id = meeting?.id ?? crypto.randomUUID();
          const ok = await c.save(
            'meetings',
            {
              id,
              group_id: g.id,
              title: f.title,
              date: f.date,
              time: f.time,
              meal_theme: f.meal_theme ?? meeting?.meal_theme ?? '',
              meal_notes: f.meal_notes ?? meeting?.meal_notes ?? '',
              kids_plan: f.kids_plan ?? meeting?.kids_plan ?? '',
            },
            !meeting,
          );
          if (ok) onSaved(id);
        }}
      >
        <Field
          name="title"
          label="Gathering title"
          value={meeting?.title ?? 'Gospel Community gathering'}
          required
        />
        <div className="two-columns">
          <Field
            name="date"
            label="Meeting date"
            type="date"
            value={meeting?.date}
            required
          />
          <Field
            name="time"
            label={`Meeting time (${g.timezone})`}
            type="time"
            value={meeting?.time?.slice(0, 5)}
            required
          />
        </div>
        {c.canGroup('meals') && (
          <>
            <Field
              name="meal_theme"
              label="Main dish (optional — plan the menu later)"
              value={meeting?.meal_theme}
            />
            <Field
              name="meal_notes"
              label="Meal instructions and dietary considerations"
              type="textarea"
              value={meeting?.meal_notes}
            />
          </>
        )}
        {c.canGroup('kids') && (
          <Field
            name="kids_plan"
            label="Kids’ time plan and supervision"
            type="textarea"
            value={meeting?.kids_plan}
          />
        )}
        <button className="button primary" disabled={c.busy}>
          Save gathering
        </button>
      </form>
    </Panel>
  );
}
function GatheringView({ meeting }: { meeting: Gathering }) {
  const c = useCommunity();
  const g = c.group!;
  const [editing, setEditing] = useState(false);
  const responses = c.data.attendance.filter(
    (a) => a.meeting_id === meeting.id,
  );
  const mine = responses.find((a) => a.user_id === c.userId);
  const roster = c.data.members.filter((m) => m.group_id === g.id);
  const [status, setStatus] = useState(mine?.status ?? 'going');
  const [adults, setAdults] = useState(mine?.adults || 1);
  const [kids, setKids] = useState(mine?.kids ?? 0);
  const committed = c.data.dishes.filter(
    (d) => d.meeting_id === meeting.id && d.assignee_id === c.userId,
  );
  const going = responses.filter((a) => a.status === 'going');
  const names = (id: string) =>
    roster.find((m) => m.user_id === id)?.display_name ?? 'Group member';
  if (editing)
    return (
      <>
        <button className="text-button" onClick={() => setEditing(false)}>
          ← Back to gathering
        </button>
        <MeetingEditor meeting={meeting} onSaved={() => setEditing(false)} />
      </>
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{meeting.title}</h2>
          <p>
            {meeting.date} · {meeting.time.slice(0, 5)} · {g.timezone}
          </p>
        </div>
        {c.isLeader && (
          <button className="button secondary" onClick={() => setEditing(true)}>
            Edit gathering
          </button>
        )}
      </div>
      <div className="two-columns">
        <Panel title="Will you be there?">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void c.rsvp({
                meeting_id: meeting.id,
                user_id: c.userId,
                status,
                adults: status === 'not-going' ? 0 : adults,
                kids: status === 'not-going' ? 0 : kids,
              });
            }}
          >
            <div className="rsvp-options">
              {(['going', 'maybe', 'not-going'] as const).map((s) => (
                <label key={s} className={status === s ? 'chosen' : ''}>
                  <input
                    type="radio"
                    name="attendance"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                  />
                  {s === 'going'
                    ? 'I’m coming'
                    : s === 'maybe'
                      ? 'Maybe'
                      : 'Not coming'}
                </label>
              ))}
            </div>
            {status !== 'not-going' && (
              <div className="two-columns">
                <label>
                  Adults (including you)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                  />
                </label>
                <label>
                  Children
                  <input
                    type="number"
                    min={0}
                    max={30}
                    required
                    value={kids}
                    onChange={(e) => setKids(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
            {status === 'not-going' && committed.length > 0 && (
              <div className="alert">
                You are assigned {committed.map((d) => d.name).join(', ')}. Your
                dishes will be flagged for reassignment. Release them below or
                coordinate with a leader.
              </div>
            )}
            <small>
              Respond once per household. Adults and children are counts only;
              do not list children’s personal details.
            </small>
            <button className="button primary" disabled={c.busy}>
              Save my attendance
            </button>
            {mine && (
              <p>
                Your saved response:{' '}
                <strong>
                  {mine.status === 'not-going'
                    ? 'Not coming'
                    : mine.status === 'going'
                      ? 'Coming'
                      : 'Maybe'}
                </strong>
              </p>
            )}
          </form>
        </Panel>
        <Panel title="Who’s gathering">
          <div className="attendance-totals">
            <strong>
              {going.reduce((n, a) => n + a.adults + a.kids, 0)}
              <small>people coming</small>
            </strong>
            <strong>
              {responses.filter((a) => a.status === 'maybe').length}
              <small>households unsure</small>
            </strong>
            <strong>
              {
                roster.filter(
                  (m) => !responses.some((r) => r.user_id === m.user_id),
                ).length
              }
              <small>not responded</small>
            </strong>
          </div>
          {roster.map((m) => {
            const a = responses.find((r) => r.user_id === m.user_id);
            return (
              <div className="detail-row" key={m.user_id}>
                <span>{m.display_name}</span>
                <strong>
                  {!a
                    ? 'No response'
                    : a.status === 'not-going'
                      ? 'Not coming'
                      : a.status === 'maybe'
                        ? 'Maybe'
                        : `${a.adults} adults · ${a.kids} kids`}
                </strong>
              </div>
            );
          })}
          <small>
            Headcount is based on household responses. Leaders should check for
            duplicate household RSVPs.
          </small>
        </Panel>
      </div>
      {c.canGroup('meals') && <MealPlan meeting={meeting} names={names} />}
      {c.canGroup('kids') && (
        <section className="panel gathering-kids">
          <Badge>Kids’ time</Badge>
          <h2>A plan for the little ones.</h2>
          <p className="preserve">
            {meeting.kids_plan ||
              'No kids’ time plan yet. Share an idea in the Kids’ time tab or ask your leader about supervision.'}
          </p>
        </section>
      )}
    </>
  );
}
function MealPlan({
  meeting,
  names,
}: {
  meeting: Gathering;
  names: (id: string) => string;
}) {
  const c = useCommunity();
  const dishes = c.data.dishes.filter((d) => d.meeting_id === meeting.id);
  const roster = c.data.members.filter((m) => m.group_id === c.group?.id);
  const absent = (id: string | null) =>
    c.data.attendance.some(
      (a) =>
        a.meeting_id === meeting.id &&
        a.user_id === id &&
        a.status === 'not-going',
    );
  return (
    <section className="panel meal-plan">
      <div className="section-heading">
        <div>
          <Badge>Shared meal</Badge>
          <h2>{meeting.meal_theme || 'Let’s plan dinner together.'}</h2>
        </div>
        <span>
          {dishes.filter((d) => d.assignee_id && !absent(d.assignee_id)).length}{' '}
          / {dishes.length} dishes covered
        </span>
      </div>
      <p className="preserve">
        {meeting.meal_notes ||
          'Your leader can add a menu and dietary considerations.'}
      </p>
      <MenuSuggestions
        key={`${meeting.id}-${meeting.meal_theme}`}
        meeting={meeting}
      />
      <div className="dish-grid">
        {dishes.map((d) => (
          <article
            key={d.id}
            className={`dish-card ${absent(d.assignee_id) ? 'needs-cover' : ''}`}
          >
            <h3>{d.name}</h3>
            <p>{d.details}</p>
            <DishIngredients dish={d} />
            <Badge>
              {d.assignee_id ? names(d.assignee_id) : 'Available to bring'}
            </Badge>
            {absent(d.assignee_id) && (
              <p className="dish-warning">
                Needs reassignment · member is not coming
              </p>
            )}
            {!d.assignee_id && (
              <button
                className="button primary"
                disabled={c.busy || absent(c.userId)}
                onClick={() => void c.assignDish(d.id, c.userId)}
              >
                I’ll bring this
              </button>
            )}
            {d.assignee_id === c.userId && (
              <button
                className="button secondary"
                disabled={c.busy}
                onClick={() => void c.assignDish(d.id, null)}
              >
                Release my dish
              </button>
            )}
            {c.isLeader && (
              <label>
                Assign {d.name}
                <select
                  aria-label={`Assign ${d.name}`}
                  value={d.assignee_id ?? ''}
                  disabled={c.busy}
                  onChange={(e) =>
                    void c.assignDish(d.id, e.target.value || null)
                  }
                >
                  <option value="">Unassigned</option>
                  {roster.map((m) => (
                    <option
                      key={m.user_id}
                      value={m.user_id}
                      disabled={absent(m.user_id)}
                    >
                      {m.display_name}
                      {absent(m.user_id) ? ' · Not coming' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </article>
        ))}
      </div>
      {!dishes.length && <p>No dishes requested yet.</p>}
      {c.isLeader && (
        <form
          className="dish-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = formValues(form);
            if (
              await c.save(
                'dishes',
                {
                  id: crypto.randomUUID(),
                  meeting_id: meeting.id,
                  name: f.name,
                  details: f.details,
                  assignee_id: null,
                },
                true,
              )
            )
              form.reset();
          }}
        >
          <Field name="name" label="Dish or supply needed" required />
          <Field name="details" label="Servings / instructions" />
          <button className="button secondary" disabled={c.busy}>
            Add dish slot
          </button>
        </form>
      )}
    </section>
  );
}
function Conversation({ kind }: { kind: 'discussion' | 'kids' }) {
  const c = useCommunity();
  const [type, setType] = useState<Contribution['kind']>(
    kind === 'kids' ? 'kids' : 'question',
  );
  const [text, setText] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const posts = c.data.contributions.filter((p) => p.group_id === c.group?.id);
  const name = (id: string) =>
    c.data.members.find((m) => m.group_id === c.group?.id && m.user_id === id)
      ?.display_name ?? 'Group member';
  async function post(body: string, parent: string | null = null) {
    return c.save(
      'contributions',
      {
        id: crypto.randomUUID(),
        group_id: c.group!.id,
        author_id: c.userId,
        kind: kind === 'kids' ? 'kids' : type,
        text: body.trim(),
        parent_id: parent,
        created_at: new Date().toISOString(),
      },
      true,
    );
  }
  return (
    <div className="community-conversation">
      <Panel
        title={
          kind === 'kids'
            ? 'Share a kids’ time idea'
            : 'Bring your voice to the discussion'
        }
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await post(text)) setText('');
          }}
        >
          {kind !== 'kids' && (
            <label>
              Contribution type
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as Contribution['kind'])
                }
              >
                <option value="question">Question</option>
                <option value="idea">Idea</option>
                <option value="discussion">Discussion</option>
              </select>
            </label>
          )}
          <label>
            {kind === 'kids' ? 'Activity idea' : 'Your contribution'}
            <textarea
              required
              maxLength={10000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={c.busy || !text.trim()}>
            Share with group
          </button>
          <small>
            {c.configured
              ? 'Visible to members of this group. Updates refresh every 15 seconds.'
              : 'Local preview only. Nothing is sent to other members.'}
          </small>
        </form>
      </Panel>
      {posts
        .filter(
          (p) =>
            !p.parent_id &&
            (kind === 'kids' ? p.kind === 'kids' : p.kind !== 'kids'),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((p) => (
          <article className="panel table-post" key={p.id}>
            <div className="section-heading">
              <Badge>{p.kind} · User contribution</Badge>
              <span>{name(p.author_id)}</span>
            </div>
            <p className="preserve">{p.text}</p>
            {posts
              .filter((r) => r.parent_id === p.id)
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((r) => (
                <div className="reply" key={r.id}>
                  <strong>{name(r.author_id)}</strong>
                  <p className="preserve">{r.text}</p>
                </div>
              ))}
            <form
              className="reply-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await post(replies[p.id], p.id))
                  setReplies({ ...replies, [p.id]: '' });
              }}
            >
              <input
                aria-label={`Reply to ${p.text}`}
                required
                maxLength={10000}
                placeholder="Add a thoughtful reply…"
                value={replies[p.id] ?? ''}
                onChange={(e) =>
                  setReplies({ ...replies, [p.id]: e.target.value })
                }
              />
              <button
                className="button secondary"
                disabled={c.busy || !replies[p.id]?.trim()}
              >
                Reply
              </button>
            </form>
          </article>
        ))}
    </div>
  );
}
function Members() {
  const c = useCommunity();
  const [code, setCode] = useState('');
  return (
    <div className="two-columns">
      <Panel title="Around our group">
        {c.data.members
          .filter((m) => m.group_id === c.group?.id)
          .map((m) => (
            <div className="detail-row" key={m.user_id}>
              <span>{m.display_name}</span>
              <Badge>{m.role}</Badge>
            </div>
          ))}
        <p>
          Church leadership is listed in the{' '}
          <a className="text-button" href="#church">
            church workspace
          </a>
          .
        </p>
      </Panel>
      {c.isLeader && (
        <Panel title="Invite a member">
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = formValues(e.currentTarget);
              const result = await c.rpc('create_group_invite', {
                gid: c.group!.id,
                member_email: f.email,
                member_role: f.role,
              });
              if (typeof result === 'string') setCode(result);
            }}
          >
            <Field name="email" label="Member email" type="email" required />
            <label>
              Group role
              <select name="role">
                <option value="member">Member</option>
                <option value="guest">Guest</option>
                {c.isAdmin && <option value="leader">Group leader</option>}
              </select>
            </label>
            <button
              className="button primary"
              disabled={!c.configured || c.busy}
            >
              Create invitation code
            </button>
            <small>
              Give the code to the member yourself. This does not send an email
              or grant access until they sign in with the invited email and
              accept.
            </small>
            {!c.configured && (
              <p>Invitations require the connected login service.</p>
            )}
          </form>
          {code && (
            <div className="subtle-box">
              <strong>Invitation code</strong>
              <p className="invite-code">{code}</p>
              <p>
                Share your site’s Member login URL and this code. Expires in
                seven days.
              </p>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
