import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import {
  defaultCapabilities,
  moduleLabels,
} from '../../server/community/policy.mjs';
import type { ChurchMember, Member } from './models';
export function AccessControls({ scope }: { scope: 'church' | 'group' }) {
  const c = useCommunity();
  if ((scope === 'church' && !c.isAdmin) || (scope === 'group' && !c.isLeader))
    return null;
  return (
    <section className="panel access-panel">
      <h2>
        {scope === 'church' ? 'Church member access' : 'Group member access'}
      </h2>
      <p>
        {scope === 'church'
          ? 'Review membership requests and choose which parts of ScriptureSmart each member can use.'
          : 'Choose who can access and contribute to discussion, meal planning, and kids planning. Church-level restrictions still apply.'}
      </p>
      {scope === 'church'
        ? c.data.church_members
            .filter(
              (m) =>
                m.church_id === c.church?.id &&
                m.user_id !== c.church?.owner_id,
            )
            .map((m) => (
              <ChurchAccess
                key={`${m.user_id}-${JSON.stringify(m)}`}
                member={m}
              />
            ))
        : c.data.members
            .filter((m) => m.group_id === c.group?.id && m.role !== 'leader')
            .map((m) => (
              <GroupAccess
                key={`${m.user_id}-${JSON.stringify(m)}`}
                member={m}
              />
            ))}
      {scope === 'church' &&
        !c.data.church_members.some(
          (m) =>
            m.church_id === c.church?.id && m.user_id !== c.church?.owner_id,
        ) && <p>No membership requests or members to manage yet.</p>}
      {scope === 'group' &&
        !c.data.members.some(
          (m) => m.group_id === c.group?.id && m.role !== 'leader',
        ) && <p>Invite members to this group to manage their access here.</p>}
    </section>
  );
}
function ChurchAccess({ member }: { member: ChurchMember }) {
  const c = useCommunity();
  const [modules, setModules] = useState(member.modules);
  const [status, setStatus] = useState(member.status);
  return (
    <form
      className="access-member"
      onSubmit={(e) => {
        e.preventDefault();
        void c.rpc('set_church_access', {
          user_id: member.user_id,
          status,
          modules,
        });
      }}
    >
      <h3>{member.display_name}</h3>
      <label>
        Membership status
        <select
          aria-label={`Membership status for ${member.display_name}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          {['pending', 'approved', 'declined', 'suspended'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Enabled portions of the site</legend>
        <div className="permission-grid">
          {Object.entries(moduleLabels).map(([key, label]) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={!!modules[key as keyof typeof modules]}
                onChange={(e) =>
                  setModules({ ...modules, [key]: e.target.checked })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="button primary" disabled={c.busy}>
        Save church access for {member.display_name}
      </button>
    </form>
  );
}
function GroupAccess({ member }: { member: Member }) {
  const c = useCommunity();
  const [caps, setCaps] = useState(member.capabilities ?? defaultCapabilities);
  return (
    <form
      className="access-member"
      onSubmit={(e) => {
        e.preventDefault();
        void c.rpc('set_group_access', {
          gid: member.group_id,
          user_id: member.user_id,
          capabilities: caps,
        });
      }}
    >
      <h3>
        {member.display_name} <small>{member.role}</small>
      </h3>
      <div className="permission-grid">
        {(['discussion', 'meals', 'kids'] as const).map((key) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              checked={caps[key]}
              onChange={(e) => setCaps({ ...caps, [key]: e.target.checked })}
            />
            {moduleLabels[key]}
          </label>
        ))}
      </div>
      <button className="button secondary" disabled={c.busy}>
        Save group access for {member.display_name}
      </button>
    </form>
  );
}
