import { useState, type FormEvent } from "react";

type MedalDialogProps = {
  name?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  onRemove?: () => void;
};

export function MedalDialog({
  name: initialName = "",
  onClose,
  onSubmit,
  onRemove,
}: MedalDialogProps) {
  const editing = Boolean(onRemove);
  const [name, setName] = useState(initialName);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="medal-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title" id="medal-title">
          {editing ? "Edit medal" : "Add a medal"}
        </div>
        <p className="dialog-body">A medal or honour they received.</p>
        <div className="field">
          <label htmlFor="medal-name">Medal</label>
          <input
            id="medal-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
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
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {editing ? "Save" : "Add medal"}
          </button>
        </div>
      </form>
    </div>
  );
}
