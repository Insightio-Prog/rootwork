import { useState } from "react";
import type { DuplicateMergeReport, GedcomImportReport } from "../import/mergeGedcom";
import { downloadBlob, makeBackupBlob, makeViewerHtml, readGedcomFile, restoreBackup } from "../backup/web";
import { clearMediaUrlCache } from "../media/store";
import { invokeErrorMessage } from "../review/claude";

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
    <section className="placeholder-page">
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
              Import backup
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
