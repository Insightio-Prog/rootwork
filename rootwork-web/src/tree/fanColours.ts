import { parseYear, type Person } from "../data/people";
import { heritageLabel, nationOf, UNKNOWN_KEY } from "./heritage";
import { HERITAGE_COLOURS, otherColour } from "./heritageColours";

export type FanColourMode = "branch" | "heritage" | "era" | "lifespan";
export type Swatch = { key: string; label: string; bg: string; fg: string };

const DARK = "#3a2d22";
const LIGHT = "#ffffff";

/** Picks readable text for a hex background. */
export function textOn(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? DARK : LIGHT;
}

function swatch(key: string, label: string, bg: string): Swatch {
  return { key, label, bg, fg: textOn(bg) };
}

const NO_DATA = "#cfc3b2";

// Older is darker: a single earthy ramp so the eye reads "how far back" without a key.
export const ERAS: Swatch[] = [
  swatch("pre1800", "Before 1800", "#5d4a73"),
  swatch("1800", "1800 – 1849", "#7b6a99"),
  swatch("1850", "1850 – 1899", "#8aa0bf"),
  swatch("1900", "1900 – 1949", "#9cc0b4"),
  swatch("1950", "1950 onwards", "#e6d79a"),
  swatch("none", "No birth year", NO_DATA),
];

export function eraOf(person: Person): Swatch {
  const year = parseYear(person.birth);
  if (year == null) return ERAS[5];
  if (year < 1800) return ERAS[0];
  if (year < 1850) return ERAS[1];
  if (year < 1900) return ERAS[2];
  if (year < 1950) return ERAS[3];
  return ERAS[4];
}

export const LIFESPANS: Swatch[] = [
  swatch("young", "Under 20", "#c9776a"),
  swatch("20s", "20 – 39", "#dca27a"),
  swatch("40s", "40 – 59", "#e6d79a"),
  swatch("60s", "60 – 79", "#a7c4a0"),
  swatch("80s", "80 or more", "#6f9a8a"),
  swatch("living", "Living", "#d8cdbb"),
  swatch("none", "Age not known", NO_DATA),
];

export function ageAtDeath(person: Person): number | null {
  const born = parseYear(person.birth);
  const died = parseYear(person.death);
  if (born == null || died == null) return null;
  const age = died - born;
  return age >= 0 && age <= 120 ? age : null;
}

export function lifespanOf(person: Person): Swatch {
  if (person.living) return LIFESPANS[5];
  const age = ageAtDeath(person);
  if (age == null) return LIFESPANS[6];
  if (age < 20) return LIFESPANS[0];
  if (age < 40) return LIFESPANS[1];
  if (age < 60) return LIFESPANS[2];
  if (age < 80) return LIFESPANS[3];
  return LIFESPANS[4];
}

export function heritageSwatch(person: Person): Swatch {
  const key = nationOf(person) ?? UNKNOWN_KEY;
  const preset = HERITAGE_COLOURS[key];
  const bg = preset?.bg ?? otherColour(key);
  return { key, label: heritageLabel(key), bg, fg: preset?.fg ?? textOn(bg) };
}

export function swatchFor(person: Person, mode: FanColourMode): Swatch | null {
  if (mode === "heritage") return heritageSwatch(person);
  if (mode === "era") return eraOf(person);
  if (mode === "lifespan") return lifespanOf(person);
  return null;
}

/** Mirrors the four branch colours in the stylesheet, for the legend. */
export const BRANCH_SWATCHES = [
  "var(--color-accent-200)",
  "color-mix(in srgb, var(--color-accent-100) 72%, var(--color-neutral-200))",
  "var(--color-accent-2-200)",
  "color-mix(in srgb, var(--color-accent-200) 42%, var(--color-neutral-100))",
];
