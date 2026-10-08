import { useState, type FormEvent } from "react";

type MilitaryDialogProps = {
  served?: string;
  war?: string;
  onClose: () => void;
  onSubmit: (served: string, war: string) => void;
  onRemove?: () => void;
};

export function MilitaryDialog({
  served: initialServed = "",
  war: initialWar = "",
  onClose,
  onSubmit,
  onRemove,
}: MilitaryDialogProps) {
  const editing = Boolean(onRemove);
  const [served, setServed] = useState(initialServed);
  const [war, setWar] = useState(initialWar);
  const canSave = Boolean(served.trim() || war.trim());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSubmit(served.trim(), war.trim());
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="military-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title" id="military-title">
          {editing ? "Edit military service" : "Add military service"}
        </div>
        <p className="dialog-body">The years they served and the war or conflict, if you know them.</p>
        <div className="field">
          <label htmlFor="military-served">Date served</label>
          <input
            id="military-served"
            className="input"
            placeholder="1914–1918"
            value={served}
            onChange={(event) => setServed(event.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="military-war">War</label>
          <input
            id="military-war"
            className="input"
            placeholder="First World War"
            value={war}
            onChange={(event) => setWar(event.target.value)}
          />
        </div>
        <div className="dialog-actions">
          {onRemove && (
            <button type="button" className="btn btn-secondary dialog-remove" onClick={onRemove}>
              Remove
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            {editing ? "Save" : "Add service"}
          </button>
        </div>
      </form>
    </div>
  );
}
