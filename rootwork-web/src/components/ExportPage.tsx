import { useEffect, useState } from "react";
import type { DuplicateMergeReport, GedcomImportReport } from "../import/mergeGedcom";
import { downloadBlob, makeBackupBlob, makeViewerHtml, readGedcomFile, restoreBackup } from "../backup/web";
import { clearMediaUrlCache } from "../media/store";
import { invokeErrorMessage, saveApiKey, storedPassword } from "../review/claude";
import { isSharedCopy } from "../share/info";
import { publishShare, shareStatus, shareUrl, stopShare, type ShareStatus } from "../export/share";

type ExportPageProps = {
  onPrepareExport: () => Promise<void>;
  onPrepareHtmlExport: () => Promise<Record<string, unknown>>;
  onImported: () => Promise<void>;
  onImportGedcom: (text: string) => GedcomImportReport;
  onCollapseDuplicates: () => Promise<DuplicateMergeReport>;
};

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ExportPage({
  onPrepareExport,
  onPrepareHtmlExport,
  onImported,
  onImportGedcom,
  onCollapseDuplicates,
}: ExportPageProps) {
  const [busy, setBusy] = useState<"export" | "html" | "import" | "gedcom" | "merge" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmImport, setConfirmImport] = useState(false);
  const [gedcomReport, setGedcomReport] = useState<GedcomImportReport | null>(null);
  const [mergeReport, setMergeReport] = useState<DuplicateMergeReport | null>(null);
  const [unlocked, setUnlocked] = useState(() => Boolean(storedPassword()));
  const [passwordDraft, setPasswordDraft] = useState("");
  const [share, setShare] = useState<ShareStatus | null>(null);
  const [shareBusy, setShareBusy] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    if (!unlocked) return;
    shareStatus()
      .then(setShare)
      .catch((err) => setShareError(invokeErrorMessage(err)));
  }, [unlocked]);

  async function handleUnlock() {
    setShareError("");
    setShareBusy("unlock");
    try {
      await saveApiKey(passwordDraft);
      setPasswordDraft("");
      setUnlocked(true);
    } catch (err) {
      setShareError(invokeErrorMessage(err));
    } finally {
      setShareBusy("");
    }
  }

  async function handlePublish(rotate: boolean) {
    setShareError("");
    setShareNote("");
    setShareBusy("publish");
    try {
      await onPrepareExport();
      setShareNote("Preparing the family backup…");
      const html = await makeBackupBlob();
      const status = await publishShare(html, rotate, (done, total) =>
        setShareNote(`Uploading… ${Math.min(done, total)} of ${total}`),
      );
      setShare(status);
      setShareNote(status.shared ? `Published (${formatBytes(html.size)}). The link is ready to copy.` : "");
    } catch (err) {
      setShareError(invokeErrorMessage(err));
      setShareNote("");
    } finally {
      setShareBusy("");
    }
  }

  async function handleCopyLink() {
    if (!share || !share.shared) return;
    const link = shareUrl(share.token);
    try {
      await navigator.clipboard.writeText(link);
      setShareNote("Link copied. Paste it into a message.");
    } catch {
      setShareNote(link);
    }
  }

  async function handleStopShare() {
    setShareError("");
    setShareBusy("stop");
    try {
      setShare(await stopShare());
      setShareNote("Sharing stopped. The old link no longer works.");
    } catch (err) {
      setShareError(invokeErrorMessage(err));
    } finally {
      setShareBusy("");
    }
  }

  async function handleExport() {
    setError("");
    setMessage("");
    setBusy("export");
    try {
      await onPrepareExport();
      downloadBlob(await makeBackupBlob(), "Rootwork-backup.zip");
      setMessage("Backup saved to your downloads.");
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleHtmlExport() {
    setError("");
    setMessage("");
    setBusy("html");
    try {
      await onPrepareExport();
      const charts = await onPrepareHtmlExport();
      const html = await makeViewerHtml(charts);
      downloadBlob(html, "Rootwork-family.html");
      const bytes = html.size;
      const size = formatBytes(bytes);
      setMessage(
        bytes >= 25 * 1024 * 1024
          ? `Webpage saved (${size}). Email may bounce a file this large — AirDrop, Drive, or WhatsApp is safer.`
          : `Webpage saved (${size}). Anyone can open that file in a browser.`,
      );
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    setError("");
    setMessage("");
    const source = await pickFile(".zip,.rootwork,application/zip");
    if (!source) {
      setConfirmImport(false);
      return;
    }
    setBusy("import");
    try {
      await restoreBackup(source);
      clearMediaUrlCache();
      await onImported();
      setMessage("Backup imported. This tree is now the one from that file.");
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(null);
      setConfirmImport(false);
    }
  }

  async function handleGedcomImport() {
    setError("");
    setMessage("");
    const source = await pickFile(".ged,.zip");
    if (!source) return;
    setBusy("gedcom");
    try {
      const text = await readGedcomFile(source);
      const report = onImportGedcom(text);
      setGedcomReport(report);
      setMessage(
        `Ancestry import finished. Added ${countLabel(report.added, "person", "people")}, filled ${countLabel(report.filled, "person", "people")}${
          report.merged ? `, merged ${countLabel(report.merged, "duplicate")}` : ""
        }.`,
      );
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleMergeDuplicates() {
    setError("");
    setMessage("");
    setBusy("merge");
    try {
      const report = await onCollapseDuplicates();
      setMergeReport(report);
      setMessage(
        report.merged
          ? `Merged ${countLabel(report.merged, "duplicate pair", "duplicate pairs")}.`
          : "No duplicate people to merge.",
      );
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="placeholder-page export-page">
      <div className="export-page-stack">
        <div className="card elev-md placeholder-card">
          <div className="placeholder-kicker">Export</div>
          <h3>Backup this tree</h3>
          <p>
            Save one file with the family tree, photos, scans, and life stories. Give that file to
            family and they open this site and import it. Your data stays in this browser until you export it.
          </p>
          <div className="export-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy)}
              onClick={() => void handleExport()}
            >
              {busy === "export" ? "Saving" : "Export backup"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(busy)}
              onClick={() => {
                setError("");
                setMessage("");
                setConfirmImport(true);
              }}
            >
              {busy === "import" ? "Importing, this can take a minute…" : "Import backup"}
            </button>
          </div>
        </div>
        <div className="card elev-md placeholder-card">
          <div className="placeholder-kicker">Import</div>
          <h3>Import Ancestry GEDCOM</h3>
          <p>
            Merge a .ged file, or a zip that contains one, into this tree. Matching people are
            filled in where Rootwork is blank. Existing values are never overwritten.
          </p>
          <div className="export-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy)}
              onClick={() => void handleGedcomImport()}
            >
              {busy === "gedcom" ? "Importing" : "Import Ancestry GEDCOM"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(busy)}
              onClick={() => void handleMergeDuplicates()}
            >
              {busy === "merge" ? "Merging" : "Merge duplicate people"}
            </button>
          </div>
        </div>
        {!isSharedCopy ? (
        <div className="card elev-md placeholder-card">
          <div className="placeholder-kicker">Share</div>
          <h3>Share one link</h3>
          <p>
            Publish this tree, its stories and photos, and send family one link. It opens the full
            Rootwork (everything except the map) with the tree already loaded on their own phone or
            computer. What they add stays on their device, and they can export a backup and send it
            back to you. Publish again later and the same link shows the latest. Anyone who has the
            link can open it, so only send it to family.
          </p>
          {!unlocked ? (
            <div className="export-actions">
              <input
                type="password"
                className="input"
                value={passwordDraft}
                placeholder="Family password"
                aria-label="Family password"
                autoComplete="off"
                onChange={(event) => setPasswordDraft(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={!passwordDraft.trim() || shareBusy === "unlock"}
                onClick={() => void handleUnlock()}
              >
                {shareBusy === "unlock" ? "Checking" : "Unlock"}
              </button>
            </div>
          ) : (
            <>
              {share && share.shared ? (
                <p className="share-link-row">
                  <code>{shareUrl(share.token)}</code>
                  <span>Last published {new Date(share.updatedAt).toLocaleString()}</span>
                </p>
              ) : null}
              <div className="export-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={Boolean(busy) || Boolean(shareBusy)}
                  onClick={() => void handlePublish(false)}
                >
                  {shareBusy === "publish" ? "Publishing…" : share && share.shared ? "Update the link" : "Publish a link"}
                </button>
                {share && share.shared ? (
                  <>
                    <button type="button" className="btn btn-secondary" disabled={Boolean(shareBusy)} onClick={() => void handleCopyLink()}>
                      Copy link
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={Boolean(busy) || Boolean(shareBusy)} onClick={() => void handlePublish(true)}>
                      New link (stops the old one)
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={Boolean(shareBusy)} onClick={() => void handleStopShare()}>
                      Stop sharing
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}
          {shareNote ? <p className="export-status">{shareNote}</p> : null}
          {shareError ? <p className="export-error">{shareError}</p> : null}
        </div>
        ) : null}
        <div className="card elev-md placeholder-card">
          <div className="placeholder-kicker">Share</div>
          <h3>Share as webpage</h3>
          <p>
            Save one HTML file with every tree, life stories, and photos. Recipients open it on a
            phone or in a browser. They can look around, not edit.
          </p>
          <div className="export-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy)}
              onClick={() => void handleHtmlExport()}
            >
              {busy === "html" ? "Compressing photos" : "Export HTML"}
            </button>
          </div>
        </div>
        {message ? <p className="export-status">{message}</p> : null}
        {error ? <p className="export-error">{error}</p> : null}
      </div>
      {confirmImport ? (
        <div className="dialog-backdrop stub-dialog" onClick={() => !busy && setConfirmImport(false)} role="presentation">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-title" id="import-title">
              Replace this tree?
            </div>
            <p className="dialog-body">
              Importing a backup replaces the family tree, photos, and life stories in this
              browser. This cannot be undone.
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => setConfirmImport(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void handleImport()}>
                {busy === "import" ? "Importing" : "Replace and import"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {gedcomReport ? (
        <div className="dialog-backdrop stub-dialog" onClick={() => setGedcomReport(null)} role="presentation">
          <div
            className="dialog gedcom-report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gedcom-report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-title" id="gedcom-report-title">
              Ancestry import
            </div>
            <p className="dialog-body">
              Added {countLabel(gedcomReport.added, "person", "people")}. Filled blanks on{" "}
              {countLabel(gedcomReport.filled, "person", "people")}. Merged{" "}
              {countLabel(gedcomReport.merged, "duplicate")}. Skipped{" "}
              {countLabel(gedcomReport.skipped, "duplicate")}.
            </p>
            {gedcomReport.unmatched.length > 0 ? (
              <div className="gedcom-report-section">
                <div className="gedcom-report-kicker">Not merged</div>
                <ul className="gedcom-report-list">
                  {gedcomReport.unmatched.map((person, index) => (
                    <li key={`${person}-${index}`}>{person}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {gedcomReport.conflicts.length > 0 ? (
              <div className="gedcom-report-section">
                <div className="gedcom-report-kicker">Conflicts kept as in Rootwork</div>
                <ul className="gedcom-report-list">
                  {gedcomReport.conflicts.map((conflict, index) => (
                    <li key={`${conflict.person}-${conflict.field}-${index}`}>
                      <strong>{conflict.person}</strong> · {conflict.field}
                      <div className="gedcom-report-values">
                        Rootwork: {conflict.current || "blank"}
                        <br />
                        Ancestry: {conflict.incoming || "blank"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={() => setGedcomReport(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {mergeReport ? (
        <div className="dialog-backdrop stub-dialog" onClick={() => setMergeReport(null)} role="presentation">
          <div
            className="dialog gedcom-report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-title" id="merge-report-title">
              Merge duplicates
            </div>
            <p className="dialog-body">
              {mergeReport.merged
                ? `Merged ${countLabel(mergeReport.merged, "duplicate pair", "duplicate pairs")}. Photos and filled-in names were kept.`
                : "No duplicate people to merge."}
            </p>
            {mergeReport.pairs.length > 0 ? (
              <div className="gedcom-report-section">
                <div className="gedcom-report-kicker">Merged into</div>
                <ul className="gedcom-report-list">
                  {mergeReport.pairs.map((pair, index) => (
                    <li key={`${pair.kept}-${index}`}>
                      <strong>{pair.kept}</strong>
                      <div className="gedcom-report-values">Removed duplicate: {pair.dropped}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {mergeReport.conflicts.length > 0 ? (
              <div className="gedcom-report-section">
                <div className="gedcom-report-kicker">Conflicts kept</div>
                <ul className="gedcom-report-list">
                  {mergeReport.conflicts.map((conflict, index) => (
                    <li key={`${conflict.person}-${conflict.field}-${index}`}>
                      <strong>{conflict.person}</strong> · {conflict.field}
                      <div className="gedcom-report-values">
                        Kept: {conflict.current || "blank"}
                        <br />
                        Other: {conflict.incoming || "blank"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={() => setMergeReport(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
