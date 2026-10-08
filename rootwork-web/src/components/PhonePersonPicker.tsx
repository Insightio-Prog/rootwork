import { useEffect, useMemo, useRef, useState } from "react";
import { displayName, yearsLabel, type Person } from "../data/people";
import { IconSearch } from "../icons";
import { PersonAvatar } from "./PersonAvatar";

type PhonePersonPickerProps = {
  people: Record<string, Person>;
  homePersonId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
};

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

/** Search the tree by name and choose a new home person. */
export function PhonePersonPicker({ people, homePersonId, onPick, onClose }: PhonePersonPickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return Object.values(people)
      .filter((person) => {
        const hay = fold(`${displayName(person)} ${person.birthPlace ?? ""}`);
        return words.every((word) => hay.includes(word));
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .slice(0, 60);
  }, [people, query]);

  const home = homePersonId ? people[homePersonId] : undefined;

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <div
        className="dialog phone-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-title" id="phone-picker-title">
          Change home person
        </div>
        {home && <p className="phone-picker-now">Now: {displayName(home)}</p>}
        <label className="phone-picker-search">
          <IconSearch size={16} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Search by name…"
            aria-label="Search people by name"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="phone-picker-list">
          {query.trim() === "" ? (
            <p className="phone-picker-hint">Type a name to find someone in the tree.</p>
          ) : matches.length === 0 ? (
            <p className="phone-picker-hint">No one matches “{query.trim()}”.</p>
          ) : (
            matches.map((person) => (
              <button key={person.id} type="button" className="phone-row" onClick={() => onPick(person.id)}>
                <PersonAvatar person={person} className={`person-mono is-${person.gender}`} />
                <span className="phone-row-copy">
                  <span className="phone-row-name">{displayName(person)}</span>
                  <span className="phone-row-meta">
                    {yearsLabel(person)}
                    {person.birthPlace ? ` · ${person.birthPlace}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
