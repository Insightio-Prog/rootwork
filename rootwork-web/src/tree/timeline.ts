import { displayName, parseYear, resolvedMarriage, type Person } from "../data/people";

export const DEFAULT_FAMILY_LINES: string[] = [];

export type TimelineKind = "birth" | "marriage" | "death";

export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  personId: string;
  title: string;
  dateLabel: string;
  year: number;
  at: number;
};

const KIND_LABEL: Record<TimelineKind, string> = {
  birth: "Birth",
  marriage: "Marriage",
  death: "Death",
};

export function normalizeFamilyLine(value: string): string {
  return value.trim();
}

export function linesMatch(familyName: string, lines: string[]): boolean {
  const family = familyName.trim().toLowerCase();
  if (!family) return false;
  return lines.some((line) => line.trim().toLowerCase() === family);
}

export function familyNamesInTree(people: Record<string, Person>): string[] {
  const names = new Set<string>();
  for (const person of Object.values(people)) {
    const name = person.familyName.trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function parseTimelineDate(value: string): { year: number; at: number; label: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!validYmd(year, month, day)) return null;
    return { year, at: yearAt(year, month, day), label: formatUkDate(day, month, year) };
  }

  const uk = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (uk) {
    const day = Number(uk[1]);
    const month = Number(uk[2]);
    const year = Number(uk[3]);
    if (!validYmd(year, month, day)) return null;
    return { year, at: yearAt(year, month, day), label: formatUkDate(day, month, year) };
  }

  const year = parseYear(trimmed);
  if (year == null) return null;
  return { year, at: year + 0.5, label: String(year) };
}

export function collectTimelineEvents(
  people: Record<string, Person>,
  lines: string[],
): TimelineEvent[] {
  const active = lines.map(normalizeFamilyLine).filter(Boolean);
  if (active.length === 0) return [];

  const onLine = Object.values(people).filter((person) => linesMatch(person.familyName, active));
  const onLineIds = new Set(onLine.map((person) => person.id));
  const events: TimelineEvent[] = [];
  const marriages = new Set<string>();

  for (const person of onLine) {
    const birth = parseTimelineDate(person.birth);
    if (birth) {
      events.push({
        id: `birth:${person.id}`,
        kind: "birth",
        personId: person.id,
        title: `${KIND_LABEL.birth} · ${displayName(person)}`,
        dateLabel: birth.label,
        year: birth.year,
        at: birth.at,
      });
    }

    if (!person.living) {
      const death = parseTimelineDate(person.death);
      if (death) {
        events.push({
          id: `death:${person.id}`,
          kind: "death",
          personId: person.id,
          title: `${KIND_LABEL.death} · ${displayName(person)}`,
          dateLabel: death.label,
          year: death.year,
          at: death.at,
        });
      }
    }

    for (const spouseId of person.spouseIds) {
      const spouse = people[spouseId];
      if (!spouse) continue;
      const key = [person.id, spouse.id].sort().join(":");
      if (marriages.has(key)) continue;
      marriages.add(key);
      const marriage = resolvedMarriage(person, spouse);
      const date = parseTimelineDate(marriage.date);
      if (!date) continue;
      const names = onLineIds.has(spouse.id)
        ? `${displayName(person)} & ${displayName(spouse)}`
        : displayName(person);
      events.push({
        id: `marriage:${key}`,
        kind: "marriage",
        personId: person.id,
        title: `${KIND_LABEL.marriage} · ${names}`,
        dateLabel: date.label,
        year: date.year,
        at: date.at,
      });
    }
  }

  return events.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));
}

export type PlacedTimelineEvent = TimelineEvent & {
  x: number;
  side: 1 | -1;
  lane: number;
};

export function placeTimelineLabels(
  events: TimelineEvent[],
  xFor: (at: number) => number,
  labelWidth: number,
): PlacedTimelineEvent[] {
  const gap = 16;
  const above: number[] = [];
  const below: number[] = [];

  return events.map((event, index) => {
    const x = xFor(event.at);
    const preferAbove = index % 2 === 0;
    const first = preferAbove ? above : below;
    const second = preferAbove ? below : above;
    const firstSide: 1 | -1 = preferAbove ? 1 : -1;
    let lane = first.findIndex((last) => x - last >= labelWidth + gap);
    let side = firstSide;
    let lanes = first;
    if (lane < 0) {
      lane = second.findIndex((last) => x - last >= labelWidth + gap);
      if (lane >= 0) {
        side = firstSide === 1 ? -1 : 1;
        lanes = second;
      } else {
        lane = first.length;
        side = firstSide;
        lanes = first;
      }
    }
    lanes[lane] = x;
    return { ...event, x, side, lane };
  });
}

function validYmd(year: number, month: number, day: number) {
  if (!Number.isFinite(year) || year < 1000 || year > 3000) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return true;
}

function yearAt(year: number, month: number, day: number) {
  return year + (month - 1) / 12 + Math.min(day, 28) / 365;
}

function formatUkDate(day: number, month: number, year: number) {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
