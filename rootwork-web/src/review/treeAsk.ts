import { countryNameFor, flagCodeFor, flagCodeFromPlace } from "../data/countries";
import {
  childrenOf,
  displayName,
  militaryOf,
  notableEventsOf,
  orderedParents,
  parseYear,
  resolvedMarriage,
  siblingsOf,
  spousesOf,
  yearsLabel,
  type Person,
} from "../data/people";
import { surnameKey } from "../tree/surname";
import { computeHeritage } from "../tree/heritage";
import { CLAUDE_SOURCE_RULES } from "./dossier";

/** Full details are sent for the people a question is about, plus their close family, up to this many. */
const MAX_DETAILED = 48;
const MAX_NAMED = 8;
const EVENT_TEXT = 320;

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** People whose full name (spelling variants and alternate names included) appears in what was asked. */
function namedInQuestion(people: Person[], question: string): Person[] {
  const asked = surnameKey(question);
  if (!asked) return [];
  const hits: { person: Person; exact: boolean }[] = [];
  for (const person of people) {
    const names = [displayName(person), ...(person.altNames ?? [])];
    const exact = names.some((name) => question.toLowerCase().includes(name.toLowerCase()));
    const loose = names.some((name) => {
      const key = surnameKey(name);
      return key.length >= 6 && asked.includes(key);
    });
    if (exact || loose) hits.push({ person, exact });
  }
  return hits
    .sort((a, b) => Number(b.exact) - Number(a.exact))
    .slice(0, MAX_NAMED)
    .map((hit) => hit.person);
}

function personLabel(person: Person) {
  const name = displayName(person);
  const year = parseYear(person.birth);
  return year != null ? `${name} (${year})` : name;
}

function names(people: Person[]) {
  return people.length ? people.map(personLabel).join("; ") : "none recorded";
}

function compactPerson(people: Record<string, Person>, person: Person): string {
  const lines = [
    `## ${person.id} | ${personLabel(person)} | ${yearsLabel(person)}`,
    `Birth: ${person.birth || "unknown"} / ${person.birthPlace || "unknown"}`,
  ];
  if (person.living) {
    lines.push("Death: living");
  } else {
    lines.push(`Death: ${person.death || "unknown"} / ${person.deathPlace || "unknown"}`);
  }
  const ownCode = flagCodeFor(person.nationality);
  if (person.nationality) {
    lines.push(`Nationality: ${person.nationality}`);
  } else if (flagCodeFromPlace(person.birthPlace)) {
    lines.push(`Nationality: ${countryNameFor(flagCodeFromPlace(person.birthPlace))} (taken from birthplace)`);
  } else if (ownCode) {
    lines.push(`Nationality: ${countryNameFor(ownCode)}`);
  }
  lines.push(`Parents: ${names(orderedParents(people, person))}`);
  const spouses = spousesOf(people, person);
  if (spouses.length === 0) {
    lines.push("Spouses: none recorded");
  } else {
    for (const spouse of spouses) {
      const marriage = resolvedMarriage(person, spouse);
      lines.push(
        `Spouse: ${personLabel(spouse)} — married ${marriage.date || "unknown"} / ${marriage.place || "unknown"}`,
      );
    }
  }
  lines.push(`Children: ${names(childrenOf(people, person.id))}`);
  return lines.join("\n");
}

function extraPerson(people: Record<string, Person>, person: Person): string {
  const lines = [compactPerson(people, person)];
  if (person.altNames?.length) lines.push(`Also known as: ${person.altNames.join("; ")}`);
  const siblings = siblingsOf(people, person);
  if (siblings.length) lines.push(`Siblings: ${names(siblings)}`);
  if (person.notes?.trim()) lines.push(`Notes: ${clip(person.notes, 2200)}`);
  for (const job of person.jobs.slice(0, 8)) {
    lines.push(`Job: ${job.title}${job.detail ? ` — ${clip(job.detail, 160)}` : ""}`);
  }
  for (const residence of person.residences.slice(0, 12)) {
    const years =
      residence.from || residence.to ? `${residence.from || "?"} – ${residence.to || "?"}` : "years unknown";
    lines.push(`Residence: ${residence.place} (${years})`);
  }
  for (const service of militaryOf(person).slice(0, 4)) {
    lines.push(`Military: ${service.war || service.served || "service"} (${service.served || "dates unknown"})`);
    for (const medal of service.medals.slice(0, 4)) {
      lines.push(`Medal: ${medal.name}`);
    }
  }
  for (const event of notableEventsOf(person).slice(0, 14)) {
    lines.push(
      `Event: ${event.title} (${event.date || "undated"})${event.detail ? ` — ${clip(event.detail, EVENT_TEXT)}` : ""}`,
    );
  }
  if (person.sources?.length) {
    lines.push(`Sources on file: ${person.sources.slice(0, 8).map((source) => source.title).join("; ")}`);
  }
  return lines.join("\n");
}

export function buildTreeAskBrief(options: {
  treeTitle: string;
  people: Record<string, Person>;
  homePersonId: string | null;
  selectedPersonId: string | null;
  /** What the person has asked in this conversation, so the people they name can be described in full. */
  question?: string;
}): string {
  const { treeTitle, people, homePersonId, selectedPersonId, question = "" } = options;
  const everyone = Object.values(people).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const home = homePersonId ? people[homePersonId] : undefined;
  const selected = selectedPersonId ? people[selectedPersonId] : undefined;
  const named = namedInQuestion(everyone, question);

  // Everyone gets a line in the roster. Full details go to the people being asked about and their close family.
  const detailed = new Map<string, Person>();
  const addDetailed = (person: Person | undefined) => {
    if (person && detailed.size < MAX_DETAILED) detailed.set(person.id, person);
  };
  for (const person of named) addDetailed(person);
  addDetailed(selected);
  addDetailed(home);
  for (const person of [...named, ...(selected ? [selected] : [])]) {
    for (const relative of [
      ...orderedParents(people, person),
      ...spousesOf(people, person),
      ...childrenOf(people, person.id),
      ...siblingsOf(people, person),
    ]) {
      addDetailed(relative);
    }
  }
  const listed = [...detailed.values()];

  const roster = everyone.map((person) => `- ${person.id}  ${personLabel(person)}  ${yearsLabel(person)}`).join("\n");
  const profiles = listed.map((person) => compactPerson(people, person)).join("\n\n");

  const focus: string[] = [];
  if (home) focus.push(`Home person: ${personLabel(home)} id=${home.id}`);
  if (selected && selected.id !== home?.id) {
    focus.push(`Currently selected: ${personLabel(selected)} id=${selected.id}`);
  } else if (selected) {
    focus.push("Currently selected: the home person");
  } else {
    focus.push("Currently selected: none");
  }
  if (home) {
    const heritage = computeHeritage(people, home.id)
      .map((item) => `${Math.round(item.share * 100)}% ${item.label}`)
      .join(", ");
    if (heritage) {
      focus.push(
        `Home person's heritage (share of ancestry by nation, from nationality or birthplace; Unknown = branches with no recorded parents or nationality): ${heritage}`,
      );
    }
  }

  const spotlightPeople = named.length > 0 ? named : selected && selected.id !== home?.id ? [selected] : home ? [home] : [];
  const spotlight = spotlightPeople.length
    ? `\n\nFULL RECORDS (${named.length > 0 ? "people the question is about" : selected && selected.id !== home?.id ? "selected person" : "home person"})\n${spotlightPeople.map((person) => extraPerson(people, person)).join("\n\n")}`
    : "";

  return `You are a genealogy assistant for this Rootwork family tree. Answer only from the tree data below. If a fact is not recorded, say so. Do not invent people, dates, places, or relationships. When people share a name, include a birth year.

Every person in the tree appears in PEOPLE. DETAILS and FULL RECORDS cover the people being asked about and their close family. If someone is in PEOPLE but has no DETAILS, you know only their name and years - say that plainly, and suggest the user names them in a question for the full record. Never say a person is missing from the tree if they are in PEOPLE.

${CLAUDE_SOURCE_RULES}

Tree: ${treeTitle || "Untitled"}
${focus.join("\n")}
This tree has ${everyone.length} ${everyone.length === 1 ? "person" : "people"}.

PEOPLE (${everyone.length})
${roster}

DETAILS (${listed.length})
${profiles}${spotlight}`;
}
