import { useMemo } from "react";
import type { Person } from "../data/people";
import { computeHeritage } from "../tree/heritage";
import { HERITAGE_COLOURS as COLOURS, OTHER_HERITAGE as OTHER } from "../tree/heritageColours";

type HeritageBarProps = {
  people: Record<string, Person>;
  homeId: string;
  homeName: string;
  panelOpen: boolean;
};

/** The home person's heritage as one bar: each nation's width is its share of their ancestry. */
export function HeritageBar({ people, homeId, homeName, panelOpen }: HeritageBarProps) {
  const shares = useMemo(() => computeHeritage(people, homeId), [people, homeId]);
  if (shares.length === 0) return null;
  let other = 0;
  const parts = shares.map((item) => {
    const preset = COLOURS[item.key];
    const colour = preset ?? { bg: OTHER[other++ % OTHER.length], fg: "#ffffff" };
    return { ...item, ...colour, percent: Math.round(item.share * 100) };
  });
  const summary = parts.map((part) => `${part.percent}% ${part.label}`).join(", ");
  // Every section gets the width its own label needs, and the rest of the bar is shared out by percentage,
  // so the smallest section can always show its name.
  const base = Math.min(
    150,
    Math.max(76, ...parts.map((part) => Math.round(`${part.percent}% ${part.label}`.length * 7.4 + 22))),
  );

  return (
    <div className={`heritage-bar${panelOpen ? " is-panel-open" : ""}`} role="img" aria-label={`Heritage: ${summary}`}>
      <div className="heritage-caption">
        <strong>Heritage</strong> · share of {homeName}&rsquo;s ancestry by nation, from nationality or birthplace
      </div>
      <div className="heritage-track">
        {parts.map((part) => (
          <div
            key={part.key}
            className="heritage-seg"
            style={{ flex: `${part.share} 1 ${base}px`, background: part.bg, color: part.fg }}
            title={`${part.percent}% ${part.label}`}
          >
            <span className="heritage-text">
              <strong>{part.percent}%</strong> {part.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
