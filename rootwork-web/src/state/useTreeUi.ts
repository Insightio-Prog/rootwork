import { useCallback, useState } from "react";
import type { PersonDraft } from "../data/people";
import type { PersonLink } from "./useTreeStore";

export type NavId =
  | "home"
  | "tree"
  | "fan"
  | "timeline"
  | "map"
  | "media"
  | "todo"
  | "export"
  | "story";

export const NAV_LABELS: Record<NavId, string> = {
  home: "Home",
  tree: "Family Tree",
  fan: "Fan Chart",
  timeline: "Timeline",
  map: "Map",
  media: "Media",
  todo: "To-do",
  export: "Export",
  story: "Life Story",
};

export const CHART_TABS = [
  { id: "ancestor", label: "Ancestor Tree" },
  { id: "focus", label: "Focus Tree" },
  { id: "fan", label: "Fan Chart" },
  { id: "timeline", label: "Timeline" },
] as const;

export type ChartTabId = (typeof CHART_TABS)[number]["id"];

export type PersonFormMode =
  | { type: "add"; link?: PersonLink; defaults?: Partial<PersonDraft> }
  | { type: "edit"; personId: string };

export function useTreeUi() {
  const [collapsed, setCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<ChartTabId>("ancestor");
  const [nav, setNav] = useState<NavId>("tree");
  const [storyPersonId, setStoryPersonId] = useState<string | null>(null);
  const [stub, setStub] = useState<string | null>(null);
  const [form, setForm] = useState<PersonFormMode | null>(null);
  const [locateId, setLocateId] = useState<string | null>(null);
  const [locateKey, setLocateKey] = useState(0);

  const toggleSidebar = useCallback(() => {
    setCollapsed((value) => !value);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen((value) => !value);
  }, []);

  const selectPerson = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setPanelOpen(true);
  }, []);

  const locatePerson = useCallback((id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
    setNav("tree");
    setTab((current) => (current === "timeline" ? "ancestor" : current));
    setLocateId(id);
    setLocateKey((value) => value + 1);
  }, []);

  const openStub = useCallback((title: string) => {
    setStub(title);
  }, []);

  const closeStub = useCallback(() => {
    setStub(null);
  }, []);

  const openAddPerson = useCallback((options?: Omit<Extract<PersonFormMode, { type: "add" }>, "type">) => {
    setForm({ type: "add", link: options?.link, defaults: options?.defaults });
  }, []);

  const openEditPerson = useCallback((personId: string) => {
    setForm({ type: "edit", personId });
  }, []);

  const openLifeStory = useCallback((personId: string) => {
    setStoryPersonId(personId);
    setNav("story");
  }, []);

  const closeForm = useCallback(() => {
    setForm(null);
  }, []);

  return {
    collapsed,
    panelOpen,
    selectedId,
    tab,
    nav,
    storyPersonId,
    stub,
    form,
    toggleSidebar,
    togglePanel,
    selectPerson,
    locatePerson,
    locateId,
    locateKey,
    setSelectedId,
    setTab,
    setNav,
    setStoryPersonId,
    openLifeStory,
    openStub,
    closeStub,
    openAddPerson,
    openEditPerson,
    closeForm,
  };
}

export type TreeUi = ReturnType<typeof useTreeUi>;
