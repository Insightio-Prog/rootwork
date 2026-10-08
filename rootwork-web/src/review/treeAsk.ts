import {
  childrenOf,
  displayName,
  militaryOf,
  notableEventsOf,
  orderedParents,
  parseYear,
  resolvedMarriage,
  spousesOf,
  yearsLabel,
  type Person,
} from "../data/people";
import { CLAUDE_SOURCE_RULES } from "./dossier";

const MAX_PEOPLE = 80;

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
  for (const job of person.jobs.slice(0, 6)) {
    lines.push(`Job: ${job.title}${job.detail ? ` — ${job.detail}` : ""}`);
  }
  for (const residence of person.residences.slice(0, 6)) {
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
  for (const event of notableEventsOf(person).slice(0, 6)) {
    lines.push(`Event: ${event.title} (${event.date || "undated"})${event.detail ? ` — ${event.detail}` : ""}`);
  }
  return lines.join("\n");
}

export function buildTreeAskBrief(options: {
  treeTitle: string;
  people: Record<string, Person>;
  homePersonId: string | null;
  selectedPersonId: string | null;
}): string {
  const { treeTitle, people, homePersonId, selectedPersonId } = options;
  const everyone = Object.values(people).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const priority = [selectedPersonId, homePersonId]
    .filter((id): id is string => Boolean(id && people[id]))
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .map((id) => people[id]);
  const rest = everyone.filter((person) => !priority.some((item) => item.id === person.id));
  const listed = [...priority, ...rest].slice(0, MAX_PEOPLE);
  const home = homePersonId ? people[homePersonId] : undefined;
  const selected = selectedPersonId ? people[selectedPersonId] : undefined;
  const roster = listed.map((person) => `- ${person.id}  ${personLabel(person)}  ${yearsLabel(person)}`).join("\n");
  const profiles = listed.map((person) => compactPerson(people, person)).join("\n\n");
  const extraCount = everyone.length - listed.length;
  const omitted = extraCount > 0 ? `\n\n(${extraCount} further people were omitted from this brief.)` : "";

  const focus: string[] = [];
  if (home) focus.push(`Home person: ${personLabel(home)} id=${home.id}`);
  if (selected && selected.id !== home?.id) {
    focus.push(`Currently selected: ${personLabel(selected)} id=${selected.id}`);
  } else if (selected) {
    focus.push("Currently selected: the home person");
  } else {
    focus.push("Currently selected: none");
  }

  const spotlight =
    selected && selected.id !== home?.id
      ? `\n\nSELECTED PERSON\n${extraPerson(people, selected)}`
      : home
        ? `\n\nHOME PERSON\n${extraPerson(people, home)}`
        : "";

  return `You are a genealogy assistant for this Rootwork family tree. Answer only from the tree data below. If a fact is not recorded, say so. Do not invent people, dates, places, or relationships. When people share a name, include a birth year.

${CLAUDE_SOURCE_RULES}

Tree: ${treeTitle || "Untitled"}
${focus.join("\n")}
This tree has ${everyone.length} ${everyone.length === 1 ? "person" : "people"}.

PEOPLE (${listed.length})
${roster}

DETAILS
${profiles}${spotlight}${omitted}`;
}
