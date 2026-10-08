import { useEffect, useMemo, useState } from "react";
import { FamilyTreeCanvas } from "../components/FamilyTreeCanvas";
import { LifeStoryPage } from "../components/LifeStoryPage";
import { peopleCountLabel } from "../data/people";
import { setExportMedia } from "../media/store";
import { hydrateStories } from "../stories";
import { parseTree } from "../state/useTreeStore";
import { BrandMark, IconHome, IconStory, IconTree } from "../icons";
import type { HtmlExportPayload, HtmlExportTree } from "../export/htmlExport";

type ViewerNav = "home" | "tree" | "story";

const ignored = () => {};

function activateTree(entry: HtmlExportTree) {
  setExportMedia(entry.media ?? {});
  hydrateStories(entry.stories ?? {});
}

export function ViewerApp({ payload }: { payload: HtmlExportPayload }) {
  const trees = payload.trees;
  const [treeId, setTreeId] = useState(trees[0]?.id ?? "");
  const [nav, setNav] = useState<ViewerNav>("tree");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [storyPersonId, setStoryPersonId] = useState<string | null>(null);

  const entry = useMemo(
    () => trees.find((tree) => tree.id === treeId) ?? trees[0],
    [trees, treeId],
  );

  useEffect(() => {
    if (entry) activateTree(entry);
  }, [entry]);

  if (!entry) {
    return (
      <div className="placeholder-page">
        <div className="card elev-md placeholder-card">
          <h3>Nothing to show</h3>
          <p>This file has no family trees.</p>
        </div>
      </div>
    );
  }

  const tree = parseTree(JSON.stringify(entry.tree));
  const { people, homePersonId, treeTitle } = tree;
  const personCount = Object.keys(people).length;
  const selected =
    selectedId && people[selectedId] ? selectedId : selectedId === null ? null : homePersonId;

  function openTree(id: string) {
    const next = trees.find((item) => item.id === id);
    if (!next) return;
    activateTree(next);
    setTreeId(id);
    setSelectedId(null);
    setStoryPersonId(null);
    setNav("tree");
  }

  return (
    <div className="app-shell viewer-shell">
      <aside className="app-sidebar is-expanded">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <BrandMark />
          </div>
          <span className="brand-name">Rootwork</span>
        </div>
        <p className="viewer-kicker">View only</p>
        <label className="viewer-tree-select">
          <span>Tree</span>
          <select className="input" value={entry.id} onChange={(event) => openTree(event.target.value)}>
            {trees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.tree?.treeTitle || "Family"}
              </option>
            ))}
          </select>
        </label>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-item${nav === "home" ? " is-active" : ""}`}
            onClick={() => setNav("home")}
          >
            <IconHome />
            <span className="nav-label">Home</span>
          </button>
          <button
            type="button"
            className={`nav-item${nav === "tree" ? " is-active" : ""}`}
            onClick={() => setNav("tree")}
          >
            <IconTree />
            <span className="nav-label">Family Tree</span>
          </button>
          <button
            type="button"
            className={`nav-item${nav === "story" ? " is-active" : ""}`}
            onClick={() => {
              setStoryPersonId(null);
              setNav("story");
            }}
          >
            <IconStory />
            <span className="nav-label">Life Story</span>
          </button>
        </nav>
      </aside>
      <main className="app-main">
        <header className="app-header">
          <h4>{nav === "tree" ? treeTitle : nav === "story" ? "Life Story" : "Your trees"}</h4>
          {nav === "tree" ? <span className="tag tag-outline people-count">{peopleCountLabel(personCount)}</span> : null}
        </header>
        {nav === "home" ? (
          <section className="home-page">
            <div className="home-page-inner">
              <div className="life-story-empty-kicker">Home</div>
              <h3>Your trees</h3>
              <p>This is a shared copy. Open a tree to look around. Nothing can be edited.</p>
              <ul className="home-tree-list">
                {trees.map((item) => (
                  <li key={item.id}>
                    <div className="home-tree-row">
                      <button type="button" className="home-tree-open" onClick={() => openTree(item.id)}>
                        <span className="home-tree-open-name">{item.name || "Family"}</span>
                        {item.id === entry.id ? <span className="home-tree-current">Current</span> : null}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : nav === "story" ? (
          <LifeStoryPage
            people={people}
            personId={storyPersonId}
            onPick={setStoryPersonId}
            onChangePerson={() => setStoryPersonId(null)}
          />
        ) : (
          <FamilyTreeCanvas
            key={entry.id}
            treeId={entry.id}
            people={people}
            homePersonId={homePersonId}
            selectedId={selected}
            panelOpen={panelOpen}
            readOnly
            chartSeed={entry.chart ?? null}
            onSelect={setSelectedId}
            onRecenter={() => {
              if (homePersonId) setSelectedId(homePersonId);
            }}
            onTogglePanel={() => setPanelOpen((open) => !open)}
            onStub={ignored}
            onAddPerson={ignored}
            onAddParent={ignored}
            onRemoveParent={ignored}
            onAddSpouse={ignored}
            onRemoveSpouse={ignored}
            onAddChild={ignored}
            onAddSibling={ignored}
            onRemoveSibling={ignored}
            onMakeHome={ignored}
            onEdit={ignored}
            onDelete={ignored}
            onAddResidence={ignored}
            onUpdateResidence={ignored}
            onRemoveResidence={ignored}
            onAddNotableEvent={ignored}
            onUpdateNotableEvent={ignored}
            onRemoveNotableEvent={ignored}
            onSetMarriageDetails={ignored}
            onSetPhoto={ignored}
            onSetFlag={ignored}
            onAddJob={ignored}
            onUpdateJob={ignored}
            onRemoveJob={ignored}
            onAddMilitaryService={ignored}
            onUpdateMilitaryService={ignored}
            onRemoveMilitaryService={ignored}
            onAddMedal={ignored}
            onUpdateMedal={ignored}
            onRemoveMedal={ignored}
            onOpenLifeStory={(id) => {
              setStoryPersonId(id);
              setNav("story");
            }}
          />
        )}
      </main>
    </div>
  );
}
