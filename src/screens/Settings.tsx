import { useCommunity } from '../community/CommunityContext';
import { defaultAIProviderId } from '../domain/ai';
import type { Preferences } from '../domain/models';
import { translations } from '../domain/providers';
import { Heading } from '../components';
import { exportText } from '../utils';
export function Settings({
  settings,
  save,
  backup,
}: {
  settings: Preferences;
  save: (s: Preferences) => void;
  backup: unknown;
}) {
  const community = useCommunity();
  return (
    <>
      <Heading
        title="Make this space yours."
        subtitle="Workspace preferences are saved on this device."
      />
      <div className="two-columns">
        <section className="panel form-stack">
          <h2>Study preferences</h2>
          <label>
            Display name
            <input
              value={settings.name}
              maxLength={80}
              onChange={(e) => save({ ...settings, name: e.target.value })}
            />
          </label>
          <label>
            Preferred translation
            <select
              aria-label="Preferred translation"
              value={settings.translation}
              onChange={(e) =>
                save({ ...settings, translation: e.target.value })
              }
            >
              {translations.map((t) => (
                <option key={t.id}>{t.id}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Comparison translations</legend>
            {translations.map((t) => (
              <label className="check" key={t.id}>
                <input
                  type="checkbox"
                  checked={settings.comparisons.includes(t.id)}
                  onChange={(e) =>
                    save({
                      ...settings,
                      comparisons: e.target.checked
                        ? [...settings.comparisons, t.id]
                        : settings.comparisons.filter((id) => id !== t.id),
                    })
                  }
                />
                {t.name}
              </label>
            ))}
          </fieldset>
          <h3>Optional theology profile</h3>
          <label>
            Tradition
            <select
              value={settings.tradition}
              onChange={(e) => save({ ...settings, tradition: e.target.value })}
            >
              {[
                'Not specified',
                'Baptist',
                'Methodist / Wesleyan',
                'Reformed',
                'Lutheran',
                'Anglican',
                'Pentecostal',
                'Church of Christ',
                'Catholic',
                'Orthodox',
                'Non-denominational',
                'Custom Statement of Faith',
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Statement of faith
            <textarea
              value={settings.statement}
              onChange={(e) => save({ ...settings, statement: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.showOthers}
              onChange={(e) =>
                save({ ...settings, showOthers: e.target.checked })
              }
            />
            Show other interpretations by default
          </label>
          <small>
            This preference will never remove access to other interpretations.
          </small>
        </section>
        <section className="panel form-stack">
          <h2>AI preferences</h2>
          <label>
            Default AI Provider
            <select
              value={settings.defaultAIProvider ?? defaultAIProviderId}
              onChange={(e) =>
                save({ ...settings, defaultAIProvider: e.target.value })
              }
            >
              <option value={defaultAIProviderId}>ScriptureSmart AI</option>
            </select>
          </label>
          <p>
            The built-in assistant uses the site administrator's configured
            model. External websites are optional and do not become connected
            providers when opened.
          </p>
          <a href="#connections">Check AI service availability</a>
          <h2>Account & privacy</h2>
          <p>
            {community.session
              ? `Signed in as ${community.session.user.email}.`
              : 'Sign in to use ScriptureSmart AI.'}{' '}
            Personal drafts remain in this browser until you explicitly share
            selected content.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              exportText(
                'scripturesmart-backup.json',
                JSON.stringify(backup, null, 2),
                'application/json',
              )
            }
          >
            Export workspace backup ↓
          </button>
          <p className="muted">
            Shared church features require the deployed Appwrite community
            service. AI uses the separate built-in assistant service.
          </p>
        </section>
      </div>
    </>
  );
}
