import { useEffect, useState } from 'react';
import { aiService } from './client';
import { Badge } from '../components';
import { useCommunity } from '../community/CommunityContext';
import './ai.css';
export function AIStatusCard() {
  const { session, authReady } = useCommunity();
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable'>(
    'checking',
  );
  useEffect(() => {
    let active = true;
    void aiService.isAvailable().then((available) => {
      if (active) setStatus(available ? 'ready' : 'unavailable');
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel ai-status-card">
      <Badge>Built-in · Default</Badge>
      <h2>ScriptureSmart AI</h2>
      <p>
        Included with ScriptureSmart. No external AI subscription or API key
        required.
      </p>
      <strong role="status">
        {status === 'checking'
          ? 'Checking service…'
          : status === 'ready'
            ? !authReady
              ? 'Available · Checking your sign-in'
              : session
                ? 'Available · Ready to ask'
                : 'Available · Sign in to ask'
            : 'Service unavailable · Administrator setup may be required'}
      </strong>
      <p>
        Use Ask ScriptureSmart in passage study or your sermon, Bible study, and
        discussion-guide editors. You choose the context and review each answer
        before inserting it.
      </p>
      <a className="button primary" href="#study">
        Open passage study
      </a>
      <details>
        <summary>Advanced information</summary>
        <p>
          The built-in assistant uses a configured server model. Service
          availability is a configuration check; individual requests may still
          fail or reach a limit. Model information appears with each response.
          Passage study can retrieve selected WEB Bible passages. Commentary and
          original-language sources are not connected.
        </p>
      </details>
    </section>
  );
}
