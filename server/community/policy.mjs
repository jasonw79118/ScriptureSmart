export const moduleLabels = {
  study: 'Passage study',
  sermons: 'Sermons',
  'bible-studies': 'Bible studies',
  guide: 'Discussion-guide builder',
  research: 'Research',
  library: 'Library',
  groups: 'Groups',
  discussion: 'Group discussion',
  meals: 'Meal planning',
  kids: 'Kids planning',
};
export const defaultModules = {
  study: true,
  sermons: false,
  'bible-studies': true,
  guide: false,
  research: true,
  library: true,
  groups: true,
  discussion: true,
  meals: true,
  kids: true,
};
export const defaultCapabilities = {
  discussion: true,
  meals: true,
  kids: true,
};
export function churchMember(data, userId) {
  return (data.church_members ?? []).find(
    (m) => m.user_id === userId && m.church_id === data.churches[0]?.id,
  );
}
export function normalizeData(data) {
  data.church_members ??= [];
  data.directory ??= [];
  for (const member of data.members) {
    const churchId = data.groups.find(
      (g) => g.id === member.group_id,
    )?.church_id;
    if (
      churchId &&
      !data.church_members.some(
        (m) => m.user_id === member.user_id && m.church_id === churchId,
      )
    )
      data.church_members.push({
        church_id: churchId,
        user_id: member.user_id,
        display_name: member.display_name,
        status: 'approved',
        modules: { ...defaultModules },
      });
  }
  return data;
}
export function approved(data, userId) {
  return (
    data.churches[0]?.owner_id === userId ||
    churchMember(data, userId)?.status === 'approved'
  );
}
export function canModule(data, userId, key) {
  if (data.churches[0]?.owner_id === userId) return true;
  const member = churchMember(data, userId);
  return member?.status === 'approved' && member.modules?.[key] === true;
}
export function canGroup(data, userId, gid, key) {
  const g = data.groups.find((g) => g.id === gid);
  if (!g) return false;
  if (
    (key === 'meals' && !g.meals_enabled) ||
    (key === 'kids' && !g.kids_enabled)
  )
    return false;
  const owner = data.churches[0]?.owner_id === userId;
  if (owner) return true;
  if (!canModule(data, userId, 'groups') || !canModule(data, userId, key))
    return false;
  const m = data.members.find(
    (m) => m.group_id === gid && m.user_id === userId,
  );
  return (
    !!m &&
    (m.role === 'leader' ||
      (m.capabilities ?? defaultCapabilities)[key] === true)
  );
}
export function directoryEntry(g) {
  const p = g.discovery ?? {};
  return {
    id: g.id,
    church_id: g.church_id,
    name: g.name,
    description: g.description,
    rhythm: g.rhythm,
    age_range: g.age_range,
    kids_enabled: g.kids_enabled,
    neighborhood: p.neighborhood ?? '',
    households: p.households ?? [],
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    leader_name: p.contact_visible ? (p.leader_name ?? '') : '',
    email: p.contact_visible ? (p.email ?? '') : '',
    phone: p.contact_visible ? (p.phone ?? '') : '',
    preferred_contact: p.contact_visible ? (p.preferred_contact ?? '') : '',
    accepting: p.accepting !== false,
  };
}
