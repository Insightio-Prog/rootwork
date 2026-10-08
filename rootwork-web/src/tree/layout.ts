import { FAMILY_LAYOUT, layoutFamilies, type FamilyLayoutConstants } from "../chart/familyLayout";
import { surnameKey } from "./surname";
import { childrenOf, orderedParents, spousesOf, type Person } from "../data/people";
import { connectorLayout, connectorPoints, coupleBrackets } from "./connectors";

export {
  CONNECTOR_LANE,
  chartFamilies,
  connectorEndpointMismatches,
  connectorLayout,
  connectorPoints,
  familyTrunks,
  focusHighlightIds,
  focusHighlightPaths,
  coupleBrackets,
  hotConnectorKeys,
  validateConnectors,
  type ConnectorLayout,
  type ConnectorPath,
} from "./connectors";

export type CardOffset = {
  dx: number;
  dy: number;
};

export type LayoutSnapshot = {
  offsets: Record<string, CardOffset>;
  collapsed: string[];
  collapsedPositions: Record<string, CardPosition>;
};

export function normalizeFamilyName(value: string): string {
  return surnameKey(value);
}

export const MAX_FAMILY_LINES = 4;

export function uniqueFamilyLineNames(names: Iterable<string>, max = MAX_FAMILY_LINES): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    const key = normalizeFamilyName(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

export type FamilyLineSurname = { name: string; count: number; variants: string[]; similar: string[] };

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.slice(i) === long.slice(i + 1);
}

export function familyLineSurnames(people: Record<string, Person>): FamilyLineSurname[] {
  const counts = new Map<string, { name: string; count: number; spellings: Map<string, number> }>();
  for (const person of Object.values(people)) {
    const name = person.familyName.trim();
    if (!name) continue;
    const key = normalizeFamilyName(name);
    if (!key) continue;
    const existing = counts.get(key) ?? { name, count: 0, spellings: new Map<string, number>() };
    existing.count += 1;
    existing.spellings.set(name, (existing.spellings.get(name) ?? 0) + 1);
    counts.set(key, existing);
  }
  // Variant spellings are one line, shown under the spelling used most often.
  const entries = [...counts.entries()].map(([key, { count, spellings }]) => {
    const ranked = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
    return { key, name: ranked[0], count, variants: ranked.slice(1) };
  });
  return entries
    .map(({ key, name, count, variants }) => ({
      name,
      count,
      variants,
      // Different keys one letter apart (Keel / Keil) are probably the same family spelled differently.
      similar: entries
        .filter((other) => other.key !== key && key.length >= 3 && withinOneEdit(key, other.key))
        .map((other) => other.name),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function peopleForFamilyLine(
  people: Record<string, Person>,
  surnames: string | string[],
  homeId: string,
): Record<string, Person> {
  const keys = new Set(uniqueFamilyLineNames(Array.isArray(surnames) ? surnames : [surnames]).map(normalizeFamilyName));
  if (keys.size === 0) return people;
  const ids = new Set<string>();
  if (homeId && people[homeId]) ids.add(homeId);
  const addWithSpouses = (person: Person) => {
    ids.add(person.id);
    for (const spouseId of person.spouseIds) {
      if (people[spouseId]) ids.add(spouseId);
    }
  };
  const onLine = new Set<string>();
  for (const person of Object.values(people)) {
    if (!keys.has(normalizeFamilyName(person.familyName))) continue;
    onLine.add(person.id);
    addWithSpouses(person);
  }
  // A surname follows the father, so keep climbing the paternal line even where the spelling changes
  // (McGuinness back to McGinnis) - otherwise the line stops one generation short.
  const queue = [...onLine];
  while (queue.length > 0) {
    const person = people[queue.pop() as string];
    if (!person || person.gender !== "male") continue;
    const father = person.parentIds.map((id) => people[id]).find((parent) => parent?.gender === "male");
    if (!father || onLine.has(father.id)) continue;
    onLine.add(father.id);
    addWithSpouses(father);
    queue.push(father.id);
  }
  const next: Record<string, Person> = {};
  for (const id of ids) {
    const person = people[id];
    if (person) next[id] = person;
  }
  return next;
}

export type LaidOutCard = {
  id: string;
  generation: number;
  x: number;
  y: number;
  w: number;
  h: number;
  parentIds: string[];
  spouseIds: string[];
};

const CARD = { w: FAMILY_LAYOUT.CARD_W, h: FAMILY_LAYOUT.CARD_H };
const PAD = 28;

function withSpouses(
  people: Record<string, Person>,
  ids: string[],
  seen: Set<string>,
): string[] {
  const next: string[] = [];
  for (const id of ids) {
    if (!next.includes(id)) next.push(id);
    const person = people[id];
    if (!person) continue;
    for (const spouse of spousesOf(people, person)) {
      if (seen.has(spouse.id)) continue;
      seen.add(spouse.id);
      next.push(spouse.id);
    }
  }
  return next;
}

function familyMemberIds(people: Record<string, Person>, personId: string): string[] {
  const person = people[personId];
  if (!person) return [personId];
  const ids = [personId];
  for (const spouseId of person.spouseIds) {
    if (people[spouseId] && !ids.includes(spouseId)) ids.push(spouseId);
  }
  return ids;
}

export function familyIsCollapsed(
  collapsed: Iterable<string>,
  people: Record<string, Person>,
  personId: string,
): boolean {
  const set = collapsed instanceof Set ? collapsed : new Set(collapsed);
  return familyMemberIds(people, personId).some((id) => set.has(id));
}

export function toggleFamilyCollapsed(
  collapsed: string[],
  people: Record<string, Person>,
  personId: string,
): string[] {
  const family = new Set(familyMemberIds(people, personId));
  if (collapsed.some((id) => family.has(id))) {
    return collapsed.filter((id) => !family.has(id));
  }
  return [...collapsed, personId];
}

function collectAncestorColumns(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
): { columns: string[][]; seen: Set<string> } {
  const columns: string[][] = [];
  const seen = new Set<string>();

  function visit(id: string, generation: number) {
    const person = people[id];
    if (!person || generation >= maxGenerations || seen.has(id)) return;
    seen.add(id);
    if (!columns[generation]) columns[generation] = [];
    columns[generation].push(id);
    if (generation >= maxGenerations - 1) return;
    for (const parent of orderedParents(people, person).slice(0, 2)) {
      visit(parent.id, generation + 1);
    }
  }

  visit(homeId, 0);
  for (let generation = 0; generation < columns.length; generation++) {
    columns[generation] = withSpouses(people, columns[generation] ?? [], seen);
  }
  return { columns, seen };
}

export function ancestorSpineIds(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
): Set<string> {
  const home = people[homeId];
  if (!home || maxGenerations < 1) return new Set();
  return collectAncestorColumns(people, homeId, maxGenerations).seen;
}

export function mainLineIds(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
): Set<string> {
  const ids = new Set<string>();
  const home = people[homeId];
  if (!home || maxGenerations < 1) return ids;

  function visit(id: string, generation: number) {
    const person = people[id];
    if (!person || generation >= maxGenerations || ids.has(id)) return;
    ids.add(id);
    if (generation >= maxGenerations - 1) return;
    for (const parent of orderedParents(people, person).slice(0, 2)) {
      visit(parent.id, generation + 1);
    }
  }

  visit(homeId, 0);
  return ids;
}

export function extraChildrenOfFamily(
  people: Record<string, Person>,
  personId: string,
  spine: Set<string>,
): string[] {
  const ids: string[] = [];
  const found = new Set<string>();
  for (const memberId of familyMemberIds(people, personId)) {
    for (const child of childrenOf(people, memberId)) {
      if (spine.has(child.id) || found.has(child.id)) continue;
      found.add(child.id);
      ids.push(child.id);
    }
  }
  return ids;
}

export function layoutAncestorCards(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
  offsets: Record<string, CardOffset>,
  collapsedIds: Iterable<string> = [],
  constants: FamilyLayoutConstants = FAMILY_LAYOUT,
): { cards: LaidOutCard[]; originX: number; originY: number; width: number; height: number } {
  const home = people[homeId];
  if (!home || maxGenerations < 1) {
    return { cards: [], originX: 0, originY: 0, width: PAD * 2, height: PAD * 2 };
  }

  const hiddenChildren = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds);
  const { positions } = layoutFamilies(people, homeId, maxGenerations, hiddenChildren, constants);
  const ids = Object.keys(positions);
  if (ids.length === 0) {
    return { cards: [], originX: 0, originY: 0, width: PAD * 2, height: PAD * 2 };
  }

  let rawMinX = Infinity;
  let rawMinY = Infinity;
  for (const id of ids) {
    rawMinX = Math.min(rawMinX, positions[id].x);
    rawMinY = Math.min(rawMinY, positions[id].y);
  }
  const shiftX = PAD - rawMinX;
  const shiftY = PAD - rawMinY;
  const columnSpan = constants.CARD_W + constants.COLUMN_GAP;
  const onChart = new Set(ids);
  const cards: LaidOutCard[] = [];

  for (const id of ids) {
    const person = people[id];
    const pos = positions[id];
    const offset = offsets[id] ?? { dx: 0, dy: 0 };
    cards.push({
      id,
      generation: Math.round(pos.x / columnSpan),
      x: pos.x + shiftX + offset.dx,
      y: pos.y + shiftY + offset.dy,
      w: constants.CARD_W,
      h: constants.CARD_H,
      parentIds: person
        ? orderedParents(people, person)
            .slice(0, 2)
            .map((parent) => parent.id)
            .filter((parentId) => onChart.has(parentId))
        : [],
      spouseIds: person
        ? spousesOf(people, person)
            .map((spouse) => spouse.id)
            .filter((spouseId) => onChart.has(spouseId))
        : [],
    });
  }

  let minX = Math.min(PAD, ...cards.map((card) => card.x));
  let minY = Math.min(PAD, ...cards.map((card) => card.y));
  let maxX = cards.reduce((max, card) => Math.max(max, card.x + card.w), PAD + constants.CARD_W);
  let maxY = cards.reduce((max, card) => Math.max(max, card.y + card.h), PAD + constants.CARD_H);
  for (const point of connectorPoints(connectorLayout(cards).paths)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const originX = Math.min(0, minX);
  const originY = Math.min(0, minY);
  return {
    cards,
    originX,
    originY,
    width: Math.max(maxX + PAD, PAD * 2 + constants.CARD_W) - originX,
    height: Math.max(maxY + PAD, PAD * 2 + constants.CARD_H) - originY,
  };
}

const FOCUS_GAP_X = 36;
const FOCUS_GAP_Y = 10;

export function pathHomeToPerson(
  people: Record<string, Person>,
  homeId: string,
  targetId: string,
): string[] | null {
  if (homeId === targetId) return [homeId];
  const queue: string[][] = [[homeId]];
  const seen = new Set<string>([homeId]);
  while (queue.length) {
    const path = queue.shift();
    if (!path) break;
    const id = path[path.length - 1];
    const person = people[id];
    if (!person) continue;
    for (const parent of orderedParents(people, person).slice(0, 2)) {
      if (seen.has(parent.id)) continue;
      const next = [...path, parent.id];
      if (parent.id === targetId) return next;
      seen.add(parent.id);
      queue.push(next);
    }
  }
  return null;
}

export function layoutFocusCards(
  people: Record<string, Person>,
  homeId: string,
  expandedIds: Iterable<string>,
): { cards: LaidOutCard[]; originX: number; originY: number; width: number; height: number } {
  const home = people[homeId];
  const expanded = new Set(expandedIds);
  if (!home) {
    return { cards: [], originX: 0, originY: 0, width: PAD * 2, height: PAD * 2 };
  }

  const columns: string[][] = [];
  const seen = new Set<string>();

  function visit(id: string, generation: number) {
    const person = people[id];
    if (!person || seen.has(id)) return;
    seen.add(id);
    if (!columns[generation]) columns[generation] = [];
    columns[generation].push(id);
    if (!expanded.has(id)) return;
    for (const parent of orderedParents(people, person).slice(0, 2)) {
      visit(parent.id, generation + 1);
    }
  }

  visit(homeId, 0);

  const displayColumns = columns.filter((ids) => ids?.length);
  const columnHeights = displayColumns.map(
    (ids) => ids.length * CARD.h + Math.max(0, ids.length - 1) * FOCUS_GAP_Y,
  );
  const contentHeight = Math.max(PAD * 2, ...columnHeights, CARD.h);
  const cards: LaidOutCard[] = [];

  displayColumns.forEach((ids, columnIndex) => {
    const colHeight = columnHeights[columnIndex] ?? CARD.h;
    let y = PAD + (contentHeight - colHeight) / 2;
    const x = PAD + columnIndex * (CARD.w + FOCUS_GAP_X);
    for (const id of ids) {
      const person = people[id];
      const parentIds = person
        ? orderedParents(people, person)
            .slice(0, 2)
            .map((parent) => parent.id)
            .filter((parentId) => seen.has(parentId))
        : [];
      cards.push({
        id,
        generation: columnIndex,
        x,
        y,
        w: CARD.w,
        h: CARD.h,
        parentIds,
        spouseIds: [],
      });
      y += CARD.h + FOCUS_GAP_Y;
    }
  });

  const xs = cards.map((card) => card.x);
  const ys = cards.map((card) => card.y);
  const originX = Math.min(0, ...xs, PAD);
  const originY = Math.min(0, ...ys, PAD);
  const right = cards.reduce((max, card) => Math.max(max, card.x + card.w), PAD + CARD.w);
  const bottom = cards.reduce((max, card) => Math.max(max, card.y + card.h), contentHeight);
  return {
    cards,
    originX,
    originY,
    width: Math.max(right + PAD, PAD * 2 + CARD.w) - originX,
    height: Math.max(bottom + PAD, contentHeight + PAD * 2) - originY,
  };
}

export type CardPosition = {
  x: number;
  y: number;
};

export function stabilizeCardOffsets(
  autoCards: LaidOutCard[],
  previous: Record<string, CardPosition>,
  existing: Record<string, CardOffset>,
): Record<string, CardOffset> {
  const autoById = new Map(autoCards.map((card) => [card.id, card]));
  const next: Record<string, CardOffset> = {};
  for (const [id, offset] of Object.entries(existing)) {
    const card = autoById.get(id);
    if (!card) {
      next[id] = offset;
      continue;
    }
    const old = previous[id];
    if (!old) {
      next[id] = offset;
      continue;
    }
    const dx = Math.round(old.x - card.x);
    const dy = Math.round(old.y - card.y);
    if (dx !== 0 || dy !== 0) next[id] = { dx, dy };
  }
  return next;
}

export function positionsFromLayout(cards: LaidOutCard[]): Record<string, CardPosition> {
  return Object.fromEntries(cards.map((card) => [card.id, { x: card.x, y: card.y }]));
}

export function sameOffsets(
  a: Record<string, CardOffset>,
  b: Record<string, CardOffset>,
): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const left = a[id] ?? { dx: 0, dy: 0 };
    const right = b[id] ?? { dx: 0, dy: 0 };
    if (left.dx !== right.dx || left.dy !== right.dy) return false;
  }
  return true;
}

export function offsetsToMatchPositions(
  autoCards: LaidOutCard[],
  current: Record<string, CardOffset>,
  positions: Record<string, CardPosition>,
  ids: Iterable<string>,
): Record<string, CardOffset> {
  const restore = new Set(ids);
  const next = { ...current };
  for (const card of autoCards) {
    if (!restore.has(card.id)) continue;
    const saved = positions[card.id];
    if (!saved) continue;
    const dx = Math.round(saved.x - card.x);
    const dy = Math.round(saved.y - card.y);
    if (dx === 0 && dy === 0) delete next[card.id];
    else next[card.id] = { dx, dy };
  }
  return next;
}

export function spouseBars(cards: LaidOutCard[]): { key: string; d: string }[] {
  return coupleBrackets(cards).map((bracket) => ({ key: `spouse-${bracket.key}`, d: bracket.d }));
}
