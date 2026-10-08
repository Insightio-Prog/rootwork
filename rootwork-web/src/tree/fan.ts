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
  index: number;
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

export function buildFanSlots(
  people: Record<string, Person>,
  homeId: string,
  maxGenerations: number,
): FanSlot[] {
  const home = people[homeId];
  if (!home) return [];
  const rings = fanRings(maxGenerations);
  const slots: FanSlot[] = [];
  let row: { person: Person | null }[] = [{ person: home }];

  for (let generation = 1; generation <= rings; generation++) {
    const next: { person: Person | null }[] = [];
    for (let index = 0; index < row.length; index++) {
      const node = row[index];
      const parents = node.person
        ? pedigreeParents(people, node.person)
        : { father: null, mother: null };
      const childId = node.person?.id ?? null;
      const pair: { person: Person | null; role: "father" | "mother" }[] = [
        { person: parents.father, role: "father" },
        { person: parents.mother, role: "mother" },
      ];
      for (let side = 0; side < 2; side++) {
        const item = pair[side];
        const extraDepth =
          generation === rings && item.person ? extraAncestorDepth(people, item.person) : 0;
        slots.push({
          generation,
          index: index * 2 + side,
          person: item.person,
          childId,
          role: item.role,
          extraDepth,
        });
        next.push({ person: item.person });
      }
    }
    row = next;
  }
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

export function slotAngles(generation: number, index: number): { a0: number; a1: number; mid: number } {
  const count = 2 ** generation;
  const slice = FAN_SPAN / count;
  const gap = Math.min(0.014, slice * 0.08);
  const a0 = FAN_START - index * slice - gap / 2;
  const a1 = FAN_START - (index + 1) * slice + gap / 2;
  return { a0, a1, mid: (a0 + a1) / 2 };
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
