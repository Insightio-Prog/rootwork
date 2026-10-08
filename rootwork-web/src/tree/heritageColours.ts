import { UNKNOWN_KEY } from "./heritage";

// Soft, earthy versions of the national colours so they sit with the cream and terracotta of the app.
export const HERITAGE_COLOURS: Record<string, { bg: string; fg: string }> = {
  "gb-eng": { bg: "#f7efe0", fg: "#4a3a2a" },
  ie: { bg: "#8aa987", fg: "#27381f" },
  "gb-wls": { bg: "#c9776a", fg: "#ffffff" },
  "gb-sct": { bg: "#7f9ebb", fg: "#17283a" },
  [UNKNOWN_KEY]: { bg: "#a98467", fg: "#ffffff" },
};
export const OTHER_HERITAGE = ["#a395bd", "#d2b072", "#7fb0b0", "#bf8aa3", "#a2ad7a", "#93a0b5"];

/** The same colour every time for a nation that has no preset. */
export function otherColour(key: string): string {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return OTHER_HERITAGE[hash % OTHER_HERITAGE.length];
}
