import { useEffect, useRef, useState, type FormEvent } from "react";
import { displayName, type Person } from "../data/people";
import { Linkify } from "./Linkify";

type NotesDialogProps = {
  person: Person;
  readOnly?: boolean;
  onAdd?: (text: string) => void;
  onUpdate?: (noteId: string, text: string) => void;
  onRemove?: (noteId: string) => void;
  onClose: () => void;
};

function stamp(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function NotesDialog({ person, readOnly = false, onAdd, onUpdate, onRemove, onClose }: NotesDialogProps) {
  const notes = person.stickyNotes ?? [];
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const addRef = useRef<HTMLTextAreaElement>(null);
  const canEdit = !readOnly && Boolean(onAdd);

  useEffect(() => {
    if (canEdit) addRef.current?.focus();
  }, [canEdit]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submitNew(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !onAdd) return;
    onAdd(draft);
    setDraft("");
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <div
        className="dialog notes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-title" id="notes-title">
          Notes · {displayName(person)}
        </div>

        {notes.length === 0 && <p className="dialog-body">No notes yet.</p>}

        <ul className="notes-list">
          {[...notes].reverse().map((note) => (
            <li key={note.id} className="notes-item">
              {editingId === note.id ? (
                <>
                  <textarea
                    className="notes-input"
                    value={editText}
                    rows={5}
                    autoFocus
                    onChange={(event) => setEditText(event.target.value)}
                  />
                  <div className="notes-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!editText.trim()}
                      onClick={() => {
                        onUpdate?.(note.id, editText);
                        setEditingId(null);
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="notes-text">
                    <Linkify text={note.text} />
                  </div>
                  <div className="notes-foot">
                    <span>
                      {stamp(note.createdAt)}
                      {note.updatedAt && note.updatedAt !== note.createdAt ? " · edited" : ""}
                    </span>
                    {canEdit && (
                      <span className="notes-actions">
                        <button
                          type="button"
                          className="btn btn-ghost add-rel-btn"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditText(note.text);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost add-rel-btn"
                          onClick={() => {
                            if (window.confirm("Delete this note?")) onRemove?.(note.id);
                          }}
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {canEdit && (
          <form className="notes-new" onSubmit={submitNew}>
            <textarea
              ref={addRef}
              className="notes-input"
              value={draft}
              rows={4}
              placeholder="Write a note…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submitNew(event);
              }}
            />
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
                Add note
              </button>
            </div>
          </form>
        )}
        {!canEdit && (
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
