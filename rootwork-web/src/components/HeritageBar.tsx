import { useMemo } from "react";
import type { Person } from "../data/people";
import { computeHeritage, UNKNOWN_KEY } from "../tree/heritage";

const COLOURS: Record<string, { bg: string; fg: string }> = {
  "gb-eng": { bg: "#ffffff", fg: "#2b2724" },
  ie: { bg: "#3f9b5f", fg: "#ffffff" },
  "gb-wls": { bg: "#cf4a42", fg: "#ffffff" },
  "gb-sct": { bg: "#3a6fb5", fg: "#ffffff" },
  [UNKNOWN_KEY]: { bg: "#9a6a3f", fg: "#ffffff" },
};
const OTHER = ["#7b6aa8", "#c9962b", "#3b8f94", "#a8567a", "#6f7f3a", "#5d6f8a"];

type HeritageBarProps = {
  people: Record<string, Person>;
  homeId: string;
  panelOpen: boolean;
};

/** The home person's heritage as one bar: each nation's width is its share of their ancestry. */
export function HeritageBar({ people, homeId, panelOpen }: HeritageBarProps) {
  const shares = useMemo(() => computeHeritage(people, homeId), [people, homeId]);
  if (shares.length === 0) return null;
  let other = 0;
  const parts = shares.map((item) => {
    const preset = COLOURS[item.key];
    const colour = preset ?? { bg: OTHER[other++ % OTHER.length], fg: "#ffffff" };
    return { ...item, ...colour, percent: Math.round(item.share * 100) };
  });
  const summary = parts.map((part) => `${part.percent}% ${part.label}`).join(", ");

  return (
    <div className={`heritage-bar${panelOpen ? " is-panel-open" : ""}`} role="img" aria-label={`Heritage: ${summary}`}>
      <div className="heritage-track">
        {parts.map((part) => (
          <div
            key={part.key}
            className="heritage-seg"
            style={{ flexGrow: part.share, flexBasis: 0, background: part.bg, color: part.fg }}
            title={`${part.percent}% ${part.label}`}
          >
            {part.share >= 0.14 ? (
              <span className="heritage-text">
                <strong>{part.percent}%</strong> {part.label}
              </span>
            ) : part.share >= 0.025 ? (
              <span className="heritage-text is-stacked">
                <strong>{part.percent}%</strong>
                <small>{part.label}</small>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
