import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import { Heading } from '../components';
import { CommunityStatus } from './ChurchPage';

export function LoginPage() {
  const c = useCommunity();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recovery, setRecovery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const secret = params.get('secret');
    return userId && secret ? { userId, secret } : null;
  });
  function leaveRecovery() {
    const url = new URL(window.location.href);
    url.searchParams.delete('userId');
    url.searchParams.delete('secret');
    url.hash = 'member-login';
    window.history.replaceState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
    setRecovery(null);
    setPassword('');
    setRecovering(false);
  }

  return (
    <>
      <Heading
        title="Come on in."
        subtitle="Sign in to your church community, then open your group."
      />
      <CommunityStatus />
      <p>
        <a href="#onboarding">
          Choose your church or check membership approval →
        </a>
      </p>
      <div className="two-columns">
        <section className="panel form-stack">
          <h2>
            {recovery
              ? 'Set a new password'
              : creatingAccount
                ? 'Create your account'
                : recovering
                  ? 'Reset your password'
                  : 'Member and guest login'}
          </h2>
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
          ) : recovery ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  const completed = await c.completePasswordRecovery(
                    recovery.userId,
                    recovery.secret,
                    password,
                  );
                  if (!completed) return;
                  leaveRecovery();
                })();
              }}
            >
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={!c.authConfigured || c.busy}
              >
                Save new password
              </button>
              <button
                type="button"
                className="text-button"
                onClick={leaveRecovery}
              >
                Back to member login
              </button>
            </form>
          ) : recovering ? (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void c.recoverPassword(email.trim());
              }}
            >
              <p>
                We’ll email you a secure link to set or reset your password.
              </p>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={!c.authConfigured || c.busy}
              >
                Email password reset link
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setRecovering(false)}
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (creatingAccount)
                    void c.createAccount(name.trim(), email.trim(), password);
                  else void c.signIn(email.trim(), password);
                }}
              >
                {creatingAccount && (
                  <label>
                    Your name
                    <input
                      autoComplete="name"
                      maxLength={128}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                )}
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
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete={
                      creatingAccount ? 'new-password' : 'current-password'
                    }
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!c.authConfigured}
                  />
                </label>
                <button
                  className="button primary"
                  disabled={!c.authConfigured || c.busy}
                >
                  {creatingAccount ? 'Create account' : 'Sign in'}
                </button>
              </form>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCreatingAccount(!creatingAccount);
                  setPassword('');
                }}
              >
                {creatingAccount
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account'}
              </button>
              {!creatingAccount && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRecovering(true)}
                >
                  Forgot password or need to set one?
                </button>
              )}
              {!creatingAccount && (
                <p>
                  Use the email address your group leader invited. Existing
                  one-time-code accounts can set a password through password
                  recovery.
                </p>
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
