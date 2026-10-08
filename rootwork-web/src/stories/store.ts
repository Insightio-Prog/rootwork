import { useEffect, useSyncExternalStore } from "react";
import { ensureWorkspaces, getCurrentTreeId, storiesStorageKey } from "../state/workspaces";
import type { LifeStory } from "./index";

function storedStory(story: LifeStory): LifeStory {
  return {
    personId: story.personId,
    ...(story.kind ? { kind: story.kind } : {}),
    slug: story.slug,
    title: story.title,
    blocks: story.blocks.map((block) =>
      block.type === "md"
        ? { type: "md" as const, text: block.text }
        : {
            type: "image" as const,
            file: block.file,
            ...(block.caption ? { caption: block.caption } : {}),
            ...(block.media ? { media: block.media } : {}),
          },
    ),
  };
}

function storiesKey() {
  return storiesStorageKey();
}

let stories: Record<string, LifeStory> = {};
const listeners = new Set<() => void>();
let initPromise: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function setStories(next: Record<string, LifeStory>) {
  stories = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return stories;
}

function parseStories(raw: string): Record<string, LifeStory> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return {};
  const record = parsed as { stories?: unknown };
  if (record.stories && typeof record.stories === "object" && !Array.isArray(record.stories)) {
    return record.stories as Record<string, LifeStory>;
  }
  return {};
}

let exportMode = false;

export function hydrateStories(next: Record<string, LifeStory>) {
  exportMode = true;
  setStories(next);
  initPromise = Promise.resolve();
}

async function persist(next: Record<string, LifeStory>) {
  if (exportMode) return;
  const json = `${JSON.stringify({ stories: next }, null, 2)}\n`;
  localStorage.setItem(storiesKey(), json);
}

async function loadStored(): Promise<Record<string, LifeStory> | null> {
  const raw = localStorage.getItem(storiesKey());
  if (raw === null) return null;
  try {
    return parseStories(raw);
  } catch {
    return {};
  }
}

export async function initStories() {
  if (exportMode) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await ensureWorkspaces();
      const loaded = await loadStored();
      setStories(loaded ?? {});
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();
  return initPromise;
}

export async function flushStories() {
  await initStories();
  if (!getCurrentTreeId()) return;
  await persist(stories);
}

export async function reloadStories() {
  if (!getCurrentTreeId()) await ensureWorkspaces();
  initPromise = null;
  const loaded = await loadStored();
  setStories(loaded ?? {});
  initPromise = Promise.resolve();
}

export async function remapStoryPerson(fromId: string, toId: string) {
  await initStories();
  const from = stories[fromId];
  if (!from) return;
  const next = { ...stories };
  delete next[fromId];
  if (!next[toId]) {
    next[toId] = { ...from, personId: toId };
  }
  await persist(next);
  setStories(next);
}

export async function saveStory(story: LifeStory) {
  await initStories();
  const next = { ...stories, [story.personId]: storedStory(story) };
  await persist(next);
  setStories(next);
  return next[story.personId];
}

export async function deleteStory(key: string) {
  await initStories();
  if (!stories[key]) return;
  const next = { ...stories };
  delete next[key];
  await persist(next);
  setStories(next);
}

/** Stories that are about a family line or topic, not one person. */
export function familyStories(all: Record<string, LifeStory>): LifeStory[] {
  return Object.values(all)
    .filter((story) => story.kind === "family")
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

export function hasLifeStory(personId: string): boolean {
  return Boolean(stories[personId]);
}

export function storyFor(personId: string): LifeStory | undefined {
  return stories[personId];
}

export function useLifeStories() {
  useEffect(() => {
    void initStories();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
