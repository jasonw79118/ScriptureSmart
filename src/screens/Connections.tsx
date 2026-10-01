import { AIStatusCard } from '../ai/StatusCard';
import {
  getBibleProviderStatus,
  type BibleProviderStatus,
} from '../ai/bibleClient';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { bibleProviders } from '../domain/providers';
import { Badge, Heading } from '../components';

export function Connections() {
  const [selected, setSelected] = useState('');
  const [prompt, setPrompt] = useState(
    'Help me study [Bible passage or topic]. Explain the context, distinguish the biblical text from interpretation, and suggest thoughtful discussion questions. Cite sources I can check and clearly identify uncertainty.',
  );
  const [copyStatus, setCopyStatus] = useState('');
  const [bibleStatus, setBibleStatus] = useState<
    'checking' | 'ready' | 'unavailable'
  >('checking');
  const [bibleConnection, setBibleConnection] = useState<BibleProviderStatus | null>(
    null,
  );
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getBibleProviderStatus(controller.signal)
      .then((status) => {
        setBibleConnection(status);
        setBibleStatus(status.available ? 'ready' : 'unavailable');
      })
      .catch(() => setBibleStatus('unavailable'));
    return () => controller.abort();
  }, []);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus(
        'Prompt copied. Open your AI service and paste it into a new conversation.',
      );
    } catch {
      promptRef.current?.focus();
      promptRef.current?.select();
      setCopyStatus(
        'Automatic copying is unavailable. Select and copy the prompt, then paste it into your AI service.',
      );
    }
  }

  return (
    <>
      <Heading
        title="Your tools, thoughtfully connected."
        subtitle="Bring your preferred providers into your study workspace."
      />
      <AIStatusCard />
      <section className="subtle-box">
        <strong>Use the AI account you already have</strong>
        <p>
          Choose a service below and sign in on its own website. Your existing
          plan and limits apply there. No API key is needed, and ScriptureSmart
          never asks for your AI account password.
        </p>
        <p>
          These links open a separate tab. Your ScriptureSmart notes are not
          sent automatically, and answers do not sync back. You can copy useful
          answers into your study notes.
        </p>
      </section>
      <div className="section-heading">
        <h2>Optional external AI services</h2>
        <span className="muted">Use your own account</span>
      </div>
      <div className="connection-grid">
        {[
          { name: 'ChatGPT', url: 'https://chatgpt.com/', symbol: 'C' },
          { name: 'Claude', url: 'https://claude.ai/', symbol: 'C' },
          { name: 'Grok', url: 'https://grok.com/', symbol: 'G' },
        ].map(({ name, url, symbol }, i) => (
          <section className="panel connection-card" key={name}>
            <div className={`provider-logo provider-${i}`} aria-hidden="true">
              {symbol}
            </div>
            <Badge>Opens provider website</Badge>
            <h3>{name}</h3>
            <p>
              Use {name} with your own account for study questions, research,
              and discussion ideas.
            </p>
            <a
              className="button secondary wide"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {name}
              <span className="sr-only"> (new tab)</span>
            </a>
          </section>
        ))}
      </div>
      <section className="panel form-stack ai-prompt-panel">
        <h2>Take a study prompt with you</h2>
        <p>
          Replace the brackets with your passage or topic, copy the prompt, then
          open your preferred service above. Review what you choose to share
          before pasting it.
        </p>
        <label>
          Study prompt
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setCopyStatus('');
            }}
            rows={6}
          />
        </label>
        <button
          className="button primary"
          disabled={!prompt.trim()}
          onClick={() => void copyPrompt()}
        >
          Copy study prompt
        </button>
        {copyStatus && <p role="status">{copyStatus}</p>}
        <small>
          Check AI answers against Scripture and the sources they cite. This
          prompt stays on this page until you copy it; it is not saved.
        </small>
      </section>
      <div className="section-heading">
        <h2>Scripture</h2>
        <span className="muted">Approved sources & licensing</span>
      </div>
      <div className="connection-grid bible-connections">
        <section className="panel connection-card">
          <span className="provider-logo">✝</span>
          <Badge>
            {bibleStatus === 'checking'
              ? 'Checking connection'
              : bibleStatus === 'ready'
                ? 'Connected'
                : 'Needs server setup'}
          </Badge>
          <h3>Available Bible text</h3>
          <p>
            Bible content is retrieved through ScriptureSmart&apos;s secure server
            connections. Provider keys stay off member devices.
          </p>
          <strong role="status">
            {bibleStatus === 'checking'
              ? 'Checking Bible providers...'
              : bibleStatus === 'ready'
                ? 'At least one Bible text provider is ready.'
                : 'No Bible text providers are connected yet.'}
          </strong>
          {bibleConnection?.translations.length ? (
            <p className="muted">
              Available translations:{' '}
              {bibleConnection.translations
                .map((translation) => translation.id)
                .join(', ')}
            </p>
          ) : null}
          <a className="button primary wide" href="#study">
            Open Bible study
          </a>
        </section>
        {bibleProviders
          .filter((provider) => provider.id !== 'youversion')
          .map((provider) => {
            const availableIds = new Set(bibleConnection?.translations.map((item) => item.id) ?? []);
            const configured = provider.id === 'esv'
              ? availableIds.has('ESV')
              : provider.id === 'api-bible'
                ? ['KJV', 'NKJV', 'NIV'].some((id) => availableIds.has(id))
                : false;
            return (
            <section className="panel connection-card" key={provider.id}>
              <span className="provider-logo">▤</span>
              <Badge>{bibleStatus === 'checking' ? 'Checking connection' : configured ? 'Connected' : 'Setup needed'}</Badge>
              <h3>{provider.name}</h3>
              <p>
                {provider.id === 'api-bible'
                  ? 'KJV, NKJV, and NIV are requested through API.Bible. Access depends on your account’s selected licenses.'
                  : provider.id === 'esv'
                    ? 'ESV passages use Crossway’s official API and are shown with its required attribution.'
                    : `${provider.capabilities.join(' · ')}. Access depends on approved APIs and applicable rights.`}
              </p>
              {provider.id === 'api-bible' && <small>Cloudflare secret: API_BIBLE_KEY</small>}
              {provider.id === 'esv' && <small>Cloudflare secret: ESV_API_KEY</small>}
              {provider.id === 'api-bible' || provider.id === 'esv' ? (
                <a className="button secondary wide" href={provider.id === 'api-bible' ? 'https://api.bible/' : 'https://api.esv.org/'} target="_blank" rel="noopener noreferrer">
                  {provider.id === 'api-bible' ? 'Open API.Bible account ↗' : 'Open Crossway ESV API ↗'}
                </a>
              ) : (
                <button className="button secondary wide" onClick={() => setSelected(provider.name)}>
                  Connection details →
                </button>
              )}
            </section>
            );
          })}
      </div>
      <section className="panel">
        <h2>
          Church content <Badge>Future</Badge>
        </h2>
        <p>
          YouTube · Google Drive · Dropbox · Planning Center · Church Center ·
          Podcast RSS
        </p>
        <p className="muted">
          Import sermons and resources using approved integrations when
          available.
        </p>
      </section>
      {selected && (
        <ConnectionDialog onClose={() => setSelected('')}>
          <Badge>Not available yet</Badge>
          <h2 id="connection-title">Connect {selected}</h2>
          <p>
            A trusted server and approved provider adapter must be configured
            first. Never enter your normal account password.
          </p>
          <label>
            API credential preview
            <input
              type="password"
              autoComplete="off"
              disabled
              placeholder="Credential entry disabled until secure storage is ready"
            />
          </label>
          <p className="muted">
            This prototype does not accept, save, or transmit credentials.
            Official OAuth can be added where supported.
          </p>
          <button className="button primary" disabled>
            Secure connection unavailable
          </button>
          <button className="button secondary" onClick={() => setSelected('')}>
            Close details
          </button>
        </ConnectionDialog>
      )}
    </>
  );
}

function ConnectionDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel connection-details"
      aria-labelledby="connection-title"
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}
