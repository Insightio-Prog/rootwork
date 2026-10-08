import { useState, type FormEvent } from "react";

type MarriageDialogProps = {
  spouseName: string;
  date: string;
  place: string;
  onClose: () => void;
  onSubmit: (date: string, place: string) => void;
};

export function MarriageDialog({ spouseName, date, place, onClose, onSubmit }: MarriageDialogProps) {
  const [nextDate, setNextDate] = useState(date);
  const [nextPlace, setNextPlace] = useState(place);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!nextDate.trim() && !nextPlace.trim()) return;
    onSubmit(nextDate.trim(), nextPlace.trim());
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="marriage-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title" id="marriage-title">
          Marriage details
        </div>
        <p className="dialog-body">Date and place of marriage to {spouseName}.</p>
        <div className="field">
          <label htmlFor="marriage-date">Date</label>
          <input
            id="marriage-date"
            className="input"
            placeholder="Year or full date"
            value={nextDate}
            onChange={(event) => setNextDate(event.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="marriage-place">Place</label>
          <input
            id="marriage-place"
            className="input"
            value={nextPlace}
            onChange={(event) => setNextPlace(event.target.value)}
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
