import { orderedParents, type Person } from "../data/people";

export const FAN_SPAN = (200 * Math.PI) / 180;
export const FAN_MID = Math.PI / 2;
export const FAN_START = FAN_MID + FAN_SPAN / 2;
/** Pedigree wedges double each ring; 8 generations is 254 slots, 20 would be ~1 million. */
export const FAN_MAX_GENERATIONS = 8;

function fanRings(maxGenerations: number): number {
  return Math.max(1, Math.min(FAN_MAX_GENERATIONS, Math.max(1, maxGenerations)) - 1);
}

export type FanSlot = {
  generation: number;
  /** Binary path from the centre (unique per slot); `index >> (generation - 2)` is the grandparent branch. */
  index: number;
  a0: number;
  a1: number;
  mid: number;
  person: Person | null;
  childId: string | null;
  role: "father" | "mother";
  extraDepth: number;
};

export type FanMetrics = {
  rings: number;
  ringW: number;
  gap: number;
  hubR: number;
  maxR: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

export function pedigreeParents(
  people: Record<string, Person>,
  person: Person,
): { father: Person | null; mother: Person | null } {
  const parents = orderedParents(people, person).slice(0, 2);
  const father = parents.find((parent) => parent.gender === "male") ?? null;
  const mother = parents.find((parent) => parent.gender === "female") ?? null;
  if (father && mother) return { father, mother };
  if (parents.length === 0) return { father: null, mother: null };
  if (parents.length === 1) {
    const only = parents[0];
    if (only.gender === "female") return { father: null, mother: only };
    return { father: only, mother: null };
  }
  return { father: father ?? parents[0], mother: mother ?? parents[1] };
}

function extraAncestorDepth(people: Record<string, Person>, person: Person, limit = 6): number {
  let depth = 0;
  let frontier: Person[] = [person];
  while (depth < limit) {
    const next: Person[] = [];
    for (const item of frontier) {
      const { father, mother } = pedigreeParents(people, item);
      if (father) next.push(father);
      if (mother) next.push(mother);
    }
    if (next.length === 0) break;
    depth += 1;
    frontier = next;
  }
  return depth;
}

/** How wide a missing parent's stub is, compared with 1 for a known person at the edge of the chart. */
const EMPTY_WEIGHT = 0.3;
const KNOWN_FLOOR = 0.8;

/** How many rings the chart really needs: as deep as the known ancestors go, plus one row of "add" stubs. */
export function fanRingsNeeded(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
): number {
  const home = people[homeId];
  if (!home) return 1;
  const known = extraAncestorDepth(people, home, FAN_MAX_GENERATIONS);
  return Math.max(1, Math.min(fanRings(maxGenerations), known + 1));
}

type FanNode = {
  person: Person | null;
  role: "father" | "mother";
  childId: string | null;
  generation: number;
  index: number;
  kids: FanNode[];
  weight: number;
};

/**
 * Lays the ancestors out so the room goes to the people we know: every known branch is shared out by how
 * many ancestors it holds, and a missing parent is a narrow stub that does not grow any further out.
 */
export function buildFanSlots(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
): FanSlot[] {
  const home = people[homeId];
  if (!home) return [];
  const rings = fanRingsNeeded(people, homeId, maxGenerations);

  function build(
    person: Person | null,
    role: "father" | "mother",
    childId: string | null,
    generation: number,
    index: number,
    path: Set<string>,
  ): FanNode {
    const node: FanNode = { person, role, childId, generation, index, kids: [], weight: person ? 1 : EMPTY_WEIGHT };
    if (person && generation < rings && !path.has(person.id)) {
      const parents = pedigreeParents(people, person);
      const nextPath = new Set(path).add(person.id);
      node.kids = [
        build(parents.father, "father", person.id, generation + 1, index * 2, nextPath),
        build(parents.mother, "mother", person.id, generation + 1, index * 2 + 1, nextPath),
      ];
      node.weight = Math.max(KNOWN_FLOOR, node.kids[0].weight + node.kids[1].weight);
    }
    return node;
  }

  const roots = pedigreeParents(people, home);
  const top = [
    build(roots.father, "father", home.id, 1, 0, new Set([home.id])),
    build(roots.mother, "mother", home.id, 1, 1, new Set([home.id])),
  ];
  const slots: FanSlot[] = [];

  function place(node: FanNode, start: number, span: number) {
    const gap = Math.min(0.014, span * 0.08);
    const a0 = start - gap / 2;
    const a1 = start - span + gap / 2;
    const extraDepth =
      node.generation === rings && node.person ? extraAncestorDepth(people, node.person) : 0;
    slots.push({
      generation: node.generation,
      index: node.index,
      a0,
      a1,
      mid: (a0 + a1) / 2,
      person: node.person,
      childId: node.childId,
      role: node.role,
      extraDepth,
    });
    const total = node.kids.reduce((sum, kid) => sum + kid.weight, 0);
    let at = start;
    for (const kid of node.kids) {
      const kidSpan = (span * kid.weight) / total;
      place(kid, at, kidSpan);
      at -= kidSpan;
    }
  }

  // The two sides share the half-turn by how much each holds, but neither is ever squeezed below a fifth.
  const fatherShare = Math.min(0.8, Math.max(0.2, top[0].weight / (top[0].weight + top[1].weight)));
  place(top[0], FAN_START, FAN_SPAN * fatherShare);
  place(top[1], FAN_START - FAN_SPAN * fatherShare, FAN_SPAN * (1 - fatherShare));
  return slots;
}

export function ringWidthFor(rings: number): number {
  if (rings <= 2) return 96;
  if (rings <= 3) return 84;
  if (rings <= 4) return 74;
  if (rings <= 5) return 64;
  if (rings <= 6) return 56;
  return 50;
}

export function fanMetrics(maxGenerations: number): FanMetrics {
  const rings = fanRings(maxGenerations);
  const ringW = ringWidthFor(rings);
  const gap = 2;
  const hubR = 64;
  const maxR = hubR + rings * ringW + (rings - 1) * gap;
  const below = Math.sin((FAN_SPAN - Math.PI) / 2) * maxR;
  const badge = 22;
  const pad = 40;
  const cx = pad + maxR + badge;
  const cy = pad + maxR;
  return {
    rings,
    ringW,
    gap,
    hubR,
    maxR,
    cx,
    cy,
    width: cx * 2,
    height: cy + Math.max(below, hubR * 0.15) + pad + badge,
  };
}

export function ringRadii(metrics: FanMetrics, generation: number): { inner: number; outer: number } {
  const inner = metrics.hubR + (generation - 1) * (metrics.ringW + metrics.gap);
  return { inner, outer: inner + metrics.ringW };
}

export function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  reverse = false,
): string {
  const start = polar(cx, cy, r, reverse ? a1 : a0);
  const end = polar(cx, cy, r, reverse ? a0 : a1);
  const large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
  const sweep = reverse ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function donutPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  a0: number,
  a1: number,
): string {
  const outerStart = polar(cx, cy, outer, a0);
  const outerEnd = polar(cx, cy, outer, a1);
  const innerEnd = polar(cx, cy, inner, a1);
  const innerStart = polar(cx, cy, inner, a0);
  const large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function textRotation(mid: number): number {
  let deg = (Math.atan2(-Math.sin(mid), Math.cos(mid)) * 180) / Math.PI;
  if (deg > 90 || deg < -90) deg += deg > 0 ? -180 : 180;
  return deg;
}

export function branchClass(generation: number, index: number): string {
  if (generation <= 1) return `fan-seg--parent-${index}`;
  return `fan-seg--branch-${index >> (generation - 2)}`;
}
