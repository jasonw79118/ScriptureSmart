import { useState } from 'react';
import type { TableItem } from '../domain/models';
import { Badge, Heading } from '../components';
export function TableWorkspace({
  items,
  save,
}: {
  items: TableItem[];
  save: (i: TableItem[]) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<TableItem['kind']>('question');
  const [reply, setReply] = useState<Record<string, string>>({});
  const [nightOnly, setNightOnly] = useState(false);
  return (
    <>
      <Heading
        title="There’s a place at The Table."
        subtitle="Bring a passage. Ask a question. Make room for one another."
      />
      <div className="table-context">
        <div className="group-art">♧</div>
        <div>
          <strong>Sunday evening fellowship</strong>
          <p>Sample group · Ephesians · Local discussion prototype</p>
        </div>
        <Badge>No live sharing</Badge>
      </div>
      <div className="two-columns table-layout">
        <section>
          <form
            className="panel form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              save([
                {
                  id: crypto.randomUUID(),
                  groupId: 'sample-group',
                  kind,
                  text: text.trim(),
                  forGroupNight: false,
                  replies: [],
                },
                ...items,
              ]);
              setText('');
            }}
          >
            <h2>Bring something to The Table</h2>
            <label>
              Item type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as TableItem['kind'])}
              >
                <option value="question">Question</option>
                <option value="passage">Bible passage</option>
                <option value="resource">Resource / source link</option>
                <option value="note">Research note</option>
                <option value="sermon-excerpt">Sermon excerpt</option>
              </select>
            </label>
            <label>
              Your contribution
              <textarea
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What would you like to explore together? Include a source when sharing a resource."
              />
            </label>
            <button className="button primary" disabled={!text.trim()}>
              Add to local Table →
            </button>
          </form>
          <div className="section-heading">
            <h2>The conversation</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={nightOnly}
                onChange={(e) => setNightOnly(e.target.checked)}
              />
              Group night only
            </label>
          </div>
          {items
            .filter((i) => !nightOnly || i.forGroupNight)
            .map((item) => (
              <article className="panel table-post" key={item.id}>
                <div className="section-heading">
                  <Badge>
                    {item.kind} · {item.sample ? 'Sample' : 'USER NOTE'}
                  </Badge>
                  <span className="muted">Local workspace</span>
                </div>
                <p className="preserve">{item.text}</p>
                {item.passage && (
                  <span className="passage-tag">▤ {item.passage}</span>
                )}
                <button
                  className="text-button save-night"
                  onClick={() =>
                    save(
                      items.map((i) =>
                        i.id === item.id
                          ? { ...i, forGroupNight: !i.forGroupNight }
                          : i,
                      ),
                    )
                  }
                >
                  {item.forGroupNight
                    ? '★ Saved for group night'
                    : '☆ Save for group night'}
                </button>
                {item.replies.map((r) => (
                  <div className="reply" key={r.id}>
                    <strong>You · Local reply</strong>
                    <p className="preserve">{r.text}</p>
                  </div>
                ))}
                <form
                  className="reply-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!reply[item.id]?.trim()) return;
                    save(
                      items.map((i) =>
                        i.id === item.id
                          ? {
                              ...i,
                              replies: [
                                ...i.replies,
                                {
                                  id: crypto.randomUUID(),
                                  text: reply[item.id].trim(),
                                },
                              ],
                            }
                          : i,
                      ),
                    );
                    setReply({ ...reply, [item.id]: '' });
                  }}
                >
                  <input
                    aria-label={`Reply to ${item.text}`}
                    placeholder="Add a thoughtful reply…"
                    value={reply[item.id] ?? ''}
                    onChange={(e) =>
                      setReply({ ...reply, [item.id]: e.target.value })
                    }
                  />
                  <button
                    className="button secondary"
                    disabled={!reply[item.id]?.trim()}
                  >
                    Reply
                  </button>
                </form>
              </article>
            ))}
        </section>
        <aside className="panel table-aside">
          <div className="eyebrow">FOR YOUR NEXT GATHERING</div>
          <h2>
            Good questions
            <br />
            make room.
          </h2>
          <p>
            Listen carefully. Keep Scripture in view. Give each person space to
            contribute.
          </p>
          <div className="writing-divider" />
          <strong>
            {items.filter((i) => i.forGroupNight).length} items saved for group
            night
          </strong>
          <p className="muted">
            Everything here stays in this browser. Group permissions and
            synchronized discussion are planned.
          </p>
        </aside>
      </div>
    </>
  );
}
