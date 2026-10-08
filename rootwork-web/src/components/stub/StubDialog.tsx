type StubDialogProps = {
  title: string;
  onClose: () => void;
};

export function StubDialog({ title, onClose }: StubDialogProps) {
  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stub-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-title" id="stub-title">
          {title}
        </div>
        <p className="dialog-body">Not in this build. The Family Tree ancestor chart is the working screen.</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
