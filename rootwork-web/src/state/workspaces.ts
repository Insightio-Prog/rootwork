import { TREE_TITLE } from "../data/people";
import { EMPTY_TODOS } from "../data/todos";

export type WorkspaceEntry = {
  id: string;
  name: string;
};

export type WorkspaceIndex = {
  currentId: string;
  trees: WorkspaceEntry[];
};

const INDEX_KEY = "rootwork.workspaces.v1";
const LEGACY_TREE_KEY = "rootwork.tree.v1";
const LEGACY_STORIES_KEY = "rootwork.stories.v1";
const LEGACY_CHART_KEY = "rootwork.chart.v1";
const LEGACY_TIMELINE_KEY = "rootwork.timeline.v1";

let currentId = "";
let index: WorkspaceIndex = { currentId: "", trees: [] };

export function getCurrentTreeId() {
  return currentId;
}

export function getWorkspaceIndex() {
  return index;
}

export function treeStorageKey(id = currentId) {
  return `${LEGACY_TREE_KEY}.${id}`;
}

export function storiesStorageKey(id = currentId) {
  return `${LEGACY_STORIES_KEY}.${id}`;
}

export function chartStorageKey(id = currentId) {
  return `${LEGACY_CHART_KEY}.${id}`;
}

export function timelineStorageKey(id = currentId) {
  return `${LEGACY_TIMELINE_KEY}.${id}`;
}

export function chartMigratedKey(id: string) {
  return `rootwork.chart.migratedFrom.v1.${id}`;
}

function copyIfMissing(fromKey: string, toKey: string) {
  if (fromKey === toKey) return;
  const from = localStorage.getItem(fromKey);
  if (!from) return;
  if (localStorage.getItem(toKey)) return;
  localStorage.setItem(toKey, from);
}

export function adoptLegacyViewSettings(next: WorkspaceIndex) {
  const first = next.trees[0];
  if (!first) return;
  const flag = chartMigratedKey(first.id);
  if (!localStorage.getItem(flag)) {
    copyIfMissing(LEGACY_CHART_KEY, chartStorageKey(first.id));
    localStorage.setItem(flag, "1");
  }
  copyIfMissing(LEGACY_TIMELINE_KEY, timelineStorageKey(first.id));
}

function setIndex(next: WorkspaceIndex) {
  index = next;
  currentId = next.currentId;
}

function titleFromTreeRaw(raw: string | null) {
  if (!raw) return TREE_TITLE;
  try {
    const parsed = JSON.parse(raw) as { treeTitle?: string };
    const title = parsed.treeTitle?.trim();
    return title || TREE_TITLE;
  } catch {
    return TREE_TITLE;
  }
}

function emptyTreeRaw(name: string) {
  return JSON.stringify({
    treeTitle: name,
    homePersonId: null,
    people: {},
    todos: EMPTY_TODOS,
  });
}

function migrateBrowserIndex(): WorkspaceIndex {
  const existing = localStorage.getItem(INDEX_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as WorkspaceIndex;
      if (parsed.currentId && parsed.trees?.some((tree) => tree.id === parsed.currentId)) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }
  const id = crypto.randomUUID();
  const legacyTree = localStorage.getItem(LEGACY_TREE_KEY);
  const legacyStories = localStorage.getItem(LEGACY_STORIES_KEY);
  const name = titleFromTreeRaw(legacyTree);
  localStorage.setItem(treeStorageKey(id), legacyTree ?? emptyTreeRaw(name));
  localStorage.setItem(storiesStorageKey(id), legacyStories ?? `${JSON.stringify({ stories: {} })}\n`);
  const next = { currentId: id, trees: [{ id, name }] };
  localStorage.setItem(INDEX_KEY, JSON.stringify(next));
  return next;
}

function writeBrowserIndex(next: WorkspaceIndex) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(next));
  setIndex(next);
}

export async function ensureWorkspaces(): Promise<WorkspaceIndex> {
  const next = migrateBrowserIndex();
  setIndex(next);
  adoptLegacyViewSettings(next);
  return next;
}

export async function createWorkspace(name: string): Promise<WorkspaceIndex> {
  const title = name.trim() || TREE_TITLE;
  const id = crypto.randomUUID();
  localStorage.setItem(treeStorageKey(id), emptyTreeRaw(title));
  localStorage.setItem(storiesStorageKey(id), `${JSON.stringify({ stories: {} })}\n`);
  const next = {
    currentId: id,
    trees: [...index.trees, { id, name: title }],
  };
  writeBrowserIndex(next);
  return next;
}

export async function switchWorkspace(id: string): Promise<WorkspaceIndex> {
  if (!index.trees.some((tree) => tree.id === id)) {
    throw new Error("that tree is not in this browser");
  }
  writeBrowserIndex({ ...index, currentId: id });
  return getWorkspaceIndex();
}

export async function renameWorkspace(id: string, name: string): Promise<WorkspaceIndex> {
  const title = name.trim();
  if (!title) throw new Error("name is required");
  const key = treeStorageKey(id);
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { treeTitle?: string };
      parsed.treeTitle = title;
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch {
      // leave the stored tree as-is
    }
  }
  writeBrowserIndex({
    ...index,
    trees: index.trees.map((tree) => (tree.id === id ? { ...tree, name: title } : tree)),
  });
  return getWorkspaceIndex();
}
