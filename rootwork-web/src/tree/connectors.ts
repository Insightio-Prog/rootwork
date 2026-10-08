export type ConnectorCard = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parentIds: string[];
  spouseIds: string[];
};

export const CONNECTOR_LANE = 16;
export const CONNECTOR_EDGE = 16;
export const CONNECTOR_BRACKET = 8;

export type ConnectorPath = {
  key: string;
  d: string;
  familyId: string;
  familyKey: string;
  fromIds: string[];
  toIds: string[];
  role: "trunk" | "parent" | "child" | "bracket";
  parentIds: string[];
  childIds: string[];
};

export type ConnectorLayout = {
  paths: ConnectorPath[];
  requiredColumnGap: number | null;
};

export type ConnectorFamily = {
  key: string;
  parentIds: string[];
  childIds: string[];
  parentLinkY: number;
  y1: number;
  y2: number;
  parentX: number;
  childX: number;
  parents: ConnectorCard[];
  children: ConnectorCard[];
};

type Segment = {
  familyKey: string;
  role: ConnectorPath["role"];
  parentIds: string[];
  childIds: string[];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function midY(card: ConnectorCard) {
  return card.y + card.h / 2;
}

function onChartParentIds(card: ConnectorCard, byId: Map<string, ConnectorCard>): string[] {
  return [...new Set(card.parentIds.filter((id) => byId.has(id)))].sort();
}

export function chartFamilies(cards: ConnectorCard[]): ConnectorFamily[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const groups = new Map<string, { parentIds: string[]; childIds: string[] }>();

  for (const card of cards) {
    const parentIds = onChartParentIds(card, byId);
    if (parentIds.length === 0) continue;
    const key = parentIds.join("+");
    const existing = groups.get(key) ?? { parentIds, childIds: [] };
    if (!existing.childIds.includes(card.id)) existing.childIds.push(card.id);
    groups.set(key, existing);
  }

  const families: ConnectorFamily[] = [];
  for (const [key, group] of groups) {
    const parents = group.parentIds
      .map((id) => byId.get(id))
      .filter((card): card is ConnectorCard => Boolean(card));
    const children = group.childIds
      .map((id) => byId.get(id))
      .filter((card): card is ConnectorCard => card != null && !group.parentIds.includes(card.id));
    if (parents.length === 0 || children.length === 0) continue;
    const parentLinkY =
      parents.reduce((sum, card) => sum + midY(card), 0) / parents.length;
    const childYs = children.map(midY);
    const y1 = Math.min(parentLinkY, ...childYs);
    const y2 = Math.max(parentLinkY, ...childYs);
    families.push({
      key,
      parentIds: group.parentIds,
      childIds: children.map((card) => card.id),
      parentLinkY,
      y1,
      y2,
      parentX: Math.min(...parents.map((card) => card.x)),
      childX: Math.min(...children.map((card) => card.x)),
      parents,
      children,
    });
  }
  return families;
}

function gutterBounds(family: ConnectorFamily) {
  const childRight = Math.max(...family.children.map((card) => card.x + card.w));
  const parentLeft = Math.min(...family.parents.map((card) => card.x));
  const childLeft = Math.min(...family.children.map((card) => card.x));
  const parentRight = Math.max(...family.parents.map((card) => card.x + card.w));
  if (parentLeft > childRight) {
    return { low: childRight, high: parentLeft, fromLeft: true as const };
  }
  if (childLeft > parentRight) {
    return { low: parentRight, high: childLeft, fromLeft: false as const };
  }
  return { low: childLeft - CONNECTOR_EDGE * 2, high: childLeft, fromLeft: true as const };
}

function gutterKey(family: ConnectorFamily) {
  return `${Math.round(family.childX)}:${Math.round(family.parentX)}`;
}

function stackedParents(parents: ConnectorCard[]): boolean {
  if (parents.length < 2) return false;
  const sorted = [...parents].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  if (sorted.some((card) => Math.abs(card.x - sorted[0].x) > 0.5)) return false;
  for (let index = 1; index < sorted.length; index++) {
    const gap = sorted[index].y - (sorted[index - 1].y + sorted[index - 1].h);
    if (gap > 8) return false;
  }
  return true;
}

function assignLanes(families: ConnectorFamily[]): {
  xs: Map<string, number>;
  requiredColumnGap: number | null;
} {
  const xs = new Map<string, number>();
  let maxLanes = 1;

  const groups = new Map<string, ConnectorFamily[]>();
  for (const family of families) {
    const key = gutterKey(family);
    const list = groups.get(key) ?? [];
    list.push(family);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.y1 - b.y1 || a.key.localeCompare(b.key));
    const lows = sorted.map((family) => gutterBounds(family).low);
    const highs = sorted.map((family) => gutterBounds(family).high);
    const low = Math.min(...lows);
    const high = Math.max(...highs);
    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();
    for (const family of sorted) {
      let lane = 0;
      while (lane < laneEnds.length && family.y1 < laneEnds[lane] + 0.5) lane += 1;
      laneEnds[lane] = Math.max(laneEnds[lane] ?? Number.NEGATIVE_INFINITY, family.y2);
      laneOf.set(family.key, lane);
      maxLanes = Math.max(maxLanes, lane + 1);
    }
    const laneCount = Math.max(1, laneEnds.length);
    const block = (laneCount - 1) * CONNECTOR_LANE;
    const start = Math.round((low + high - block) / 2);
    for (const family of sorted) {
      const lane = laneOf.get(family.key) ?? 0;
      xs.set(family.key, start + lane * CONNECTOR_LANE);
    }
  }

  const needed = CONNECTOR_EDGE * 2 + Math.max(0, maxLanes - 1) * CONNECTOR_LANE;
  const currentGap = families.length === 0 ? null : Math.min(...families.map((family) => {
    const gutter = gutterBounds(family);
    return gutter.high - gutter.low;
  }));
  const requiredColumnGap =
    currentGap != null && needed > currentGap + 0.5 ? needed : null;
  return { xs, requiredColumnGap };
}

export type CoupleBracket = {
  key: string;
  parentIds: string[];
  x: number;
  y1: number;
  y2: number;
  midY: number;
  lane: number;
  d: string;
  parents: ConnectorCard[];
};

function coupleKeyOf(a: string, b: string) {
  return [a, b].sort().join("+");
}

export function coupleBracketGeom(a: ConnectorCard, b: ConnectorCard, lane = 0): CoupleBracket {
  const upper = a.y <= b.y ? a : b;
  const lower = a.y <= b.y ? b : a;
  const left = Math.min(upper.x, lower.x);
  const x = Math.round(left - CONNECTOR_BRACKET * (lane + 1));
  const y1 = Math.round(midY(upper));
  const y2 = Math.round(midY(lower));
  const parentIds = [a.id, b.id].sort();
  return {
    key: parentIds.join("+"),
    parentIds,
    x,
    y1,
    y2,
    midY: Math.round((y1 + y2) / 2),
    lane,
    d: `M ${Math.round(upper.x)} ${y1} H ${x} V ${y2} H ${Math.round(lower.x)}`,
    parents: [upper, lower],
  };
}

function listedCouples(cards: ConnectorCard[]): Array<[ConnectorCard, ConnectorCard]> {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const seen = new Set<string>();
  const pairs: Array<[ConnectorCard, ConnectorCard]> = [];
  for (const card of cards) {
    for (const spouseId of card.spouseIds) {
      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      const key = coupleKeyOf(card.id, spouseId);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(card.y <= spouse.y ? [card, spouse] : [spouse, card]);
    }
  }
  return pairs.sort((a, b) => a[0].y - b[0].y || a[0].id.localeCompare(b[0].id));
}

function assignCoupleLanes(pairs: Array<[ConnectorCard, ConnectorCard]>): Map<string, number> {
  const lanes = new Map<string, number>();
  const columns = new Map<number, Array<[ConnectorCard, ConnectorCard]>>();
  for (const pair of pairs) {
    const x = Math.round(Math.min(pair[0].x, pair[1].x));
    const list = columns.get(x) ?? [];
    list.push(pair);
    columns.set(x, list);
  }
  for (const group of columns.values()) {
    const items = group
      .map((pair) => ({
        pair,
        key: coupleKeyOf(pair[0].id, pair[1].id),
        y1: Math.round(midY(pair[0])),
        y2: Math.round(midY(pair[1])),
      }))
      .sort((a, b) => a.y1 - b.y1 || a.key.localeCompare(b.key));
    const laneEnds: number[] = [];
    for (const item of items) {
      let lane = 0;
      while (lane < laneEnds.length && item.y1 <= laneEnds[lane] + 0.5) lane += 1;
      laneEnds[lane] = Math.max(laneEnds[lane] ?? Number.NEGATIVE_INFINITY, item.y2);
      lanes.set(item.key, lane);
    }
  }
  return lanes;
}

export function coupleBrackets(cards: ConnectorCard[]): CoupleBracket[] {
  const pairs = listedCouples(cards);
  const lanes = assignCoupleLanes(pairs);
  return pairs.map((pair) => coupleBracketGeom(pair[0], pair[1], lanes.get(coupleKeyOf(pair[0].id, pair[1].id)) ?? 0));
}

function attachX(card: ConnectorCard, trunkX: number) {
  return Math.round(card.x + card.w / 2 <= trunkX ? card.x + card.w : card.x);
}

function identityPath(
  path: Omit<ConnectorPath, "familyId" | "familyKey" | "fromIds" | "toIds"> & {
    familyId: string;
    fromIds: string[];
    toIds: string[];
  },
): ConnectorPath {
  return {
    ...path,
    familyKey: path.familyId,
  };
}

type FamilyDraw = ConnectorFamily & {
  trunkX: number;
  stacked: boolean;
  bracket: CoupleBracket | null;
  bracketX: number;
  linkY: number;
};

function buildFamilyDraws(cards: ConnectorCard[]): {
  draws: FamilyDraw[];
  brackets: CoupleBracket[];
  requiredColumnGap: number | null;
} {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const families = chartFamilies(cards);
  const brackets = coupleBrackets(cards);
  const bracketByKey = new Map(brackets.map((item) => [item.key, item]));
  const { xs, requiredColumnGap } = assignLanes(families);
  const draws: FamilyDraw[] = [];
  for (const family of families) {
    const parents = family.parentIds
      .map((id) => byId.get(id))
      .filter((card): card is ConnectorCard => Boolean(card))
      .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    const children = family.childIds
      .map((id) => byId.get(id))
      .filter((card): card is ConnectorCard => Boolean(card));
    if (parents.length === 0 || children.length === 0) continue;
    const trunkX = xs.get(family.key);
    if (trunkX == null) continue;
    const coupleBracket =
      parents.length === 2 ? (bracketByKey.get(coupleKeyOf(parents[0].id, parents[1].id)) ?? null) : null;
    const left = Math.min(...parents.map((card) => card.x));
    draws.push({
      ...family,
      parents,
      children,
      trunkX,
      stacked: stackedParents(parents),
      bracket: coupleBracket,
      bracketX: coupleBracket?.x ?? left - CONNECTOR_BRACKET,
      linkY: coupleBracket?.midY ?? Math.round(family.parentLinkY),
    });
  }
  return { draws, brackets, requiredColumnGap };
}

function continueTo(d: string, x: number, y: number): string {
  const at = pathEnd(d);
  if (!at) return d;
  const tx = Math.round(x);
  const ty = Math.round(y);
  if (at.x === tx && at.y === ty) return d;
  if (at.y === ty) return `${d} H ${tx}`;
  if (at.x === tx) return `${d} V ${ty}`;
  return `${d} V ${ty} H ${tx}`;
}

function pathEnd(d: string): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  let seen = false;
  const parts = d.split(/(?=[MVH])/);
  for (const part of parts) {
    if (!part) continue;
    const cmd = part[0];
    const nums = part
      .slice(1)
      .trim()
      .split(/[ ,]+/)
      .filter(Boolean)
      .map(Number);
    if (cmd === "M") {
      x = nums[0];
      y = nums[1];
      seen = true;
    } else if (cmd === "V") {
      y = nums[0];
      seen = true;
    } else if (cmd === "H") {
      x = nums[0];
      seen = true;
    }
  }
  return seen ? { x, y } : null;
}

function parentsToChildPath(fam: FamilyDraw, child: ConnectorCard): string {
  const childY = Math.round(midY(child));
  const childA = attachX(child, fam.trunkX);
  if (fam.bracket) {
    let d = fam.bracket.d;
    d = continueTo(d, fam.bracket.x, fam.bracket.y2);
    d = continueTo(d, fam.bracket.x, fam.bracket.midY);
    d = continueTo(d, fam.trunkX, fam.bracket.midY);
    d = continueTo(d, fam.trunkX, childY);
    d = continueTo(d, childA, childY);
    return d;
  }
  if (fam.stacked && fam.parents.length >= 2) {
    const fallback = coupleBracketGeom(fam.parents[0], fam.parents[fam.parents.length - 1]);
    let d = fallback.d;
    d = continueTo(d, fallback.x, fallback.midY);
    d = continueTo(d, fam.trunkX, fallback.midY);
    d = continueTo(d, fam.trunkX, childY);
    d = continueTo(d, childA, childY);
    return d;
  }
  const first = fam.parents[0];
  if (!first) return "";
  let d = `M ${attachX(first, fam.trunkX)} ${Math.round(midY(first))} H ${fam.trunkX}`;
  for (const parent of fam.parents.slice(1)) {
    const y = Math.round(midY(parent));
    const from = attachX(parent, fam.trunkX);
    d = continueTo(d, fam.trunkX, y);
    d = continueTo(d, from, y);
    d = continueTo(d, fam.trunkX, y);
  }
  d = continueTo(d, fam.trunkX, childY);
  d = continueTo(d, childA, childY);
  return d;
}

function moveCount(d: string): number {
  return d.match(/\bM\b/g)?.length ?? 0;
}

function neighborhoodIds(cards: ConnectorCard[], personId: string | null): Set<string> {
  const ids = new Set<string>();
  if (!personId) return ids;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const card = byId.get(personId);
  if (!card) return ids;
  ids.add(personId);
  for (const id of card.parentIds) if (byId.has(id)) ids.add(id);
  for (const id of card.spouseIds) if (byId.has(id)) ids.add(id);
  for (const other of cards) {
    if (other.parentIds.includes(personId)) ids.add(other.id);
  }
  for (const id of [...ids]) {
    const person = byId.get(id);
    if (!person) continue;
    for (const spouseId of person.spouseIds) if (byId.has(spouseId)) ids.add(spouseId);
  }
  return ids;
}

export function focusHighlightPaths(cards: ConnectorCard[], personId: string | null): ConnectorPath[] {
  if (!personId) return [];
  const hotIds = neighborhoodIds(cards, personId);
  const { draws, brackets } = buildFamilyDraws(cards);
  const paths: ConnectorPath[] = [];
  const drawnCouples = new Set<string>();

  for (const fam of draws) {
    const parentIds = fam.parents.map((card) => card.id);
    const asChild = fam.children.find((card) => card.id === personId);
    const asParent = fam.parentIds.includes(personId);
    if (asChild) {
      const d = parentsToChildPath(fam, asChild);
      if (d && moveCount(d) === 1) {
        paths.push(identityPath({
          key: `focus-up-${fam.key}`,
          d,
          familyId: fam.key,
          role: "parent",
          fromIds: parentIds,
          toIds: [personId],
          parentIds,
          childIds: [personId],
        }));
        drawnCouples.add([...parentIds].sort().join("+"));
      }
    }
    if (asParent) {
      drawnCouples.add([...parentIds].sort().join("+"));
      for (const child of fam.children) {
        const d = parentsToChildPath(fam, child);
        if (!d || moveCount(d) !== 1) continue;
        paths.push(identityPath({
          key: `focus-down-${fam.key}-${child.id}`,
          d,
          familyId: fam.key,
          role: "child",
          fromIds: parentIds,
          toIds: [child.id],
          parentIds,
          childIds: [child.id],
        }));
      }
    }
  }

  for (const bracket of brackets) {
    const coupleLit =
      bracket.parentIds.length >= 2 && bracket.parentIds.every((id) => hotIds.has(id));
    if (drawnCouples.has(bracket.key) || (!coupleLit && !bracket.parentIds.includes(personId))) continue;
    paths.push(identityPath({
      key: `focus-bracket-${bracket.key}`,
      d: bracket.d,
      familyId: bracket.key,
      role: "bracket",
      fromIds: bracket.parentIds,
      toIds: bracket.parentIds,
      parentIds: bracket.parentIds,
      childIds: [],
    }));
  }
  return paths;
}

export function focusHighlightIds(cards: ConnectorCard[], personId: string | null): Set<string> {
  const ids = new Set<string>();
  if (!personId) return ids;
  const onChart = new Set(cards.map((card) => card.id));
  ids.add(personId);
  for (const path of focusHighlightPaths(cards, personId)) {
    for (const id of [...path.fromIds, ...path.toIds, ...path.parentIds, ...path.childIds]) {
      if (onChart.has(id)) ids.add(id);
    }
  }
  return ids;
}

export function connectorLayout(cards: ConnectorCard[]): ConnectorLayout {
  const { draws, brackets, requiredColumnGap } = buildFamilyDraws(cards);
  const paths: ConnectorPath[] = [];

  for (const bracket of brackets) {
    paths.push(identityPath({
      key: `bracket-${bracket.key}`,
      d: bracket.d,
      familyId: bracket.key,
      role: "bracket",
      fromIds: bracket.parentIds,
      toIds: bracket.parentIds,
      parentIds: bracket.parentIds,
      childIds: [],
    }));
  }

  for (const fam of draws) {
    const familyId = fam.key;
    const parentIds = fam.parents.map((card) => card.id);
    const childIds = fam.children.map((card) => card.id);
    const y1 = Math.round(fam.y1);
    const y2 = Math.round(fam.y2);
    if (y2 > y1) {
      paths.push(identityPath({
        key: `trunk-${familyId}`,
        d: `M ${fam.trunkX} ${y1} V ${y2}`,
        familyId,
        role: "trunk",
        fromIds: parentIds,
        toIds: childIds,
        parentIds,
        childIds,
      }));
    }

    if (fam.bracket) {
      if (Math.abs(fam.bracket.x - fam.trunkX) >= 0.5) {
        paths.push(identityPath({
          key: `parent-${familyId}`,
          d: `M ${fam.bracket.x} ${fam.bracket.midY} H ${fam.trunkX}`,
          familyId,
          role: "parent",
          fromIds: parentIds,
          toIds: childIds,
          parentIds,
          childIds,
        }));
      }
    } else {
      for (const parent of fam.parents) {
        const y = Math.round(midY(parent));
        const from = attachX(parent, fam.trunkX);
        if (Math.abs(from - fam.trunkX) < 0.5) continue;
        paths.push(identityPath({
          key: `parent-${familyId}-${parent.id}`,
          d: `M ${from} ${y} H ${fam.trunkX}`,
          familyId,
          role: "parent",
          fromIds: [parent.id],
          toIds: childIds,
          parentIds,
          childIds,
        }));
      }
    }

    for (const child of fam.children) {
      const y = Math.round(midY(child));
      const from = attachX(child, fam.trunkX);
      if (Math.abs(from - fam.trunkX) < 0.5) continue;
      paths.push(identityPath({
        key: `child-${familyId}-${child.id}`,
        d: `M ${from} ${y} H ${fam.trunkX}`,
        familyId,
        role: "child",
        fromIds: [child.id],
        toIds: parentIds,
        parentIds,
        childIds: [child.id],
      }));
    }
  }

  return { paths: gapCrossingVerticals(paths), requiredColumnGap };
}

export function familyTrunks(cards: ConnectorCard[]): { key: string; d: string }[] {
  return connectorLayout(cards).paths.map((path) => ({ key: path.key, d: path.d }));
}

function parseSegments(path: ConnectorPath): Segment[] {
  const segs: Segment[] = [];
  let x = 0;
  let y = 0;
  const parts = path.d.split(/(?=[MVH])/);
  for (const part of parts) {
    if (!part) continue;
    const cmd = part[0];
    const nums = part
      .slice(1)
      .trim()
      .split(/[ ,]+/)
      .filter(Boolean)
      .map(Number);
    if (cmd === "M") {
      x = nums[0];
      y = nums[1];
    } else if (cmd === "V") {
      segs.push({
        familyKey: path.familyKey,
        role: path.role,
        parentIds: path.parentIds,
        childIds: path.childIds,
        x1: x,
        y1: y,
        x2: x,
        y2: nums[0],
      });
      y = nums[0];
    } else if (cmd === "H") {
      segs.push({
        familyKey: path.familyKey,
        role: path.role,
        parentIds: path.parentIds,
        childIds: path.childIds,
        x1: x,
        y1: y,
        x2: nums[0],
        y2: y,
      });
      x = nums[0];
    }
  }
  return segs;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(value) < 0.01) return 0;
  return value > 0 ? 1 : 2;
}

function collinearOverlap(a: Segment, b: Segment): number {
  if (isVertical(a) && isVertical(b) && Math.abs(a.x1 - b.x1) < 0.5) {
    return yOverlap(a.y1, a.y2, b.y1, b.y2);
  }
  const aH = Math.abs(a.y1 - a.y2) < 0.5 && Math.abs(a.x1 - a.x2) > 0.5;
  const bH = Math.abs(b.y1 - b.y2) < 0.5 && Math.abs(b.x1 - b.x2) > 0.5;
  if (aH && bH && Math.abs(a.y1 - b.y1) < 0.5) {
    const left = Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
    const right = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2));
    return right - left;
  }
  return 0;
}

function properIntersect(a: Segment, b: Segment): boolean {
  const o1 = orientation(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orientation(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orientation(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orientation(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  if (o1 !== o2 && o3 !== o4) {
    const shareEnd =
      (Math.abs(a.x1 - b.x1) < 0.5 && Math.abs(a.y1 - b.y1) < 0.5) ||
      (Math.abs(a.x1 - b.x2) < 0.5 && Math.abs(a.y1 - b.y2) < 0.5) ||
      (Math.abs(a.x2 - b.x1) < 0.5 && Math.abs(a.y2 - b.y1) < 0.5) ||
      (Math.abs(a.x2 - b.x2) < 0.5 && Math.abs(a.y2 - b.y2) < 0.5);
    return !shareEnd;
  }
  return collinearOverlap(a, b) > 0.5;
}

function isVertical(seg: Segment) {
  return Math.abs(seg.x1 - seg.x2) < 0.5 && Math.abs(seg.y1 - seg.y2) > 0.5;
}

function yOverlap(a1: number, a2: number, b1: number, b2: number) {
  const top = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const bottom = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  return bottom - top;
}

function familiesSharePerson(a: Segment, b: Segment): boolean {
  return (
    a.parentIds.some((id) => b.parentIds.includes(id) || b.childIds.includes(id)) ||
    a.childIds.some((id) => b.parentIds.includes(id) || b.childIds.includes(id))
  );
}

function splitVertical(seg: Segment, cuts: number[]): Segment[] {
  const lo = Math.min(seg.y1, seg.y2);
  const hi = Math.max(seg.y1, seg.y2);
  const gap = 2.5;
  let ranges = [{ top: lo, bottom: hi }];
  for (const cut of cuts) {
    const next: Array<{ top: number; bottom: number }> = [];
    for (const range of ranges) {
      const g1 = cut - gap;
      const g2 = cut + gap;
      if (g2 <= range.top + 0.01 || g1 >= range.bottom - 0.01) {
        next.push(range);
        continue;
      }
      if (g1 > range.top + 0.5) next.push({ top: range.top, bottom: g1 });
      if (g2 < range.bottom - 0.5) next.push({ top: g2, bottom: range.bottom });
    }
    ranges = next;
  }
  return ranges
    .filter((range) => range.bottom - range.top > 0.5)
    .map((range) => ({ ...seg, y1: range.top, y2: range.bottom, x1: seg.x1, x2: seg.x2 }));
}

function gapCrossingVerticals(paths: ConnectorPath[]): ConnectorPath[] {
  const segs = paths.flatMap(parseSegments);
  const horizontals = segs.filter((seg) => Math.abs(seg.y1 - seg.y2) < 0.5 && Math.abs(seg.x1 - seg.x2) > 0.5);
  const out: ConnectorPath[] = [];
  for (const path of paths) {
    if (path.role === "bracket") {
      out.push(path);
      continue;
    }
    const pieces = parseSegments(path);
    if (pieces.length === 0) {
      out.push(path);
      continue;
    }
    const rebuilt: Segment[] = [];
    for (const piece of pieces) {
      if (!isVertical(piece)) {
        rebuilt.push(piece);
        continue;
      }
      const cuts = horizontals
        .filter((seg) => seg.familyKey !== piece.familyKey && properIntersect(piece, seg))
        .map((seg) => seg.y1);
      if (cuts.length === 0) rebuilt.push(piece);
      else rebuilt.push(...splitVertical(piece, cuts));
    }
    const verticals: Segment[] = [];
    const horizontalsOut: Segment[] = [];
    for (const seg of rebuilt) {
      if (isVertical(seg)) verticals.push(seg);
      else horizontalsOut.push(seg);
    }
    if (path.role === "trunk" && verticals.length > 0) {
      out.push({
        ...path,
        d: verticals
          .map((seg) => `M ${Math.round(seg.x1)} ${Math.round(seg.y1)} V ${Math.round(seg.y2)}`)
          .join(" "),
      });
      continue;
    }
    const rebuiltAll = [...horizontalsOut, ...verticals];
    if (rebuiltAll.length === 1) {
      const seg = rebuiltAll[0];
      const vertical = isVertical(seg);
      out.push({
        ...path,
        d: vertical
          ? `M ${seg.x1} ${Math.round(seg.y1)} V ${Math.round(seg.y2)}`
          : `M ${seg.x1} ${Math.round(seg.y1)} H ${Math.round(seg.x2)}`,
      });
      continue;
    }
    rebuiltAll.forEach((seg, index) => {
      const vertical = isVertical(seg);
      out.push({
        ...path,
        key: `${path.key}:${index}`,
        d: vertical
          ? `M ${Math.round(seg.x1)} ${Math.round(seg.y1)} V ${Math.round(seg.y2)}`
          : `M ${Math.round(seg.x1)} ${Math.round(seg.y1)} H ${Math.round(seg.x2)}`,
      });
    });
  }
  return out;
}

export function connectorPoints(paths: ConnectorPath[]): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (const path of paths) {
    for (const seg of parseSegments(path)) {
      points.push({ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
    }
  }
  return points;
}

export type ConnectorValidation = {
  crossings: string[];
  closeParallels: string[];
  parentLinkCounts: Record<string, number>;
  endpointMismatches: string[];
};

function pointHitsCard(x: number, y: number, card: ConnectorCard): boolean {
  return (
    x >= card.x - 0.5 &&
    x <= card.x + card.w + 0.5 &&
    y >= card.y - 0.5 &&
    y <= card.y + card.h + 0.5
  );
}

export function connectorEndpointMismatches(
  paths: ConnectorPath[],
  cards: ConnectorCard[],
  nameOf: (id: string) => string = (id) => id,
): string[] {
  const mismatches: string[] = [];
  for (const path of paths) {
    const family = new Set([...path.fromIds, ...path.toIds, ...path.parentIds, ...path.childIds]);
    const names = [...family].map(nameOf).join(", ");
    for (const point of connectorPoints([path])) {
      const hit = cards.find((card) => pointHitsCard(point.x, point.y, card));
      if (!hit || family.has(hit.id)) continue;
      mismatches.push(
        `${path.key}: endpoint hits ${nameOf(hit.id)} but path is ${names || path.familyId}`,
      );
    }
    if (path.role === "child") {
      for (const id of path.fromIds) {
        const card = cards.find((item) => item.id === id);
        if (!card) {
          mismatches.push(`${path.key}: missing card for ${nameOf(id)}`);
          continue;
        }
        const touches = connectorPoints([path]).some((point) => pointHitsCard(point.x, point.y, card));
        if (!touches) mismatches.push(`${path.key}: endpoints miss ${nameOf(id)}`);
      }
    } else if (path.role === "bracket" && !/:\d+$/.test(path.key)) {
      for (const id of path.fromIds) {
        const card = cards.find((item) => item.id === id);
        if (!card) {
          mismatches.push(`${path.key}: missing card for ${nameOf(id)}`);
          continue;
        }
        const touches = connectorPoints([path]).some((point) => pointHitsCard(point.x, point.y, card));
        if (!touches) mismatches.push(`${path.key}: endpoints miss ${nameOf(id)}`);
      }
    }
  }
  return mismatches;
}

export function validateConnectors(cards: ConnectorCard[]): ConnectorValidation {
  const layout = connectorLayout(cards);
  const segs = layout.paths.flatMap(parseSegments);
  const crossings: string[] = [];
  const closeParallels: string[] = [];

  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i];
      const b = segs[j];
      if (a.familyKey === b.familyKey || familiesSharePerson(a, b)) continue;
      if (properIntersect(a, b)) {
        crossings.push(`${a.familyKey} × ${b.familyKey}`);
      }
      if (isVertical(a) && isVertical(b) && yOverlap(a.y1, a.y2, b.y1, b.y2) > 0.5) {
        const gap = Math.abs(a.x1 - b.x1);
        if (gap < 0.5) {
          closeParallels.push(`${a.familyKey} ∥ ${b.familyKey} (shared lane)`);
        } else if (a.role === "trunk" && b.role === "trunk" && gap < CONNECTOR_LANE - 0.5) {
          closeParallels.push(`${a.familyKey} ∥ ${b.familyKey} (${gap}px)`);
        }
      }
    }
  }

  const parentLinkCounts: Record<string, number> = {};
  for (const path of layout.paths) {
    if (path.role !== "parent") continue;
    parentLinkCounts[path.familyKey] = (parentLinkCounts[path.familyKey] ?? 0) + 1;
  }
  for (const family of chartFamilies(cards)) {
    if (parentLinkCounts[family.key] == null) parentLinkCounts[family.key] = 0;
  }

  return {
    crossings,
    closeParallels,
    parentLinkCounts,
    endpointMismatches: connectorEndpointMismatches(layout.paths, cards),
  };
}

export function hotConnectorKeys(paths: ConnectorPath[], personId: string | null): Set<string> {
  const hot = new Set<string>();
  if (!personId) return hot;
  for (const path of paths) {
    const parentLink =
      (path.role === "child" && path.fromIds.includes(personId)) ||
      (path.role === "parent" && path.toIds.includes(personId));
    const spouseBracket = path.role === "bracket" && path.fromIds.includes(personId);
    const childrenTrunk = path.role === "trunk" && path.parentIds.includes(personId);
    if (parentLink || spouseBracket || childrenTrunk) hot.add(path.key);
  }
  return hot;
}
