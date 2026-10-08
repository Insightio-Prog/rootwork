import { useState, type FormEvent } from "react";

type NotableEventDialogProps = {
  title?: string;
  date?: string;
  detail?: string;
  onClose: () => void;
  onSubmit: (title: string, date: string, detail: string) => void | Promise<void>;
  onRemove?: () => void;
};

export function NotableEventDialog({
  title: initialTitle = "",
  date: initialDate = "",
  detail: initialDetail = "",
  onClose,
  onSubmit,
  onRemove,
}: NotableEventDialogProps) {
  const editing = Boolean(onRemove);
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [detail, setDetail] = useState(initialDetail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(title.trim(), date.trim(), detail.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the event.");
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notable-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title" id="notable-title">
          {editing ? "Edit notable event" : "Add a notable event"}
        </div>
        <p className="dialog-body">A newspaper article, award, or anything else worth recording.</p>
        <div className="field">
          <label htmlFor="notable-name">Title</label>
          <input
            id="notable-name"
            className="input"
            placeholder="Headline or short name"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="notable-date">Date</label>
          <input
            id="notable-date"
            className="input"
            placeholder="Year or full date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="notable-detail">Note</label>
          <textarea
            id="notable-detail"
            className="input"
            placeholder="What happened, or a summary of the article"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </div>
        {error ? <p className="dialog-error">{error}</p> : null}
        <div className="dialog-actions">
          {onRemove && (
            <button type="button" className="btn btn-secondary dialog-remove" onClick={onRemove} disabled={busy}>
              Remove
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || busy}>
            {busy ? "Saving…" : editing ? "Save" : "Add event"}
          </button>
        </div>
      </form>
    </div>
  );
}
