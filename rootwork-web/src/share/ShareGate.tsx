import { useEffect, useState, type ReactNode } from "react";
import { restoreBackup } from "../backup/web";
import { initStories } from "../stories";
import { ensureWorkspaces, treeStorageKey } from "../state/workspaces";
import type { ShareInfo } from "./info";

const SEEN_KEY = "rootwork.share.seen";

type Phase = "checking" | "loading" | "ask" | "ready" | "error";

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(value: string) {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    /* private window: it will just ask again next time */
  }
}

function hasLocalPeople(): boolean {
  try {
    const raw = localStorage.getItem(treeStorageKey());
    if (!raw) return false;
    const tree = JSON.parse(raw) as { people?: Record<string, unknown> };
    return Object.keys(tree.people ?? {}).length > 0;
  } catch {
    return false;
  }
}

/** Loads the family tree from the link into this browser, with care not to overwrite someone's own work. */
export function ShareGate({ info, children }: { info: ShareInfo; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState("");
  const [update, setUpdate] = useState(false);

  async function load() {
    setPhase("loading");
    setError("");
    try {
      const response = await fetch(info.data, { cache: "no-store" });
      if (!response.ok) throw new Error("The family link isn't available right now. Ask for a fresh one.");
      const blob = await response.blob();
      await restoreBackup(blob);
      writeSeen(info.updatedAt);
      await initStories();
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong loading the family tree.");
      setPhase("error");
    }
  }

  function keepMine() {
    writeSeen(info.updatedAt);
    void initStories();
    setPhase("ready");
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureWorkspaces();
      if (cancelled) return;
      const seen = readSeen();
      if (seen === info.updatedAt) {
        void initStories();
        setPhase("ready");
        return;
      }
      setUpdate(seen !== null);
      if (!hasLocalPeople()) {
        void load();
        return;
      }
      setPhase("ask");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "ready") return <>{children}</>;

  return (
    <div className="share-gate">
      <div className="card elev-md share-gate-card">
        <div className="placeholder-kicker">Rootwork</div>
        {phase === "checking" || phase === "loading" ? (
          <>
            <h3>Opening the family tree…</h3>
            <p>Loading the people, photos and stories onto this device. This can take a minute.</p>
          </>
        ) : phase === "error" ? (
          <>
            <h3>That didn't work</h3>
            <p>{error}</p>
            <div className="export-actions">
              <button type="button" className="btn btn-primary" onClick={() => void load()}>
                Try again
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>{update ? "A newer family tree is ready" : "Load the family tree?"}</h3>
            <p>
              {update
                ? "Loading it replaces the tree on this device. If you have added your own people, keep yours for now, then use Backup to export a copy first."
                : "This device already has a tree in Rootwork. Loading the family tree replaces it."}
            </p>
            <div className="export-actions">
              <button type="button" className="btn btn-primary" onClick={() => void load()}>
                {update ? "Load the new version" : "Load the family tree"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={keepMine}>
                Keep what I have
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
