import { useState } from 'react';
import { useCommunity } from './CommunityContext';
import { Field } from './ChurchPage';
import { formValues } from './forms';
import type { DiscoveryProfile } from './models';
export function DirectoryEditor() {
  const c = useCommunity();
  const g = c.group!;
  const p = g.discovery;
  const [households, setHouseholds] = useState(
    p?.households ?? ['single', 'married', 'other'],
  );
  return (
    <section className="panel form-stack directory-editor">
      <h2>Help people find this group</h2>
      <p>
        These details are visible to approved members of your church. The home
        address stays private to your group.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = formValues(e.currentTarget);
          const latitude = f.latitude ? Number(f.latitude) : null,
            longitude = f.longitude ? Number(f.longitude) : null;
          if ((latitude === null) !== (longitude === null)) {
            c.setError(
              'Provide both approximate coordinates or leave both blank.',
            );
            return;
          }
          const profile: DiscoveryProfile = {
            listed: f.listed === 'on',
            accepting: f.accepting === 'on',
            neighborhood: f.neighborhood,
            households,
            latitude,
            longitude,
            leader_name: f.leader_name,
            email: f.email,
            phone: f.phone,
            preferred_contact:
              f.preferred_contact as DiscoveryProfile['preferred_contact'],
            contact_visible: f.contact_visible === 'on',
          };
          void c.rpc('update_directory', { gid: g.id, profile });
        }}
      >
        <label className="check">
          <input type="checkbox" name="listed" defaultChecked={p?.listed} />
          List this group in the church group finder
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="accepting"
            defaultChecked={p?.accepting ?? true}
          />
          Open to new members
        </label>
        <Field
          name="neighborhood"
          label="Neighborhood / general area"
          value={p?.neighborhood}
        />
        <fieldset>
          <legend>
            Households welcomed (used for suggestions, not restrictions)
          </legend>
          {['single', 'married', 'other'].map((h) => (
            <label className="check" key={h}>
              <input
                type="checkbox"
                checked={households.includes(h)}
                onChange={(e) =>
                  setHouseholds(
                    e.target.checked
                      ? [...households, h]
                      : households.filter((v) => v !== h),
                  )
                }
              />
              {h === 'other' ? 'Other household situations' : h}
            </label>
          ))}
        </fieldset>
        <div className="two-columns">
          <label>
            Approximate neighborhood latitude
            <input
              name="latitude"
              type="number"
              step="any"
              min={-90}
              max={90}
              defaultValue={p?.latitude ?? ''}
            />
          </label>
          <label>
            Approximate neighborhood longitude
            <input
              name="longitude"
              type="number"
              step="any"
              min={-180}
              max={180}
              defaultValue={p?.longitude ?? ''}
            />
          </label>
        </div>
        <small>
          Optional: use a neighborhood center or nearby public meeting point,
          not a private home. No map coordinates are inferred from the street
          address.
        </small>
        <Field
          name="leader_name"
          label="Leader contact name"
          value={p?.leader_name}
        />
        <Field
          name="email"
          label="Leader contact email"
          type="email"
          value={p?.email}
        />
        <Field
          name="phone"
          label="Leader contact phone"
          type="tel"
          value={p?.phone}
        />
        <label>
          Preferred contact method
          <select
            name="preferred_contact"
            defaultValue={p?.preferred_contact ?? ''}
          >
            <option value="">Not specified</option>
            <option value="email">Email</option>
            <option value="text">Text message</option>
            <option value="phone">Phone call</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="contact_visible"
            defaultChecked={p?.contact_visible}
          />
          The leader approves sharing these contact details with church members.
        </label>
        <button className="button primary" disabled={c.busy}>
          Save group listing
        </button>
      </form>
    </section>
  );
}
