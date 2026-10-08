import { useState } from "react";
import type { WorkspaceEntry } from "../state/workspaces";

type HomePageProps = {
  trees: WorkspaceEntry[];
  currentId: string;
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
};

export function HomePage({ trees, currentId, onOpen, onCreate, onRename }: HomePageProps) {
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function submitNew() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
  }

  function submitRename() {
    if (!renameId) return;
    const name = renameValue.trim();
    if (!name) return;
    onRename(renameId, name);
    setRenameId(null);
  }

  return (
    <section className="home-page">
      <div className="home-page-inner">
        <div className="life-story-empty-kicker">Home</div>
        <h3>Your trees</h3>
        <p>Each tree has its own people, photos, and life stories. Open one, or start a blank tree.</p>
        <ul className="home-tree-list">
          {trees.map((tree) => (
            <li key={tree.id}>
              {renameId === tree.id ? (
                <div className="home-tree-row">
                  <input
                    className="input"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitRename();
                      if (event.key === "Escape") setRenameId(null);
                    }}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary" onClick={submitRename}>
                    Save
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setRenameId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="home-tree-row">
                  <button type="button" className="home-tree-open" onClick={() => onOpen(tree.id)}>
                    <span className="home-tree-open-name">{tree.name}</span>
                    {tree.id === currentId ? <span className="home-tree-current">Current</span> : null}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost home-tree-rename"
                    onClick={() => {
                      setRenameId(tree.id);
                      setRenameValue(tree.name);
                    }}
                  >
                    Rename
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="home-tree-row home-new-tree">
          <input
            className="input"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitNew();
            }}
            placeholder="Name of a new tree"
          />
          <button type="button" className="btn btn-primary" disabled={!newName.trim()} onClick={submitNew}>
            New tree
          </button>
        </div>
      </div>
    </section>
  );
}
