type ConfirmDeleteDialogProps = {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({ name, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  return (
    <div className="dialog-backdrop stub-dialog" onClick={onCancel} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-title" id="delete-title">
          Delete {name}?
        </div>
        <p className="dialog-body">
          This removes {name} from the tree and every link to them — parents, spouses, and
          children. This cannot be undone.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Delete forever
          </button>
        </div>
      </div>
    </div>
  );
}
