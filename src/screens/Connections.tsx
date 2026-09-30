import { AIStatusCard } from '../ai/StatusCard';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { bibleProviders } from '../domain/providers';
import { Badge, Heading } from '../components';
export function Connections() {
  const [selected, setSelected] = useState('');
  const [prompt, setPrompt] = useState(
    'Help me study [Bible passage or topic]. Explain the context, distinguish the biblical text from interpretation, and suggest thoughtful discussion questions. Cite sources I can check and clearly identify uncertainty.',
  );
  const [copyStatus, setCopyStatus] = useState('');
  const promptRef = useRef<HTMLTextAreaElement>(null);
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
        {bibleProviders.map((provider) => (
          <section className="panel connection-card" key={provider.id}>
            <span className="provider-logo">▤</span>
            <Badge>Planned integration</Badge>
            <h3>{provider.name}</h3>
            <p>
              {provider.capabilities.join(' · ')}
              <br />
              Access depends on approved APIs and applicable rights.
            </p>
            <button
              className="button secondary wide"
              onClick={() => setSelected(provider.name)}
            >
              Connection details →
            </button>
          </section>
        ))}
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
