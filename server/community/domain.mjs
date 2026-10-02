import {
  normalizeData,
  approved,
  canModule,
  canGroup,
  defaultModules,
  defaultCapabilities,
  moduleLabels,
  directoryEntry,
} from './policy.mjs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
export class InputError extends Error {}
const fail = (message) => {
  throw new InputError(message);
};
const str = (value, max = 160, required = false) => {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    fail('A required text field is missing or too long.');
  return value.trim();
};
const bool = (v) => {
  if (typeof v !== 'boolean') fail('Expected a true/false preference.');
  return v;
};
const choice = (v, values) => {
  if (!values.includes(v)) fail('Invalid selection.');
  return v;
};
const strings = (values, max = 40) => {
  if (!Array.isArray(values) || values.length > max)
    fail('Too many food tags.');
  return values.map((v) => str(v, 100, true));
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
export const blank = () => ({
  church_members: [],
  directory: [],
  churches: [],
  groups: [],
  members: [],
  meetings: [],
  attendance: [],
  dishes: [],
  contributions: [],
  dietary: [],
});
function identity(input) {
  return {
    name: str(input.name, 160, true),
    city: str(input.city ?? ''),
    group_label: str(input.group_label ?? 'Small Group', 80, true),
    group_label_plural: str(
      input.group_label_plural ?? 'Small Groups',
      80,
      true,
    ),
    accent: /^#[a-f0-9]{6}$/i.test(input.accent ?? '')
      ? input.accent
      : '#35553d',
    welcome: str(input.welcome ?? '', 1000),
    leaders: str(input.leaders ?? '', 5000),
  };
}
export function newChurch(user, input) {
  if (!user?.id || !user.emailVerified) fail('A verified account is required.');
  const id = randomUUID();
  return {
    data: {
      ...blank(),
      churches: [{ ...identity(input), id, owner_id: user.id }],
    },
    invites: [],
  };
}
export function visible(state, user) {
  const d = normalizeData(structuredClone(state.data));
  const owner = d.churches[0]?.owner_id === user.id;
  const cm = d.church_members.find((m) => m.user_id === user.id);
  if (!owner && !cm) return blank();
  const result = blank();
  result.churches = d.churches;
  result.church_members = owner ? d.church_members : cm ? [cm] : [];
  if (!approved(d, user.id)) return result;
  if (canModule(d, user.id, 'groups'))
    result.directory = d.groups
      .filter((g) => g.discovery?.listed)
      .map(directoryEntry);
  const ids = new Set(
    d.groups
      .filter(
        (g) =>
          owner ||
          (canModule(d, user.id, 'groups') &&
            d.members.some(
              (m) => m.group_id === g.id && m.user_id === user.id,
            )),
      )
      .map((g) => g.id),
  );
  result.groups = d.groups.filter((g) => ids.has(g.id));
  result.members = d.members.filter((m) => ids.has(m.group_id));
  result.meetings = d.meetings
    .filter((m) => ids.has(m.group_id))
    .map((m) => ({
      ...m,
      meal_theme: canGroup(d, user.id, m.group_id, 'meals') ? m.meal_theme : '',
      meal_notes: canGroup(d, user.id, m.group_id, 'meals') ? m.meal_notes : '',
      kids_plan: canGroup(d, user.id, m.group_id, 'kids') ? m.kids_plan : '',
    }));
  const mids = new Set(result.meetings.map((m) => m.id));
  result.attendance = d.attendance.filter((r) => mids.has(r.meeting_id));
  result.dishes = d.dishes.filter((r) =>
    canGroup(
      d,
      user.id,
      d.meetings.find((m) => m.id === r.meeting_id)?.group_id,
      'meals',
    ),
  );
  result.dietary = d.dietary.filter(
    (r) => r.consent && canGroup(d, user.id, r.group_id, 'meals'),
  );
  result.contributions = d.contributions.filter((r) =>
    canGroup(d, user.id, r.group_id, r.kind === 'kids' ? 'kids' : 'discussion'),
  );
  return result;
}
export function applyCommand(original, user, command, now = Date.now()) {
  if (!user?.id || !user.emailVerified)
    fail('Sign in with a verified email first.');
  const state = structuredClone(original);
  const d = normalizeData(state.data);
  const church = d.churches[0];
  if (!church) fail('Workspace unavailable.');
  const owner = church.owner_id === user.id;
  const group = (id) =>
    d.groups.find((g) => g.id === id) ?? fail('Group unavailable.');
  const membership = (id) =>
    d.members.find((m) => m.group_id === id && m.user_id === user.id);
  const access = (id) => {
    group(id);
    if (
      !owner &&
      (!approved(d, user.id) ||
        !canModule(d, user.id, 'groups') ||
        !membership(id))
    )
      fail('Group access required.');
  };
  const lead = (id) => {
    access(id);
    if (!owner && membership(id)?.role !== 'leader')
      fail('Group leader access required.');
  };
  const meeting = (id) => {
    const m = d.meetings.find((m) => m.id === id);
    if (!m) fail('Gathering unavailable.');
    access(m.group_id);
    return m;
  };
  const capability = (gid, key) => {
    if (!canGroup(d, user.id, gid, key))
      fail('Access to this group feature is disabled.');
  };
  const absent = (mid, uid) =>
    d.attendance.some(
      (a) =>
        a.meeting_id === mid && a.user_id === uid && a.status === 'not-going',
    );
  let value;
  switch (command.action) {
    case 'request_church': {
      const existing = d.church_members.find((m) => m.user_id === user.id);
      if (existing) fail('A church membership or request already exists.');
      d.church_members.push({
        church_id: church.id,
        user_id: user.id,
        display_name: str(command.display_name, 100, true),
        status: 'pending',
        modules: { ...defaultModules },
      });
      value = church.id;
      break;
    }
    case 'set_church_access': {
      if (!owner) fail('Church administrator access required.');
      const m = d.church_members.find((m) => m.user_id === command.user_id);
      if (!m) fail('Member unavailable.');
      m.status = choice(command.status, [
        'pending',
        'approved',
        'declined',
        'suspended',
      ]);
      m.modules = Object.fromEntries(
        Object.keys(moduleLabels).map((k) => [k, bool(command.modules?.[k])]),
      );
      break;
    }
    case 'set_group_access': {
      lead(command.gid);
      const m = d.members.find(
        (m) => m.group_id === command.gid && m.user_id === command.user_id,
      );
      if (!m || m.role === 'leader')
        fail(
          'Select a member or guest; leaders are managed by the church administrator.',
        );
      m.capabilities = Object.fromEntries(
        Object.keys(defaultCapabilities).map((k) => [
          k,
          bool(command.capabilities?.[k]),
        ]),
      );
      break;
    }
    case 'update_directory': {
      lead(command.gid);
      const g = group(command.gid),
        p = command.profile;
      const coordinate = (v, max) => {
        if (v === null) return null;
        if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > max)
          fail('Invalid approximate map coordinates.');
        return v;
      };
      const lat = coordinate(p.latitude, 90),
        lon = coordinate(p.longitude, 180);
      if ((lat === null) !== (lon === null))
        fail('Provide both approximate coordinates or leave both blank.');
      const email = str(p.email ?? '', 254),
        phone = str(p.phone ?? '', 50);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail('Enter a valid contact email.');
      if (phone && !/^[+0-9(). -]+$/.test(phone))
        fail('Enter a valid contact phone.');
      g.discovery = {
        listed: bool(p.listed),
        accepting: bool(p.accepting),
        neighborhood: str(p.neighborhood ?? '', 160),
        households: strings(p.households ?? [], 4).map((v) =>
          choice(v, ['single', 'married', 'other']),
        ),
        latitude: lat,
        longitude: lon,
        leader_name: str(p.leader_name ?? '', 100),
        email,
        phone,
        preferred_contact: choice(p.preferred_contact, [
          '',
          'email',
          'text',
          'phone',
        ]),
        contact_visible: bool(p.contact_visible),
      };
      break;
    }
    case 'create_group': {
      if (!owner) fail('Church administrator access required.');
      const id = randomUUID();
      d.groups.push({
        id,
        church_id: church.id,
        name: str(command.group_name, 160, true),
        description: '',
        rhythm: '',
        hosts: '',
        age_range: '',
        location: '',
        address: '',
        directions: '',
        timezone: 'America/Chicago',
        meals_enabled: true,
        kids_enabled: true,
      });
      d.members.push({
        group_id: id,
        user_id: user.id,
        display_name: str(command.display_name, 100, true),
        role: 'leader',
      });
      value = id;
      break;
    }
    case 'create_group_invite': {
      lead(command.gid);
      const role = choice(command.member_role, ['leader', 'member', 'guest']);
      if (role === 'leader' && !owner)
        fail('Only the church administrator may appoint leaders.');
      const email = str(command.member_email, 254, true).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail('Enter a valid email address.');
      const token = randomBytes(24).toString('hex');
      state.invites = state.invites.filter((i) => i.expires > now);
      state.invites.push({
        hash: hash(token),
        group_id: command.gid,
        email,
        role,
        expires: now + 7 * 86400000,
      });
      value = `${church.id}.${token}`;
      break;
    }
    case 'join_group': {
      const parts = str(command.invite_code, 150, true).split('.');
      const invite = state.invites.find(
        (i) =>
          i.hash === hash(parts[1] ?? '') &&
          i.expires > now &&
          i.email === user.email.toLowerCase(),
      );
      if (parts[0] !== church.id || !invite)
        fail(
          'Invitation is invalid, expired, used, or belongs to another email.',
        );
      const cm = d.church_members.find((m) => m.user_id === user.id);
      if (cm && cm.status !== 'approved')
        fail(
          'Church approval is required before accepting this group invitation.',
        );
      if (!cm)
        d.church_members.push({
          church_id: church.id,
          user_id: user.id,
          display_name: str(command.display_name, 100, true),
          status: 'approved',
          modules: { ...defaultModules },
        });
      const member = {
        group_id: invite.group_id,
        user_id: user.id,
        display_name: str(command.display_name, 100, true),
        role: invite.role,
      };
      const existing = d.members.find(
        (m) => m.group_id === member.group_id && m.user_id === user.id,
      );
      if (existing) Object.assign(existing, member);
      else d.members.push(member);
      state.invites = state.invites.filter((i) => i !== invite);
      value = invite.group_id;
      break;
    }
    case 'rsvp': {
      const r = command.row;
      meeting(r.meeting_id);
      const status = choice(r.status, ['going', 'maybe', 'not-going']);
      for (const n of [r.adults, r.kids])
        if (!Number.isInteger(n) || n < 0 || n > 30)
          fail('Headcount must be from 0 to 30.');
      if (status !== 'not-going' && r.adults < 1)
        fail('Include at least one adult in this household response.');
      const row = {
        meeting_id: r.meeting_id,
        user_id: user.id,
        status,
        adults: status === 'not-going' ? 0 : r.adults,
        kids: status === 'not-going' ? 0 : r.kids,
      };
      d.attendance = d.attendance.filter(
        (a) => a.meeting_id !== row.meeting_id || a.user_id !== user.id,
      );
      d.attendance.push(row);
      break;
    }
    case 'assign_dish': {
      const dish = d.dishes.find((x) => x.id === command.dish_id);
      if (!dish) fail('Dish unavailable.');
      const m = meeting(dish.meeting_id);
      capability(m.group_id, 'meals');
      if (!group(m.group_id).meals_enabled)
        fail('Meals are disabled for this group.');
      const manager = owner || membership(m.group_id)?.role === 'leader';
      const assignee = command.assignee ?? null;
      if (
        !manager &&
        ((dish.assignee_id && dish.assignee_id !== user.id) ||
          (assignee && assignee !== user.id))
      )
        fail('This dish is assigned to another member.');
      if (
        assignee &&
        !d.members.some(
          (x) => x.group_id === m.group_id && x.user_id === assignee,
        )
      )
        fail('Choose a member of this group.');
      if (assignee && absent(m.id, assignee))
        fail('This person is not attending. Choose another member.');
      dish.assignee_id = assignee;
      break;
    }
    case 'remove_dietary': {
      const n = d.dietary.find((x) => x.id === command.id);
      if (!n || n.user_id !== user.id)
        fail('Only the person who declared this requirement can remove it.');
      access(n.group_id);
      d.dietary = d.dietary.filter((x) => x.id !== n.id);
      break;
    }
    case 'save': {
      const r = command.row;
      const collection = choice(command.collection, [
        'churches',
        'groups',
        'meetings',
        'dishes',
        'contributions',
        'dietary',
      ]);
      const rows = d[collection];
      const previous = rows.find((x) => x.id === r.id);
      if (command.insert && previous) fail('This item already exists.');
      if (!command.insert && !previous)
        fail('Item no longer exists. Refresh and try again.');
      const id = command.insert ? randomUUID() : previous.id;
      let row;
      if (collection === 'churches') {
        if (!owner || command.insert)
          fail('Church administrator access required.');
        row = { ...church, ...identity(r) };
      }
      if (collection === 'groups') {
        if (command.insert) fail('Use create group.');
        lead(previous.id);
        row = {
          ...previous,
          name: str(r.name, 160, true),
          description: str(r.description, 3000),
          rhythm: str(r.rhythm),
          location: str(r.location),
          address: str(r.address, 300),
          directions: str(r.directions, 3000),
          hosts: str(r.hosts, 300),
          age_range: str(r.age_range, 100),
          timezone: str(r.timezone, 100, true),
          meals_enabled: bool(r.meals_enabled),
          kids_enabled: bool(r.kids_enabled),
        };
        try {
          new Intl.DateTimeFormat('en', { timeZone: row.timezone });
        } catch {
          fail('Invalid time zone.');
        }
      }
      if (collection === 'meetings') {
        const gid = previous?.group_id ?? r.group_id;
        lead(gid);
        if (
          (!canGroup(d, user.id, gid, 'meals') &&
            (r.meal_theme || r.meal_notes)) ||
          (!canGroup(d, user.id, gid, 'kids') && r.kids_plan)
        )
          fail('Cannot edit disabled planning features.');
        const date = str(r.date, 10, true),
          time = str(r.time, 8, true);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Number.isNaN(Date.parse(date)) ||
          !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)
        )
          fail('Enter a valid date and time.');
        row = {
          id,
          group_id: gid,
          title: str(r.title, 160, true),
          date,
          time,
          meal_theme: canGroup(d, user.id, gid, 'meals')
            ? str(r.meal_theme, 160)
            : (previous?.meal_theme ?? ''),
          meal_notes: canGroup(d, user.id, gid, 'meals')
            ? str(r.meal_notes, 4000)
            : (previous?.meal_notes ?? ''),
          kids_plan: canGroup(d, user.id, gid, 'kids')
            ? str(r.kids_plan, 4000)
            : (previous?.kids_plan ?? ''),
        };
      }
      if (collection === 'dishes') {
        const mid = previous?.meeting_id ?? r.meeting_id;
        const m = meeting(mid);
        capability(m.group_id, 'meals');
        if (!group(m.group_id).meals_enabled) fail('Meals are disabled.');
        const manager = owner || membership(m.group_id)?.role === 'leader';
        if (!manager && (!previous || previous.assignee_id !== user.id))
          fail('Only a leader or this dish’s cook can edit it.');
        row = {
          id,
          meeting_id: mid,
          name: manager ? str(r.name, 160, true) : previous.name,
          details: manager ? str(r.details, 2000) : previous.details,
          assignee_id: previous?.assignee_id ?? null,
          category: choice(r.category ?? 'side', [
            'main',
            'side',
            'dessert',
            'supplies',
          ]),
          allergens: strings(r.allergens ?? []),
          ingredients: str(r.ingredients ?? '', 4000),
          ingredient_status: choice(r.ingredient_status ?? 'unverified', [
            'unverified',
            'provided',
          ]),
        };
        if (row.ingredient_status === 'provided' && !row.ingredients.trim())
          fail('Supply ingredient information before marking it provided.');
      }
      if (collection === 'contributions') {
        if (!command.insert)
          fail('Discussion contributions cannot be overwritten.');
        access(r.group_id);
        if (!membership(r.group_id)) fail('Join this group before posting.');
        const kind = choice(r.kind, ['question', 'idea', 'discussion', 'prayer', 'kids']);
        capability(r.group_id, kind === 'kids' ? 'kids' : 'discussion');
        const parent = d.contributions.find((p) => p.id === r.parent_id);
        if (parent && (parent.kind === 'kids') !== (kind === 'kids'))
          fail('Replies must stay within their original group section.');
        if (parent && (parent.kind === 'prayer') !== (kind === 'prayer'))
          fail('Prayer replies must stay within their original request.');
        if (parent)
          capability(
            r.group_id,
            parent.kind === 'kids' ? 'kids' : 'discussion',
          );
        if (kind === 'kids' && !group(r.group_id).kids_enabled)
          fail('Kids’ time is disabled.');
        if (
          r.parent_id &&
          !d.contributions.some(
            (p) =>
              p.id === r.parent_id && p.group_id === r.group_id && !p.parent_id,
          )
        )
          fail('Reply must refer to a post in this group.');
        row = {
          id,
          group_id: r.group_id,
          author_id: user.id,
          kind,
          text: str(r.text, 10000, true),
          parent_id: r.parent_id ?? null,
          created_at: new Date(now).toISOString(),
        };
      }
      if (collection === 'dietary') {
        const gid = previous?.group_id ?? r.group_id;
        access(gid);
        capability(gid, 'meals');
        if (previous && previous.user_id !== user.id)
          fail('You can only update your own declarations.');
        if (r.consent !== true)
          fail('Permission to share this food requirement is required.');
        const foods = strings(r.foods);
        if (!foods.length) fail('Declare at least one food.');
        row = {
          id,
          group_id: gid,
          user_id: user.id,
          person: str(r.person, 100, true),
          kind: choice(r.kind, ['allergy', 'sensitivity']),
          foods,
          notes: str(r.notes, 2000),
          consent: true,
        };
      }
      if (command.insert) rows.push(row);
      else d[collection] = rows.map((x) => (x.id === previous.id ? row : x));
      value = id;
      break;
    }
    default:
      fail('Unsupported community action.');
  }
  if (JSON.stringify(state).length > 800000)
    fail(
      'This workspace has reached its storage limit. Contact your administrator to archive older records.',
    );
  return { state, value };
}
