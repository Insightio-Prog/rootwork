import { useState, type FormEvent } from "react";

type JobDialogProps = {
  title?: string;
  detail?: string;
  onClose: () => void;
  onSubmit: (title: string, detail: string) => void;
  onRemove?: () => void;
};

export function JobDialog({
  title: initialTitle = "",
  detail: initialDetail = "",
  onClose,
  onSubmit,
  onRemove,
}: JobDialogProps) {
  const editing = Boolean(onRemove);
  const [title, setTitle] = useState(initialTitle);
  const [detail, setDetail] = useState(initialDetail);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), detail.trim());
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title" id="job-title">
          {editing ? "Edit job" : "Add a job"}
        </div>
        <p className="dialog-body">A role they held, with a short description if you have one.</p>
        <div className="field">
          <label htmlFor="job-name">Job title</label>
          <input
            id="job-name"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="job-detail">Description</label>
          <textarea
            id="job-detail"
            className="input"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
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
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            {editing ? "Save" : "Add job"}
          </button>
        </div>
      </form>
    </div>
  );
}
