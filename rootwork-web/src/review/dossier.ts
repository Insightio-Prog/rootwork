import {
  childrenOf,
  closeRelativeLabel,
  displayName,
  militaryOf,
  notableEventsOf,
  relativeDeathsInLifetime,
  resolvedMarriage,
  spousesOf,
  yearsLabel,
  type MediaRef,
  type Person,
} from "../data/people";

export type DossierFile = {
  id: string;
  ext: string;
  mime: string;
  name: string;
  label: string;
};

export type ReviewFactDef = {
  id: string;
  label: string;
};

export const CLAUDE_SOURCE_RULES = `This tree is used as a visual family record, not a source-citation workspace.
- Look for missing dates, places, parents, spouses, and children.
- Do not ask for certificates, scans, indexes, or source links.
- Do not treat photos as proof of a fact.`;

export type PersonDossier = {
  text: string;
  files: DossierFile[];
  facts: ReviewFactDef[];
};

function fileFrom(media: MediaRef, label: string): DossierFile {
  return {
    id: media.id,
    ext: media.ext.replace(/^\./, ""),
    mime: media.mime,
    name: media.originalName,
    label,
  };
}

function residenceYears(from: string, to: string): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `from ${from}`;
  if (to) return `until ${to}`;
  return "years unknown";
}

export function buildPersonDossier(
  people: Record<string, Person>,
  person: Person,
): PersonDossier {
  const facts: ReviewFactDef[] = [];
  const files: DossierFile[] = [];
  const seen = new Set<string>();
  const sections: string[] = [
    `Subject: ${displayName(person)} (${yearsLabel(person)})`,
    `Living: ${person.living ? "yes" : "no"}`,
  ];

  facts.push({ id: "birth", label: "Birth & location" });
  sections.push(
    `\n[birth] Birth & location\nDate: ${person.birth || "unknown"}\nPlace: ${person.birthPlace || "unknown"}`,
  );

  for (const spouse of spousesOf(people, person)) {
    const marriage = resolvedMarriage(person, spouse);
    const id = `marriage:${spouse.id}`;
    facts.push({ id, label: `Marriage to ${displayName(spouse)}` });
    sections.push(
      `\n[${id}] Marriage to ${displayName(spouse)}\nDate: ${marriage.date || "unknown"}\nPlace: ${marriage.place || "unknown"}`,
    );
  }

  for (const child of childrenOf(people, person.id)) {
    const id = `child:${child.id}`;
    facts.push({ id, label: `Birth of ${displayName(child)}` });
    sections.push(
      `\n[${id}] Birth of ${displayName(child)} (${closeRelativeLabel(people, person, child)})\nDate: ${child.birth || "unknown"}\nPlace: ${child.birthPlace || "unknown"}`,
    );
  }

  for (const residence of person.residences) {
    const id = `residence:${residence.id}`;
    facts.push({ id, label: `Address: ${residence.place}` });
    sections.push(
      `\n[${id}] Address\nPlace: ${residence.place}\nYears: ${residenceYears(residence.from, residence.to)}`,
    );
  }

  for (const service of militaryOf(person)) {
    const servedId = `military-served:${service.id}`;
    const warId = `military-war:${service.id}`;
    const label = service.war || service.served || "Military service";
    facts.push({ id: servedId, label: `Military service dates · ${label}` });
    sections.push(
      `\n[${servedId}] Military service dates\nWar: ${service.war || "unknown"}\nDates: ${service.served || "unknown"}`,
    );
    facts.push({ id: warId, label: `War · ${label}` });
    sections.push(
      `\n[${warId}] War\nWar: ${service.war || "unknown"}\nDates: ${service.served || "unknown"}`,
    );
    for (const medal of service.medals) {
      const medalId = `medal:${service.id}:${medal.id}`;
      facts.push({ id: medalId, label: `Medal: ${medal.name}` });
      sections.push(`\n[${medalId}] Medal: ${medal.name}\nWar: ${service.war || "unknown"}`);
    }
  }

  for (const event of notableEventsOf(person)) {
    const id = `notable:${event.id}`;
    facts.push({ id, label: event.title });
    sections.push(
      `\n[${id}] Notable event: ${event.title}\nDate: ${event.date || "unknown"}\nNote: ${event.detail || "none"}`,
    );
  }

  for (const relative of relativeDeathsInLifetime(people, person)) {
    const id = `relative-death:${relative.id}`;
    facts.push({ id, label: `Death of ${displayName(relative)}` });
    sections.push(
      `\n[${id}] Death of ${displayName(relative)} (${closeRelativeLabel(people, person, relative)})\nDate: ${relative.death || "unknown"}\nPlace: ${relative.deathPlace || "unknown"}`,
    );
  }

  if (!person.living) {
    facts.push({ id: "death", label: "Death & location" });
    sections.push(
      `\n[death] Death & location\nDate: ${person.death || "unknown"}\nPlace: ${person.deathPlace || "unknown"}`,
    );
  }

  for (const media of [person.photo, ...(person.media ?? [])]) {
    if (!media || seen.has(media.id)) continue;
    seen.add(media.id);
    files.push(fileFrom(media, media.originalName || "Photo"));
  }

  const factList = facts.map((fact) => `- ${fact.id}: ${fact.label}`).join("\n");
  const text = `Review these genealogical claims. Call submit_review with a verdict for every fact id listed.

${CLAUDE_SOURCE_RULES}

Verdicts:
- supported: the date and place are filled in
- weak: some detail is recorded, but incomplete
- missing: the fact is blank
- conflict: recorded details contradict each other

Do not invent sources or ask for certificates.

Fact ids that must appear in facts[]:
${factList}

${sections.join("\n")}`;

  return { text, files: files.slice(0, 12), facts };
}

export function labelForFact(id: string, facts: ReviewFactDef[]): string {
  return facts.find((fact) => fact.id === id)?.label ?? id;
}
