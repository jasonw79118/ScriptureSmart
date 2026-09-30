import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import { CommunityStatus } from './ChurchPage';
import { Heading } from '../components';
export function Onboarding() {
  const c = useCommunity();
  const [search, setSearch] = useState('Redeemer');
  const [results, setResults] = useState<
    { id: string; name: string; city: string }[]
  >([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const memberships = c.data.church_members.filter(
    (m) => m.user_id === c.userId,
  );
  return (
    <>
      <Heading
        title="First, find your church."
        subtitle="One account. A church community to call home."
      />
      <CommunityStatus />
      {c.configured && !c.session ? (
        <a className="button primary" href="#member-login">
          Sign in to continue
        </a>
      ) : (
        <div className="two-columns">
          <section className="panel form-stack">
            <div className="eyebrow">STEP 1 · CHURCH CONNECTION</div>
            <h2>Choose an existing church</h2>
            <p>
              Joining a church requests member access. Your church administrator
              reviews the request.
            </p>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void c.run(
                  async () =>
                    setResults(await c.churchDirectory(search.trim())),
                  'Church search complete.',
                );
              }}
            >
              <label>
                Church name or city
                <input
                  required
                  minLength={2}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button className="button secondary" disabled={c.busy}>
                Find churches
              </button>
            </form>
            {results.map((ch) => (
              <label className="church-result" key={ch.id}>
                <input
                  type="radio"
                  name="church"
                  checked={selected === ch.id}
                  onChange={() => setSelected(ch.id)}
                />
                <span>
                  <strong>{ch.name}</strong>
                  <small>{ch.city}</small>
                </span>
              </label>
            ))}
            {selected && (
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await c.rpc('request_church', {
                    churchId: selected,
                    display_name: name.trim(),
                  });
                }}
              >
                <label>
                  Your name
                  <input
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className="button primary"
                  disabled={c.busy || !name.trim()}
                >
                  Request church membership
                </button>
              </form>
            )}
            <p className="muted">
              Cannot find your church? Ask its administrator for an invitation.
              Church setup is a separate administrator task.
            </p>
            <a className="text-button" href="#church">
              I’m setting up a church as its administrator →
            </a>
          </section>
          <section className="panel form-stack">
            <div className="eyebrow">STEP 2 · FIND YOUR PEOPLE</div>
            <h2>Your church connection</h2>
            {memberships.map((m) => (
              <article key={m.church_id} className="subtle-box">
                <strong>
                  {c.data.churches.find((ch) => ch.id === m.church_id)?.name}
                </strong>
                <p>
                  {m.status === 'pending'
                    ? 'Awaiting church administrator approval.'
                    : m.status === 'approved'
                      ? 'Membership approved.'
                      : m.status === 'suspended'
                        ? 'Access is suspended. Contact your church administrator.'
                        : 'Your request was declined. Contact the church for help.'}
                </p>
              </article>
            ))}
            {c.isAdmin && <p>You administer {c.church?.name}.</p>}
            {!c.needsChurch && c.church && (
              <a className="button primary" href="#find-group">
                Help me find a group →
              </a>
            )}
            <p>
              Already know your group? Use the invitation code from your leader.
            </p>
            <a className="text-button" href="#member-login">
              Enter a group invitation →
            </a>
          </section>
        </div>
      )}
    </>
  );
}
