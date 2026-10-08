import { countryNameFor, flagCodeFor, flagCodeFromPlace } from "../data/countries";
import { orderedParents, type Person } from "../data/people";

export type HeritageShare = { key: string; label: string; share: number };

const LABELS: Record<string, string> = {
  "gb-eng": "English",
  "gb-wls": "Welsh",
  "gb-sct": "Scottish",
  "gb-nir": "Northern Irish",
  gb: "British",
  ie: "Irish",
};

export const UNKNOWN_KEY = "unknown";

export function heritageLabel(key: string): string {
  return key === UNKNOWN_KEY ? "Unknown" : (LABELS[key] ?? (countryNameFor(key) || key.toUpperCase()));
}

export function nationOf(person: Person): string | null {
  return flagCodeFor(person.nationality) ?? flagCodeFromPlace(person.birthPlace);
}

/**
 * Half from each parent, all the way up. An ancestor with no recorded parents counts as their own
 * nationality (the one typed in, else the one from their birthplace); a missing parent or a missing
 * nationality is counted as Unknown rather than spread over the rest.
 */
export function computeHeritage(
  people: Record<string, Person>,
  personId: string,
  maxDepth = 12,
): HeritageShare[] {
  const totals = new Map<string, number>();
  const add = (key: string, weight: number) => totals.set(key, (totals.get(key) ?? 0) + weight);

  function walk(person: Person, weight: number, depth: number, path: Set<string>) {
    const parents = depth < maxDepth ? orderedParents(people, person).filter((parent) => !path.has(parent.id)) : [];
    if (parents.length === 0) {
      add(nationOf(person) ?? UNKNOWN_KEY, weight);
      return;
    }
    const nextPath = new Set(path).add(person.id);
    for (const parent of parents) walk(parent, weight / 2, depth + 1, nextPath);
    if (parents.length === 1) add(UNKNOWN_KEY, weight / 2);
  }

  const start = people[personId];
  if (!start) return [];
  walk(start, 1, 0, new Set());
  return [...totals.entries()]
    .map(([key, share]) => ({ key, label: key === UNKNOWN_KEY ? "Unknown" : (LABELS[key] ?? (countryNameFor(key) || key.toUpperCase())), share }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_KEY) return 1;
      if (b.key === UNKNOWN_KEY) return -1;
      return b.share - a.share;
    });
}
