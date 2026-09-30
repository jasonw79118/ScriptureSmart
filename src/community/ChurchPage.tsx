import { AccessControls } from './AccessControls';
import { formValues } from './forms';
import { useState, type ReactNode } from 'react';
import { useCommunity } from './CommunityContext';
import { Badge, Heading } from '../components';
import { redeemer, type ChurchIdentity, type CommunityGroup } from './models';
export function Field({
  name,
  label,
  value = '',
  type = 'text',
  required = false,
}: {
  name: string;
  label: string;
  value?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      {type === 'textarea' ? (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          maxLength={10000}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={type === 'text' ? 160 : undefined}
        />
      )}
    </label>
  );
}
export function CommunityStatus() {
  const c = useCommunity();
  return (
    <>
      {!c.configured && (
        <div className="community-mode">
          <Badge>Local planning preview</Badge>
          <span>
            Changes stay on this device. Member login and shared updates need a
            connected Appwrite project.
          </span>
          <a href="#member-login">Member login →</a>
        </div>
      )}
      {c.configured && !c.session && (
        <div className="community-mode">
          Sign in to see your church and groups.{' '}
          <a href="#member-login">Member login →</a>
        </div>
      )}
      {c.error && (
        <div className="alert" role="alert">
          {c.error}
        </div>
      )}
      {c.message && (
        <div className="notice" role="status">
          {c.message}
          <button
            aria-label="Dismiss community notification"
            onClick={() => c.setMessage('')}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
export function ChurchSwitcher() {
  const c = useCommunity();
  return c.data.churches.length > 1 ? (
    <label className="church-switch">
      Church workspace
      <select
        aria-label="Church workspace"
        value={c.church?.id ?? ''}
        onChange={(e) => c.setSelectedChurch(e.target.value)}
      >
        {c.data.churches.map((ch) => (
          <option key={ch.id} value={ch.id}>
            {ch.name}
          </option>
        ))}
      </select>
    </label>
  ) : null;
}
export function ChurchPage() {
  const c = useCommunity();
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [name, setName] = useState('');
  const church = c.church;
  const identity =
    creating || !church
      ? {
          ...redeemer,
          name: '',
          city: '',
          group_label: 'Small Group',
          group_label_plural: 'Small Groups',
          welcome: '',
        }
      : church;
  return (
    <>
      <Heading
        title="A place for your church."
        subtitle="Your identity, your leadership, your way of gathering."
      />
      <CommunityStatus />
      <ChurchSwitcher />
      {c.isAdmin && <AccessControls scope="church" />}
      {(!c.configured || c.session) && (
        <>
          <div className="editor-toolbar">
            <button
              className="button secondary"
              onClick={() => setCreating(!creating)}
            >
              {creating ? 'Back to my church' : 'Set up another church'}
            </button>
          </div>
          <div className="two-columns">
            <section className="panel">
              <h2>
                {creating || !church
                  ? 'Create a church workspace'
                  : church.name}
              </h2>
              <p>Church → Leadership → {identity.group_label_plural}</p>
              {creating || !church || c.isAdmin ? (
                <form
                  key={creating ? 'new' : church?.id}
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = formValues(e.currentTarget);
                    const values = {
                      name: f.name,
                      city: f.city,
                      group_label: f.group_label,
                      group_label_plural: f.group_label_plural,
                      accent: f.accent,
                      welcome: f.welcome,
                      leaders: f.leaders,
                    };
                    if (creating || !church) {
                      if (c.configured) {
                        const id = await c.rpc('create_church', {
                          identity: values,
                          display_name: f.display_name,
                        });
                        if (typeof id === 'string') {
                          c.setSelectedChurch(id);
                          setCreating(false);
                        }
                      } else {
                        const id = crypto.randomUUID();
                        await c.run(async () =>
                          c.persist({
                            ...c.data,
                            churches: [
                              ...c.data.churches,
                              { ...values, id, owner_id: c.userId },
                            ],
                          }),
                        );
                        c.setSelectedChurch(id);
                        setCreating(false);
                      }
                    } else
                      await c.save('churches', {
                        ...church,
                        ...values,
                      } as ChurchIdentity);
                  }}
                >
                  <Field
                    name="name"
                    label="Church name"
                    value={identity.name}
                    required
                  />
                  <Field
                    name="city"
                    label="City and state"
                    value={identity.city}
                  />
                  <div className="two-columns">
                    <Field
                      name="group_label"
                      label="Group name (singular)"
                      value={identity.group_label}
                      required
                    />
                    <Field
                      name="group_label_plural"
                      label="Group name (plural)"
                      value={identity.group_label_plural}
                      required
                    />
                  </div>
                  <Field
                    name="accent"
                    label="Church accent color"
                    type="color"
                    value={identity.accent}
                  />
                  <Field
                    name="welcome"
                    label="Welcome message"
                    value={identity.welcome}
                  />
                  <Field
                    name="leaders"
                    label="Church leadership — names and roles"
                    type="textarea"
                    value={identity.leaders}
                  />
                  <small>
                    This leadership directory describes people’s roles. Group
                    access is granted through invitations.
                  </small>
                  {(creating || !church) && (
                    <Field name="display_name" label="Your name" required />
                  )}
                  <button disabled={c.busy} className="button primary">
                    {creating || !church
                      ? 'Create church workspace'
                      : 'Save church identity'}
                  </button>
                </form>
              ) : (
                <>
                  <p>{church?.city}</p>
                  <p>{church?.welcome}</p>
                  <h3>Church leadership</h3>
                  <p className="preserve">
                    {church?.leaders ||
                      'Leadership details have not been added.'}
                  </p>
                </>
              )}
            </section>
            <section className="panel form-stack">
              <h2>{church?.group_label_plural ?? 'Groups'}</h2>
              <p>
                Each group can choose its own meeting rhythm, location, meal
                practices, and kids’ time.
              </p>
              {c.groups.map((g) => (
                <button
                  className="group-directory-card"
                  key={g.id}
                  onClick={() => {
                    c.setSelectedGroup(g.id);
                    window.location.assign('#groups');
                  }}
                >
                  <strong>{g.name} →</strong>
                  <small>{g.rhythm || 'Meeting schedule not set'}</small>
                </button>
              ))}
              {church && c.isAdmin && !creating && (
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (c.configured) {
                      const id = await c.rpc('create_group', {
                        church_id: church.id,
                        group_name: groupName,
                        display_name: name,
                      });
                      if (typeof id === 'string') {
                        c.setSelectedGroup(id);
                        setGroupName('');
                        window.location.assign('#groups');
                      }
                    } else {
                      const id = crypto.randomUUID();
                      const g: CommunityGroup = {
                        id,
                        church_id: church.id,
                        name: groupName.trim(),
                        description: '',
                        rhythm: '',
                        location: '',
                        address: '',
                        directions: '',
                        timezone: 'America/Chicago',
                        hosts: '',
                        age_range: '',
                        meals_enabled: true,
                        kids_enabled: true,
                      };
                      await c.run(async () =>
                        c.persist({
                          ...c.data,
                          groups: [...c.data.groups, g],
                          members: [
                            ...c.data.members,
                            {
                              group_id: id,
                              user_id: c.userId,
                              display_name: name.trim(),
                              role: 'leader',
                            },
                          ],
                        }),
                      );
                      c.setSelectedGroup(id);
                      setGroupName('');
                      window.location.assign('#groups');
                    }
                  }}
                >
                  <label>
                    New group name
                    <input
                      required
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Your name as group leader
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                    />
                  </label>
                  <button
                    className="button primary"
                    disabled={c.busy || !groupName.trim() || !name.trim()}
                  >
                    Create group
                  </button>
                </form>
              )}
              <div className="subtle-box">
                <strong>Built for different church rhythms</strong>
                <p>
                  Meals and kids’ time can be enabled per group. Private
                  locations, discussions, and member responses are restricted to
                  group members once connected.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="panel form-stack">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
