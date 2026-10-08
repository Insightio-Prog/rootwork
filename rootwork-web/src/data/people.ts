export type Gender = "female" | "male";

export type MediaRef = {
  id: string;
  originalName: string;
  mime: string;
  ext: string;
};

export type Residence = {
  id: string;
  place: string;
  from: string;
  to: string;
};

export type NotableEvent = {
  id: string;
  title: string;
  date: string;
  detail: string;
};

export type Job = {
  id: string;
  title: string;
  detail: string;
};

export type Medal = {
  id: string;
  name: string;
};

export type MilitaryService = {
  id: string;
  served: string;
  war: string;
  medals: Medal[];
};

export type Marriage = {
  date: string;
  place: string;
};

export type SourceLink = {
  id: string;
  title: string;
  url: string;
};

export type Person = {
  id: string;
  givenName: string;
  familyName: string;
  gender: Gender;
  birth: string;
  birthPlace: string;
  death: string;
  deathPlace: string;
  living: boolean;
  parentIds: string[];
  spouseIds: string[];
  residences: Residence[];
  notableEvents: NotableEvent[];
  jobs: Job[];
  military: MilitaryService[];
  marriages: Record<string, Marriage>;
  photo: MediaRef | null;
  flag: MediaRef | null;
  media: MediaRef[];
  notes: string;
  altNames: string[];
  sources: SourceLink[];
  nationality: string;
};

export type PersonDraft = {
  givenName: string;
  familyName: string;
  gender: Gender;
  birth: string;
  birthPlace: string;
  death: string;
  deathPlace: string;
  living: boolean;
  nationality?: string;
};

export const TREE_TITLE = "My Family";

export const emptyDraft = (overrides: Partial<PersonDraft> = {}): PersonDraft => ({
  givenName: "",
  familyName: "",
  gender: "female",
  birth: "",
  birthPlace: "",
  death: "",
  deathPlace: "",
  living: true,
  nationality: "",
  ...overrides,
});

export function createPerson(draft: PersonDraft): Person {
  const living = draft.living;
  return {
    id: crypto.randomUUID(),
    givenName: draft.givenName.trim(),
    familyName: draft.familyName.trim(),
    gender: draft.gender,
    birth: draft.birth.trim(),
    birthPlace: draft.birthPlace.trim(),
    death: living ? "" : draft.death.trim(),
    deathPlace: living ? "" : draft.deathPlace.trim(),
    living,
    parentIds: [],
    spouseIds: [],
    residences: [],
    notableEvents: [],
    jobs: [],
    military: [],
    marriages: {},
    photo: null,
    flag: null,
    media: [],
    notes: "",
    altNames: [],
    sources: [],
    nationality: (draft.nationality ?? "").trim(),
  };
}

export function displayName(person: Person): string {
  return [person.givenName, person.familyName].filter(Boolean).join(" ") || "Unnamed";
}

export function cardName(person: Person): string {
  return displayName(person);
}

export function initials(person: Pick<Person, "givenName" | "familyName">): string {
  const given = person.givenName.trim();
  const family = person.familyName.trim();
  const a = given ? given[0] : "";
  const b = family ? family[0] : given.length > 1 ? given[1] : "";
  const letters = (a + b).toUpperCase();
  return letters || "?";
}

export function yearFromDate(value: string): string {
  const match = value.match(/\d{4}/);
  return match ? match[0] : value.trim();
}

export function yearsLabel(person: Person): string {
  const birth = yearFromDate(person.birth);
  if (person.living) return birth ? `${birth} – Living` : "Living";
  const death = yearFromDate(person.death);
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return "Dates unknown";
}

export function peopleCountLabel(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

export function draftFromPerson(person: Person): PersonDraft {
  return {
    givenName: person.givenName,
    familyName: person.familyName,
    gender: person.gender,
    birth: person.birth,
    birthPlace: person.birthPlace,
    death: person.death,
    deathPlace: person.deathPlace,
    living: person.living,
    nationality: person.nationality ?? "",
  };
}

export function getPerson(
  people: Record<string, Person>,
  id: string | null | undefined,
): Person | undefined {
  if (!id) return undefined;
  return people[id];
}

export function orderedParents(
  people: Record<string, Person>,
  person: Person,
): Person[] {
  return person.parentIds
    .map((id) => people[id])
    .filter((parent): parent is Person => Boolean(parent))
    .sort((a, b) => Number(a.gender !== "male") - Number(b.gender !== "male"));
}

export function spousesOf(
  people: Record<string, Person>,
  person: Person,
): Person[] {
  return person.spouseIds
    .map((id) => people[id])
    .filter((spouse): spouse is Person => Boolean(spouse));
}

export function childrenOf(
  people: Record<string, Person>,
  personId: string,
): Person[] {
  return Object.values(people)
    .filter((person) => person.parentIds.includes(personId))
    .sort((a, b) => (parseYear(a.birth) ?? 99999) - (parseYear(b.birth) ?? 99999));
}

export function isAncestorOf(
  people: Record<string, Person>,
  ancestorId: string,
  personId: string,
  seen = new Set<string>(),
): boolean {
  if (!ancestorId || ancestorId === personId || seen.has(personId)) return false;
  seen.add(personId);
  const person = people[personId];
  if (!person) return false;
  if (person.parentIds.includes(ancestorId)) return true;
  return person.parentIds.some((parentId) => isAncestorOf(people, ancestorId, parentId, seen));
}

function byDisplayName(a: Person, b: Person): number {
  return displayName(a).localeCompare(displayName(b));
}

export function existingParentCandidates(
  people: Record<string, Person>,
  childId: string,
): Person[] {
  const child = people[childId];
  if (!child || child.parentIds.length >= 2) return [];
  return Object.values(people)
    .filter((person) => {
      if (person.id === childId) return false;
      if (child.parentIds.includes(person.id)) return false;
      if (isAncestorOf(people, childId, person.id)) return false;
      if (isAncestorOf(people, person.id, childId)) return false;
      return true;
    })
    .sort(byDisplayName);
}

export function existingSpouseCandidates(
  people: Record<string, Person>,
  personId: string,
): Person[] {
  const person = people[personId];
  if (!person) return [];
  return Object.values(people)
    .filter((candidate) => {
      if (candidate.id === personId) return false;
      if (person.spouseIds.includes(candidate.id)) return false;
      return true;
    })
    .sort(byDisplayName);
}

export function existingChildCandidates(
  people: Record<string, Person>,
  parentId: string,
): Person[] {
  const parent = people[parentId];
  if (!parent) return [];
  return Object.values(people)
    .filter((candidate) => {
      if (candidate.id === parentId) return false;
      if (candidate.parentIds.includes(parentId)) return false;
      if (candidate.parentIds.length >= 2) return false;
      if (isAncestorOf(people, candidate.id, parentId)) return false;
      if (isAncestorOf(people, parentId, candidate.id)) return false;
      return true;
    })
    .sort(byDisplayName);
}

export function existingSiblingCandidates(
  people: Record<string, Person>,
  personId: string,
): Person[] {
  const person = people[personId];
  if (!person || person.parentIds.length === 0) return [];
  const already = new Set(siblingsOf(people, person).map((sibling) => sibling.id));
  return Object.values(people)
    .filter((candidate) => {
      if (candidate.id === personId) return false;
      if (already.has(candidate.id)) return false;
      if (person.parentIds.includes(candidate.id)) return false;
      if (candidate.parentIds.includes(personId)) return false;
      if (person.spouseIds.includes(candidate.id)) return false;
      if (isAncestorOf(people, candidate.id, personId)) return false;
      if (isAncestorOf(people, personId, candidate.id)) return false;
      return uniqueIds([...candidate.parentIds, ...person.parentIds]).length <= 2;
    })
    .sort(byDisplayName);
}

export function otherParentCandidates(
  people: Record<string, Person>,
  parentId: string,
): { spouses: Person[]; others: Person[] } {
  const parent = people[parentId];
  if (!parent) return { spouses: [], others: [] };
  const spouses = spousesOf(people, parent);
  const spouseIds = new Set(spouses.map((spouse) => spouse.id));
  const others = Object.values(people)
    .filter((person) => person.id !== parentId && !spouseIds.has(person.id))
    .sort(byDisplayName);
  return { spouses, others };
}

export function roleFor(
  people: Record<string, Person>,
  id: string,
  homeId: string | null,
): string {
  if (!homeId) return "Relative";
  if (id === homeId) return "Home person";
  const home = people[homeId];
  if (!home) return "Relative";
  const homeParents = orderedParents(people, home);
  if (homeParents[0]?.id === id) {
    return homeParents[0].gender === "female" ? "Mother of home person" : "Father of home person";
  }
  if (homeParents[1]?.id === id) {
    return homeParents[1].gender === "male" ? "Father of home person" : "Mother of home person";
  }
  for (const parent of homeParents) {
    const grandparents = orderedParents(people, parent);
    if (grandparents[0]?.id === id) {
      return grandparents[0].gender === "female" ? "Grandmother" : "Grandfather";
    }
    if (grandparents[1]?.id === id) {
      return grandparents[1].gender === "male" ? "Grandfather" : "Grandmother";
    }
  }
  if (home.spouseIds.includes(id)) return "Spouse of home person";
  if (home.parentIds.includes(id)) {
    return people[id]?.gender === "female" ? "Mother of home person" : "Father of home person";
  }
  return "Relative";
}

export function ancestorGenerations(
  people: Record<string, Person>,
  homeId: string | null,
): number {
  if (!homeId || !people[homeId]) return 0;
  const home = people[homeId];
  if (home.parentIds.length === 0) return 1;
  const hasGrandparent = orderedParents(people, home).some(
    (parent) => parent.parentIds.length > 0,
  );
  return hasGrandparent ? 3 : 2;
}

export function parseYear(value: string): number | null {
  const raw = yearFromDate(value);
  if (!raw) return null;
  const year = Number(raw);
  return Number.isFinite(year) ? year : null;
}

export function diedDuringLifetime(person: Person, relative: Person): boolean {
  if (relative.living) return false;
  const relativeDeath = parseYear(relative.death);
  const birth = parseYear(person.birth);
  const death = person.living ? Number.POSITIVE_INFINITY : (parseYear(person.death) ?? Number.POSITIVE_INFINITY);
  if (relativeDeath == null) return true;
  if (birth != null && relativeDeath < birth) return false;
  if (relativeDeath > death) return false;
  return true;
}

export function siblingsOf(people: Record<string, Person>, person: Person): Person[] {
  const seen = new Set<string>([person.id]);
  const siblings: Person[] = [];
  for (const parentId of person.parentIds) {
    for (const sibling of childrenOf(people, parentId)) {
      if (seen.has(sibling.id)) continue;
      seen.add(sibling.id);
      siblings.push(sibling);
    }
  }
  return siblings;
}

function isParentOrAncestor(
  people: Record<string, Person>,
  maybeAncestorId: string,
  person: Person,
): boolean {
  return person.parentIds.includes(maybeAncestorId) || isAncestorOf(people, maybeAncestorId, person.id);
}

export function withSiblingLink(
  people: Record<string, Person>,
  personId: string,
  relativeId: string,
): Record<string, Person> {
  const relative = people[relativeId];
  const added = people[personId];
  if (!relative || !added || relative.id === personId || relative.parentIds.length === 0) return people;
  if (isParentOrAncestor(people, personId, relative) || isParentOrAncestor(people, relativeId, added)) {
    return people;
  }
  const parentIds = uniqueIds(
    [...added.parentIds, ...relative.parentIds].filter((id) => id !== personId && id !== relativeId),
  );
  if (parentIds.length > 2) return people;
  return { ...people, [personId]: { ...added, parentIds } };
}

export function unlinkSibling(
  people: Record<string, Person>,
  personId: string,
  siblingId: string,
): Record<string, Person> {
  const person = people[personId];
  const sibling = people[siblingId];
  if (!person || !sibling || personId === siblingId) return people;

  const siblingIsAncestor = isParentOrAncestor(people, siblingId, person);
  const personIsAncestor = isParentOrAncestor(people, personId, sibling);
  let targetId = siblingId;
  if (siblingIsAncestor) targetId = personId;
  else if (personIsAncestor) targetId = siblingId;
  else if (childrenOf(people, siblingId).length > 0 && childrenOf(people, personId).length === 0) {
    targetId = personId;
  }

  const target = people[targetId];
  const other = people[targetId === personId ? siblingId : personId];
  if (!target || !other) return people;
  const shared = new Set(other.parentIds);
  const parentIds = uniqueIds(
    target.parentIds.filter((id) => id === other.id || !shared.has(id)),
  );
  if (parentIds.length === target.parentIds.length) return people;
  return { ...people, [targetId]: { ...target, parentIds } };
}

export function grandparentsOf(
  people: Record<string, Person>,
  person: Person,
): Person[] {
  const seen = new Set<string>();
  const grandparents: Person[] = [];
  for (const parent of orderedParents(people, person)) {
    for (const grandparent of orderedParents(people, parent)) {
      if (seen.has(grandparent.id)) continue;
      seen.add(grandparent.id);
      grandparents.push(grandparent);
    }
  }
  return grandparents;
}

export function closeRelatives(people: Record<string, Person>, person: Person): Person[] {
  return [
    ...orderedParents(people, person),
    ...grandparentsOf(people, person),
    ...spousesOf(people, person),
    ...childrenOf(people, person.id),
    ...siblingsOf(people, person),
  ];
}

export function relativeDeathsInLifetime(
  people: Record<string, Person>,
  person: Person,
): Person[] {
  return closeRelatives(people, person).filter((relative) => diedDuringLifetime(person, relative));
}

export function closeRelativeLabel(
  people: Record<string, Person>,
  person: Person,
  relative: Person,
): string {
  if (person.parentIds.includes(relative.id)) {
    return relative.gender === "female" ? "Mother" : "Father";
  }
  if (orderedParents(people, person).some((parent) => parent.parentIds.includes(relative.id))) {
    return relative.gender === "female" ? "Grandmother" : "Grandfather";
  }
  if (person.spouseIds.includes(relative.id)) return "Spouse";
  if (relative.parentIds.includes(person.id)) {
    return relative.gender === "female" ? "Daughter" : "Son";
  }
  return "Sibling";
}

export function emptyMarriage(): Marriage {
  return { date: "", place: "" };
}

export function resolvedMarriage(person: Person, spouse: Person): Marriage {
  const own = person.marriages[spouse.id];
  const theirs = spouse.marriages[person.id];
  return {
    date: own?.date || theirs?.date || "",
    place: own?.place || theirs?.place || "",
  };
}

export function withMarriageDetails(
  person: Person,
  spouseId: string,
  date: string,
  place: string,
): Person {
  const existing = person.marriages[spouseId] ?? emptyMarriage();
  return {
    ...person,
    marriages: {
      ...person.marriages,
      [spouseId]: {
        ...existing,
        date: date.trim(),
        place: place.trim(),
      },
    },
  };
}

export function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function normalizeEvidenceUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function normalizeMedia(value: unknown): MediaRef | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<MediaRef>;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  const originalName = typeof raw.originalName === "string" ? raw.originalName : "";
  const mime = typeof raw.mime === "string" ? raw.mime : "application/octet-stream";
  const ext =
    typeof raw.ext === "string" && raw.ext.trim()
      ? raw.ext.startsWith(".")
        ? raw.ext.toLowerCase()
        : `.${raw.ext.toLowerCase()}`
      : "";
  return { id: raw.id, originalName, mime, ext: ext || ".bin" };
}

function filesFromEvidenceList(value: unknown): MediaRef[] {
  if (!Array.isArray(value)) return [];
  const files: MediaRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as { files?: unknown };
    if (!Array.isArray(raw.files)) continue;
    for (const file of raw.files) {
      const media = normalizeMedia(file);
      if (media) files.push(media);
    }
  }
  return files;
}

function collectLegacyMedia(raw: Record<string, unknown>, photo: MediaRef | null, flag: MediaRef | null): MediaRef[] {
  const skip = new Set([photo?.id, flag?.id].filter((id): id is string => Boolean(id)));
  const seen = new Set<string>();
  const refs: MediaRef[] = [];
  const push = (files: MediaRef[]) => {
    for (const file of files) {
      if (skip.has(file.id) || seen.has(file.id)) continue;
      seen.add(file.id);
      refs.push(file);
    }
  };
  if (Array.isArray(raw.media)) {
    push(raw.media.map(normalizeMedia).filter((file): file is MediaRef => Boolean(file)));
  }
  push(filesFromEvidenceList(raw.birthEvidence));
  push(filesFromEvidenceList(raw.deathEvidence));
  if (Array.isArray(raw.residences)) {
    for (const residence of raw.residences) {
      if (residence && typeof residence === "object") {
        push(filesFromEvidenceList((residence as { evidence?: unknown }).evidence));
      }
    }
  }
  if (Array.isArray(raw.notableEvents)) {
    for (const event of raw.notableEvents) {
      if (event && typeof event === "object") {
        push(filesFromEvidenceList((event as { evidence?: unknown }).evidence));
      }
    }
  }
  if (raw.marriages && typeof raw.marriages === "object" && !Array.isArray(raw.marriages)) {
    for (const marriage of Object.values(raw.marriages as Record<string, { evidence?: unknown }>)) {
      push(filesFromEvidenceList(marriage?.evidence));
    }
  }
  if (raw.relativeDeathEvidence && typeof raw.relativeDeathEvidence === "object") {
    for (const evidence of Object.values(raw.relativeDeathEvidence as Record<string, unknown>)) {
      push(filesFromEvidenceList(evidence));
    }
  }
  if (Array.isArray(raw.military)) {
    for (const service of raw.military) {
      if (!service || typeof service !== "object") continue;
      const row = service as { servedEvidence?: unknown; warEvidence?: unknown; medals?: unknown };
      push(filesFromEvidenceList(row.servedEvidence));
      push(filesFromEvidenceList(row.warEvidence));
      if (Array.isArray(row.medals)) {
        for (const medal of row.medals) {
          if (medal && typeof medal === "object") {
            push(filesFromEvidenceList((medal as { evidence?: unknown }).evidence));
          }
        }
      }
    }
  }
  return refs;
}

export function mediaRefsOfPerson(person: Person): MediaRef[] {
  const refs: MediaRef[] = [];
  if (person.photo) refs.push(person.photo);
  if (person.flag) refs.push(person.flag);
  refs.push(...(person.media ?? []));
  return refs;
}

export function albumMediaOfPerson(person: Person, extras: MediaRef[] = []): MediaRef[] {
  const flagId = person.flag?.id;
  const seen = new Set<string>();
  const refs: MediaRef[] = [];
  for (const ref of [...mediaRefsOfPerson(person), ...extras]) {
    if (flagId && ref.id === flagId) continue;
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    refs.push(ref);
  }
  return refs;
}

export function createResidence(place: string, from = "", to = ""): Residence {
  return {
    id: crypto.randomUUID(),
    place: place.trim(),
    from: from.trim(),
    to: to.trim(),
  };
}

export function createNotableEvent(title: string, date = "", detail = ""): NotableEvent {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    date: date.trim(),
    detail: detail.trim(),
  };
}

export function notableEventsOf(person: Person): NotableEvent[] {
  return [...person.notableEvents].sort(
    (a, b) => (parseYear(a.date) ?? 99999) - (parseYear(b.date) ?? 99999),
  );
}

function normalizeNotableEvents(value: unknown): NotableEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<NotableEvent>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) return [];
    return [
      {
        id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
        title,
        date: typeof raw.date === "string" ? raw.date : "",
        detail: typeof raw.detail === "string" ? raw.detail : "",
      },
    ];
  });
}

export function createJob(title: string, detail = ""): Job {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    detail: detail.trim(),
  };
}

export function militaryOf(person: Person): MilitaryService[] {
  return person.military ?? [];
}

export function createMilitaryService(served = "", war = ""): MilitaryService {
  return {
    id: crypto.randomUUID(),
    served: served.trim(),
    war: war.trim(),
    medals: [],
  };
}

export function createMedal(name: string): Medal {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
  };
}

function normalizeMedals(value: unknown): Medal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<Medal>;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) return [];
    return [
      {
        id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
        name,
      },
    ];
  });
}

function normalizeMilitary(value: unknown): MilitaryService[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<MilitaryService>;
    const served = typeof raw.served === "string" ? raw.served.trim() : "";
    const war = typeof raw.war === "string" ? raw.war.trim() : "";
    const medals = normalizeMedals(raw.medals);
    if (!served && !war && medals.length === 0) return [];
    return [
      {
        id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
        served,
        war,
        medals,
      },
    ];
  });
}

function normalizeJobs(value: unknown): Job[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<Job>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) return [];
    return [
      {
        id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
        title,
        detail: typeof raw.detail === "string" ? raw.detail : "",
      },
    ];
  });
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function normalizePerson(
  person: Omit<
    Person,
    | "living"
    | "residences"
    | "notableEvents"
    | "jobs"
    | "military"
    | "marriages"
    | "photo"
    | "flag"
    | "media"
    | "notes"
    | "altNames"
    | "sources"
    | "nationality"
  > & {
    living?: boolean;
    residences?: Residence[];
    notableEvents?: NotableEvent[];
    jobs?: Job[];
    military?: MilitaryService[];
    marriages?: Record<string, Marriage>;
    photo?: MediaRef | null;
    flag?: MediaRef | null;
    media?: MediaRef[];
    notes?: string;
    altNames?: string[];
    sources?: SourceLink[];
    nationality?: string;
  },
): Person {
  const living =
    typeof person.living === "boolean" ? person.living : !String(person.death ?? "").trim();
  const marriages =
    person.marriages && typeof person.marriages === "object" && !Array.isArray(person.marriages)
      ? Object.fromEntries(
          Object.entries(person.marriages).map(([spouseId, marriage]) => [
            spouseId,
            {
              date: marriage?.date ?? "",
              place: marriage?.place ?? "",
            },
          ]),
        )
      : {};
  const photo = normalizeMedia(person.photo);
  const flag = normalizeMedia(person.flag);
  const media = collectLegacyMedia(person as unknown as Record<string, unknown>, photo, flag);
  return {
    id: person.id,
    givenName: person.givenName,
    familyName: person.familyName,
    gender: person.gender,
    birth: person.birth,
    birthPlace: person.birthPlace,
    death: living ? "" : person.death ?? "",
    deathPlace: living ? "" : person.deathPlace ?? "",
    living,
    parentIds: person.parentIds,
    spouseIds: person.spouseIds,
    residences: Array.isArray(person.residences)
      ? person.residences.map((residence) => ({
          id: residence.id,
          place: residence.place,
          from: residence.from,
          to: residence.to,
        }))
      : [],
    notableEvents: normalizeNotableEvents(person.notableEvents),
    jobs: normalizeJobs(person.jobs),
    military: normalizeMilitary(person.military),
    marriages,
    photo,
    flag,
    media,
    notes: typeof person.notes === "string" ? person.notes : "",
    altNames: Array.isArray(person.altNames)
      ? person.altNames.filter((name): name is string => typeof name === "string" && Boolean(name.trim()))
      : [],
    sources: normalizeSources(person.sources),
    nationality: typeof person.nationality === "string" ? person.nationality.trim() : "",
  };
}

function normalizeSources(value: unknown): SourceLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<SourceLink>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    if (!title && !url) return [];
    return [{ id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(), title: title || url, url }];
  });
}
