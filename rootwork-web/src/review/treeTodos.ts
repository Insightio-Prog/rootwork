import {
  childrenOf,
  displayName,
  militaryOf,
  notableEventsOf,
  orderedParents,
  resolvedMarriage,
  spousesOf,
  yearsLabel,
  type Person,
} from "../data/people";
import { CLAUDE_SOURCE_RULES } from "./dossier";

function personBrief(people: Record<string, Person>, person: Person): string {
  const lines = [
    `## ${person.id} | ${displayName(person)} | ${yearsLabel(person)}`,
    `Living: ${person.living ? "yes" : "no"}`,
    `Birth: ${person.birth || "unknown"} / ${person.birthPlace || "unknown"}`,
  ];
  if (person.living) {
    lines.push("Death: living");
  } else {
    lines.push(`Death: ${person.death || "unknown"} / ${person.deathPlace || "unknown"}`);
  }
  const parents = orderedParents(people, person);
  lines.push(
    `Parents: ${parents.length ? parents.map((parent) => displayName(parent)).join("; ") : "none recorded"}`,
  );
  const spouses = spousesOf(people, person);
  if (spouses.length === 0) {
    lines.push("Spouses: none recorded");
  } else {
    for (const spouse of spouses) {
      const marriage = resolvedMarriage(person, spouse);
      lines.push(
        `Spouse: ${displayName(spouse)} — married ${marriage.date || "unknown"} / ${marriage.place || "unknown"}`,
      );
    }
  }
  const children = childrenOf(people, person.id);
  lines.push(
    `Children: ${
      children.length
        ? children.map((child) => `${displayName(child)} (${yearsLabel(child)})`).join("; ")
        : "none recorded"
    }`,
  );
  const residences = person.residences.slice(0, 6);
  if (residences.length === 0) {
    lines.push("Residences: none recorded");
  } else {
    for (const residence of residences) {
      const years =
        residence.from || residence.to
          ? `${residence.from || "?"} – ${residence.to || "?"}`
          : "years unknown";
      lines.push(`Residence: ${residence.place} (${years})`);
    }
  }
  for (const service of militaryOf(person).slice(0, 4)) {
    const label = service.war || service.served || "service";
    lines.push(`Military: ${label} (${service.served || "dates unknown"})`);
    for (const medal of service.medals.slice(0, 4)) {
      lines.push(`Medal: ${medal.name} (${label})`);
    }
  }
  const events = notableEventsOf(person).slice(0, 6);
  for (const event of events) {
    lines.push(`Event: ${event.title} (${event.date || "undated"})`);
  }
  return lines.join("\n");
}

export function buildTreeTodoBrief(people: Record<string, Person>): string {
  const everyone = Object.values(people).sort((a, b) =>
    displayName(a).localeCompare(displayName(b)),
  );
  const listed = everyone.slice(0, 80);
  const roster = listed
    .map((person) => `- ${person.id}  ${displayName(person)}  ${yearsLabel(person)}`)
    .join("\n");
  const profiles = listed.map((person) => personBrief(people, person)).join("\n\n");
  const extra =
    everyone.length > listed.length
      ? `\n\n(${everyone.length - listed.length} further people were omitted from this brief.)`
      : "";

  return `You are a genealogy research assistant. This tree has ${everyone.length} people. List missing facts to fill in next — dates, places, parents, spouses, and children. Do not return an empty list.

${CLAUDE_SOURCE_RULES}

Rules:
- Cover deceased people first, then living people.
- Prefer blank birth, death, marriage, parent, or place fields.
- Do not suggest certificates, scans, indexes, or source hunting.
- personId MUST be copied exactly from the roster (the uuid). Never invent an id.
- Return 8 to 40 concrete items.
- Call submit_todos.

Each item needs:
- id: {personId}:{kind}
- personId: uuid from the roster
- title: short, e.g. "Birth date"
- detail: one or two sentences
- priority: high, medium, or low

PEOPLE (${listed.length})
${roster}

DETAILS
${profiles}${extra}`;
}
