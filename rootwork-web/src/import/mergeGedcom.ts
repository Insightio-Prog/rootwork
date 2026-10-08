import {
  displayName,
  emptyMarriage,
  parseYear,
  uniqueIds,
  type Job,
  type Marriage,
  type MilitaryService,
  type NotableEvent,
  type Person,
  type Residence,
} from "../data/people";
import { mapGedcomPeople } from "./gedcom";

export type GedcomConflict = {
  person: string;
  field: string;
  current: string;
  incoming: string;
};

export type GedcomImportReport = {
  added: number;
  filled: number;
  skipped: number;
  merged: number;
  unmatched: string[];
  conflicts: GedcomConflict[];
};

export function mergeGedcomTree<T extends { people: Record<string, Person>; homePersonId: string | null }>(
  current: T,
  text: string,
): { tree: T; report: GedcomImportReport; remaps: Array<{ from: string; to: string }> } {
  const incoming = mapGedcomPeople(text);
  const report: GedcomImportReport = {
    added: 0,
    filled: 0,
    skipped: 0,
    merged: 0,
    unmatched: [],
    conflicts: [],
  };
  const { matches, ambiguous } = matchPeople(Object.values(current.people), Object.values(incoming));
  report.skipped = ambiguous.length;
  report.unmatched = ambiguous.map((person) => displayName(person));

  const idMap = new Map<string, string>();
  const people: Record<string, Person> = { ...current.people };
  const filledIds = new Set<string>();
  let firstAddedId: string | null = null;

  for (const person of Object.values(incoming)) {
    if (ambiguous.some((item) => item.id === person.id)) continue;
    const matchedId = matches.get(person.id);
    if (matchedId) {
      idMap.set(person.id, matchedId);
      continue;
    }
    const created = remapPerson(person);
    people[created.id] = created;
    idMap.set(person.id, created.id);
    report.added += 1;
    firstAddedId ??= created.id;
  }

  for (const [xref, person] of Object.entries(incoming)) {
    const destId = idMap.get(xref);
    if (!destId) continue;
    const dest = people[destId];
    if (!dest) continue;
    const wasMatch = matches.has(xref);
    if (wasMatch) {
      people[destId] = mergeMatchedPerson(dest, person, idMap, people, report.conflicts, filledIds);
    } else {
      people[destId] = remapLinks(dest, idMap);
    }
  }

  report.filled = filledIds.size;
  const homePersonId =
    current.homePersonId && people[current.homePersonId]
      ? current.homePersonId
      : (firstAddedId ?? current.homePersonId);
  const collapsed = collapseDuplicatePeople({
    ...current,
    people,
    homePersonId,
  });
  report.merged = collapsed.report.merged;
  report.conflicts.push(...collapsed.report.conflicts);
  return {
    tree: collapsed.tree,
    report,
    remaps: collapsed.remaps,
  };
}

export type DuplicateMergeReport = {
  merged: number;
  pairs: { kept: string; dropped: string }[];
  conflicts: GedcomConflict[];
};

export function collapseDuplicatePeople<T extends { people: Record<string, Person>; homePersonId: string | null }>(
  current: T,
): { tree: T; report: DuplicateMergeReport; remaps: Array<{ from: string; to: string }> } {
  const report: DuplicateMergeReport = { merged: 0, pairs: [], conflicts: [] };
  const pairs = collectDuplicatePairs(Object.values(current.people), current.homePersonId);
  const remaps = pairs.map((pair) => ({ from: pair.drop.id, to: pair.keep.id }));
  const idMap = new Map(remaps.map((remap) => [remap.from, remap.to]));
  let people = { ...current.people };
  let homePersonId = current.homePersonId;
  for (const pair of pairs) {
    const keep = people[pair.keep.id];
    const drop = people[pair.drop.id];
    if (!keep || !drop) continue;
    people = absorbDuplicate(people, keep, drop, idMap, report.conflicts);
    homePersonId = homePersonId === drop.id ? keep.id : homePersonId;
    report.pairs.push({ kept: displayName(keep), dropped: displayName(drop) });
    report.merged += 1;
  }
  return {
    tree: {
      ...current,
      people,
      homePersonId,
      ...rewriteTodoPersonIds(current, remaps),
    },
    report,
    remaps,
  };
}

function collectDuplicatePairs(people: Person[], homeId: string | null): Array<{ keep: Person; drop: Person }> {
  const used = new Set<string>();
  const pairs: Array<{ keep: Person; drop: Person }> = [];
  for (const person of people) {
    if (used.has(person.id) || parseYear(person.birth) == null) continue;
    const matches = people.filter(
      (other) => other.id !== person.id && !used.has(other.id) && peopleMatch(person, other) && yearsEqual(person, other),
    );
    if (matches.length !== 1) continue;
    const pair = preferPerson(person, matches[0], homeId);
    used.add(pair.keep.id);
    used.add(pair.drop.id);
    pairs.push(pair);
  }
  return pairs;
}

function yearsEqual(a: Person, b: Person): boolean {
  const left = parseYear(a.birth);
  const right = parseYear(b.birth);
  return left != null && right != null && left === right;
}

function rewriteTodoPersonIds<T>(
  current: T,
  remaps: Array<{ from: string; to: string }>,
): Partial<T> {
  if (!current || typeof current !== "object" || !("todos" in current)) return {};
  const todos = (current as { todos?: { items?: Array<{ personId: string }> } }).todos;
  if (!todos || !Array.isArray(todos.items)) return {};
  const mapped = new Map(remaps.map((remap) => [remap.from, remap.to]));
  return {
    todos: {
      ...todos,
      items: todos.items.map((item) => ({
        ...item,
        personId: mapped.get(item.personId) ?? item.personId,
      })),
    },
  } as unknown as Partial<T>;
}

function preferPerson(a: Person, b: Person, homeId: string | null): { keep: Person; drop: Person } {
  const rank = (person: Person) =>
    (person.id === homeId ? 1000 : 0) +
    (person.photo ? 100 : 0) +
    person.givenName.trim().length +
    person.birth.trim().length +
    person.residences.length +
    (person.media?.length ?? 0) +
    person.spouseIds.length;
  return rank(a) >= rank(b) ? { keep: a, drop: b } : { keep: b, drop: a };
}

function absorbDuplicate(
  people: Record<string, Person>,
  keep: Person,
  drop: Person,
  idMap: Map<string, string>,
  conflicts: GedcomConflict[],
): Record<string, Person> {
  const filledIds = new Set<string>();
  const merged = mergeMatchedPerson(people[keep.id], drop, idMap, people, conflicts, filledIds);
  const withKeep = {
    ...people,
    [keep.id]: {
      ...merged,
      photo: merged.photo ?? drop.photo,
      flag: merged.flag ?? drop.flag,
    },
  };
  return rewritePersonId(withKeep, drop.id, keep.id);
}

function rewritePersonId(people: Record<string, Person>, from: string, to: string): Record<string, Person> {
  const next: Record<string, Person> = {};
  for (const person of Object.values(people)) {
    if (person.id === from) continue;
    const parentIds = uniqueIds(person.parentIds.map((id) => (id === from ? to : id))).filter((id) => id !== person.id);
    const spouseIds = uniqueIds(person.spouseIds.map((id) => (id === from ? to : id))).filter((id) => id !== person.id);
    const marriages = Object.fromEntries(
      Object.entries(person.marriages).flatMap(([spouseId, marriage]) => {
        const mapped = spouseId === from ? to : spouseId;
        if (mapped === person.id) return [];
        return [[mapped, marriage]];
      }),
    );
    next[person.id] = {
      ...person,
      parentIds: parentIds.slice(0, 2),
      spouseIds,
      marriages,
    };
  }
  return next;
}

function matchPeople(
  current: Person[],
  incoming: Person[],
): { matches: Map<string, string>; ambiguous: Person[] } {
  const matches = new Map<string, string>();
  const usedCurrent = new Set<string>();
  const ambiguousIds = new Set<string>();

  for (const ged of incoming) {
    const year = parseYear(ged.birth);
    if (year == null) continue;
    const yearCurrent = current.filter(
      (person) => !usedCurrent.has(person.id) && peopleMatch(ged, person) && parseYear(person.birth) === year,
    );
    const yearIncoming = incoming.filter(
      (person) => peopleMatch(ged, person) && parseYear(person.birth) === year,
    );
    if (yearIncoming.length === 1 && yearCurrent.length === 1) {
      matches.set(ged.id, yearCurrent[0].id);
      usedCurrent.add(yearCurrent[0].id);
    } else if (yearCurrent.length > 1 || (yearCurrent.length > 0 && yearIncoming.length > 1)) {
      ambiguousIds.add(ged.id);
    }
  }

  for (const ged of incoming) {
    if (matches.has(ged.id) || ambiguousIds.has(ged.id)) continue;
    const leftoverCurrent = current.filter(
      (person) => !usedCurrent.has(person.id) && peopleMatch(ged, person) && yearsCompatible(ged, person),
    );
    const leftoverIncoming = incoming.filter(
      (person) =>
        !matches.has(person.id) &&
        !ambiguousIds.has(person.id) &&
        peopleMatch(ged, person) &&
        yearsCompatible(ged, person),
    );
    if (leftoverIncoming.length === 1 && leftoverCurrent.length === 1) {
      matches.set(ged.id, leftoverCurrent[0].id);
      usedCurrent.add(leftoverCurrent[0].id);
    } else if (leftoverIncoming.length > 0 && leftoverCurrent.length > 0) {
      ambiguousIds.add(ged.id);
    }
  }

  return {
    matches,
    ambiguous: incoming.filter((person) => ambiguousIds.has(person.id)),
  };
}

function mergeMatchedPerson(
  dest: Person,
  incoming: Person,
  idMap: Map<string, string>,
  people: Record<string, Person>,
  conflicts: GedcomConflict[],
  filledIds: Set<string>,
): Person {
  const name = displayName(dest);
  let next: Person = {
    ...dest,
    parentIds: [...dest.parentIds],
    spouseIds: [...dest.spouseIds],
    residences: dest.residences.map((item) => ({ ...item })),
    notableEvents: dest.notableEvents.map((item) => ({ ...item })),
    altNames: [...(dest.altNames ?? [])],
    sources: (dest.sources ?? []).map((item) => ({ ...item })),
    jobs: dest.jobs.map((item) => ({ ...item })),
    military: dest.military.map((item) => ({
      ...item,
      medals: item.medals.map((medal) => ({ ...medal })),
    })),
    marriages: Object.fromEntries(
      Object.entries(dest.marriages).map(([spouseId, marriage]) => [spouseId, { ...marriage }]),
    ),
    media: [...(dest.media ?? [])],
  };
  let filled = false;

  const given = fillName(next.givenName, incoming.givenName, name, "Given name", conflicts);
  next.givenName = given.value;
  filled = given.filled || filled;
  const family = fillName(next.familyName, incoming.familyName, name, "Family name", conflicts);
  next.familyName = family.value;
  filled = family.filled || filled;

  if (incoming.gender && incoming.gender !== next.gender) {
    conflicts.push({
      person: name,
      field: "Gender",
      current: next.gender,
      incoming: incoming.gender,
    });
  }

  const birth = fillDate(next.birth, incoming.birth, name, "Birth date", conflicts);
  next.birth = birth.value;
  filled = birth.filled || filled;
  next.birth = birth.value;
  filled = birth.filled || filled;
  const birthPlace = fillText(next.birthPlace, incoming.birthPlace, name, "Birth place", conflicts);
  next.birthPlace = birthPlace.value;
  filled = birthPlace.filled || filled;

  if (incoming.death) {
    if (next.living && !next.death) {
      next.living = false;
      next.death = incoming.death;
      next.deathPlace = incoming.deathPlace;
      filled = true;
    } else {
      const death = fillDate(next.death, incoming.death, name, "Death date", conflicts);
      next.death = death.value;
      filled = death.filled || filled;
      const deathPlace = fillText(next.deathPlace, incoming.deathPlace, name, "Death place", conflicts);
      next.deathPlace = deathPlace.value;
      filled = deathPlace.filled || filled;
    }
  }

  const residences = mergeResidences(next.residences, incoming.residences);
  next.residences = residences.list;
  filled = residences.added || filled;
  const jobs = mergeJobs(next.jobs, incoming.jobs);
  next.jobs = jobs.list;
  filled = jobs.added || filled;
  const events = mergeEvents(next.notableEvents, incoming.notableEvents);
  next.notableEvents = events.list;
  filled = events.added || filled;
  const altNames = [...new Set([...(next.altNames ?? []), ...(incoming.altNames ?? [])])];
  if (altNames.length !== (next.altNames ?? []).length) filled = true;
  next.altNames = altNames;
  const known = new Set((next.sources ?? []).map((item) => item.url || item.title));
  const newSources = (incoming.sources ?? []).filter((item) => !known.has(item.url || item.title));
  if (newSources.length) filled = true;
  next.sources = [...(next.sources ?? []), ...newSources.map((item) => ({ ...item, id: crypto.randomUUID() }))];
  if (!next.nationality?.trim() && incoming.nationality?.trim()) {
    next.nationality = incoming.nationality;
    filled = true;
  }
  if (!next.notes?.trim() && incoming.notes?.trim()) {
    next.notes = incoming.notes;
    filled = true;
  }
  const military = mergeMilitary(next.military, incoming.military);
  next.military = military.list;
  filled = military.added || filled;

  const parentResult = mergeParents(next, incoming, idMap, people, name, conflicts);
  next.parentIds = parentResult.ids;
  filled = parentResult.added || filled;

  const spouseResult = mergeSpouses(next, incoming, idMap, name, conflicts);
  next.spouseIds = spouseResult.ids;
  next.marriages = spouseResult.marriages;
  filled = spouseResult.added || filled;

  if (!next.photo && incoming.photo) {
    next.photo = incoming.photo;
    filled = true;
  }
  if (!next.flag && incoming.flag) {
    next.flag = incoming.flag;
    filled = true;
  }
  const media = mergeMedia(next.media ?? [], incoming.media ?? [], next.photo?.id, next.flag?.id);
  next.media = media.list;
  filled = media.added || filled;

  if (filled) filledIds.add(next.id);
  return next;
}

function mergeParents(
  dest: Person,
  incoming: Person,
  idMap: Map<string, string>,
  people: Record<string, Person>,
  name: string,
  conflicts: GedcomConflict[],
): { ids: string[]; added: boolean } {
  const mapped = uniqueIds(
    incoming.parentIds
      .map((id) => idMap.get(id) ?? id)
      .filter((id) => id && !id.startsWith("@") && id !== dest.id),
  );
  let ids = [...dest.parentIds];
  let added = false;
  for (const parentId of mapped) {
    if (ids.includes(parentId)) continue;
    if (ids.length >= 2) {
      conflicts.push({
        person: name,
        field: "Parents",
        current: ids.map((id) => (people[id] ? displayName(people[id]) : id)).join(", "),
        incoming: people[parentId] ? displayName(people[parentId]) : parentId,
      });
      continue;
    }
    ids.push(parentId);
    added = true;
  }
  return { ids, added };
}

function mergeSpouses(
  dest: Person,
  incoming: Person,
  idMap: Map<string, string>,
  name: string,
  conflicts: GedcomConflict[],
): { ids: string[]; marriages: Record<string, Marriage>; added: boolean } {
  const mapped = uniqueIds(
    incoming.spouseIds
      .map((id) => idMap.get(id) ?? id)
      .filter((id) => id && !id.startsWith("@") && id !== dest.id),
  );
  const ids = uniqueIds([...dest.spouseIds, ...mapped]);
  let added = mapped.some((id) => !dest.spouseIds.includes(id));
  const marriages = { ...dest.marriages };

  for (const [xref, marriage] of Object.entries(incoming.marriages)) {
    const spouseId = idMap.get(xref) ?? (xref.startsWith("@") ? "" : xref);
    if (!spouseId || spouseId === dest.id) continue;
    const existing = marriages[spouseId] ?? emptyMarriage();
    const date = fillText(existing.date, marriage.date, name, "Marriage date", conflicts);
    const place = fillText(existing.place, marriage.place, name, "Marriage place", conflicts);
    marriages[spouseId] = {
      date: date.value,
      place: place.value,
    };
    added = date.filled || place.filled || added;
  }

  return { ids, marriages, added };
}

function mergeResidences(existing: Residence[], incoming: Residence[]): { list: Residence[]; added: boolean } {
  const list = [...existing];
  let added = false;
  for (const item of incoming) {
    const match = list.find((residence) => sameText(residence.place, item.place));
    if (match) {
      if (!match.from && item.from) {
        match.from = item.from;
        added = true;
      }
      if (!match.to && item.to) {
        match.to = item.to;
        added = true;
      }
      continue;
    }
    list.push(item);
    added = true;
  }
  return { list, added };
}

function mergeJobs(existing: Job[], incoming: Job[]): { list: Job[]; added: boolean } {
  const list = [...existing];
  let added = false;
  for (const item of incoming) {
    if (list.some((job) => sameText(job.title, item.title))) continue;
    list.push(item);
    added = true;
  }
  return { list, added };
}

function mergeEvents(existing: NotableEvent[], incoming: NotableEvent[]): { list: NotableEvent[]; added: boolean } {
  const list = [...existing];
  let added = false;
  for (const item of incoming) {
    const match = list.find(
      (event) => sameText(event.title, item.title) && sameText(event.date, item.date),
    );
    if (match) {
      if (!match.detail && item.detail) {
        match.detail = item.detail;
        added = true;
      }
      continue;
    }
    list.push(item);
    added = true;
  }
  return { list, added };
}

function mergeMilitary(
  existing: MilitaryService[],
  incoming: MilitaryService[],
): { list: MilitaryService[]; added: boolean } {
  const list = [...existing];
  let added = false;
  for (const item of incoming) {
    if (list.some((service) => sameText(service.war, item.war) && sameText(service.served, item.served))) {
      continue;
    }
    list.push(item);
    added = true;
  }
  return { list, added };
}

function mergeMedia(
  existing: Person["media"],
  incoming: Person["media"],
  photoId?: string,
  flagId?: string,
): { list: Person["media"]; added: boolean } {
  const list = [...existing];
  const seen = new Set(existing.map((item) => item.id));
  let added = false;
  for (const item of incoming) {
    if (!item?.id || seen.has(item.id) || item.id === photoId || item.id === flagId) continue;
    seen.add(item.id);
    list.push(item);
    added = true;
  }
  return { list, added };
}

function fillName(
  current: string,
  incoming: string,
  person: string,
  field: string,
  conflicts: GedcomConflict[],
): { value: string; filled: boolean } {
  const next = incoming.trim();
  const prev = current.trim();
  if (!next) return { value: current, filled: false };
  if (!prev) return { value: incoming, filled: true };
  const preferred = preferredSimilarName(prev, next);
  if (preferred) return { value: preferred, filled: preferred !== prev };
  conflicts.push({ person, field, current: prev, incoming: next });
  return { value: current, filled: false };
}

function preferredSimilarName(current: string, incoming: string): string | null {
  if (sameText(current, incoming)) return current;
  const currentTokens = tokenizeName(current);
  const incomingTokens = tokenizeName(incoming);
  if (currentTokens.length === 0 || incomingTokens.length === 0) return null;
  if (!similarWord(currentTokens[0], incomingTokens[0])) return null;
  const extraCurrent = currentTokens.slice(1);
  const extraIncoming = incomingTokens.slice(1);
  if (extraCurrent.length && extraIncoming.length) {
    const extraOk = extraCurrent.every((token, index) => !extraIncoming[index] || similarWord(token, extraIncoming[index]));
    if (!extraOk) return null;
  }
  return current.length >= incoming.length ? current : incoming;
}

function peopleMatch(a: Person, b: Person): boolean {
  const givenA = tokenizeName(a.givenName);
  const givenB = tokenizeName(b.givenName);
  if (!givenA[0] || !givenB[0] || !similarWord(givenA[0], givenB[0])) return false;
  if (!similarWord(familyKey(a.familyName), familyKey(b.familyName))) return false;
  if (givenA[1] && givenB[1] && !similarWord(givenA[1], givenB[1])) return false;
  return true;
}

function yearsCompatible(a: Person, b: Person): boolean {
  const left = parseYear(a.birth);
  const right = parseYear(b.birth);
  if (left == null || right == null) return true;
  return left === right;
}

function tokenizeName(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .map((token) => token.replace(/\./g, ""))
    .filter(Boolean);
}

function familyKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, "");
}

function similarWord(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.length <= 2 && b.startsWith(a)) return true;
  if (b.length <= 2 && a.startsWith(b)) return true;
  return levenshtein(a, b) <= 1;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

function fillDate(
  current: string,
  incoming: string,
  person: string,
  field: string,
  conflicts: GedcomConflict[],
): { value: string; filled: boolean } {
  const next = incoming.trim();
  const prev = current.trim();
  if (!next) return { value: current, filled: false };
  if (!prev) return { value: incoming, filled: true };
  if (prev === next) return { value: current, filled: false };
  const currentYear = parseYear(prev);
  const incomingYear = parseYear(next);
  if (currentYear != null && currentYear === incomingYear) {
    const currentRest = prev.replace(String(currentYear), "").replace(/\D/g, "");
    const incomingRest = next.replace(String(incomingYear), "").replace(/\D/g, "");
    if (!currentRest && incomingRest) return { value: incoming, filled: true };
    return { value: current, filled: false };
  }
  conflicts.push({ person, field, current: prev, incoming: next });
  return { value: current, filled: false };
}

function fillText(
  current: string,
  incoming: string,
  person: string,
  field: string,
  conflicts: GedcomConflict[],
): { value: string; filled: boolean } {
  const next = incoming.trim();
  const prev = current.trim();
  if (!next) return { value: current, filled: false };
  if (!prev) return { value: incoming, filled: true };
  if (prev === next) return { value: current, filled: false };
  conflicts.push({ person, field, current: prev, incoming: next });
  return { value: current, filled: false };
}

function remapPerson(person: Person): Person {
  return {
    ...person,
    id: crypto.randomUUID(),
    residences: person.residences.map(cloneResidence),
    notableEvents: person.notableEvents.map(cloneEvent),
    altNames: [...(person.altNames ?? [])],
    sources: (person.sources ?? []).map((item) => ({ ...item, id: crypto.randomUUID() })),
    jobs: person.jobs.map((job) => ({ ...job, id: crypto.randomUUID() })),
    military: person.military.map(cloneMilitary),
    media: [...(person.media ?? [])],
    marriages: Object.fromEntries(
      Object.entries(person.marriages).map(([spouseId, marriage]) => [spouseId, { ...marriage }]),
    ),
  };
}

function remapLinks(person: Person, idMap: Map<string, string>): Person {
  return {
    ...person,
    parentIds: uniqueIds(person.parentIds.map((id) => idMap.get(id) ?? id).filter((id) => !id.startsWith("@"))).slice(
      0,
      2,
    ),
    spouseIds: uniqueIds(person.spouseIds.map((id) => idMap.get(id) ?? id).filter((id) => !id.startsWith("@"))),
    marriages: Object.fromEntries(
      Object.entries(person.marriages).flatMap(([spouseId, marriage]) => {
        const mapped = idMap.get(spouseId) ?? (spouseId.startsWith("@") ? "" : spouseId);
        return mapped ? [[mapped, marriage]] : [];
      }),
    ),
  };
}

function cloneResidence(item: Residence): Residence {
  return { ...item, id: crypto.randomUUID() };
}

function cloneEvent(item: NotableEvent): NotableEvent {
  return { ...item, id: crypto.randomUUID() };
}

function cloneMilitary(item: MilitaryService): MilitaryService {
  return {
    ...item,
    id: crypto.randomUUID(),
    medals: item.medals.map((medal) => ({
      ...medal,
      id: crypto.randomUUID(),
    })),
  };
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
