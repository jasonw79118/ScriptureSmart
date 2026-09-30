import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCommand,
  newChurch,
  visible,
} from '../server/community/domain.mjs';
import {
  suggestPairings,
  conflicts,
} from '../src/community/mealSuggestions.ts';
const admin = { id: 'admin', email: 'admin@example.test', emailVerified: true };
const member = {
  id: 'member',
  email: 'member@example.test',
  emailVerified: true,
};
const outsider = {
  id: 'outsider',
  email: 'outsider@example.test',
  emailVerified: true,
};
function fixture() {
  let state = newChurch(admin, { name: 'Church A' });
  state = applyCommand(state, admin, {
    action: 'create_group',
    group_name: 'Group A',
    display_name: 'Leader',
  }).state;
  const gid = state.data.groups[0].id;
  state.data.members.push({
    group_id: gid,
    user_id: member.id,
    display_name: 'Member',
    role: 'member',
  });
  state.data.meetings.push({
    id: 'meeting',
    group_id: gid,
    title: 'Dinner',
    date: '2026-10-04',
    time: '16:00',
    meal_theme: 'Tacos',
    meal_notes: '',
    kids_plan: '',
  });
  state.data.dishes.push({
    id: 'dish',
    meeting_id: 'meeting',
    name: 'Rice',
    details: '',
    assignee_id: null,
  });
  return { state, gid };
}
test('group and church data remain hidden from outsiders', () => {
  const { state } = fixture();
  assert.equal(visible(state, outsider).groups.length, 0);
  assert.throws(
    () =>
      applyCommand(state, outsider, {
        action: 'assign_dish',
        dish_id: 'dish',
        assignee: outsider.id,
      }),
    /access/,
  );
});
test('membership does not expose another group in the same church', () => {
  const { state } = fixture();
  const next = applyCommand(state, admin, {
    action: 'create_group',
    group_name: 'Private group',
    display_name: 'Leader',
  }).state;
  assert.equal(visible(next, member).groups.length, 1);
  assert.equal(visible(next, admin).groups.length, 2);
});
test('members cannot change identity, role, group ownership, or create groups', () => {
  const { state, gid } = fixture();
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'save',
        collection: 'churches',
        row: state.data.churches[0],
        insert: false,
      }),
    /administrator/,
  );
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'save',
        collection: 'groups',
        row: { ...state.data.groups[0], owner_id: member.id },
        insert: false,
      }),
    /leader/,
  );
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'create_group',
        group_name: 'Hijack',
        display_name: 'Member',
      }),
    /administrator/,
  );
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'create_group_invite',
        gid,
        member_email: 'x@example.test',
        member_role: 'leader',
      }),
    /leader/,
  );
});
test('meal claims reject another member taking an occupied slot and absent assignments', () => {
  const { state, gid } = fixture();
  state.data.members.push({
    group_id: gid,
    user_id: 'other',
    display_name: 'Other',
    role: 'member',
  });
  const claimed = applyCommand(state, member, {
    action: 'assign_dish',
    dish_id: 'dish',
    assignee: member.id,
  }).state;
  assert.throws(
    () =>
      applyCommand(
        claimed,
        { ...member, id: 'other' },
        { action: 'assign_dish', dish_id: 'dish', assignee: 'other' },
      ),
    /assigned/,
  );
  const away = applyCommand(claimed, member, {
    action: 'rsvp',
    row: {
      meeting_id: 'meeting',
      user_id: 'admin',
      status: 'not-going',
      adults: 0,
      kids: 0,
    },
  }).state;
  assert.equal(away.data.attendance[0].user_id, member.id);
  assert.equal(away.data.dishes[0].assignee_id, member.id);
  assert.throws(
    () =>
      applyCommand(away, admin, {
        action: 'assign_dish',
        dish_id: 'dish',
        assignee: member.id,
      }),
    /not attending/,
  );
});
test('a failed edit leaves the original state unchanged', () => {
  const { state } = fixture();
  const before = JSON.stringify(state);
  assert.throws(() =>
    applyCommand(state, member, {
      action: 'rsvp',
      row: { meeting_id: 'meeting', status: 'going', adults: -2, kids: 1 },
    }),
  );
  assert.equal(JSON.stringify(state), before);
});
test('dish authorship and ingredients cannot be changed by unrelated members', () => {
  const { state } = fixture();
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'save',
        collection: 'dishes',
        row: { ...state.data.dishes[0], ingredients: 'anything' },
        insert: false,
      }),
    /cook/,
  );
});
test('posts use authenticated authors and reject cross-group replies', () => {
  const { state, gid } = fixture();
  const posted = applyCommand(state, member, {
    action: 'save',
    collection: 'contributions',
    insert: true,
    row: {
      id: 'fake',
      group_id: gid,
      author_id: 'admin',
      text: 'A question',
      kind: 'question',
      parent_id: null,
    },
  }).state;
  assert.equal(posted.data.contributions[0].author_id, member.id);
  assert.throws(
    () =>
      applyCommand(posted, member, {
        action: 'save',
        collection: 'contributions',
        insert: true,
        row: {
          group_id: gid,
          text: 'Reply',
          kind: 'discussion',
          parent_id: 'missing',
        },
      }),
    /Reply/,
  );
});
test('guest invitation is email-bound, single-use, expiring, and grants only guest access', () => {
  const { state, gid } = fixture();
  const issued = applyCommand(
    state,
    admin,
    {
      action: 'create_group_invite',
      gid,
      member_email: outsider.email,
      member_role: 'guest',
    },
    1000,
  );
  assert.throws(
    () =>
      applyCommand(
        issued.state,
        member,
        {
          action: 'join_group',
          invite_code: issued.value,
          display_name: 'Wrong',
        },
        2000,
      ),
    /Invitation/,
  );
  const joined = applyCommand(
    issued.state,
    outsider,
    { action: 'join_group', invite_code: issued.value, display_name: 'Guest' },
    2000,
  );
  assert.equal(joined.state.data.members.at(-1).role, 'guest');
  assert.throws(
    () =>
      applyCommand(
        joined.state,
        outsider,
        {
          action: 'join_group',
          invite_code: issued.value,
          display_name: 'Again',
        },
        2000,
      ),
    /Invitation/,
  );
  assert.throws(
    () =>
      applyCommand(
        issued.state,
        outsider,
        {
          action: 'join_group',
          invite_code: issued.value,
          display_name: 'Late',
        },
        1000 + 8 * 86400000,
      ),
    /Invitation/,
  );
  assert.equal(visible(joined.state, outsider).groups.length, 1);
});
test('dietary disclosure requires consent and can only be removed by its author', () => {
  const { state, gid } = fixture();
  const row = {
    group_id: gid,
    user_id: 'admin',
    person: 'My guest',
    kind: 'allergy',
    foods: ['Milk'],
    notes: 'Separate utensils',
    consent: false,
  };
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'save',
        collection: 'dietary',
        row,
        insert: true,
      }),
    /Permission/,
  );
  row.consent = true;
  const added = applyCommand(state, member, {
    action: 'save',
    collection: 'dietary',
    row,
    insert: true,
  }).state;
  const need = added.data.dietary[0];
  assert.equal(need.user_id, member.id);
  assert.throws(
    () => applyCommand(added, admin, { action: 'remove_dietary', id: need.id }),
    /Only/,
  );
  assert.equal(
    applyCommand(added, member, { action: 'remove_dietary', id: need.id }).state
      .data.dietary.length,
    0,
  );
});
test('pairings match main dishes and flag standard and custom requirements', () => {
  assert.equal(suggestPairings('').length, 0);
  assert.ok(suggestPairings('Tacos').some((p) => p.name.includes('rice')));
  assert.ok(suggestPairings('Brisket').some((p) => p.name.includes('slaw')));
  const needs = [{ foods: ['dairy', 'Gluten', 'Onion'], consent: true }];
  assert.deepEqual(
    conflicts(
      {
        name: 'Garlic bread',
        allergens: ['Milk', 'Wheat'],
        ingredients: 'onion powder',
      },
      needs,
    ),
    ['dairy', 'Gluten', 'Onion'],
  );
});

test('church requests require admin approval and suspension removes group access', () => {
  let { state, gid } = fixture();
  state = applyCommand(state, outsider, {
    action: 'request_church',
    display_name: 'New person',
  }).state;
  assert.equal(visible(state, outsider).church_members[0].status, 'pending');
  assert.equal(visible(state, outsider).groups.length, 0);
  const modules = state.data.church_members.find(
    (m) => m.user_id === outsider.id,
  ).modules;
  assert.throws(
    () =>
      applyCommand(state, outsider, {
        action: 'set_church_access',
        user_id: outsider.id,
        status: 'approved',
        modules,
      }),
    /administrator/,
  );
  state = applyCommand(state, admin, {
    action: 'set_church_access',
    user_id: outsider.id,
    status: 'approved',
    modules,
  }).state;
  state.data.members.push({
    group_id: gid,
    user_id: outsider.id,
    role: 'member',
    display_name: 'New person',
  });
  assert.equal(visible(state, outsider).groups.length, 1);
  state = applyCommand(state, admin, {
    action: 'set_church_access',
    user_id: outsider.id,
    status: 'suspended',
    modules,
  }).state;
  assert.equal(visible(state, outsider).groups.length, 0);
  assert.throws(() =>
    applyCommand(state, outsider, {
      action: 'assign_dish',
      dish_id: 'dish',
      assignee: outsider.id,
    }),
  );
});
test('church restrictions override group permissions and filter planning data', () => {
  let { state, gid } = fixture();
  state = applyCommand(state, admin, {
    action: 'set_group_access',
    gid,
    user_id: member.id,
    capabilities: { discussion: true, meals: true, kids: true },
  }).state;
  const cm = state.data.church_members.find((m) => m.user_id === member.id);
  state = applyCommand(state, admin, {
    action: 'set_church_access',
    user_id: member.id,
    status: 'approved',
    modules: { ...cm.modules, meals: false },
  }).state;
  assert.equal(visible(state, member).dishes.length, 0);
  assert.equal(visible(state, member).meetings[0].meal_theme, '');
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'assign_dish',
        dish_id: 'dish',
        assignee: member.id,
      }),
    /disabled/,
  );
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'set_group_access',
        gid,
        user_id: member.id,
        capabilities: { discussion: true, meals: true, kids: true },
      }),
    /leader/,
  );
});
test('directory exposes only an approved listing, with contact consent and no home address', () => {
  let { state, gid } = fixture();
  state.data.groups[0].address = 'Private home';
  state = applyCommand(state, admin, {
    action: 'update_directory',
    gid,
    profile: {
      listed: true,
      accepting: true,
      neighborhood: 'Canyon',
      households: ['married'],
      latitude: null,
      longitude: null,
      leader_name: 'Leader',
      email: 'leader@example.test',
      phone: '',
      preferred_contact: 'email',
      contact_visible: false,
    },
  }).state;
  state = applyCommand(state, outsider, {
    action: 'request_church',
    display_name: 'New person',
  }).state;
  assert.equal(visible(state, outsider).directory.length, 0);
  const cm = state.data.church_members.find((m) => m.user_id === outsider.id);
  state = applyCommand(state, admin, {
    action: 'set_church_access',
    user_id: outsider.id,
    status: 'approved',
    modules: cm.modules,
  }).state;
  const view = visible(state, outsider);
  assert.equal(view.groups.length, 0);
  assert.equal(view.directory.length, 1);
  assert.equal(view.directory[0].email, '');
  assert.equal('address' in view.directory[0], false);
  assert.equal(JSON.stringify(view).includes('Private home'), false);
});

test('leaders cannot override church restrictions and hidden plans survive gathering edits', () => {
  let { state } = fixture();
  state.data.members.find((m) => m.user_id === member.id).role = 'leader';
  const cm = visible(state, member).church_members.find(
    (m) => m.user_id === member.id,
  );
  state = applyCommand(state, admin, {
    action: 'set_church_access',
    user_id: member.id,
    status: 'approved',
    modules: { ...cm.modules, meals: false },
  }).state;
  state = applyCommand(state, member, {
    action: 'save',
    collection: 'meetings',
    row: { ...visible(state, member).meetings[0], title: 'New title' },
  }).state;
  assert.equal(state.data.meetings[0].meal_theme, 'Tacos');
  assert.throws(
    () =>
      applyCommand(state, member, {
        action: 'save',
        collection: 'meetings',
        row: { ...state.data.meetings[0], meal_theme: 'Pizza' },
      }),
    /disabled/,
  );
});
