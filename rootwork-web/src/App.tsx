import { useEffect, useState } from "react";
import { AskClaudeDialog } from "./components/AskClaudeDialog";
import { ApiKeyDialog } from "./components/ApiKeyDialog";
import { AppHeader } from "./components/AppHeader";
import { ChartTabs } from "./components/ChartTabs";
import { ConfirmDeleteDialog } from "./components/ConfirmDeleteDialog";
import { ExportPage } from "./components/ExportPage";
import { FamilyTreeCanvas } from "./components/FamilyTreeCanvas";
import { HomePage } from "./components/HomePage";
import { LifeStoryPage } from "./components/LifeStoryPage";
import { StoryLab } from "./dev/StoryLabOverlay";
import { MediaPage } from "./components/MediaPage";
import { PersonFormDialog } from "./components/PersonFormDialog";
import { PlaceholderPage } from "./components/PlaceholderPage";
import { Sidebar } from "./components/Sidebar";
import { StubDialog } from "./components/stub/StubDialog";
import { TimelinePage } from "./components/TimelinePage";
import { TodoPage } from "./components/TodoPage";
import {
  displayName,
  draftFromPerson,
  existingChildCandidates,
  existingParentCandidates,
  existingSiblingCandidates,
  existingSpouseCandidates,
  otherParentCandidates,
  peopleCountLabel,
  type Person,
  type PersonDraft,
} from "./data/people";
import { EMPTY_TODOS } from "./data/todos";
import { clearMediaUrlCache } from "./media/store";
import { hasApiKey, type ChatTurn } from "./review/claude";
import { useTreeStore, type PersonLink } from "./state/useTreeStore";
import { flushStories, reloadStories, storyFor, useLifeStories } from "./stories";
import { chartStorageKey } from "./state/workspaces";
import { NAV_LABELS, useTreeUi } from "./state/useTreeUi";

export default function App() {
  const store = useTreeStore();
  const ui = useTreeUi();
  useLifeStories();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storyLab, setStoryLab] = useState<{ personId?: string } | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askByTree, setAskByTree] = useState<Record<string, ChatTurn[]>>({});
  const { people, homePersonId, treeTitle, todos = EMPTY_TODOS } = store.tree;
  const personCount = Object.keys(people).length;
  const readingStory = ui.nav === "story" && ui.storyPersonId ? storyFor(ui.storyPersonId) : undefined;
  const headerTitle =
    ui.nav === "tree" ? treeTitle : readingStory ? readingStory.title : NAV_LABELS[ui.nav];
  const selectedId =
    ui.selectedId === undefined
      ? homePersonId
      : ui.selectedId && people[ui.selectedId]
        ? ui.selectedId
        : null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "y") {
        return;
      }
      event.preventDefault();
      setStoryLab((current) => (current ? null : { personId: ui.storyPersonId ?? undefined }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui.storyPersonId]);

  useEffect(() => {
    setAskOpen(false);
  }, [store.workspaces.currentId]);

  async function openAskClaude() {
    ui.setNav("tree");
    try {
      const ready = await hasApiKey();
      if (!ready) {
        setSettingsOpen(true);
        return;
      }
    } catch {
      setSettingsOpen(true);
      return;
    }
    setAskOpen(true);
  }

  function handleAdd(draft: PersonDraft, link?: PersonLink) {
    const id = store.addPerson(draft, link);
    ui.selectPerson(id);
    ui.closeForm();
  }

  function handleLinkExisting(existingId: string, link?: PersonLink) {
    if (!link) return;
    store.linkExistingPerson(existingId, link);
    ui.selectPerson(existingId);
    ui.closeForm();
  }

  function openRelative(link: PersonLink, defaults: Partial<PersonDraft>) {
    ui.openAddPerson({ link, defaults });
  }

  const editing = ui.form?.type === "edit" ? people[ui.form.personId] : undefined;
  const deleting = deleteId ? people[deleteId] : undefined;
  const addLink = ui.form?.type === "add" ? ui.form.link : undefined;
  const existingCandidates = addLink ? candidatesForLink(people, addLink) : [];
  const otherParent =
    addLink?.kind === "child"
      ? {
          knownParentName: people[addLink.parentId] ? displayName(people[addLink.parentId]) : "This parent",
          ...otherParentCandidates(people, addLink.parentId),
        }
      : undefined;

  function childLink(otherParentId?: string): PersonLink | undefined {
    if (!addLink) return addLink;
    if (addLink.kind !== "child") return addLink;
    return { ...addLink, otherParentId };
  }

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={ui.collapsed}
        nav={ui.nav}
        askOpen={askOpen}
        onNav={(id) => {
          setAskOpen(false);
          if (id === "story") ui.setStoryPersonId(null);
          ui.setNav(id);
        }}
        onAskClaude={() => {
          if (askOpen) {
            setAskOpen(false);
            return;
          }
          void openAskClaude();
        }}
        todoOpenCount={todos.items.filter((item) => !item.done).length}
      />
      <main className="app-main">
        <AppHeader
          title={headerTitle}
          people={people}
          homePerson={homePersonId ? people[homePersonId] : undefined}
          peopleCountLabel={ui.nav === "tree" ? peopleCountLabel(personCount) : undefined}
          onToggleSidebar={ui.toggleSidebar}
          onAddPerson={personCount === 0 ? () => ui.openAddPerson() : undefined}
          onOpenSettings={() => setSettingsOpen(true)}
          onLocatePerson={ui.locatePerson}
        />
        {ui.nav === "tree" ? (
          <>
            <ChartTabs tab={ui.tab} onTab={ui.setTab} />
            {ui.tab === "timeline" ? (
              <TimelinePage key={store.workspaces.currentId} treeId={store.workspaces.currentId} people={people} homePersonId={homePersonId} />
            ) : (
              <FamilyTreeCanvas
                key={store.workspaces.currentId}
                treeId={store.workspaces.currentId}
                people={people}
                homePersonId={homePersonId}
                selectedId={selectedId}
                locateId={ui.locateId}
                locateKey={ui.locateKey}
                panelOpen={ui.panelOpen}
                chartKind={ui.tab === "fan" ? "fan" : ui.tab === "focus" ? "focus" : "ancestor"}
                onSelect={ui.selectPerson}
                onRecenter={() => {
                  if (ui.tab !== "focus" && homePersonId) ui.selectPerson(homePersonId);
                }}
                onTogglePanel={ui.togglePanel}
                onStub={ui.openStub}
                onAddPerson={() => ui.openAddPerson()}
                treeTitle={treeTitle}
                onStartTree={(name) => {
                  if (name !== treeTitle) void store.renameTree(store.workspaces.currentId, name);
                  ui.openAddPerson();
                }}
                onImportBackup={() => ui.setNav("export")}
                onAddParent={(childId, gender) => {
                  const child = people[childId];
                  const hasFather = child?.parentIds.some((id) => people[id]?.gender === "male");
                  openRelative(
                    { kind: "parent", childId },
                    {
                      familyName: child?.familyName ?? "",
                      gender: gender ?? (hasFather ? "female" : "male"),
                    },
                  );
                }}
                onRemoveParent={store.removeParent}
                onAddSpouse={(personId) => {
                  const person = people[personId];
                  openRelative(
                    { kind: "spouse", personId },
                    {
                      familyName: person?.familyName ?? "",
                      gender: person?.gender === "male" ? "female" : "male",
                    },
                  );
                }}
                onRemoveSpouse={store.removeSpouse}
                onAddChild={(parentId) => {
                  const parent = people[parentId];
                  openRelative(
                    { kind: "child", parentId },
                    { familyName: parent?.familyName ?? "" },
                  );
                }}
                onAddSibling={(personId) => {
                  const person = people[personId];
                  if (!person?.parentIds.length) return;
                  openRelative(
                    { kind: "sibling", personId },
                    { familyName: person.familyName ?? "" },
                  );
                }}
                onRemoveSibling={store.removeSibling}
                onMakeHome={store.makeHome}
                onEdit={ui.openEditPerson}
                onDelete={setDeleteId}
                onAddResidence={store.addResidence}
                onUpdateResidence={store.updateResidence}
                onRemoveResidence={store.removeResidence}
                onAddNotableEvent={store.addNotableEvent}
                onUpdateNotableEvent={store.updateNotableEvent}
                onRemoveNotableEvent={store.removeNotableEvent}
                onSetMarriageDetails={store.setMarriageDetails}
                onSetPhoto={store.setPhoto}
                onSetFlag={store.setFlag}
                onAddJob={store.addJob}
                onUpdateJob={store.updateJob}
                onRemoveJob={store.removeJob}
                onAddMilitaryService={store.addMilitaryService}
                onUpdateMilitaryService={store.updateMilitaryService}
                onRemoveMilitaryService={store.removeMilitaryService}
                onAddMedal={store.addMedal}
                onUpdateMedal={store.updateMedal}
                onRemoveMedal={store.removeMedal}
                onOpenLifeStory={ui.openLifeStory}
              />
            )}
          </>
        ) : ui.nav === "story" ? (
          <LifeStoryPage
            people={people}
            personId={ui.storyPersonId}
            onPick={ui.setStoryPersonId}
            onChangePerson={() => ui.setStoryPersonId(null)}
            onCreateStory={() => setStoryLab({})}
            onEditStory={(id) => setStoryLab({ personId: id })}
          />
        ) : ui.nav === "home" ? (
          <HomePage
            trees={store.workspaces.trees}
            currentId={store.workspaces.currentId}
            onOpen={(id) => {
              void (async () => {
                clearMediaUrlCache();
                await store.switchTree(id);
                await reloadStories();
                ui.setSelectedId(null);
                ui.setStoryPersonId(null);
                ui.setNav("tree");
              })();
            }}
            onCreate={(name) => {
              void (async () => {
                clearMediaUrlCache();
                await store.createTree(name);
                await reloadStories();
                ui.setSelectedId(null);
                ui.setStoryPersonId(null);
                ui.setNav("tree");
              })();
            }}
            onRename={(id, name) => {
              void store.renameTree(id, name);
            }}
          />
        ) : ui.nav === "export" ? (
          <ExportPage
            onPrepareExport={() => flushStories()}
            onPrepareHtmlExport={async () => {
              await flushStories();
              const charts: Record<string, unknown> = {};
              for (const tree of store.workspaces.trees) {
                const raw = localStorage.getItem(chartStorageKey(tree.id));
                if (!raw) continue;
                try {
                  charts[tree.id] = JSON.parse(raw) as unknown;
                } catch {
                  // Skip a broken chart settings blob.
                }
              }
              return charts;
            }}
            onImported={async () => {
              await store.reloadFromDisk();
              await reloadStories();
            }}
            onImportGedcom={(text) => store.mergeGedcomTree(text)}
            onCollapseDuplicates={() => store.collapseDuplicates()}
          />
        ) : ui.nav === "media" ? (
          <MediaPage
            people={people}
            onAddMedia={store.addPersonMedia}
            onRemoveMedia={store.removePersonMedia}
          />
        ) : ui.nav === "todo" ? (
          <TodoPage
            people={people}
            todos={todos}
            onAddTodo={store.addTodo}
            onRemoveTodo={store.removeTodo}
            onSetDone={store.setTodoDone}
            onClearTodos={store.clearTodos}
            onOpenPerson={(id) => {
              ui.setNav("tree");
              ui.selectPerson(id);
            }}
          />
        ) : (
          <PlaceholderPage title={NAV_LABELS[ui.nav]} />
        )}
      </main>
      {settingsOpen && <ApiKeyDialog onClose={() => setSettingsOpen(false)} />}
      {askOpen && (
        <AskClaudeDialog
          treeTitle={treeTitle}
          people={people}
          homePersonId={homePersonId}
          selectedPersonId={selectedId}
          messages={askByTree[store.workspaces.currentId] ?? []}
          onMessages={(messages) =>
            setAskByTree((current) => ({ ...current, [store.workspaces.currentId]: messages }))
          }
          onClose={() => setAskOpen(false)}
          onNeedApiKey={() => {
            setAskOpen(false);
            setSettingsOpen(true);
          }}
        />
      )}
      {ui.stub && <StubDialog title={ui.stub} onClose={ui.closeStub} />}
      {deleting && (
        <ConfirmDeleteDialog
          name={displayName(deleting)}
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            store.deletePerson(deleting.id);
            ui.setSelectedId(null);
            ui.closeForm();
            setDeleteId(null);
          }}
        />
      )}
      {ui.form?.type === "add" && (
        <PersonFormDialog
          key={`add-${ui.form.link?.kind ?? "new"}`}
          title={formTitle(ui.form.link)}
          initial={ui.form.defaults ?? {}}
          submitLabel="Add to tree"
          existingCandidates={existingCandidates}
          otherParent={otherParent}
          onClose={ui.closeForm}
          onSubmit={(draft, otherParentId) => handleAdd(draft, childLink(otherParentId))}
          onSubmitExisting={(id, otherParentId) => handleLinkExisting(id, childLink(otherParentId))}
        />
      )}
      {editing && ui.form?.type === "edit" && (
        <PersonFormDialog
          key={`edit-${editing.id}`}
          title="Edit person"
          initial={draftFromPerson(editing)}
          submitLabel="Save"
          onClose={ui.closeForm}
          onSubmit={(draft) => {
            store.updatePerson(editing.id, draft);
            ui.closeForm();
          }}
        />
      )}
      <StoryLab
        open={storyLab !== null}
        people={people}
        personId={storyLab?.personId}
        onClose={() => setStoryLab(null)}
      />
    </div>
  );
}

function formTitle(link?: PersonLink): string {
  if (link?.kind === "parent") return "Add a parent";
  if (link?.kind === "spouse") return "Add a spouse";
  if (link?.kind === "child") return "Add a child";
  if (link?.kind === "sibling") return "Add a sibling";
  return "Add person";
}

function candidatesForLink(people: Record<string, Person>, link: PersonLink): Person[] {
  if (link.kind === "parent") return existingParentCandidates(people, link.childId);
  if (link.kind === "spouse") return existingSpouseCandidates(people, link.personId);
  if (link.kind === "sibling") return existingSiblingCandidates(people, link.personId);
  return existingChildCandidates(people, link.parentId);
}
