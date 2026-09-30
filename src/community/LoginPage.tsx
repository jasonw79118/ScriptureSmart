import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import { Heading } from '../components';
import { CommunityStatus } from './ChurchPage';
export function LoginPage() {
  const c = useCommunity();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  return (
    <>
      <Heading
        title="Come on in."
        subtitle="Sign in to your church community, then open your group."
      />
      <CommunityStatus />
      <p>
        <a href="#onboarding">
          Choose your church or check membership approval ?
        </a>
      </p>
      <div className="two-columns">
        <section className="panel form-stack">
          <h2>Member and guest login</h2>
          {!c.authReady ? (
            <p>Checking your session…</p>
          ) : c.session ? (
            <>
              <p>Signed in as {c.session.user.email}</p>
              <button
                className="button secondary"
                disabled={c.busy}
                onClick={() => void c.signOut()}
              >
                Sign out
              </button>
              <a className="button primary" href="#groups">
                Open my groups →
              </a>
            </>
          ) : (
            <>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void c.signIn(email.trim());
                }}
              >
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!c.authConfigured}
                  />
                </label>
                <p>
                  Appwrite will send a one-time code. Use the email address your
                  group leader invited.
                </p>
                <button
                  className="button primary"
                  disabled={!c.authConfigured || c.busy}
                >
                  Email me a sign-in code
                </button>
              </form>
              {c.loginToken && (
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void c.verifyCode(otp.trim());
                  }}
                >
                  {c.phrase && (
                    <p>
                      Check that your email shows this security phrase:{' '}
                      <strong>{c.phrase}</strong>
                    </p>
                  )}
                  <label>
                    Email sign-in code
                    <input
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </label>
                  <button className="button primary" disabled={c.busy}>
                    Verify and sign in
                  </button>
                </form>
              )}
            </>
          )}
        </section>
        <section className="panel form-stack">
          <h2>Join your {c.church?.group_label ?? 'group'}</h2>
          <p>
            Your leader can give you a single-use invitation code for your email
            address. Members and guests can both participate.
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const id = await c.rpc('join_group', {
                invite_code: code.trim(),
                display_name: name.trim(),
              });
              if (typeof id === 'string') {
                c.setSelectedGroup(id);
                window.location.assign('#groups');
              }
            }}
          >
            <label>
              Your name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Invitation code
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={!c.session || !c.configured || c.busy}
            >
              Join group
            </button>
          </form>
          <a className="text-button" href="#church">
            Starting a church workspace? Set up your church →
          </a>
        </section>
      </div>
    </>
  );
}
