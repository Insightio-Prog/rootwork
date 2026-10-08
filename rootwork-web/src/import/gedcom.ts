import {
  createJob,
  createMilitaryService,
  createNotableEvent,
  createPerson,
  createResidence,
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
  const people: Record<string, Person> = {};
  for (const [xref, node] of individuals) {
    people[xref] = mapIndividual(xref, node);
  }
  applyFamilies(people, families);
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

function mapIndividual(xref: string, node: GedNode): Person {
  const name = readName(node);
  const sex = child(node, "SEX");
  const gender: Gender = concatText(sex).trim().toUpperCase().startsWith("M") ? "male" : "female";
  const birth = child(node, "BIRT");
  const death = child(node, "DEAT");
  const living = !death;
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
  ].flatMap(mapEvent);
  return person;
}

function applyFamilies(people: Record<string, Person>, families: Map<string, GedNode>) {
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

    if (husb && wife && people[husb] && people[wife]) {
      people[husb].spouseIds = uniqueIds([...people[husb].spouseIds, wife]);
      people[wife].spouseIds = uniqueIds([...people[wife].spouseIds, husb]);
      people[husb].marriages[wife] = { date, place };
      people[wife].marriages[husb] = { date, place };
    }

    for (const childId of kids) {
      const person = people[childId];
      person.parentIds = uniqueIds([...person.parentIds, ...parents]).slice(0, 2);
    }
  }
}

function readName(node: GedNode): { given: string; family: string } {
  const nameNode = child(node, "NAME");
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
  if (!place) return [];
  const { from, to } = parseResidenceDates(factDate(node));
  return [createResidence(place, from, to)];
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
