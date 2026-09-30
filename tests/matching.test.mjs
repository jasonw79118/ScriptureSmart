import test from 'node:test';
import assert from 'node:assert/strict';
import { milesBetween, recommendGroups } from '../src/community/matching.ts';
const base = {
  id: 'unknown',
  name: 'Unknown',
  church_id: 'church',
  description: '',
  rhythm: 'Sunday',
  age_range: '0�14',
  kids_enabled: true,
  neighborhood: '',
  households: ['married'],
  latitude: null,
  longitude: null,
  leader_name: '',
  email: '',
  phone: '',
  preferred_contact: '',
  accepting: true,
};
test('five-mile filter uses real coordinates and does not guess unknown distances', () => {
  const location = { latitude: 35, longitude: -102 };
  const near = { ...base, id: 'near', latitude: 35.01, longitude: -102 };
  const far = { ...base, id: 'far', latitude: 36, longitude: -102 };
  const prefs = {
    household: 'married',
    kids: 'yes',
    day: 'Sunday',
    location,
    nearbyOnly: true,
  };
  assert.deepEqual(
    recommendGroups([base, far, near], prefs).map((r) => r.group.id),
    ['near'],
  );
  assert.equal(
    recommendGroups([base], { ...prefs, nearbyOnly: false })[0].distance,
    null,
  );
  assert.equal(milesBetween(location, location), 0);
  assert.ok(
    Math.abs(
      milesBetween(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ) - 69.09,
    ) < 0.02,
  );
});
test('optional household answers rank suggestions without excluding people', () => {
  const groups = [
    { ...base, id: 'different', households: ['single'], kids_enabled: false },
    base,
  ];
  const result = recommendGroups(groups, {
    household: 'married',
    kids: 'yes',
    day: 'Sunday',
    location: null,
    nearbyOnly: false,
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].group.id, 'unknown');
});
