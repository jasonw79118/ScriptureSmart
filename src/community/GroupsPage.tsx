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
import { Badge, Heading } from '../components';
import { ChurchSwitcher, CommunityStatus, Field, Panel } from './ChurchPage';
import type { Gathering, Contribution } from './models';
export function GroupsPage() {
  const c = useCommunity();
  const [tab, setTab] = useState('Gatherings');
  const [selectedMeeting, setSelectedMeeting] = useState('');
  const [newMeeting, setNewMeeting] = useState(false);
  const g = c.group;
  const meetings = c.data.meetings
    .filter((m) => m.group_id === g?.id)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
    );
  const meeting = meetings.find((m) => m.id === selectedMeeting) ?? meetings[0];
  return (
    <>
      <Heading
        title={c.church?.group_label_plural ?? 'Your church community'}
        subtitle={
          c.church
            ? `${c.church.name} · ${c.church.city}`
            : 'Sign in to see the groups you belong to.'
        }
      />
      <CommunityStatus />
      <ChurchSwitcher />
      <p>
        <a href="#find-group">Find a group that fits your household ?</a>
      </p>
      {!g ? (
        <div className="panel">
          <h2>
            {c.configured && !c.session
              ? 'Your group is waiting.'
              : 'No groups yet.'}
          </h2>
          <p>
            Join with an invitation from your leader, or create a group from
            your church workspace.
          </p>
          <a className="button primary" href="#member-login">
            Member login / join group
          </a>{' '}
          <a className="button secondary" href="#church">
            Church workspace
          </a>
        </div>
      ) : (
        <>
          <div
            className="community-hero"
            style={{ borderTopColor: c.church?.accent }}
          >
            <div>
              <Badge>{c.church?.group_label}</Badge>
              <h2>{g.name}</h2>
              <p>{g.description || c.church?.welcome}</p>
              <div className="group-facts">
                <span>◷ {g.rhythm || 'Meeting time to be added'}</span>
                <span>⌖ {g.location || 'Location to be added'}</span>
              </div>
            </div>
            <label>
              My groups
              <select
                aria-label="My groups"
                value={g.id}
                onChange={(e) => {
                  c.setSelectedGroup(e.target.value);
                  setSelectedMeeting('');
                }}
              >
                {c.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="tabs" aria-label="Group sections">
            {[
              'Gatherings',
              ...(c.canGroup('discussion') ? ['Discussion'] : []),
              ...(c.canGroup('kids') ? ['Kids’ time'] : []),
              ...(c.canGroup('meals') ? ['Food needs'] : []),
              'Members',
              'Group details',
            ].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'Gatherings' && (
            <>
              <div className="editor-toolbar">
                {meetings.length > 0 && (
                  <label className="meeting-select">
                    Gathering
                    <select
                      aria-label="Gathering"
                      value={meeting?.id ?? ''}
                      onChange={(e) => {
                        setSelectedMeeting(e.target.value);
                        setNewMeeting(false);
                      }}
                    >
                      {meetings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.date} · {m.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {c.isLeader && (
                  <button
                    className="button primary"
                    onClick={() => setNewMeeting(!newMeeting)}
                  >
                    {newMeeting ? 'Cancel new gathering' : 'Plan a gathering'}
                  </button>
                )}
              </div>
              {newMeeting && (
                <MeetingEditor
                  onSaved={(id) => {
                    setNewMeeting(false);
                    setSelectedMeeting(id);
                  }}
                />
              )}
              {!meeting && !newMeeting && (
                <div className="empty">
                  <h2>Make room for your next gathering.</h2>
                  <p>
                    A leader can add a date and time, meal plan, and kids’
                    activities. Each gathering gets its own attendance and dish
                    sign-ups.
                  </p>
                </div>
              )}
              {meeting && !newMeeting && (
                <GatheringView key={meeting.id} meeting={meeting} />
              )}
            </>
          )}
          {tab === 'Discussion' && c.canGroup('discussion') && (
            <Conversation kind="discussion" />
          )}
          {tab === 'Kids’ time' && g.kids_enabled && (
            <>
              <div className="subtle-box">
                <strong>Ideas for time with kids</strong>
                <p>
                  For ages 0–3, offer supervised play and a short song. Ages 4–7
                  can retell a story or draw a scene. Ages 8–14 can discuss a
                  question or plan a small service activity. These are suggested
                  activities; leaders should choose age-appropriate plans and
                  supervision.
                </p>
              </div>
              <Conversation kind="kids" />
            </>
          )}
          {tab === 'Food needs' && c.canGroup('meals') && (
            <DietaryPreferences />
          )}
          {tab === 'Members' && (
            <>
              <Members />
              {c.isLeader && <AccessControls scope="group" />}
            </>
          )}
          {tab === 'Group details' && (
            <>
              <GroupDetails />
              {c.isLeader && <DirectoryEditor key={g.id} />}
            </>
          )}
        </>
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
