import { displayName, yearsLabel, type Person } from "../data/people";
import { arcPath, polar, textRotation } from "./fan";

const CHAR_RATIO = 0.56;
const MIN_FONT = 6.75;

export type FanLabelLine = {
  text: string;
  years: boolean;
};

export type FanSegmentLabel =
  | {
      mode: "arc";
      fontSize: number;
      lines: (FanLabelLine & { id: string; d: string })[];
    }
  | {
      mode: "radial";
      fontSize: number;
      lines: FanLabelLine[];
      x: number;
      y: number;
      rotation: number;
    };

function compactYears(person: Person): string | null {
  const label = yearsLabel(person);
  if (label === "Dates unknown") return null;
  return label.replace(/ – /g, "–");
}

function maxCharsFor(width: number, fontSize: number): number {
  return Math.max(1, Math.floor((width - 6) / (fontSize * CHAR_RATIO)));
}

function wrapToWidth(text: string, maxChars: number, maxLines: number): string[] {
  if (maxChars < 1 || maxLines < 1 || !text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  function flush() {
    if (!current) return;
    lines.push(current);
    current = "";
  }

  for (const word of words) {
    if (lines.length >= maxLines) break;
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    flush();
    if (lines.length >= maxLines) break;
    if (word.length <= maxChars) {
      current = word;
      continue;
    }
    let rest = word;
    while (rest.length > maxChars && lines.length < maxLines) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    if (lines.length < maxLines) current = rest;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function buildCopy(
  person: Person | null,
  role: "father" | "mother",
  maxChars: number,
  maxLines: number,
  canAdd: boolean,
): FanLabelLine[] {
  if (maxLines < 1 || maxChars < 3) return [];

  if (!person) {
    if (!canAdd) return [];
    if (maxLines >= 2 && maxChars >= 6) {
      return [
        { text: "Add", years: false },
        { text: role === "father" ? "father" : "mother", years: false },
      ];
    }
    if (maxChars >= 10) return [{ text: role === "father" ? "Add father" : "Add mother", years: false }];
    if (maxChars >= 6) return [{ text: role === "father" ? "Father" : "Mother", years: false }];
    return [];
  }

  const given = person.givenName.trim();
  const family = person.familyName.trim();
  const years = compactYears(person);
  const lines: FanLabelLine[] = [];

  if (given && family && maxLines >= 3 && given.length <= maxChars && family.length <= maxChars) {
    const givenLines = wrapToWidth(given, maxChars, years ? maxLines - 2 : maxLines - 1);
    lines.push(...givenLines.map((text) => ({ text, years: false })));
    if (family.length <= maxChars && lines.length < maxLines) lines.push({ text: family, years: false });
    if (years && lines.length < maxLines) lines.push({ text: years, years: true });
    return lines;
  }

  if (given && family && maxLines >= 2 && given.length <= maxChars && family.length <= maxChars) {
    lines.push({ text: given, years: false }, { text: family, years: false });
    if (years && maxLines >= 3) lines.push({ text: years, years: true });
    return lines;
  }

  const nameBudget = years && maxLines >= 2 ? maxLines - 1 : maxLines;
  const nameLines = wrapToWidth(displayName(person), maxChars, nameBudget);
  lines.push(...nameLines.map((text) => ({ text, years: false })));
  if (years && lines.length < maxLines) lines.push({ text: years, years: true });
  return lines;
}

export function segmentLabel(options: {
  person: Person | null;
  role: "father" | "mother";
  canAdd: boolean;
  generation: number;
  index: number;
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  a0: number;
  a1: number;
  mid: number;
}): FanSegmentLabel | null {
  const { person, role, canAdd, generation, index, cx, cy, inner, outer, a0, a1, mid } = options;
  const ringW = outer - inner;
  const midR = (inner + outer) / 2;
  const arcLen = midR * Math.abs(a0 - a1);
  if (arcLen < 11 && ringW < 28) return null;

  const useArc = arcLen >= 48 && arcLen > ringW * 1.15;
  const reverse = Math.sin(mid) < 0;

  if (useArc) {
    const maxLines = Math.max(1, Math.min(4, Math.floor((ringW - 10) / 12)));
    let fontSize = Math.min(generation <= 1 ? 13 : generation === 2 ? 12 : 11, ringW / (maxLines + 1.1));
    fontSize = Math.max(MIN_FONT, fontSize);
    let chars = maxCharsFor(arcLen, fontSize);
    if (chars < 4) {
      fontSize = Math.max(MIN_FONT, fontSize * 0.86);
      chars = maxCharsFor(arcLen, fontSize);
    }
    const lines = buildCopy(person, role, chars, maxLines, canAdd);
    if (lines.length === 0) return null;
    const lineHeight = fontSize * 1.22;
    const block = (lines.length - 1) * lineHeight;
    const startR = midR - block / 2;
    return {
      mode: "arc",
      fontSize,
      lines: lines.map((line, lineIndex) => ({
        ...line,
        id: `fan-arc-${generation}-${index}-${lineIndex}`,
        d: arcPath(cx, cy, startR + lineIndex * lineHeight, a0, a1, reverse),
      })),
    };
  }

  const fontSize = Math.max(
    MIN_FONT,
    Math.min(generation <= 2 ? 11 : 9.5, ringW / 4.6, arcLen / 1.35),
  );
  const chars = maxCharsFor(ringW, fontSize);
  const maxLines = Math.max(1, Math.min(4, Math.floor((arcLen - 4) / (fontSize * 1.18))));
  const lines = buildCopy(person, role, chars, maxLines, canAdd);
  if (lines.length === 0) return null;
  const point = polar(cx, cy, midR, mid);
  return {
    mode: "radial",
    fontSize,
    lines,
    x: point.x,
    y: point.y,
    rotation: textRotation(mid),
  };
}
