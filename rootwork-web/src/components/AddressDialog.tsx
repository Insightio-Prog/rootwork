import { useState, type FormEvent } from "react";

type AddressDialogProps = {
  place?: string;
  from?: string;
  to?: string;
  onClose: () => void;
  onSubmit: (place: string, from: string, to: string) => void;
  onRemove?: () => void;
};

export function AddressDialog({
  place: initialPlace = "",
  from: initialFrom = "",
  to: initialTo = "",
  onClose,
  onSubmit,
  onRemove,
}: AddressDialogProps) {
  const editing = Boolean(onRemove);
  const [place, setPlace] = useState(initialPlace);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!place.trim()) return;
    onSubmit(place.trim(), from.trim(), to.trim());
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title" id="address-title">
          {editing ? "Edit address" : "Add an address"}
        </div>
        <p className="dialog-body">A place they lived, with years if you have them.</p>
        <div className="field">
          <label htmlFor="address-place">Place</label>
          <input
            id="address-place"
            className="input"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            autoFocus
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="address-from">From</label>
            <input
              id="address-from"
              className="input"
              placeholder="Year"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="address-to">To</label>
            <input
              id="address-to"
              className="input"
              placeholder="Year"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
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
          <button type="submit" className="btn btn-primary" disabled={!place.trim()}>
            {editing ? "Save" : "Add address"}
          </button>
        </div>
      </form>
    </div>
  );
}
