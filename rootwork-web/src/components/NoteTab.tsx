import { noteSnippet, type Person } from "../data/people";

type NoteTabProps = {
  person: Person;
  onOpen?: (personId: string) => void;
};

/** A little sticky note pinned beside a tree card: the first few words, and a click opens the lot. */
export function NoteTab({ person, onOpen }: NoteTabProps) {
  const notes = person.stickyNotes ?? [];
  if (notes.length === 0 || !onOpen) return null;
  const latest = notes[notes.length - 1];
  return (
    <button
      type="button"
      className="note-tab"
      title="Open notes"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(person.id);
      }}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <span className="note-tab-text">{noteSnippet(latest.text)}</span>
      {notes.length > 1 && <span className="note-tab-count">+{notes.length - 1}</span>}
    </button>
  );
}
