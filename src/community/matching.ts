import type { GroupListing } from './models';
export function milesBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return (
    3958.7613 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export interface FitPreferences {
  household: string;
  kids: string;
  day: string;
  location: { latitude: number; longitude: number } | null;
  nearbyOnly: boolean;
}
export function recommendGroups(groups: GroupListing[], p: FitPreferences) {
  return groups
    .map((g) => {
      const distance =
        p.location && g.latitude !== null && g.longitude !== null
          ? milesBetween(p.location, {
              latitude: g.latitude,
              longitude: g.longitude,
            })
          : null;
      const reasons: string[] = [];
      let score = 0;
      if (distance !== null && distance <= 5) {
        score += 4;
        reasons.push('Within about five miles');
      }
      if (p.kids === 'yes' && g.kids_enabled) {
        score += 2;
        reasons.push(
          `Welcomes children${g.age_range ? ` · ${g.age_range}` : ''}`,
        );
      }
      if (p.household && g.households.includes(p.household)) {
        score++;
        reasons.push('Welcomes your household stage');
      }
      if (p.day && g.rhythm.toLowerCase().includes(p.day.toLowerCase())) {
        score += 2;
        reasons.push('Matches your preferred meeting day');
      }
      if (g.accepting) {
        score++;
        reasons.push('Open to new people');
      }
      return { group: g, distance, score, reasons };
    })
    .filter((r) => !p.nearbyOnly || (r.distance !== null && r.distance <= 5))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
        a.group.name.localeCompare(b.group.name),
    );
}
