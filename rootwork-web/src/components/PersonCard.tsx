import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { cardName, yearsLabel, type Person } from "../data/people";
import { PersonAvatar } from "./PersonAvatar";
import { PersonFlag } from "./PersonFlag";

type PersonCardProps = {
  person: Person;
  selected: boolean;
  lineHot?: boolean;
  mainLine?: boolean;
  dragging?: boolean;
  onSelect: (id: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>, id: string) => void;
};

export function PersonCard({
  person,
  selected,
  lineHot = false,
  mainLine = false,
  dragging = false,
  onSelect,
  onPointerDown,
  onContextMenu,
}: PersonCardProps) {
  return (
    <button
      type="button"
      className={`person-card${mainLine ? " is-main-line" : ""}${selected ? " is-selected" : ""}${lineHot ? " is-line-hot" : ""}${dragging ? " is-dragging" : ""}`}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (!dragging) onSelect(person.id, event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.(event, person.id);
      }}
    >
      <PersonAvatar person={person} className={`person-mono is-${person.gender}`} />
      <div className="person-copy">
        <div className="person-name">{cardName(person)}</div>
        <div className="person-meta">
          <div className="person-years">{yearsLabel(person)}</div>
          <PersonFlag flag={person.flag ?? null} nationality={person.nationality} birthPlace={person.birthPlace} layoutId="tree-flag" />
        </div>
      </div>
    </button>
  );
}
