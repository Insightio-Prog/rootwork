import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { displayName, initials, yearsLabel, type Person } from "../data/people";
import { IconMenu, IconPlus, IconSearch, IconSettings } from "../icons";

type AppHeaderProps = {
  title: string;
  people: Record<string, Person>;
  homePerson?: Person | null;
  peopleCountLabel?: string;
  onToggleSidebar: () => void;
  onAddPerson?: () => void;
  onOpenSettings: () => void;
  onLocatePerson: (id: string) => void;
};

const RESULT_LIMIT = 8;

function nameMatches(person: Person, needle: string) {
  if (!needle) return false;
  return displayName(person).toLowerCase().includes(needle);
}

export function AppHeader({
  title,
  people,
  homePerson,
  peopleCountLabel,
  onToggleSidebar,
  onAddPerson,
  onOpenSettings,
  onLocatePerson,
}: AppHeaderProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return [];
    return Object.values(people)
      .filter((person) => nameMatches(person, needle))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .slice(0, RESULT_LIMIT);
  }, [people, needle]);

  useEffect(() => {
    setActive(0);
  }, [needle]);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  function pick(id: string) {
    onLocatePerson(id);
    setQuery("");
    setOpen(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const person = matches[active] ?? matches[0];
    if (person) pick(person.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (!matches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % matches.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index - 1 + matches.length) % matches.length);
    }
  }

  return (
    <header className="app-header">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="btn btn-secondary btn-icon"
        style={{ borderRadius: 999 }}
        aria-label="Toggle sidebar"
      >
        <IconMenu />
      </button>
      <h4>{title}</h4>
      {peopleCountLabel && (
        <span className="tag tag-outline people-count">{peopleCountLabel}</span>
      )}
      <div className="header-spacer" />
      <div className="search-pill" ref={boxRef}>
        <IconSearch size={16} />
        <form onSubmit={handleSubmit}>
          <input
            type="search"
            value={query}
            placeholder="Search people…"
            aria-label="Search people"
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
          />
        </form>
        {open && needle ? (
          <div className="search-results" role="listbox">
            {matches.length === 0 ? (
              <div className="search-empty">No matching people</div>
            ) : (
              matches.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`search-result${index === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(person.id)}
                >
                  <span className="search-result-name">{displayName(person)}</span>
                  <span className="search-result-years">{yearsLabel(person)}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      {onAddPerson && (
        <button type="button" className="btn btn-primary add-person-btn" onClick={onAddPerson}>
          <IconPlus size={16} />
          Add person
        </button>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        style={{ borderRadius: 999 }}
        aria-label="Settings"
        onClick={onOpenSettings}
      >
        <IconSettings size={18} />
      </button>
      <div
        className="user-avatar"
        title={homePerson ? displayName(homePerson) : undefined}
        aria-label={homePerson ? `Home person ${displayName(homePerson)}` : "No home person"}
      >
        {homePerson ? initials(homePerson) : "?"}
      </div>
    </header>
  );
}
