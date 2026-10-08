import {
  childrenOf,
  orderedParents,
  parseYear,
  spousesOf,
  type Person,
} from "../data/people";
import { CONNECTOR_LANE, chartFamilies } from "../tree/connectors";

/** Person-card size from `src/tree/layout.ts` / `.person-card`. */
const CARD_W = 250;
const CARD_H = 70;

export const FAMILY_LAYOUT = {
  CARD_GAP: 10,
  SPOUSE_GAP: 8,
  FAMILY_GAP: 56,
  COLUMN_GAP: 160,
  CARD_W,
  CARD_H,
} as const;

export const SPACING_SLIDERS = {
  CARD_GAP: { min: 4, max: 24 },
  FAMILY_GAP: { min: 24, max: 120 },
  COLUMN_GAP: { min: 80, max: 280 },
} as const;

/** Unhighlighted opacity while a person is focused. Cards default 70%; lines sit 15 points lower. */
export const HIGHLIGHT_SLIDER = {
  min: 50,
  max: 90,
  fallback: 70,
  lineOffset: 15,
} as const;

export type FamilyLayoutConstants = {
  CARD_GAP: number;
  SPOUSE_GAP: number;
  FAMILY_GAP: number;
  COLUMN_GAP: number;
  CARD_W: number;
  CARD_H: number;
};

export type SpacingSliderKey = keyof typeof SPACING_SLIDERS;

export function clampLayoutGap(value: unknown, key: SpacingSliderKey): number {
  const fallback = FAMILY_LAYOUT[key];
  const range = SPACING_SLIDERS[key];
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(next)));
}

export function clampHighlightDim(value: unknown): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return HIGHLIGHT_SLIDER.fallback;
  return Math.min(HIGHLIGHT_SLIDER.max, Math.max(HIGHLIGHT_SLIDER.min, Math.round(next)));
}

export function highlightLineDim(cardDim: number): number {
  return Math.min(
    HIGHLIGHT_SLIDER.max - 10,
    Math.max(HIGHLIGHT_SLIDER.min - 15, cardDim - HIGHLIGHT_SLIDER.lineOffset),
  );
}

export function familyLayoutConstants(
  overrides: Partial<Pick<FamilyLayoutConstants, "CARD_GAP" | "FAMILY_GAP" | "COLUMN_GAP">> = {},
): FamilyLayoutConstants {
  return {
    CARD_W: FAMILY_LAYOUT.CARD_W,
    CARD_H: FAMILY_LAYOUT.CARD_H,
    SPOUSE_GAP: FAMILY_LAYOUT.SPOUSE_GAP,
    CARD_GAP: overrides.CARD_GAP ?? FAMILY_LAYOUT.CARD_GAP,
    FAMILY_GAP: overrides.FAMILY_GAP ?? FAMILY_LAYOUT.FAMILY_GAP,
    COLUMN_GAP: overrides.COLUMN_GAP ?? FAMILY_LAYOUT.COLUMN_GAP,
  };
}

export type FamilyCardPosition = {
  x: number;
  y: number;
};

export type FamilyLayoutBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type FamilyLayoutResult = {
  positions: Record<string, FamilyCardPosition>;
  bounds: FamilyLayoutBounds;
};

export type ParentAnchorViolation = {
  parentIds: string[];
  names: string;
  childIds: string[];
  childNames: string;
  distance: number;
  limit: number;
};

export type BandInterleaveViolation = {
  columnX: number;
  aboveId: string;
  betweenId: string;
  belowId: string;
  names: string;
};

export type LineageBands = {
  bandPath: Map<string, number[]>;
  homeLineSpouse: Map<string, string>;
  homeLineChild: Map<string, string>;
};

function personLabel(people: Record<string, Person>, id: string): string {
  const person = people[id];
  return person ? `${person.givenName} ${person.familyName}`.trim() : id;
}

function recordedVisibleParents(
  people: Record<string, Person>,
  child: Person,
  visible: Set<string>,
): Person[] {
  const out: Person[] = [];
  for (const id of child.parentIds) {
    if (!visible.has(id)) continue;
    const parent = people[id];
    if (parent && !out.some((item) => item.id === parent.id)) out.push(parent);
    if (out.length === 2) break;
  }
  return out;
}

/** Male above female when both are known; otherwise first recorded parent is upper. */
export function splitParentRoles(
  people: Record<string, Person>,
  child: Person,
  visible: Set<string>,
): { upper?: Person; lower?: Person } {
  const recorded = recordedVisibleParents(people, child, visible);
  if (recorded.length === 0) return {};
  if (recorded.length === 1) return { upper: recorded[0] };
  const a = recorded[0];
  const b = recorded[1];
  if (a.gender === "male" && b.gender === "female") return { upper: a, lower: b };
  if (a.gender === "female" && b.gender === "male") return { upper: b, lower: a };
  return { upper: a, lower: b };
}

function natalSiblingIds(
  people: Record<string, Person>,
  id: string,
  visible: Set<string>,
): string[] {
  const person = people[id];
  if (!person || person.parentIds.length === 0) return [];
  const key = [...person.parentIds].sort().join("+");
  return Object.values(people)
    .filter(
      (other) =>
        other.id !== id &&
        visible.has(other.id) &&
        [...other.parentIds].sort().join("+") === key,
    )
    .map((other) => other.id);
}

export function compareBandPaths(a: number[] | undefined, b: number[] | undefined): number {
  if (!a || !b) return 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Father-line (upper) first from the home person. First assignment wins a cousin loop.
 */
export function lineageBands(
  people: Record<string, Person>,
  homeId: string,
  visible: Set<string> = new Set(Object.keys(people)),
): LineageBands {
  const bandPath = new Map<string, number[]>();
  const homeLineSpouse = new Map<string, string>();
  const homeLineChild = new Map<string, string>();
  const walked = new Set<string>();
  const home = people[homeId];
  if (!home || !visible.has(homeId)) {
    return { bandPath, homeLineSpouse, homeLineChild };
  }

  function walk(id: string, path: number[]): void {
    const person = people[id];
    if (!person || !visible.has(id)) return;
    if (walked.has(id)) return;
    const existing = bandPath.get(id);
    if (existing) {
      if (existing.join(",") !== path.join(",")) {
        console.info(
          `familyLayout: cousin loop, ${personLabel(people, id)} already on band [${existing.join(".")}]; skipping [${path.join(".")}]`,
        );
      }
      return;
    }
    walked.add(id);
    bandPath.set(id, path);
    for (const sibId of natalSiblingIds(people, id, visible)) {
      if (!bandPath.has(sibId)) bandPath.set(sibId, path);
    }
    const roles = splitParentRoles(people, person, visible);
    if (roles.upper && roles.lower) {
      homeLineSpouse.set(roles.upper.id, roles.lower.id);
      homeLineSpouse.set(roles.lower.id, roles.upper.id);
      homeLineChild.set(roles.upper.id, id);
      homeLineChild.set(roles.lower.id, id);
    } else if (roles.upper) {
      homeLineChild.set(roles.upper.id, id);
    }
    if (roles.upper) walk(roles.upper.id, [...path, 0]);
    if (roles.lower) walk(roles.lower.id, [...path, 1]);
  }

  const homeMembers = [homeId];
  for (const spouseId of home.spouseIds) {
    if (visible.has(spouseId) && people[spouseId] && !homeMembers.includes(spouseId)) {
      homeMembers.push(spouseId);
    }
  }
  const partner = homeMembers.find((id) => id !== homeId);
  let homePath = [0];
  if (partner) {
    const homePerson = people[homeId];
    const partnerPerson = people[partner];
    if (homePerson.gender === "female" && partnerPerson.gender === "male") homePath = [1];
    else if (homePerson.gender === partnerPerson.gender || (homePerson.gender !== "male" && homePerson.gender !== "female")) {
      homePath = [0];
    }
  }
  walk(homeId, homePath);
  if (partner && !walked.has(partner)) {
    walk(partner, homePath[0] === 1 ? [0] : [1]);
  }

  for (const [id, path] of [...bandPath]) {
    const person = people[id];
    if (!person) continue;
    for (const spouseId of person.spouseIds) {
      if (visible.has(spouseId) && people[spouseId] && !bandPath.has(spouseId)) {
        bandPath.set(spouseId, path);
      }
    }
  }

  return { bandPath, homeLineSpouse, homeLineChild };
}

function blockMidY(
  ids: string[],
  positions: Record<string, FamilyCardPosition>,
  cardH: number,
): number | null {
  let min = Infinity;
  let max = -Infinity;
  for (const id of ids) {
    const card = positions[id];
    if (!card) continue;
    min = Math.min(min, card.y);
    max = Math.max(max, card.y + cardH);
  }
  if (!Number.isFinite(min)) return null;
  return (min + max) / 2;
}

function stackedSpouseUnit(
  people: Record<string, Person>,
  positions: Record<string, FamilyCardPosition>,
  id: string,
): string[] {
  const origin = positions[id];
  if (!origin) return [id];
  const inColumn = (otherId: string) =>
    Boolean(positions[otherId] && Math.abs(positions[otherId].x - origin.x) < 0.5);
  const unit = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const memberId of [...unit]) {
      const person = people[memberId];
      if (!person) continue;
      for (const spouseId of person.spouseIds) {
        if (!inColumn(spouseId) || unit.has(spouseId)) continue;
        unit.add(spouseId);
        changed = true;
      }
    }
  }
  return [...unit].sort((a, b) => positions[a].y - positions[b].y || a.localeCompare(b));
}

function coupleKey(parentIds: string[]): string {
  return [...parentIds].sort().join("|");
}

function bloodChildrenOfPair(
  people: Record<string, Person>,
  positions: Record<string, FamilyCardPosition>,
  required: string[],
): string[] {
  return Object.values(people)
    .filter((person) => {
      if (!positions[person.id]) return false;
      if (required.length === 1) return person.parentIds.includes(required[0]);
      return required.every((id) => person.parentIds.includes(id));
    })
    .map((person) => person.id);
}

export function parentAnchorViolations(
  people: Record<string, Person>,
  positions: Record<string, FamilyCardPosition>,
  constants: FamilyLayoutConstants = FAMILY_LAYOUT,
): ParentAnchorViolation[] {
  const seen = new Set<string>();
  const out: ParentAnchorViolation[] = [];
  const placed = new Set(Object.keys(positions));
  for (const person of Object.values(people)) {
    if (!positions[person.id]) continue;
    const parents = recordedVisibleParents(people, person, placed);
    if (parents.length === 0) continue;
    const recordedIds = parents.map((parent) => parent.id);
    const parentIds =
      recordedIds.length === 1 ? stackedSpouseUnit(people, positions, recordedIds[0]) : recordedIds;
    const key = coupleKey(parentIds);
    if (seen.has(key)) continue;
    seen.add(key);
    const childIds = bloodChildrenOfPair(people, positions, recordedIds);
    if (childIds.length === 0) continue;
    const parentMid = blockMidY(parentIds, positions, constants.CARD_H);
    const childMid = blockMidY(childIds, positions, constants.CARD_H);
    if (parentMid == null || childMid == null) continue;
    const unitHeight =
      parentIds.length * constants.CARD_H + Math.max(0, parentIds.length - 1) * constants.SPOUSE_GAP;
    const limit = constants.FAMILY_GAP + unitHeight;
    const distance = Math.abs(parentMid - childMid);
    if (distance <= limit + 0.5) continue;
    out.push({
      parentIds,
      names: parentIds.map((id) => personLabel(people, id)).join(", "),
      childIds,
      childNames: childIds.map((id) => personLabel(people, id)).join(", "),
      distance,
      limit,
    });
  }
  return out;
}

export function bandInterleaveViolations(
  people: Record<string, Person>,
  positions: Record<string, FamilyCardPosition>,
  homeId: string,
): BandInterleaveViolation[] {
  const visible = new Set(Object.keys(positions));
  const { bandPath } = lineageBands(people, homeId, visible);
  const byX = new Map<number, string[]>();
  for (const id of Object.keys(positions)) {
    const x = positions[id].x;
    const list = byX.get(x) ?? [];
    list.push(id);
    byX.set(x, list);
  }
  const out: BandInterleaveViolation[] = [];
  for (const [columnX, ids] of byX) {
    ids.sort((a, b) => positions[a].y - positions[b].y || a.localeCompare(b));
    const maxDepth = Math.max(0, ...ids.map((id) => bandPath.get(id)?.length ?? 0));
    for (let depth = 0; depth < maxDepth; depth++) {
      const groups = new Map<string, string[]>();
      for (const id of ids) {
        const path = bandPath.get(id);
        if (!path || path.length <= depth) continue;
        const prefix = path.slice(0, depth).join(",");
        const list = groups.get(prefix) ?? [];
        list.push(id);
        groups.set(prefix, list);
      }
      for (const group of groups.values()) {
        const bits = group.map((id) => bandPath.get(id)![depth]);
        let seenOne = false;
        for (let i = 0; i < bits.length; i++) {
          if (bits[i] === 1) seenOne = true;
          if (seenOne && bits[i] === 0) {
            const betweenId = group[i];
            let aboveId = group[0];
            for (let k = i - 1; k >= 0; k--) {
              if (bits[k] === 1) {
                aboveId = group[k];
                break;
              }
            }
            let belowId = group[group.length - 1];
            for (let k = i + 1; k < bits.length; k++) {
              if (bits[k] === 1) {
                belowId = group[k];
                break;
              }
            }
            out.push({
              columnX,
              aboveId,
              betweenId,
              belowId,
              names: `${personLabel(people, aboveId)} … ${personLabel(people, betweenId)} … ${personLabel(people, belowId)}`,
            });
            break;
          }
        }
      }
    }
  }
  return out;
}

function logParentAnchorViolations(
  people: Record<string, Person>,
  positions: Record<string, FamilyCardPosition>,
  constants: FamilyLayoutConstants,
): void {
  for (const item of parentAnchorViolations(people, positions, constants)) {
    console.info(
      `familyLayout: ${item.names} ${Math.round(item.distance)}px from children [${item.childNames}] (limit ${item.limit})`,
    );
  }
}

const emptyBounds: FamilyLayoutBounds = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
  width: 0,
  height: 0,
};

export function layoutFamilies(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
  hiddenChildren: Set<string>,
  constants: FamilyLayoutConstants = FAMILY_LAYOUT,
): FamilyLayoutResult {
  const home = people[homeId];
  if (!home || maxGenerations < 1) {
    return { positions: {}, bounds: { ...emptyBounds } };
  }

  const C = constants;
  const { visible, generation } = collectVisible(
    people,
    homeId,
    maxGenerations,
    hiddenChildren,
  );
  if (!visible.has(homeId)) {
    return { positions: {}, bounds: { ...emptyBounds } };
  }

  const { bandPath, homeLineSpouse, homeLineChild } = lineageBands(people, homeId, visible);

  const pos: Record<string, FamilyCardPosition> = {};
  const placed = new Set<string>();
  const didDescendants = new Set<string>();
  const didAncestors = new Set<string>();

  function hidesChildren(id: string): boolean {
    if (hiddenChildren.has(id)) return true;
    const person = people[id];
    if (!person) return false;
    return person.spouseIds.some((spouseId) => hiddenChildren.has(spouseId));
  }

  function unitMembers(id: string): string[] {
    const person = people[id];
    if (!person) return visible.has(id) ? [id] : [];
    const ids = [id];
    for (const spouseId of person.spouseIds) {
      if (visible.has(spouseId) && !ids.includes(spouseId)) ids.push(spouseId);
    }
    return ids;
  }

  function marriageYear(a: string, b: string): number {
    const date = people[a]?.marriages?.[b]?.date || people[b]?.marriages?.[a]?.date || "";
    return parseYear(date) ?? 99999;
  }

  function firstRecordedPairOrder(ids: string[]): string[] | null {
    if (ids.length !== 2) return null;
    const wanted = new Set(ids);
    const childId = homeLineChild.get(ids[0]) ?? homeLineChild.get(ids[1]);
    if (childId) {
      const child = people[childId];
      if (child) {
        const rec = child.parentIds.filter((id) => wanted.has(id));
        if (rec.length === 2) return rec;
      }
    }
    for (const person of Object.values(people)) {
      if (!visible.has(person.id)) continue;
      const rec = person.parentIds.filter((id) => wanted.has(id));
      if (rec.length === 2) return rec;
    }
    return null;
  }

  function sortPair(ids: string[]): string[] {
    if (ids.length <= 1) return [...ids];
    const a = people[ids[0]];
    const b = people[ids[1]];
    if (a?.gender === "male" && b?.gender === "female") return [ids[0], ids[1]];
    if (a?.gender === "female" && b?.gender === "male") return [ids[1], ids[0]];
    const recorded = firstRecordedPairOrder(ids);
    if (recorded) return recorded;
    return [...ids].sort((left, right) => left.localeCompare(right));
  }

  function unitOf(id: string): string[] {
    const members = unitMembers(id).filter((memberId) => visible.has(memberId));
    if (members.length <= 1) return members;
    if (members.length === 2) return sortPair(members);
    const focus = pickFocus(members);
    const lineSpouse = homeLineSpouse.get(focus) ?? homeLineSpouse.get(id);
    const pair =
      lineSpouse && members.includes(lineSpouse) && members.includes(focus)
        ? sortPair([focus, lineSpouse])
        : null;
    const extras = members
      .filter((memberId) => (pair ? !pair.includes(memberId) : memberId !== focus))
      .sort((left, right) => marriageYear(focus, left) - marriageYear(focus, right) || byBirthId(left, right));
    if (!pair) {
      const splitAt = Math.ceil(extras.length / 2);
      return [...extras.slice(0, splitAt), focus, ...extras.slice(splitAt)].filter((memberId) =>
        visible.has(memberId),
      );
    }
    const pairYear = marriageYear(pair[0], pair[1]);
    const earlier = extras.filter((spouseId) => {
      const year = marriageYear(focus, spouseId);
      if (year !== pairYear) return year < pairYear;
      const other = pair.find((memberId) => memberId !== focus) ?? pair[0];
      return byBirthId(spouseId, other) < 0;
    });
    const later = extras.filter((spouseId) => !earlier.includes(spouseId));
    return [...earlier, ...pair, ...later].filter((memberId) => visible.has(memberId));
  }

  function pickFocus(members: string[]): string {
    return [...members].sort((a, b) => {
      const spousesA = (people[a]?.spouseIds ?? []).filter((id) => members.includes(id)).length;
      const spousesB = (people[b]?.spouseIds ?? []).filter((id) => members.includes(id)).length;
      if (spousesB !== spousesA) return spousesB - spousesA;
      const rank = genderRank(people[a]) - genderRank(people[b]);
      if (rank !== 0) return rank;
      return a.localeCompare(b);
    })[0];
  }

  function byBirthId(a: string, b: string): number {
    const personA = people[a];
    const personB = people[b];
    const yearA = personA ? (parseYear(personA.birth) ?? 99999) : 99999;
    const yearB = personB ? (parseYear(personB.birth) ?? 99999) : 99999;
    if (yearA !== yearB) return yearA - yearB;
    return a.localeCompare(b);
  }

  function minBandPath(ids: string[]): number[] | undefined {
    let best: number[] | undefined;
    for (const id of ids) {
      const path = bandPath.get(id);
      if (!path) continue;
      if (!best || compareBandPaths(path, best) < 0) best = path;
    }
    return best;
  }

  function compareUnitBands(a: string[], b: string[]): number {
    return compareBandPaths(minBandPath(a), minBandPath(b));
  }

  function homeLinePair(unit: string[]): string[] {
    if (unit.length <= 2) return unit;
    const focus = pickFocus(unit);
    const spouse = homeLineSpouse.get(focus) ?? unit.map((id) => homeLineSpouse.get(id)).find(Boolean);
    if (spouse && unit.includes(focus) && unit.includes(spouse)) return sortPair([focus, spouse]);
    return unit;
  }

  function xFor(id: string): number {
    return (generation.get(id) ?? 0) * (C.CARD_W + C.COLUMN_GAP);
  }

  function unitHeight(unit: string[]): number {
    if (unit.length === 0) return 0;
    return unit.length * C.CARD_H + Math.max(0, unit.length - 1) * C.SPOUSE_GAP;
  }

  function stackHeight(units: string[][]): number {
    if (units.length === 0) return 0;
    let height = 0;
    for (let index = 0; index < units.length; index++) {
      height += unitHeight(units[index]);
      if (index < units.length - 1) height += C.CARD_GAP;
    }
    return height;
  }

  type Contour = Map<number, { top: number; bottom: number }>;

  function mergeContour(base: Contour, extra: Contour, dy: number): Contour {
    const next: Contour = new Map(base);
    for (const [gen, range] of extra) {
      const shifted = { top: range.top + dy, bottom: range.bottom + dy };
      const prev = next.get(gen);
      next.set(
        gen,
        prev
          ? { top: Math.min(prev.top, shifted.top), bottom: Math.max(prev.bottom, shifted.bottom) }
          : shifted,
      );
    }
    return next;
  }

  function contourSep(upper: Contour, lower: Contour, gapAt: (gen: number) => number): number {
    let sep = 0;
    for (const [gen, low] of lower) {
      const up = upper.get(gen);
      if (!up) continue;
      sep = Math.max(sep, up.bottom + gapAt(gen) - low.top);
    }
    return sep;
  }

  function packRelativeMids(contours: Contour[], unitGens: number[]): number[] {
    if (contours.length === 0) return [];
    const mids = [0];
    for (let index = 1; index < contours.length; index++) {
      const prevGen = unitGens[index - 1];
      mids[index] =
        mids[index - 1] +
        contourSep(contours[index - 1], contours[index], (gen) =>
          gen === prevGen && gen === unitGens[index] ? C.CARD_GAP : C.FAMILY_GAP,
        );
    }
    let top = Infinity;
    let bottom = -Infinity;
    for (let index = 0; index < contours.length; index++) {
      for (const range of contours[index].values()) {
        top = Math.min(top, mids[index] + range.top);
        bottom = Math.max(bottom, mids[index] + range.bottom);
      }
    }
    const shift = Number.isFinite(top) ? -((top + bottom) / 2) : 0;
    return mids.map((mid) => mid + shift);
  }

  function placeUnitsAt(units: string[][], topY: number): string[] {
    const ids: string[] = [];
    let y = topY;
    for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
      const unit = units[unitIndex];
      for (let index = 0; index < unit.length; index++) {
        const id = unit[index];
        pos[id] = { x: xFor(id), y };
        placed.add(id);
        ids.push(id);
        y += C.CARD_H;
        if (index < unit.length - 1) y += C.SPOUSE_GAP;
      }
      if (unitIndex < units.length - 1) y += C.CARD_GAP;
    }
    return ids;
  }

  function placeUnitCentered(unit: string[], centerY: number): string[] {
    return placeUnitsAt([unit], centerY - unitHeight(unit) / 2);
  }

  function midY(ids: string[]): number {
    let min = Infinity;
    let max = -Infinity;
    for (const id of ids) {
      const card = pos[id];
      if (!card) continue;
      min = Math.min(min, card.y);
      max = Math.max(max, card.y + C.CARD_H);
    }
    if (!Number.isFinite(min)) return 0;
    return (min + max) / 2;
  }

  function minY(ids: string[]): number {
    let min = Infinity;
    for (const id of ids) {
      const card = pos[id];
      if (card) min = Math.min(min, card.y);
    }
    return Number.isFinite(min) ? min : 0;
  }

  function maxBottom(ids: string[]): number {
    let max = -Infinity;
    for (const id of ids) {
      const card = pos[id];
      if (card) max = Math.max(max, card.y + C.CARD_H);
    }
    return Number.isFinite(max) ? max : 0;
  }

  function childrenOfCouple(parentIds: string[]): string[] {
    if (parentIds.length === 0 || parentIds.some(hidesChildren)) return [];
    const wanted = [...parentIds].sort();
    return Object.values(people)
      .filter((person) => {
        if (!visible.has(person.id)) return false;
        const shown = person.parentIds.filter((id) => visible.has(id)).sort();
        if (shown.length === 0) return false;
        if (wanted.length === 1) return shown.includes(wanted[0]);
        return wanted.every((id) => shown.includes(id));
      })
      .map((person) => person.id)
      .sort(byBirthId);
  }

  function childGroups(unit: string[]): Array<{ parents: string[]; childIds: string[] }> {
    if (unit.length === 0 || unit.some(hidesChildren)) return [];
    const couples: string[][] = [];
    if (unit.length === 1) {
      couples.push([unit[0]]);
    } else if (unit.length === 2) {
      couples.push(unit);
    } else {
      const focus = pickFocus(unit);
      for (const spouseId of unit) {
        if (spouseId === focus) continue;
        couples.push(sortPair([focus, spouseId]));
      }
    }
    const groups: Array<{ parents: string[]; childIds: string[] }> = [];
    const used = new Set<string>();
    for (const parents of couples) {
      const childIds = childrenOfCouple(parents).filter((id) => !used.has(id));
      if (childIds.length === 0) continue;
      for (const id of childIds) used.add(id);
      groups.push({ parents, childIds });
    }
    return groups;
  }

  function unitsForUnplaced(ids: string[]): string[][] {
    const units: string[][] = [];
    const used = new Set<string>();
    for (const id of [...ids].sort(byBirthId)) {
      if (used.has(id) || placed.has(id)) continue;
      const unit = unitOf(id).filter((memberId) => visible.has(memberId) && !placed.has(memberId));
      if (unit.length === 0) continue;
      for (const memberId of unit) used.add(memberId);
      units.push(unit);
    }
    return units;
  }

  function unitsForIds(ids: string[]): string[][] {
    const units: string[][] = [];
    const used = new Set<string>();
    for (const id of [...ids].sort(byBirthId)) {
      if (used.has(id) || !visible.has(id)) continue;
      const unit = unitOf(id).filter((memberId) => visible.has(memberId));
      if (unit.length === 0) continue;
      for (const memberId of unit) used.add(memberId);
      units.push(unit);
    }
    return units;
  }

  const contourMemo = new Map<string, Contour>();
  const contourStack = new Set<string>();

  function unitKey(unit: string[]): string {
    return [...unit].sort().join("|");
  }

  function ownContour(unit: string[]): Contour {
    const gen = generation.get(unit[0]);
    const height = unitHeight(unit);
    const contour: Contour = new Map();
    if (gen != null) contour.set(gen, { top: -height / 2, bottom: height / 2 });
    return contour;
  }

  function memberMids(unit: string[]): Map<string, number> {
    const mids = new Map<string, number>();
    let y = -unitHeight(unit) / 2;
    for (let index = 0; index < unit.length; index++) {
      mids.set(unit[index], y + C.CARD_H / 2);
      y += C.CARD_H;
      if (index < unit.length - 1) y += C.SPOUSE_GAP;
    }
    return mids;
  }

  function predictedContour(unit: string[]): Contour {
    if (unit.length === 0) return new Map();
    const key = unitKey(unit);
    const cached = contourMemo.get(key);
    if (cached) return cached;
    if (contourStack.has(key)) return ownContour(unit);
    contourStack.add(key);
    let contour = ownContour(unit);
    const localMids = memberMids(unit);
    for (const group of childGroups(unit)) {
      const childUnits = unitsForIds(group.childIds);
      if (childUnits.length === 0) continue;
      const childContours = childUnits.map((childUnit) => predictedContour(childUnit));
      const childGens = childUnits.map((childUnit) => generation.get(childUnit[0]) ?? 0);
      const mids = packRelativeMids(childContours, childGens);
      let pack: Contour = new Map();
      for (let index = 0; index < childUnits.length; index++) {
        pack = mergeContour(pack, childContours[index], mids[index]);
      }
      const parentMids = group.parents
        .map((id) => localMids.get(id))
        .filter((mid): mid is number => mid != null);
      const coupleMid =
        parentMids.length > 0 ? parentMids.reduce((sum, mid) => sum + mid, 0) / parentMids.length : 0;
      contour = mergeContour(contour, pack, coupleMid);
    }
    contourStack.delete(key);
    contourMemo.set(key, contour);
    return contour;
  }

  function occupiedRanges(ignore: Set<string>): Map<number, Array<{ top: number; bottom: number; ids: string[] }>> {
    const byGen = new Map<number, Array<{ top: number; y: number; id: string }>>();
    for (const id of Object.keys(pos)) {
      if (ignore.has(id)) continue;
      const card = pos[id];
      const gen = generation.get(id);
      if (!card || gen == null) continue;
      const list = byGen.get(gen) ?? [];
      list.push({ top: card.y, y: card.y, id });
      byGen.set(gen, list);
    }
    const ranges = new Map<number, Array<{ top: number; bottom: number; ids: string[] }>>();
    for (const [gen, cards] of byGen) {
      cards.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
      const merged: Array<{ top: number; bottom: number; ids: string[] }> = [];
      for (const card of cards) {
        const bottom = card.y + C.CARD_H;
        const last = merged[merged.length - 1];
        if (last && card.y <= last.bottom + C.FAMILY_GAP) {
          last.bottom = Math.max(last.bottom, bottom);
          last.ids.push(card.id);
        } else {
          merged.push({ top: card.y, bottom, ids: [card.id] });
        }
      }
      ranges.set(gen, merged);
    }
    return ranges;
  }

  function natalOf(unit: string[]): Set<string> {
    const blood = unit.filter((id) => {
      const parents = people[id]?.parentIds ?? [];
      return parents.length > 0;
    });
    const parentKey = blood
      .map((id) => [...(people[id]?.parentIds ?? [])].sort().join("+"))
      .find((key) => key.length > 0);
    const ids = new Set(unit);
    if (!parentKey) return ids;
    for (const person of Object.values(people)) {
      if ([...person.parentIds].sort().join("+") !== parentKey) continue;
      ids.add(person.id);
      for (const spouseId of person.spouseIds) ids.add(spouseId);
    }
    return ids;
  }

  function gapAgainst(unit: string[], gen: number, obstacleIds: string[]): number {
    const unitGen = generation.get(unit[0]);
    if (gen !== unitGen) return C.FAMILY_GAP;
    const natal = natalOf(unit);
    if (obstacleIds.some((id) => natal.has(id))) return C.CARD_GAP;
    return C.FAMILY_GAP;
  }

  function gapForContour(unit: string[] | null, gen: number, obstacleIds: string[]): number {
    if (!unit || unit.length === 0) return C.FAMILY_GAP;
    return gapAgainst(unit, gen, obstacleIds);
  }

  function fitContour(
    pred: Contour,
    targetMid: number,
    ignore: Set<string>,
    unit: string[] | null,
    direction?: -1 | 1,
  ): number {
    const occupied = occupiedRanges(ignore);
    let lo = Number.NEGATIVE_INFINITY;
    let hi = Number.POSITIVE_INFINITY;
    for (const [gen, range] of pred) {
      for (const obs of occupied.get(gen) ?? []) {
        const gap = gapForContour(unit, gen, obs.ids);
        const maxMidAbove = obs.top - gap - range.bottom;
        const minMidBelow = obs.bottom + gap - range.top;
        const clearAbove = targetMid + range.bottom + gap <= obs.top;
        const clearBelow = targetMid + range.top >= obs.bottom + gap;
        if (direction === -1) {
          if (!clearAbove && !clearBelow) hi = Math.min(hi, maxMidAbove);
          continue;
        }
        if (direction === 1) {
          if (!clearAbove && !clearBelow) lo = Math.max(lo, minMidBelow);
          continue;
        }
        if (clearAbove) hi = Math.min(hi, maxMidAbove);
        else if (clearBelow) lo = Math.max(lo, minMidBelow);
        else if (targetMid - maxMidAbove <= minMidBelow - targetMid) hi = Math.min(hi, maxMidAbove);
        else lo = Math.max(lo, minMidBelow);
      }
    }
    if (direction === -1) {
      const cap = Number.isFinite(hi) ? hi : targetMid;
      return Math.min(targetMid, cap);
    }
    if (direction === 1) {
      const floor = Number.isFinite(lo) ? lo : targetMid;
      return Math.max(targetMid, floor);
    }
    if (lo > hi) {
      return Math.abs(targetMid - lo) <= Math.abs(targetMid - hi) ? lo : hi;
    }
    const fitted = Math.min(hi, Math.max(lo, targetMid));
    if (!Number.isFinite(fitted) || Math.abs(fitted - targetMid) > 1e5) return targetMid;
    return fitted;
  }

  function fitAway(
    unit: string[],
    startMid: number,
    direction: -1 | 1,
    ignore: Set<string>,
  ): number {
    const pred = predictedContour(unit);
    let mid = startMid;
    for (let guard = 0; guard < 64; guard++) {
      const next = fitContour(pred, mid, ignore, unit, direction);
      if (next === mid) break;
      mid = next;
    }
    return mid;
  }

  function childSpanContour(unit: string[], childIds: string[]): Contour {
    const contour = ownContour(unit);
    const parentGen = generation.get(unit[0]);
    const anchors = unique(childIds).filter((id) => pos[id]);
    if (parentGen == null || anchors.length === 0) return contour;
    const top = minY(anchors);
    const bottom = maxBottom(anchors);
    const mid = (top + bottom) / 2;
    const extra: Contour = new Map([[parentGen, { top: top - mid, bottom: bottom - mid }]]);
    return mergeContour(contour, extra, 0);
  }

  function fitInSlot(
    unit: string[],
    targetMid: number,
    ignore: Set<string>,
    ownOnly = false,
    childIds: string[] = [],
  ): number {
    const pred =
      childIds.length > 0
        ? childSpanContour(unit, childIds)
        : ownOnly
          ? ownContour(unit)
          : predictedContour(unit);
    const fitted = fitContour(pred, targetMid, ignore, unit);
    const limit = C.FAMILY_GAP + unitHeight(unit);
    if (!Number.isFinite(fitted) || Math.abs(fitted - targetMid) > limit) return targetMid;
    return fitted;
  }

  function canonicalUnit(id: string): string[] {
    let members = unitMembers(id).filter((memberId) => visible.has(memberId));
    for (const memberId of [...members]) {
      const expanded = unitMembers(memberId).filter((otherId) => visible.has(otherId));
      if (expanded.length > members.length) members = expanded;
    }
    if (members.length === 0) return visible.has(id) ? [id] : [];
    return unitOf(pickFocus(members));
  }

  function stacksAtX(x: number): string[][] {
    const ids = Object.keys(pos)
      .filter((id) => Math.abs(pos[id].x - x) < 0.5)
      .sort((a, b) => pos[a].y - pos[b].y || a.localeCompare(b));
    const stacks: string[][] = [];
    let current: string[] = [];
    for (const id of ids) {
      if (current.length === 0) {
        current = [id];
        continue;
      }
      const prev = current[current.length - 1];
      const gap = pos[id].y - (pos[prev].y + C.CARD_H);
      if (Math.abs(gap - C.SPOUSE_GAP) <= 0.5) current.push(id);
      else {
        stacks.push(current);
        current = [id];
      }
    }
    if (current.length > 0) stacks.push(current);
    return stacks;
  }

  function placedChildrenOf(unit: string[]): string[] {
    return unique(
      unit.flatMap((id) =>
        childrenOf(people, id)
          .map((child) => child.id)
          .filter((childId) => pos[childId]),
      ),
    );
  }

  function packParentUnits(units: string[][]): void {
    const merged: string[][] = [];
    const used = new Set<string>();
    for (const unit of units) {
      const placedUnit = unique(unit.filter((id) => pos[id]));
      if (placedUnit.length === 0 || placedUnit.every((id) => used.has(id))) continue;
      const combined = new Set(placedUnit);
      for (const other of units) {
        if (other.some((id) => combined.has(id))) {
          for (const id of other) if (pos[id]) combined.add(id);
        }
      }
      const stack = [...combined].sort((a, b) => pos[a].y - pos[b].y || a.localeCompare(b));
      for (const id of stack) used.add(id);
      merged.push(stack);
    }
    const items = merged.map((unit) => {
      const pair = homeLinePair(unit).filter((id) => pos[id]);
      const pinParents =
        pair.length > 0 && pair.every((id) => people[id])
          ? pair.map((id) => people[id])
          : unit.map((id) => people[id]).filter((person): person is Person => Boolean(person));
      const kids =
        pair.length === 2
          ? Object.values(people)
              .filter(
                (person) =>
                  visible.has(person.id) &&
                  pos[person.id] &&
                  pair.every((id) => person.parentIds.includes(id)),
              )
              .map((person) => person.id)
          : bloodOfParents(pinParents).filter((id) => pos[id]);
      const childIds = kids.length > 0 ? kids : placedChildrenOf(unit);
      const pairOffset =
        pair.length > 0 && unit.includes(pair[0])
          ? unit.indexOf(pair[0]) * (C.CARD_H + C.SPOUSE_GAP)
          : 0;
      return {
        unit,
        pair,
        pairOffset,
        target: childIds.length > 0 ? midY(childIds) : midY(unit),
        height: unitHeight(unit),
        pairHeight: unitHeight(pair.length > 0 ? pair : unit),
      };
    });
    for (const item of items) {
      const pairTop = item.target - item.pairHeight / 2;
      let y = pairTop - item.pairOffset;
      for (let index = 0; index < item.unit.length; index++) {
        pos[item.unit[index]].y = y;
        y += C.CARD_H;
        if (index < item.unit.length - 1) y += C.SPOUSE_GAP;
      }
    }
    items.sort(
      (a, b) =>
        compareUnitBands(a.unit, b.unit) || a.target - b.target || a.unit[0].localeCompare(b.unit[0]),
    );
    for (let guard = 0; guard < 32; guard++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          if (Math.abs(pos[a.unit[0]].x - pos[b.unit[0]].x) > 0.5) continue;
          const aTop = minY(a.unit);
          const aBottom = maxBottom(a.unit);
          const bTop = minY(b.unit);
          const bBottom = maxBottom(b.unit);
          if (aBottom + C.FAMILY_GAP <= bTop + 0.5 || bBottom + C.FAMILY_GAP <= aTop + 0.5) continue;
          const overlap =
            Math.min(aBottom + C.FAMILY_GAP, bBottom + C.FAMILY_GAP) - Math.max(aTop, bTop);
          if (overlap <= 0.5) continue;
          const dy = overlap / 2;
          for (const id of a.unit) pos[id].y -= dy;
          for (const id of b.unit) pos[id].y += dy;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  function clearOverlapsWithKept(keepUnits: string[][]): void {
    const units = keepUnits.map((unit) => unit.filter((id) => pos[id])).filter((unit) => unit.length > 0);
    if (units.length === 0) return;
    const keepIds = new Set(units.flat());
    const origin = pos[units[0][0]];
    if (!origin) return;
    for (let guard = 0; guard < 32; guard++) {
      let moved = false;
      for (const block of stacksAtX(origin.x)) {
        if (block.some((id) => keepIds.has(id))) continue;
        const blockTop = minY(block);
        const blockBottom = maxBottom(block);
        const blockMid = (blockTop + blockBottom) / 2;
        for (const keep of units) {
          const keepTop = minY(keep);
          const keepBottom = maxBottom(keep);
          const natal = natalOf(keep);
          const gap = block.some((id) => natal.has(id)) ? C.CARD_GAP : C.FAMILY_GAP;
          if (blockBottom + gap <= keepTop + 0.5 || blockTop >= keepBottom + gap - 0.5) continue;
          const keepMid = (keepTop + keepBottom) / 2;
          const cmp = compareUnitBands(block, keep);
          const dy =
            cmp < 0
              ? keepTop - gap - blockBottom
              : cmp > 0
                ? keepBottom + gap - blockTop
                : blockMid <= keepMid
                  ? keepTop - gap - blockBottom
                  : keepBottom + gap - blockTop;
          if (!Number.isFinite(dy) || Math.abs(dy) <= 0.5) continue;
          for (const id of block) pos[id].y += dy;
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
  }

  function seatParentOnChildren(unit: string[], childIds: string[]): void {
    const toPlace = unit.filter((id) => visible.has(id) && !placed.has(id));
    if (toPlace.length === 0) return;
    const anchors = unique(childIds).filter((id) => pos[id]);
    const targetMid = anchors.length > 0 ? midY(anchors) : 0;
    if (!Number.isFinite(targetMid)) return;
    const ignore = new Set(anchors);
    const mid = anchors.length > 0 ? fitInSlot(toPlace, targetMid, ignore, false, anchors) : targetMid;
    const pair = homeLinePair(toPlace).filter((id) => toPlace.includes(id));
    const pairOffset =
      pair.length > 0 && toPlace.includes(pair[0])
        ? toPlace.indexOf(pair[0]) * (C.CARD_H + C.SPOUSE_GAP)
        : 0;
    const pairH = unitHeight(pair.length > 0 ? pair : toPlace);
    placeUnitsAt([toPlace], mid - pairH / 2 - pairOffset);
  }

  function parentsOfChild(childId: string): Person[] {
    const child = people[childId];
    if (!child) return [];
    return recordedVisibleParents(people, child, visible);
  }

  function coupleRole(childId: string): "upper" | "lower" | "single" {
    const unit = unitOf(childId).filter((id) => placed.has(id) || visible.has(id));
    if (unit.length <= 1) return "single";
    const pair = homeLinePair(unit);
    if (pair.length < 2) return "single";
    const ordered = sortPair(pair);
    if (ordered[0] === childId) return "upper";
    if (ordered[1] === childId) return "lower";
    const idx = unit.indexOf(childId);
    const pairStart = unit.indexOf(ordered[0]);
    if (idx >= 0 && pairStart >= 0) return idx < pairStart ? "upper" : "lower";
    return "single";
  }

  function bloodOfParents(parents: Person[]): string[] {
    return unique(
      parents.flatMap((parent) =>
        hidesChildren(parent.id)
          ? []
          : childrenOf(people, parent.id)
              .filter((person) => visible.has(person.id))
              .map((person) => person.id),
      ),
    ).sort(byBirthId);
  }

  function placeSiblingsAround(childId: string): void {
    if (!placed.has(childId) || didAncestors.has(childId)) return;
    didAncestors.add(childId);
    const parents = parentsOfChild(childId);
    if (parents.length === 0) return;
    const blood = bloodOfParents(parents);
    const siblingIds = blood.filter((id) => id !== childId && !placed.has(id));
    if (siblingIds.length === 0) return;
    const anchorIds = unitOf(childId).filter((id) => placed.has(id));
    const role = coupleRole(childId);
    if (role === "upper") {
      placeSiblingUnits(unitsForUnplaced(siblingIds).sort((a, b) => byBirthId(a[0], b[0])), anchorIds, "above");
      return;
    }
    if (role === "lower") {
      placeSiblingUnits(unitsForUnplaced(siblingIds).sort((a, b) => byBirthId(a[0], b[0])), anchorIds, "below");
      return;
    }
    const above = siblingIds.filter((id) => byBirthId(id, childId) < 0);
    const below = siblingIds.filter((id) => !above.includes(id));
    placeSiblingUnits(unitsForUnplaced(above), anchorIds, "above");
    placeSiblingUnits(unitsForUnplaced(below), anchorIds, "below");
  }

  function parentUnitsForChildren(childIds: string[]): string[][] {
    const units: string[][] = [];
    const seen = new Set<string>();
    for (const childId of childIds) {
      const parents = parentsOfChild(childId);
      if (parents.length === 0) continue;
      const parentIds = unique(parents.flatMap((parent) => canonicalUnit(parent.id))).filter(
        (id) => visible.has(id),
      );
      const ordered =
        parentIds.length === 2
          ? sortPair(parentIds)
          : parentIds.length > 2
            ? canonicalUnit(parents[0].id)
            : parentIds;
      const toPlace = ordered.filter((id) => !placed.has(id));
      if (toPlace.length === 0) continue;
      const key = unitKey(toPlace);
      if (seen.has(key)) continue;
      seen.add(key);
      const blood = bloodOfParents(parents);
      const anchors = blood.filter((id) => placed.has(id));
      seatParentOnChildren(toPlace.length === ordered.length ? ordered : toPlace, anchors);
      units.push(ordered.filter((id) => pos[id]));
    }
    return units;
  }

  const seatedByGen = new Map<number, string[][]>();

  function pinSeatedGeneration(g: number): void {
    const units = (seatedByGen.get(g) ?? [])
      .map((unit) => unit.filter((id) => pos[id]))
      .filter((unit) => unit.length > 0);
    packParentUnits(units);
    clearOverlapsWithKept(units);
  }

  function placeAncestorGenerations(): void {
    let maxGen = 0;
    for (const gen of generation.values()) maxGen = Math.max(maxGen, gen);
    for (let g = 1; g <= maxGen; g++) {
      const origins = Object.keys(pos)
        .filter((id) => (generation.get(id) ?? 0) === g - 1)
        .sort(byBirthId);
      for (const childId of origins) placeSiblingsAround(childId);
      const seated = parentUnitsForChildren(
        Object.keys(pos)
          .filter((id) => (generation.get(id) ?? 0) === g - 1)
          .sort(byBirthId),
      );
      seatedByGen.set(g, seated);
      packParentUnits(seated);
      clearOverlapsWithKept(seated);
    }
  }

  function placeSubtree(unit: string[], centerY: number): string[] {
    const ids = placeUnitCentered(unit.filter((id) => !placed.has(id)), centerY);
    if (unit.some((id) => placed.has(id) && !ids.includes(id))) {
      for (const id of unit) {
        if (placed.has(id) && !ids.includes(id)) ids.push(id);
      }
    }
    for (const id of unit) didDescendants.add(id);
    for (const group of childGroups(unit)) {
      const childUnits = unitsForUnplaced(group.childIds);
      if (childUnits.length === 0) continue;
      const parents = group.parents.filter((id) => placed.has(id));
      const coupleMid = parents.length > 0 ? midY(parents) : centerY;
      const childContours = childUnits.map((childUnit) => predictedContour(childUnit));
      const childGens = childUnits.map((childUnit) => generation.get(childUnit[0]) ?? 0);
      const relMids = packRelativeMids(childContours, childGens);
      const ignore = new Set(unit);
      let pack: Contour = new Map();
      for (let index = 0; index < childUnits.length; index++) {
        pack = mergeContour(pack, childContours[index], relMids[index]);
      }
      const packMid = fitContour(pack, coupleMid, ignore, null);
      for (let index = 0; index < childUnits.length; index++) {
        ids.push(...placeSubtree(childUnits[index], packMid + relMids[index]));
      }
    }
    return ids;
  }

  function placeSiblingUnits(units: string[][], anchorIds: string[], side: "above" | "below"): string[] {
    if (units.length === 0 || anchorIds.length === 0) return [];
    const ordered = side === "above" ? [...units].reverse() : units;
    const ids: string[] = [];
    let edge = side === "above" ? minY(anchorIds) : maxBottom(anchorIds);
    for (const unit of ordered) {
      const tight =
        side === "above" ? edge - C.CARD_GAP - unitHeight(unit) / 2 : edge + C.CARD_GAP + unitHeight(unit) / 2;
      const mid = fitAway(unit, tight, side === "above" ? -1 : 1, new Set(anchorIds));
      ids.push(...placeSubtree(unit, mid));
      edge = side === "above" ? minY(unit.filter((id) => pos[id])) : maxBottom(unit.filter((id) => pos[id]));
    }
    return ids;
  }

  function resolveColumnStackOverlaps(): void {
    const xs = [...new Set(Object.keys(pos).map((id) => pos[id].x))];
    for (const x of xs) {
      for (let guard = 0; guard < 48; guard++) {
        const stacks = stacksAtX(x);
        let moved = false;
        for (let i = 0; i < stacks.length; i++) {
          for (let j = i + 1; j < stacks.length; j++) {
            const a = stacks[i];
            const b = stacks[j];
            const aTop = minY(a);
            const aBottom = maxBottom(a);
            const bTop = minY(b);
            const bBottom = maxBottom(b);
            const natal = natalOf(a);
            const gap = b.some((id) => natal.has(id)) ? C.CARD_GAP : C.FAMILY_GAP;
            if (aBottom + gap <= bTop + 0.5 || bBottom + gap <= aTop + 0.5) continue;
            const overlap = Math.min(aBottom + gap, bBottom + gap) - Math.max(aTop, bTop);
            if (overlap <= 0.5) continue;
            const cmp = compareUnitBands(a, b);
            const dir = cmp > 0 ? -1 : 1;
            const dy = overlap / 2;
            for (const id of a) pos[id].y -= dir * dy;
            for (const id of b) pos[id].y += dir * dy;
            moved = true;
          }
        }
        if (!moved) break;
      }
    }
  }

  function enforceBandOrder(): void {
    const xs = [...new Set(Object.keys(pos).map((id) => pos[id].x))];
    for (const x of xs) {
      for (let guard = 0; guard < 48; guard++) {
        const stacks = stacksAtX(x);
        let moved = false;
        for (let i = 0; i < stacks.length; i++) {
          for (let j = i + 1; j < stacks.length; j++) {
            const a = stacks[i];
            const b = stacks[j];
            if (compareUnitBands(a, b) <= 0) continue;
            const aTop = minY(a);
            const bTop = minY(b);
            const bBottom = maxBottom(b);
            const natal = natalOf(a);
            const gap = b.some((id) => natal.has(id)) ? C.CARD_GAP : C.FAMILY_GAP;
            const jHeight = bBottom - bTop;
            for (const id of b) pos[id].y += aTop - bTop;
            for (const id of a) pos[id].y += jHeight + gap;
            moved = true;
          }
        }
        if (!moved) break;
      }
    }
  }

  function placeDescendants(personId: string): void {
    if (!placed.has(personId) || hidesChildren(personId) || didDescendants.has(personId)) return;
    didDescendants.add(personId);
    const unit = unitOf(personId).filter((id) => placed.has(id));
    if (unit.length === 0) return;
    placeSubtree(unit, midY(unit));
  }

  const homeUnit = unitOf(homeId).filter((id) => visible.has(id));
  placeUnitsAt([homeUnit], -stackHeight([homeUnit]) / 2);
  placeDescendants(homeId);
  placeAncestorGenerations();
  resolveTrunkReservations();
  let maxPlacedGen = 0;
  for (const id of Object.keys(pos)) {
    maxPlacedGen = Math.max(maxPlacedGen, generation.get(id) ?? 0);
  }
  function relaxPinsTowardChildren(): void {
    const units: string[][] = [];
    const seen = new Set<string>();
    for (const person of Object.values(people)) {
      if (!pos[person.id]) continue;
      const parents = recordedVisibleParents(people, person, visible);
      if (parents.length === 0) continue;
      const parentIds = parents.map((parent) => parent.id).filter((id) => pos[id]);
      if (parentIds.length === 0) continue;
      const key = unitKey(parentIds);
      if (seen.has(key)) continue;
      seen.add(key);
      const stack = unique(parentIds.flatMap((id) => stacksAtX(pos[id].x).find((block) => block.includes(id)) ?? [id]));
      units.push(stack);
    }
    for (let guard = 0; guard < 16; guard++) {
      let moved = false;
      for (const unit of units) {
        const pair = homeLinePair(unit).filter((id) => pos[id]);
        const pinIds = pair.length > 0 ? pair : unit;
        const kids =
          pinIds.length === 2
            ? Object.values(people)
                .filter(
                  (person) =>
                    visible.has(person.id) &&
                    pos[person.id] &&
                    pinIds.every((id) => person.parentIds.includes(id)),
                )
                .map((person) => person.id)
            : bloodOfParents(pinIds.map((id) => people[id]).filter((person): person is Person => Boolean(person))).filter(
                (id) => pos[id],
              );
        if (kids.length === 0) continue;
        const dy = midY(kids) - midY(pinIds);
        if (!Number.isFinite(dy) || Math.abs(dy) <= 0.5) continue;
        const x = pos[unit[0]].x;
        const nextTop = minY(unit) + dy;
        const nextBottom = maxBottom(unit) + dy;
        let allowed = dy;
        for (const other of stacksAtX(x)) {
          if (other.some((id) => unit.includes(id))) continue;
          const otherTop = minY(other);
          const otherBottom = maxBottom(other);
          const natal = natalOf(unit);
          const gap = other.some((id) => natal.has(id)) ? C.CARD_GAP : C.FAMILY_GAP;
          const cmp = compareUnitBands(unit, other);
          if (dy < 0) {
            const cap = otherBottom + gap;
            if (nextTop < cap - 0.5 && nextBottom > otherTop - gap + 0.5) {
              allowed = Math.max(allowed, cap - minY(unit));
            }
            if (cmp > 0 && nextBottom > otherTop + 0.5) allowed = Math.max(allowed, otherTop - maxBottom(unit));
          } else {
            const cap = otherTop - gap;
            if (nextBottom > cap + 0.5 && nextTop < otherBottom + gap - 0.5) {
              allowed = Math.min(allowed, cap - maxBottom(unit));
            }
            if (cmp < 0 && nextTop < otherBottom - 0.5) allowed = Math.min(allowed, otherBottom - minY(unit));
          }
        }
        if (!Number.isFinite(allowed) || Math.abs(allowed) <= 0.5) continue;
        if (dy < 0 && allowed >= 0) continue;
        if (dy > 0 && allowed <= 0) continue;
        for (const id of unit) pos[id].y += allowed;
        moved = true;
      }
      if (!moved) break;
    }
  }

  for (let g = 1; g <= maxPlacedGen; g++) pinSeatedGeneration(g);
  enforceBandOrder();
  resolveColumnStackOverlaps();
  relaxPinsTowardChildren();
  resolveColumnStackOverlaps();
  logParentAnchorViolations(people, pos, C);

  return { positions: pos, bounds: boundsOf(pos, C.CARD_W, C.CARD_H) };

  function cardsFromPos() {
    return Object.keys(pos).map((id) => {
      const person = people[id];
      return {
        id,
        x: pos[id].x,
        y: pos[id].y,
        w: C.CARD_W,
        h: C.CARD_H,
        parentIds: person?.parentIds.filter((parentId) => pos[parentId]) ?? [],
        spouseIds: person?.spouseIds.filter((spouseId) => pos[spouseId]) ?? [],
      };
    });
  }

  function resolveTrunkReservations(): void {
    for (let guard = 0; guard < 24; guard++) {
      const families = chartFamilies(cardsFromPos());
      let shifted = false;
      for (const other of families) {
        for (const family of families) {
          if (family.key === other.key) continue;
          if (Math.abs(family.parentX - other.parentX) > 0.5 || Math.abs(family.childX - other.childX) > 0.5) {
            continue;
          }
          if (family.parentIds.some((id) => other.childIds.includes(id))) continue;
          if (other.parentIds.some((id) => family.childIds.includes(id))) continue;
          if (family.parentLinkY <= other.y1 + 0.5 || family.parentLinkY >= other.y2 - 0.5) continue;
          const childYs = family.children.map((card) => card.y + card.h / 2);
          if (childYs.some((y) => y < other.y1 - 0.5) && childYs.some((y) => y > other.y2 + 0.5)) {
            continue;
          }
          const delta = other.y2 + CONNECTOR_LANE - family.parentLinkY;
          if (delta <= 0.5) continue;
          const move = unique(family.parentIds.flatMap((id) => unitOf(id))).filter((id) => pos[id]);
          if (move.length === 0) continue;
          let nextDelta = delta;
          for (const id of move) {
            const card = pos[id];
            for (const [otherId, otherCard] of Object.entries(pos)) {
              if (move.includes(otherId)) continue;
              if (Math.abs(otherCard.x - card.x) > 0.5) continue;
              const destTop = card.y + nextDelta;
              if (destTop < otherCard.y + C.CARD_H + C.FAMILY_GAP && destTop + C.CARD_H + C.FAMILY_GAP > otherCard.y) {
                nextDelta = Math.max(nextDelta, otherCard.y + C.CARD_H + C.FAMILY_GAP - card.y);
              }
            }
          }
          if (nextDelta <= 0.5) continue;
          const childIds = unique(
            move.flatMap((id) => childrenOf(people, id).map((person) => person.id).filter((childId) => pos[childId])),
          );
          if (childIds.length > 0) {
            const nextMid = midY(move) + nextDelta;
            const limit = C.FAMILY_GAP + unitHeight(move);
            if (Math.abs(nextMid - midY(childIds)) > limit + 0.5) {
              const otherMove = unique(other.parentIds.flatMap((id) => unitOf(id))).filter((id) => pos[id]);
              if (otherMove.length === 0) continue;
              for (const id of otherMove) pos[id].y -= nextDelta;
              shifted = true;
              continue;
            }
          }
          for (const id of move) pos[id].y += nextDelta;
          shifted = true;
        }
      }
      if (!shifted) break;
    }
  }
}

function collectVisible(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
  hiddenChildren: Set<string>,
): { visible: Set<string>; generation: Map<string, number> } {
  const visible = new Set<string>();
  const generation = new Map<string, number>();
  const walkedUp = new Set<string>();

  function hidesChildren(id: string): boolean {
    if (hiddenChildren.has(id)) return true;
    const person = people[id];
    if (!person) return false;
    return person.spouseIds.some((spouseId) => hiddenChildren.has(spouseId));
  }

  function add(id: string, gen: number): boolean {
    if (!people[id]) return false;
    if (visible.has(id) || generation.has(id)) return false;
    visible.add(id);
    generation.set(id, gen);
    return true;
  }

  function addSpouse(id: string, gen: number): void {
    const person = people[id];
    if (!person) return;
    for (const spouse of spousesOf(people, person)) {
      add(spouse.id, gen);
    }
  }

  function walkUp(id: string, gen: number): void {
    if (gen >= maxGenerations || !people[id]) return;
    if (walkedUp.has(id)) return;
    walkedUp.add(id);
    if (!visible.has(id)) add(id, gen);
    addSpouse(id, generation.get(id) ?? gen);
    if (gen >= maxGenerations - 1) return;
    const person = people[id];
    if (!person) return;
    for (const parent of orderedParents(people, person).slice(0, 2)) {
      walkUp(parent.id, gen + 1);
    }
  }

  walkUp(homeId, 0);

  const queue = [...visible];
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (hidesChildren(id)) continue;
    const gen = generation.get(id);
    if (gen == null) continue;
    for (const child of childrenOf(people, id)) {
      if (visible.has(child.id)) continue;
      if (!add(child.id, gen - 1)) continue;
      queue.push(child.id);
      addSpouse(child.id, gen - 1);
      for (const spouse of spousesOf(people, child)) {
        if (visible.has(spouse.id) && !queue.includes(spouse.id)) queue.push(spouse.id);
      }
    }
  }

  return { visible, generation };
}

function genderRank(person: Person | undefined): number {
  if (!person) return 3;
  if (person.gender === "male") return 0;
  if (person.gender === "female") return 1;
  return 2;
}

function unique(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function boundsOf(
  positions: Record<string, FamilyCardPosition>,
  cardW: number,
  cardH: number,
): FamilyLayoutBounds {
  const ids = Object.keys(positions);
  if (ids.length === 0) return { ...emptyBounds };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const card = positions[id];
    minX = Math.min(minX, card.x);
    minY = Math.min(minY, card.y);
    maxX = Math.max(maxX, card.x + cardW);
    maxY = Math.max(maxY, card.y + cardH);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
