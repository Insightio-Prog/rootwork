import { useEffect, useState, type FormEvent } from "react";
import { clearApiKey, hasApiKey, invokeErrorMessage, saveApiKey } from "../review/claude";

type ApiKeyDialogProps = {
  onClose: () => void;
};

export function ApiKeyDialog({ onClose }: ApiKeyDialogProps) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void hasApiKey().then(setSaved).catch(() => setSaved(false));
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveApiKey(key);
      setKey("");
      setSaved(true);
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await clearApiKey();
      setSaved(false);
      setKey("");
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop stub-dialog" onClick={onClose} role="presentation">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSave}
      >
        <div className="dialog-title" id="settings-title">
          Settings
        </div>
        <p className="dialog-body">
          Claude can review Life facts against attached scans, scan the tree for gaps, and answer
          questions about it. Enter the family password to unlock it in this browser. Your tree is
          only sent to Claude when you ask it something.
        </p>
        <div className="field">
          <label htmlFor="family-password">Family password</label>
          <input
            id="family-password"
            className="input"
            type="password"
            autoComplete="current-password"
            spellCheck={false}
            placeholder={saved ? "Unlocked — enter a new password to replace it" : "Family password"}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            disabled={busy}
          />
        </div>
        {saved && <p className="review-meta">Claude is unlocked in this browser.</p>}
        {error && <p className="dialog-error">{error}</p>}
        <div className="dialog-actions">
          {saved && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleRemove()}
              disabled={busy}
            >
              Lock Claude
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !key.trim()}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
