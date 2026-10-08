import {
  createJob,
  createMilitaryService,
  createNotableEvent,
  createPerson,
  createResidence,
  parseYear,
  uniqueIds,
  type Gender,
  type Person,
} from "../data/people";

export type GedNode = {
  tag: string;
  xref: string;
  value: string;
  children: GedNode[];
};

const EVENT_TITLES: Record<string, string> = {
  BURI: "Burial",
  BAPM: "Baptism",
  EMIG: "Emigration",
  PROB: "Probate",
  EVEN: "Event",
  MARB: "Marriage banns",
};

export function parseGedcom(text: string): GedNode[] {
  const roots: GedNode[] = [];
  const stack: GedNode[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const match = raw.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_/-]+)(?:\s(.*))?$/);
    if (!match) continue;
    const level = Number(match[1]);
    const node: GedNode = {
      tag: match[3].toUpperCase(),
      xref: match[2] ?? "",
      value: match[4] ?? "",
      children: [],
    };
    if (level === 0) {
      stack.length = 0;
      roots.push(node);
      stack.push(node);
      continue;
    }
    while (stack.length > level) stack.pop();
    const parent = stack[stack.length - 1];
    if (!parent) continue;
    parent.children.push(node);
    stack.push(node);
  }
  return roots;
}

export function mapGedcomPeople(text: string): Record<string, Person> {
  const roots = parseGedcom(text);
  const individuals = indexByTag(roots, "INDI");
  if (individuals.size === 0) {
    throw new Error("no people in this GEDCOM");
  }
  const families = indexByTag(roots, "FAM");
  const sources = indexByTag(roots, "SOUR");
  const people: Record<string, Person> = {};
  livingFlagged.clear();
  for (const [xref, node] of individuals) {
    people[xref] = mapIndividual(xref, node, sources);
  }
  applyFamilies(people, families, sources, individuals);
  return people;
}

function indexByTag(roots: GedNode[], tag: string): Map<string, GedNode> {
  const map = new Map<string, GedNode>();
  for (const node of roots) {
    if (node.tag !== tag || !node.xref) continue;
    map.set(node.xref, node);
  }
  return map;
}

function mapIndividual(xref: string, node: GedNode, sources: Map<string, GedNode>): Person {
  const names = children(node, "NAME");
  const primary = names.find((item) => child(item, "_PRIM")?.value.trim().toUpperCase() === "Y") ?? names[0];
  const name = readName(primary);
  const sex = child(node, "SEX");
  const sexText = concatText(sex).trim().toUpperCase();
  const gender: Gender = sexText.startsWith("M") ? "male" : "female";
  const birth = child(node, "BIRT");
  const death = child(node, "DEAT");
  const deceasedFacts = ["BURI", "PROB"].some((tag) => child(node, tag));
  const living = isLiving(node, factDate(birth) || factDate(child(node, "BAPM")), Boolean(death) || deceasedFacts);
  const person = createPerson({
    givenName: name.given,
    familyName: name.family,
    gender,
    birth: factDate(birth),
    birthPlace: factPlace(birth),
    death: living ? "" : factDate(death),
    deathPlace: living ? "" : factPlace(death),
    living,
  });
  person.id = xref;
  person.residences = collapseResidences(children(node, "RESI").flatMap(mapResidence));
  person.jobs = children(node, "OCCU").flatMap(mapJob);
  person.military = children(node, "_MILT").flatMap(mapMilitary);
  person.notableEvents = [
    ...children(node, "EVEN"),
    ...children(node, "BURI"),
    ...children(node, "BAPM"),
    ...children(node, "EMIG"),
    ...children(node, "PROB"),
    ...children(node, "MARB"),
  ].flatMap((item) => mapEvent(item));

  // Things the tree has no event for go in their own fields: alternate names, notes and source links.
  for (const other of names) {
    if (other === primary) continue;
    const text = displayGedName(other);
    if (text && text.toLowerCase() !== displayGedName(primary).toLowerCase() && !person.altNames.includes(text)) {
      person.altNames.push(text);
    }
  }
  const noteParts: string[] = [];
  const suffix = concatText(child(primary, "NSFX")).trim();
  if (suffix) noteParts.push(`Name suffix: ${suffix}`);
  for (const note of children(node, "NOTE")) {
    const text = concatText(note).trim();
    if (text && !pointer(text)) noteParts.push(text);
  }
  person.notes = noteParts.join("\n\n");
  const cause = concatText(child(death, "CAUS")).trim();
  if (cause) person.notableEvents.push(createNotableEvent("Cause of death", factDate(death), cause));
  person.sources = collectSources(node, sources);
  if (explicitlyLiving(node)) livingFlagged.add(xref);
  return person;
}

/** People Findmypast explicitly marks as living - the deceased inference below must not touch them. */
const livingFlagged = new Set<string>();

function explicitlyLiving(node: GedNode): boolean {
  return Boolean(child(node, "_LIV"));
}

/** Every record the person is cited from, as short titled links, without repeats. */
function collectSources(root: GedNode, sources: Map<string, GedNode>, into: Person["sources"] = []): Person["sources"] {
  const seen = new Set(into.map((item) => item.url || item.title));
  const walk = (node: GedNode) => {
    for (const item of node.children) {
      if (item.tag === "SOUR") {
        const link = citationLink(item, sources);
        const key = link ? link.url || link.title : "";
        if (link && !seen.has(key)) {
          seen.add(key);
          into.push(link);
        }
      } else {
        walk(item);
      }
    }
  };
  walk(root);
  return into.slice(0, 40);
}

function citationLink(cite: GedNode, sources: Map<string, GedNode>): Person["sources"][number] | null {
  const source = sources.get(pointer(cite.value) ?? "");
  const title = (concatText(child(source, "TITL")) || concatText(child(source, "ABBR"))).trim();
  const url = concatText(child(cite, "REF")).trim();
  if (!title && !url) return null;
  return { id: crypto.randomUUID(), title: title || "Source record", url: /^https?:/i.test(url) ? url : "" };
}

function displayGedName(node: GedNode | undefined): string {
  if (!node) return "";
  const { given, family } = readName(node);
  return [given, family].filter(Boolean).join(" ").trim();
}

/** Findmypast marks people it knows to be dead with _NLIV (and the living with _LIV) but gives no death date. */
function isLiving(node: GedNode, birth: string, hasDeathFact: boolean): boolean {
  if (hasDeathFact) return false;
  if (child(node, "_NLIV")) return false;
  if (child(node, "_LIV")) return true;
  const year = parseYear(birth);
  if (year !== null && new Date().getFullYear() - year > 100) return false;
  return true;
}

function applyFamilies(
  people: Record<string, Person>,
  families: Map<string, GedNode>,
  sources: Map<string, GedNode>,
  individuals: Map<string, GedNode>,
) {
  for (const node of families.values()) {
    const husb = pointer(child(node, "HUSB")?.value ?? "");
    const wife = pointer(child(node, "WIFE")?.value ?? "");
    const kids = children(node, "CHIL")
      .map((item) => pointer(item.value))
      .filter((id): id is string => Boolean(id && people[id]));
    const parents = [husb, wife].filter((id): id is string => Boolean(id && people[id]));
    const marr = child(node, "MARR");
    const date = factDate(marr);
    const place = factPlace(marr);

    // Sex is sometimes missing; a person's role in a family says which it must be.
    if (husb && people[husb] && !child(individuals.get(husb), "SEX")) people[husb].gender = "male";
    if (wife && people[wife] && !child(individuals.get(wife), "SEX")) people[wife].gender = "female";

    if (husb && wife && people[husb] && people[wife]) {
      people[husb].spouseIds = uniqueIds([...people[husb].spouseIds, wife]);
      people[wife].spouseIds = uniqueIds([...people[wife].spouseIds, husb]);
      people[husb].marriages[wife] = { date, place };
      people[wife].marriages[husb] = { date, place };
    }

    const marriageSources = collectSources(node, sources);
    const banns = children(node, "MARB").flatMap((item) => mapEvent(item));
    for (const spouseId of parents) {
      const spouse = people[spouseId];
      const otherId = parents.find((id) => id !== spouseId);
      const other = otherId ? people[otherId] : undefined;
      const withName = (title: string) =>
        other ? `${title} (to ${[other.givenName, other.familyName].join(" ").trim()})` : title;
      for (const event of banns) {
        spouse.notableEvents.push({ ...event, id: crypto.randomUUID(), title: withName(event.title) });
      }
      spouse.sources = mergeSourceLists(spouse.sources, marriageSources);
    }

    for (const childId of kids) {
      const person = people[childId];
      if (person.parentIds.length && parents.length && !parents.every((id) => person.parentIds.includes(id))) {
        const names = parents
          .map((id) => [people[id].givenName, people[id].familyName].join(" ").trim())
          .join(" and ");
        person.notableEvents.push(createNotableEvent("Other recorded parents", "", names));
        continue;
      }
      person.parentIds = uniqueIds([...person.parentIds, ...parents]).slice(0, 2);
    }
  }
  inferDeceasedAncestors(people);
}

function mergeSourceLists(a: Person["sources"], b: Person["sources"]): Person["sources"] {
  const seen = new Set(a.map((item) => item.url || item.title));
  const out = [...a];
  for (const item of b) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, id: crypto.randomUUID() });
  }
  return out.slice(0, 40);
}

/** Nobody is a living parent of a dead person, or of someone old enough to be dead themselves. */
function inferDeceasedAncestors(people: Record<string, Person>) {
  const year = new Date().getFullYear();
  let changed = true;
  while (changed) {
    changed = false;
    for (const person of Object.values(people)) {
      for (const parentId of person.parentIds) {
        const parent = people[parentId];
        if (!parent || !parent.living || livingFlagged.has(parentId)) continue;
        const born = parseYear(person.birth);
        if (!person.living || (born !== null && year - born > 80)) {
          parent.living = false;
          parent.death = "";
          parent.deathPlace = "";
          changed = true;
        }
      }
    }
  }
}

function readName(nameNode: GedNode | undefined): { given: string; family: string } {
  const parsed = parseSlashName(concatText(nameNode));
  const given = concatText(child(nameNode, "GIVN")) || parsed.given;
  const family = concatText(child(nameNode, "SURN")) || parsed.family;
  return { given, family };
}

function parseSlashName(value: string): { given: string; family: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*)\/([^/]*)\/(.*)$/);
  if (!match) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { given: trimmed, family: "" };
    return { given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1] };
  }
  const given = [match[1].trim(), match[3].trim()].filter(Boolean).join(" ");
  return { given, family: match[2].trim() };
}

function mapResidence(node: GedNode): Person["residences"] {
  const place = factPlace(node);
  const address = concatText(child(node, "ADDR")).trim().replace(/\s*\n\s*/g, ", ");
  const full = [address, place].filter(Boolean).join(", ");
  if (!full) return [];
  const { from, to } = parseResidenceDates(factDate(node));
  return [createResidence(full, from, to)];
}

function parseResidenceDates(value: string): { from: string; to: string } {
  const range = value.match(/^(\d{4})\s*[-–—]\s*(\d{4})$/);
  if (range) return { from: range[1], to: range[2] };
  return { from: value, to: "" };
}

function mapJob(node: GedNode): Person["jobs"] {
  const title = concatText(node).trim();
  if (!title) return [];
  const date = factDate(node);
  const place = factPlace(node);
  const detail = [date, place].filter(Boolean).join(" · ");
  return [createJob(title, detail)];
}

function mapMilitary(node: GedNode): Person["military"] {
  const note = children(node, "NOTE").map(concatText).join("\n").trim();
  const date = factDate(node);
  const war = warFromNote(note);
  if (!war && !date) return [];
  return [createMilitaryService(date, war)];
}

function warFromNote(note: string): string {
  if (!note) return "";
  const before = note.split(":")[0]?.trim() ?? "";
  if (before && before.length <= 80) return before;
  return note.split(/[.!]/)[0]?.trim().slice(0, 80) ?? note.slice(0, 80);
}

function mapEvent(node: GedNode): Person["notableEvents"] {
  const type = concatText(child(node, "TYPE")).trim();
  const page = concatText(child(children(node, "SOUR")[0], "PAGE")).trim();
  const title =
    type && page && page.toLowerCase().startsWith(type.toLowerCase())
      ? page
      : type || EVENT_TITLES[node.tag] || "Event";
  const date = factDate(node);
  const place = factPlace(node);
  const note = children(node, "NOTE").map(concatText).join("\n").trim();
  const detail = [place, note].filter(Boolean).join("\n");
  return [createNotableEvent(title, date, detail)];
}

function collapseResidences(items: Person["residences"]): Person["residences"] {
  const list: Person["residences"] = [];
  for (const item of items) {
    const match = list.find((residence) => residence.place.trim().toLowerCase() === item.place.trim().toLowerCase());
    if (!match) {
      list.push(item);
      continue;
    }
    if (!match.from) match.from = item.from;
    if (!match.to) match.to = item.to;
  }
  return list;
}

function factDate(node: GedNode | undefined): string {
  return concatText(child(node, "DATE")).trim();
}

function factPlace(node: GedNode | undefined): string {
  return concatText(child(node, "PLAC")).trim();
}

function child(node: GedNode | undefined, tag: string): GedNode | undefined {
  return node?.children.find((item) => item.tag === tag);
}

function children(node: GedNode, tag: string): GedNode[] {
  return node.children.filter((item) => item.tag === tag);
}

function pointer(value: string): string | null {
  const trimmed = value.trim();
  return /^@[^@]+@$/.test(trimmed) ? trimmed : null;
}

export function concatText(node: GedNode | undefined): string {
  if (!node) return "";
  let text = node.value;
  for (const item of node.children) {
    if (item.tag === "CONC") text += concatText(item);
    else if (item.tag === "CONT") text += `\n${concatText(item)}`;
  }
  return decodeEntities(text);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
