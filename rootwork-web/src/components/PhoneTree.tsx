import { useEffect, useMemo, useState } from "react";
import {
  childrenOf,
  displayName,
  noteSnippet,
  orderedParents,
  siblingsOf,
  spousesOf,
  yearsLabel,
  type Person,
} from "../data/people";
import { storyFor } from "../stories";
import { computeHeritage } from "../tree/heritage";
import { HERITAGE_COLOURS, otherColour } from "../tree/heritageColours";
import { NotesDialog } from "./NotesDialog";
import { PersonAvatar } from "./PersonAvatar";
import { PersonFlag } from "./PersonFlag";
import { PersonPanel } from "./PersonPanel";

type PhoneTreeProps = {
  people: Record<string, Person>;
  homePersonId: string | null;
  locateId?: string | null;
  locateKey?: number;
  onOpenLifeStory: (id: string) => void;
  onGoToBackup: () => void;
};

const noop = () => undefined;

function PersonRow({ person, role, onOpen }: { person: Person; role?: string; onOpen: (id: string) => void }) {
  const notes = person.stickyNotes ?? [];
  return (
    <button type="button" className="phone-row" onClick={() => onOpen(person.id)}>
      <PersonAvatar person={person} className={`person-mono is-${person.gender}`} />
      <span className="phone-row-copy">
        <span className="phone-row-name">{displayName(person)}</span>
        <span className="phone-row-meta">
          {role ? `${role} · ` : ""}
          {yearsLabel(person)}
        </span>
        {notes.length > 0 && <span className="phone-row-note">{noteSnippet(notes[notes.length - 1].text, 46)}</span>}
      </span>
      <PersonFlag flag={person.flag ?? null} nationality={person.nationality} birthPlace={person.birthPlace} className="phone-row-flag" />
    </button>
  );
}

function Section({ title, people, role, onOpen }: { title: string; people: Person[]; role?: (p: Person) => string; onOpen: (id: string) => void }) {
  if (people.length === 0) return null;
  return (
    <section className="phone-section">
      <h3>{title}</h3>
      <div className="phone-rows">
        {people.map((person) => (
          <PersonRow key={person.id} person={person} role={role?.(person)} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

/** The phone's family tree: one person at a time, with their parents, partners, siblings and children one tap away. */
export function PhoneTree({ people, homePersonId, locateId, locateKey, onOpenLifeStory, onGoToBackup }: PhoneTreeProps) {
  const start = homePersonId && people[homePersonId] ? homePersonId : (Object.keys(people)[0] ?? null);
  const [focusId, setFocusId] = useState<string | null>(start);
  const [trail, setTrail] = useState<string[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<string | null>(null);

  function go(id: string) {
    if (!people[id]) return;
    setTrail((current) => (focusId && focusId !== id ? [...current, focusId].slice(-40) : current));
    setFocusId(id);
    window.scrollTo?.({ top: 0 });
  }

  useEffect(() => {
    if (locateId && people[locateId]) {
      setTrail([]);
      setFocusId(locateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateKey]);

  const focus = focusId ? people[focusId] : undefined;
  const heritage = useMemo(() => (focus ? computeHeritage(people, focus.id) : []), [people, focus]);

  if (!focus) {
    return (
      <section className="phone-tree">
        <div className="phone-empty">
          <h3>No family tree on this phone yet</h3>
          <p>Each device keeps its own copy. Open Backup, then choose the backup file you were sent to load the tree here.</p>
          <button type="button" className="btn btn-primary" onClick={onGoToBackup}>
            Open Backup
          </button>
        </div>
      </section>
    );
  }

  const parents = orderedParents(people, focus);
  const spouses = spousesOf(people, focus);
  const children = childrenOf(people, focus.id);
  const siblings = siblingsOf(people, focus);
  const notes = focus.stickyNotes ?? [];
  const hasStory = Boolean(storyFor(focus.id));
  const isHome = focus.id === homePersonId;

  return (
    <section className="phone-tree">
      <div className="phone-nav">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={trail.length === 0}
          onClick={() => {
            const previous = trail[trail.length - 1];
            if (!previous) return;
            setTrail(trail.slice(0, -1));
            setFocusId(previous);
          }}
        >
          ← Back
        </button>
        {!isHome && homePersonId && people[homePersonId] && (
          <button type="button" className="btn btn-secondary" onClick={() => go(homePersonId)}>
            Home person
          </button>
        )}
      </div>

      <div className="phone-hero">
        <PersonAvatar person={focus} className={`person-mono is-${focus.gender} phone-hero-avatar`} />
        <h2>{displayName(focus)}</h2>
        <div className="phone-hero-years">{yearsLabel(focus)}</div>
        {focus.birthPlace && <div className="phone-hero-place">Born {focus.birthPlace}</div>}
        <div className="phone-hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => setProfileId(focus.id)}>
            Full profile
          </button>
          {hasStory && (
            <button type="button" className="btn btn-secondary" onClick={() => onOpenLifeStory(focus.id)}>
              Life story
            </button>
          )}
          {notes.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setNotesFor(focus.id)}>
              Notes ({notes.length})
            </button>
          )}
        </div>
        {heritage.length > 0 && (
          <div className="phone-heritage" aria-label="Heritage">
            {heritage.map((item) => {
              const colour = HERITAGE_COLOURS[item.key] ?? { bg: otherColour(item.key), fg: "#fff" };
              return (
                <span key={item.key} className="phone-heritage-chip" style={{ background: colour.bg, color: colour.fg }}>
                  {Math.round(item.share * 100)}% {item.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <Section
        title="Parents"
        people={parents}
        role={(p) => (p.gender === "male" ? "Father" : "Mother")}
        onOpen={go}
      />
      <Section title={spouses.length > 1 ? "Partners" : "Partner"} people={spouses} onOpen={go} />
      <Section title="Siblings" people={siblings} onOpen={go} />
      <Section title="Children" people={children} onOpen={go} />

      {profileId && people[profileId] && (
        <div className="phone-profile">
          <PersonPanel
            people={people}
            person={people[profileId]}
            homePersonId={homePersonId}
            readOnly
            onSelect={(id) => {
              go(id);
              setProfileId(id);
            }}
            onClose={() => setProfileId(null)}
            onOpenNotes={() => setNotesFor(profileId)}
            onMakeHome={noop}
            onAddParent={noop}
            onRemoveParent={noop}
            onAddSpouse={noop}
            onRemoveSpouse={noop}
            onAddChild={noop}
            onRemoveChild={noop}
            onAddSibling={noop}
            onRemoveSibling={noop}
            onEdit={noop}
            onAddResidence={noop}
            onUpdateResidence={noop}
            onRemoveResidence={noop}
            onAddNotableEvent={noop}
            onUpdateNotableEvent={noop}
            onRemoveNotableEvent={noop}
            onSetMarriageDetails={noop}
            onSetPhoto={noop}
            onSetFlag={noop}
            onAddJob={noop}
            onUpdateJob={noop}
            onRemoveJob={noop}
            onAddMilitaryService={noop}
            onUpdateMilitaryService={noop}
            onRemoveMilitaryService={noop}
            onAddMedal={noop}
            onUpdateMedal={noop}
            onRemoveMedal={noop}
          />
        </div>
      )}
      {notesFor && people[notesFor] && (
        <NotesDialog person={people[notesFor]} readOnly onClose={() => setNotesFor(null)} />
      )}
    </section>
  );
}
