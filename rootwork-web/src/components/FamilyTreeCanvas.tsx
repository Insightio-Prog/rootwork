import { WelcomeCard } from "./WelcomeCard";
import { HeritageBar } from "./HeritageBar";
import { useEffect, useMemo, useState } from "react";
import {
  FAMILY_LAYOUT,
  HIGHLIGHT_SLIDER,
  clampHighlightDim,
  clampLayoutGap,
  familyLayoutConstants,
} from "../chart/familyLayout";
import { displayName, type Gender, type Person } from "../data/people";
import { NotesDialog } from "./NotesDialog";
import { IconEye, IconHome, IconPanel, IconPencil, IconSettings, IconTrash } from "../icons";
import { FAN_MAX_GENERATIONS } from "../tree/fan";
import {
  familyLineSurnames,
  peopleForFamilyLine,
  uniqueFamilyLineNames,
  type CardOffset,
  type CardPosition,
  type LayoutSnapshot,
} from "../tree/layout";
import { chartStorageKey } from "../state/workspaces";
import { AncestorTree } from "./AncestorTree";
import { ChartSettingsDialog } from "./ChartSettingsDialog";
import { FanChart } from "./FanChart";
import { FocusTree } from "./FocusTree";
import { PersonPanel } from "./PersonPanel";
import { ViewMenu } from "./ViewMenu";

const DEFAULT_GENERATIONS = 3;
const MIN_GENERATIONS = 2;
const MAX_GENERATIONS = 20;
const EMPTY_IDS: string[] = [];
const EMPTY_OFFSETS: Record<string, CardOffset> = {};
const EMPTY_POSITIONS: Record<string, CardPosition> = {};

export type ChartSettings = {
  generations: number;
  fanGenerations: number;
  lineSurnames: string[];
  cardGap: number;
  familyGap: number;
  columnGap: number;
  highlightDim: number;
  offsetsByHome: Record<string, Record<string, CardOffset>>;
  collapsedByHome: Record<string, string[]>;
  collapsedPositionsByHome: Record<string, Record<string, CardPosition>>;
  fullLayoutByHome: Record<string, LayoutSnapshot>;
  lineOffsetsByHome: Record<string, Record<string, CardOffset>>;
  lineCollapsedByHome: Record<string, string[]>;
  lineCollapsedPositionsByHome: Record<string, Record<string, CardPosition>>;
};

function clampGenerations(value: unknown, max: number, fallback = DEFAULT_GENERATIONS): number {
  const next = Number(value);
  return Number.isInteger(next) && next >= MIN_GENERATIONS && next <= max ? next : fallback;
}

function parseLineSurnames(parsed: { lineSurnames?: unknown; lineSurname?: unknown }): string[] {
  if (Array.isArray(parsed.lineSurnames)) {
    return uniqueFamilyLineNames(parsed.lineSurnames.filter((item): item is string => typeof item === "string"));
  }
  if (typeof parsed.lineSurname === "string") return uniqueFamilyLineNames([parsed.lineSurname]);
  return [];
}

function familyLinesLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} line`;
  return names.join(" · ");
}

function asCardOffsets(value: unknown): Record<string, CardOffset> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, CardOffset> = {};
  for (const [id, offset] of Object.entries(value as Record<string, unknown>)) {
    if (!offset || typeof offset !== "object" || Array.isArray(offset)) continue;
    const dx = Number((offset as { dx?: unknown }).dx);
    const dy = Number((offset as { dy?: unknown }).dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
    next[id] = { dx, dy };
  }
  return next;
}

function asCardPositions(value: unknown): Record<string, CardPosition> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, CardPosition> = {};
  for (const [id, pos] of Object.entries(value as Record<string, unknown>)) {
    if (!pos || typeof pos !== "object" || Array.isArray(pos)) continue;
    const x = Number((pos as { x?: unknown }).x);
    const y = Number((pos as { y?: unknown }).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    next[id] = { x, y };
  }
  return next;
}

function asOffsetMap(value: unknown): Record<string, Record<string, CardOffset>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, Record<string, CardOffset>> = {};
  for (const [homeId, offsets] of Object.entries(value as Record<string, unknown>)) {
    next[homeId] = asCardOffsets(offsets);
  }
  return next;
}

function asIdLists(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, string[]> = {};
  for (const [homeId, ids] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(ids)) continue;
    next[homeId] = ids.filter((id): id is string => typeof id === "string");
  }
  return next;
}

function asPositionMaps(value: unknown): Record<string, Record<string, CardPosition>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, Record<string, CardPosition>> = {};
  for (const [homeId, positions] of Object.entries(value as Record<string, unknown>)) {
    next[homeId] = asCardPositions(positions);
  }
  return next;
}

function asLayoutSnapshots(value: unknown): Record<string, LayoutSnapshot> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, LayoutSnapshot> = {};
  for (const [homeId, snap] of Object.entries(value as Record<string, unknown>)) {
    if (!snap || typeof snap !== "object" || Array.isArray(snap)) continue;
    const record = snap as {
      offsets?: unknown;
      collapsed?: unknown;
      collapsedPositions?: unknown;
    };
    next[homeId] = {
      offsets: asCardOffsets(record.offsets),
      collapsed: Array.isArray(record.collapsed)
        ? record.collapsed.filter((id): id is string => typeof id === "string")
        : [],
      collapsedPositions: asCardPositions(record.collapsedPositions),
    };
  }
  return next;
}

function currentLayoutSnapshot(chart: ChartSettings, homeId: string): LayoutSnapshot {
  return {
    offsets: { ...(chart.offsetsByHome[homeId] ?? {}) },
    collapsed: [...(chart.collapsedByHome[homeId] ?? [])],
    collapsedPositions: { ...(chart.collapsedPositionsByHome[homeId] ?? {}) },
  };
}

export function parseChartSettings(
  parsed: (Partial<ChartSettings> & { lineSurname?: string }) | null | undefined,
): ChartSettings {
  const empty: ChartSettings = {
    generations: DEFAULT_GENERATIONS,
    fanGenerations: DEFAULT_GENERATIONS,
    lineSurnames: [],
    cardGap: FAMILY_LAYOUT.CARD_GAP,
    familyGap: FAMILY_LAYOUT.FAMILY_GAP,
    columnGap: FAMILY_LAYOUT.COLUMN_GAP,
    highlightDim: HIGHLIGHT_SLIDER.fallback,
    offsetsByHome: {},
    collapsedByHome: {},
    collapsedPositionsByHome: {},
    fullLayoutByHome: {},
    lineOffsetsByHome: {},
    lineCollapsedByHome: {},
    lineCollapsedPositionsByHome: {},
  };
  if (!parsed) return empty;
  const generations = clampGenerations(parsed.generations, MAX_GENERATIONS);
  return {
    generations,
    fanGenerations: clampGenerations(
      parsed.fanGenerations,
      FAN_MAX_GENERATIONS,
      Math.min(generations, FAN_MAX_GENERATIONS),
    ),
    lineSurnames: parseLineSurnames(parsed),
    cardGap: clampLayoutGap(parsed.cardGap, "CARD_GAP"),
    familyGap: clampLayoutGap(parsed.familyGap, "FAMILY_GAP"),
    columnGap: clampLayoutGap(parsed.columnGap, "COLUMN_GAP"),
    highlightDim: clampHighlightDim(parsed.highlightDim),
    offsetsByHome: asOffsetMap(parsed.offsetsByHome),
    collapsedByHome: asIdLists(parsed.collapsedByHome),
    collapsedPositionsByHome: asPositionMaps(parsed.collapsedPositionsByHome),
    fullLayoutByHome: asLayoutSnapshots(parsed.fullLayoutByHome),
    lineOffsetsByHome: asOffsetMap(parsed.lineOffsetsByHome),
    lineCollapsedByHome: asIdLists(parsed.lineCollapsedByHome),
    lineCollapsedPositionsByHome: asPositionMaps(parsed.lineCollapsedPositionsByHome),
  };
}

export function loadChartSettings(treeId: string): ChartSettings {
  if (!treeId) return parseChartSettings(null);
  try {
    const raw = localStorage.getItem(chartStorageKey(treeId));
    if (!raw) return parseChartSettings(null);
    return parseChartSettings(JSON.parse(raw) as Partial<ChartSettings>);
  } catch {
    return parseChartSettings(null);
  }
}

export function tidyChartSettings(current: ChartSettings, homePersonId: string): ChartSettings {
  const lineOffsetsByHome = { ...current.lineOffsetsByHome };
  delete lineOffsetsByHome[homePersonId];
  const lineCollapsedPositionsByHome = { ...current.lineCollapsedPositionsByHome };
  delete lineCollapsedPositionsByHome[homePersonId];
  const offsetsByHome = { ...current.offsetsByHome };
  delete offsetsByHome[homePersonId];
  const collapsedPositionsByHome = { ...current.collapsedPositionsByHome };
  delete collapsedPositionsByHome[homePersonId];
  const fullLayoutByHome = {
    ...current.fullLayoutByHome,
    [homePersonId]: {
      offsets: {},
      collapsed: [...(current.collapsedByHome[homePersonId] ?? [])],
      collapsedPositions: {},
    },
  };
  return {
    ...current,
    offsetsByHome,
    collapsedPositionsByHome,
    fullLayoutByHome,
    lineOffsetsByHome,
    lineCollapsedPositionsByHome,
  };
}

type FamilyTreeCanvasProps = {
  onAddNote?: (personId: string, text: string) => void;
  onUpdateNote?: (personId: string, noteId: string, text: string) => void;
  onRemoveNote?: (personId: string, noteId: string) => void;
  treeId: string;
  people: Record<string, Person>;
  homePersonId: string | null;
  selectedId: string | null;
  locateId?: string | null;
  locateKey?: number;
  panelOpen: boolean;
  chartKind?: "ancestor" | "fan" | "focus";
  onSelect: (id: string | null) => void;
  onRecenter: () => void;
  onTogglePanel: () => void;
  onStub: (title: string) => void;
  onAddPerson: () => void;
  treeTitle?: string;
  onStartTree?: (name: string) => void;
  onImportBackup?: () => void;
  onAddParent: (childId: string, gender?: Gender) => void;
  onRemoveParent: (childId: string, parentId: string) => void;
  onAddSpouse: (personId: string) => void;
  onRemoveSpouse: (personId: string, spouseId: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (personId: string) => void;
  onRemoveSibling: (personId: string, siblingId: string) => void;
  onMakeHome: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddResidence: (personId: string, place: string, from: string, to: string) => void;
  onUpdateResidence: (personId: string, residenceId: string, place: string, from: string, to: string) => void;
  onRemoveResidence: (personId: string, residenceId: string) => void;
  onAddNotableEvent: (personId: string, title: string, date: string, detail: string) => void;
  onUpdateNotableEvent: (
    personId: string,
    eventId: string,
    title: string,
    date: string,
    detail: string,
  ) => void | Promise<void>;
  onRemoveNotableEvent: (personId: string, eventId: string) => void;
  onSetMarriageDetails: (personId: string, spouseId: string, date: string, place: string) => void;
  onSetPhoto: (personId: string, file: File) => void;
  onSetFlag: (personId: string, file: File) => void;
  onAddJob: (personId: string, title: string, detail: string) => void;
  onUpdateJob: (personId: string, jobId: string, title: string, detail: string) => void;
  onRemoveJob: (personId: string, jobId: string) => void;
  onAddMilitaryService: (personId: string, served: string, war: string) => void;
  onUpdateMilitaryService: (personId: string, serviceId: string, served: string, war: string) => void;
  onRemoveMilitaryService: (personId: string, serviceId: string) => void;
  onAddMedal: (personId: string, serviceId: string, name: string) => void;
  onUpdateMedal: (personId: string, serviceId: string, medalId: string, name: string) => void;
  onRemoveMedal: (personId: string, serviceId: string, medalId: string) => void;
  onOpenLifeStory: (id: string) => void;
  readOnly?: boolean;
  chartSeed?: Partial<ChartSettings> | null;
};

export function FamilyTreeCanvas({
  treeId,
  people,
  homePersonId,
  selectedId,
  locateId = null,
  locateKey = 0,
  panelOpen,
  chartKind = "ancestor",
  onSelect,
  onRecenter,
  onTogglePanel,
  onAddPerson,
  treeTitle,
  onStartTree,
  onImportBackup,
  onAddParent,
  onRemoveParent,
  onAddSpouse,
  onRemoveSpouse,
  onAddChild,
  onAddSibling,
  onRemoveSibling,
  onMakeHome,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  onEdit,
  onDelete,
  onAddResidence,
  onUpdateResidence,
  onRemoveResidence,
  onAddNotableEvent,
  onUpdateNotableEvent,
  onRemoveNotableEvent,
  onSetMarriageDetails,
  onSetPhoto,
  onSetFlag,
  onAddJob,
  onUpdateJob,
  onRemoveJob,
  onAddMilitaryService,
  onUpdateMilitaryService,
  onRemoveMilitaryService,
  onAddMedal,
  onUpdateMedal,
  onRemoveMedal,
  onOpenLifeStory,
  readOnly = false,
  chartSeed = null,
}: FamilyTreeCanvasProps) {
  const selected = selectedId ? people[selectedId] : undefined;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewResetKey, setViewResetKey] = useState(0);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [viewMenu, setViewMenu] = useState<{ x: number; y: number } | null>(null);
  const [connectorGapHint, setConnectorGapHint] = useState<number | null>(null);
  const [chart, setChart] = useState(() =>
    readOnly ? parseChartSettings(chartSeed) : loadChartSettings(treeId),
  );
  const {
    generations,
    fanGenerations,
    lineSurnames,
    cardGap,
    familyGap,
    columnGap,
    highlightDim,
    offsetsByHome,
    collapsedByHome,
    collapsedPositionsByHome,
    lineOffsetsByHome,
    lineCollapsedByHome,
    lineCollapsedPositionsByHome,
  } = chart;
  const isFan = chartKind === "fan";
  const filtering = lineSurnames.length > 0;
  const visibleGenerations = isFan ? fanGenerations : generations;
  const surnames = useMemo(() => familyLineSurnames(people), [people]);
  const chartPeople = useMemo(
    () => (filtering && homePersonId ? peopleForFamilyLine(people, lineSurnames, homePersonId) : people),
    [people, filtering, lineSurnames, homePersonId],
  );
  const layoutOffsets = homePersonId
    ? filtering
      ? (lineOffsetsByHome[homePersonId] ?? EMPTY_OFFSETS)
      : (offsetsByHome[homePersonId] ?? EMPTY_OFFSETS)
    : EMPTY_OFFSETS;
  const layoutCollapsed = homePersonId
    ? filtering
      ? (lineCollapsedByHome[homePersonId] ?? EMPTY_IDS)
      : (collapsedByHome[homePersonId] ?? EMPTY_IDS)
    : EMPTY_IDS;
  const layoutCollapsedPositions = homePersonId
    ? filtering
      ? (lineCollapsedPositionsByHome[homePersonId] ?? EMPTY_POSITIONS)
      : (collapsedPositionsByHome[homePersonId] ?? EMPTY_POSITIONS)
    : EMPTY_POSITIONS;
  const layoutConstants = useMemo(
    () =>
      familyLayoutConstants({
        CARD_GAP: cardGap,
        FAMILY_GAP: familyGap,
        COLUMN_GAP: columnGap,
      }),
    [cardGap, familyGap, columnGap],
  );

  useEffect(() => {
    if (readOnly || !treeId) return;
    const json = JSON.stringify(chart);
    localStorage.setItem(chartStorageKey(treeId), json);
    return () => {
      localStorage.setItem(chartStorageKey(treeId), json);
    };
  }, [treeId, chart, readOnly]);

  const generationLabel = [
    familyLinesLabel(lineSurnames),
    visibleGenerations === 1 ? "1 generation" : `${visibleGenerations} generations`,
  ]
    .filter(Boolean)
    .join(" · ");

  function refreshView() {
    onRecenter();
    setViewResetKey((key) => key + 1);
  }

  function tidyLayout() {
    if (!homePersonId) return;
    setChart((current) => tidyChartSettings(current, homePersonId));
    refreshView();
  }

  function showWholeTree() {
    if (!homePersonId) return;
    setChart((current) => {
      const snapshot = current.fullLayoutByHome[homePersonId];
      return {
        ...current,
        lineSurnames: [],
        offsetsByHome: {
          ...current.offsetsByHome,
          [homePersonId]: snapshot?.offsets ?? current.offsetsByHome[homePersonId] ?? {},
        },
        collapsedByHome: {
          ...current.collapsedByHome,
          [homePersonId]: snapshot?.collapsed ?? current.collapsedByHome[homePersonId] ?? [],
        },
        collapsedPositionsByHome: {
          ...current.collapsedPositionsByHome,
          [homePersonId]: snapshot?.collapsedPositions ?? current.collapsedPositionsByHome[homePersonId] ?? {},
        },
      };
    });
    setViewMenu(null);
    refreshView();
  }

  function showFamilyLines(names: string[]) {
    if (!homePersonId) return;
    const nextNames = uniqueFamilyLineNames(names);
    if (nextNames.length === 0) return;
    setChart((current) => ({
      ...current,
      lineSurnames: nextNames,
      fullLayoutByHome: current.lineSurnames.length > 0
        ? current.fullLayoutByHome
        : { ...current.fullLayoutByHome, [homePersonId]: currentLayoutSnapshot(current, homePersonId) },
      lineOffsetsByHome: { ...current.lineOffsetsByHome, [homePersonId]: {} },
      lineCollapsedByHome: { ...current.lineCollapsedByHome, [homePersonId]: [] },
      lineCollapsedPositionsByHome: { ...current.lineCollapsedPositionsByHome, [homePersonId]: {} },
    }));
    setViewMenu(null);
    refreshView();
  }

  return (
    <section className="chart-canvas">
      <div className="chart-toolbar">
        <button
          type="button"
          onClick={() => {
            onRecenter();
            setViewResetKey((key) => key + 1);
          }}
          className="btn btn-icon toolbar-home"
          aria-label="Recenter on home person"
          data-tip="Recentre on home person"
          disabled={!homePersonId}
        >
          <IconHome size={18} />
        </button>
        {readOnly ? null : (
        <button
          type="button"
          className={`btn btn-icon toolbar-icon${filtering ? " is-on" : ""}`}
          aria-label="Tree view"
          data-tip="Tree view &amp; family lines"
          aria-expanded={Boolean(viewMenu)}
          disabled={!homePersonId}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setViewMenu({ x: rect.left, y: rect.bottom + 8 });
          }}
        >
          <IconEye size={18} />
        </button>
        )}
        <button
          type="button"
          onClick={onTogglePanel}
          className="btn btn-icon toolbar-icon"
          aria-label="Toggle person panel"
          data-tip="Show or hide person panel"
          disabled={!selected}
        >
          <IconPanel size={18} />
        </button>
        {chartKind !== "focus" && (
          <>
            <button
              type="button"
              className="btn btn-icon toolbar-icon"
              aria-label="Chart settings"
          data-tip="Chart settings"
              onClick={() => setSettingsOpen(true)}
            >
              <IconSettings size={18} />
            </button>
            <div className="toolbar-rule" />
            <span className="toolbar-meta">{generationLabel}</span>
          </>
        )}
      </div>

      {homePersonId && people[homePersonId] ? (
        chartKind === "fan" ? (
          <FanChart
            onOpenNotes={setNotesFor}
            people={chartPeople}
            homeId={homePersonId}
            onMakeHome={readOnly ? undefined : onMakeHome}
            selectedId={selectedId}
            panelOpen={panelOpen && Boolean(selected)}
            maxGenerations={fanGenerations}
            viewResetKey={viewResetKey}
            onSelect={onSelect}
            onAddParent={onAddParent}
            onAddRelative={(personId, kind) => {
              if (kind === "parent") onAddParent(personId);
              else if (kind === "spouse") onAddSpouse(personId);
              else onAddChild(personId);
            }}
          />
        ) : chartKind === "focus" ? (
          <FocusTree
            onOpenNotes={setNotesFor}
            key={homePersonId}
            people={chartPeople}
            homeId={homePersonId}
            onMakeHome={readOnly ? undefined : onMakeHome}
            selectedId={selectedId}
            locateId={locateId}
            locateKey={locateKey}
            panelOpen={panelOpen && Boolean(selected)}
            viewResetKey={viewResetKey}
            onViewProfile={onSelect}
            onOpenLifeStory={onOpenLifeStory}
          />
        ) : (
          <AncestorTree
            onOpenNotes={setNotesFor}
            people={chartPeople}
            homeId={homePersonId}
            onMakeHome={readOnly ? undefined : onMakeHome}
            selectedId={selectedId}
            locateId={locateId}
            locateKey={locateKey}
            panelOpen={panelOpen && Boolean(selected)}
            maxGenerations={generations}
            layoutConstants={layoutConstants}
            highlightDim={highlightDim}
            offsets={layoutOffsets}
            collapsedIds={layoutCollapsed}
            collapsedPositions={layoutCollapsedPositions}
            viewResetKey={viewResetKey}
            readOnly={readOnly}
            onSelect={onSelect}
            onMove={(id, offset) => {
              if (!homePersonId) return;
              setChart((current) => {
                const key = current.lineSurnames.length > 0 ? "lineOffsetsByHome" : "offsetsByHome";
                return {
                  ...current,
                  [key]: {
                    ...current[key],
                    [homePersonId]: {
                      ...current[key][homePersonId],
                      [id]: offset,
                    },
                  },
                };
              });
            }}
            onOffsetsChange={(next) => {
              if (!homePersonId) return;
              setChart((current) => {
                const key = current.lineSurnames.length > 0 ? "lineOffsetsByHome" : "offsetsByHome";
                return {
                  ...current,
                  [key]: {
                    ...current[key],
                    [homePersonId]: next,
                  },
                };
              });
            }}
            onCollapsedChange={(ids) => {
              if (!homePersonId) return;
              setChart((current) => {
                const key = current.lineSurnames.length > 0 ? "lineCollapsedByHome" : "collapsedByHome";
                return {
                  ...current,
                  [key]: {
                    ...current[key],
                    [homePersonId]: ids,
                  },
                };
              });
            }}
            onCollapsedPositionsChange={(positions) => {
              if (!homePersonId) return;
              setChart((current) => {
                const key = current.lineSurnames.length > 0 ? "lineCollapsedPositionsByHome" : "collapsedPositionsByHome";
                return {
                  ...current,
                  [key]: {
                    ...current[key],
                    [homePersonId]: positions,
                  },
                };
              });
            }}
            onAddRelative={(personId, kind) => {
              if (kind === "parent") onAddParent(personId);
              else if (kind === "spouse") onAddSpouse(personId);
              else onAddChild(personId);
            }}
            onOpenLifeStory={onOpenLifeStory}
            onConnectorGap={setConnectorGapHint}
          />
        )
      ) : (
        <div className="empty-tree">
          {!readOnly && onStartTree ? (
            <WelcomeCard
              treeTitle={treeTitle ?? ""}
              onStart={onStartTree}
              onImport={() => onImportBackup?.()}
            />
          ) : (
          <div className="card elev-md placeholder-card">
            <div className="placeholder-kicker">This tree</div>
            <h3>No one here yet</h3>
            <p>
              {readOnly
                ? "This shared copy has no people in this tree."
                : "Add a person to make them the home person, then attach parents, spouses, and children."}
            </p>
            {readOnly ? null : (
            <button type="button" className="btn btn-primary" onClick={onAddPerson}>
              Add person
            </button>
            )}
          </div>
          )}
        </div>
      )}

      {notesFor && people[notesFor] && (
        <NotesDialog
          person={people[notesFor]}
          readOnly={readOnly || !onAddNote}
          onAdd={onAddNote ? (text) => onAddNote(notesFor, text) : undefined}
          onUpdate={onUpdateNote ? (noteId, text) => onUpdateNote(notesFor, noteId, text) : undefined}
          onRemove={onRemoveNote ? (noteId) => onRemoveNote(notesFor, noteId) : undefined}
          onClose={() => setNotesFor(null)}
        />
      )}

      {panelOpen && selected && (
        <PersonPanel
          onOpenNotes={() => setNotesFor(selected.id)}
          people={people}
          person={selected}
          homePersonId={homePersonId}
          onSelect={onSelect}
          onClose={onTogglePanel}
          onMakeHome={() => onMakeHome(selected.id)}
          onAddParent={() => onAddParent(selected.id)}
          onRemoveParent={(parentId) => onRemoveParent(selected.id, parentId)}
          onAddSpouse={() => onAddSpouse(selected.id)}
          onRemoveSpouse={(spouseId) => onRemoveSpouse(selected.id, spouseId)}
          onAddChild={() => onAddChild(selected.id)}
          onRemoveChild={(childId) => onRemoveParent(childId, selected.id)}
          onAddSibling={() => onAddSibling(selected.id)}
          onRemoveSibling={(siblingId) => onRemoveSibling(selected.id, siblingId)}
          onEdit={onEdit}
          onAddResidence={(place, from, to) => onAddResidence(selected.id, place, from, to)}
          onUpdateResidence={(residenceId, place, from, to) =>
            onUpdateResidence(selected.id, residenceId, place, from, to)
          }
          onRemoveResidence={(residenceId) => onRemoveResidence(selected.id, residenceId)}
          onAddNotableEvent={(title, date, detail) =>
            onAddNotableEvent(selected.id, title, date, detail)
          }
          onUpdateNotableEvent={(eventId, title, date, detail) =>
            onUpdateNotableEvent(selected.id, eventId, title, date, detail)
          }
          onRemoveNotableEvent={(eventId) => onRemoveNotableEvent(selected.id, eventId)}
          onSetMarriageDetails={(spouseId, date, place) =>
            onSetMarriageDetails(selected.id, spouseId, date, place)
          }
          onSetPhoto={(file) => onSetPhoto(selected.id, file)}
          onSetFlag={(file) => onSetFlag(selected.id, file)}
          onAddJob={(title, detail) => onAddJob(selected.id, title, detail)}
          onUpdateJob={(jobId, title, detail) => onUpdateJob(selected.id, jobId, title, detail)}
          onRemoveJob={(jobId) => onRemoveJob(selected.id, jobId)}
          onAddMilitaryService={(served, war) => onAddMilitaryService(selected.id, served, war)}
          onUpdateMilitaryService={(serviceId, served, war) =>
            onUpdateMilitaryService(selected.id, serviceId, served, war)
          }
          onRemoveMilitaryService={(serviceId) => onRemoveMilitaryService(selected.id, serviceId)}
          onAddMedal={(serviceId, name) => onAddMedal(selected.id, serviceId, name)}
          onUpdateMedal={(serviceId, medalId, name) =>
            onUpdateMedal(selected.id, serviceId, medalId, name)
          }
          onRemoveMedal={(serviceId, medalId) => onRemoveMedal(selected.id, serviceId, medalId)}
          readOnly={readOnly}
        />
      )}

      {homePersonId && people[homePersonId] ? (
        <HeritageBar
          people={people}
          homeId={homePersonId}
          homeName={displayName(people[homePersonId])}
          panelOpen={panelOpen && Boolean(selected)}
        />
      ) : null}

      {viewMenu && (
        <ViewMenu
          x={viewMenu.x}
          y={viewMenu.y}
          surnames={surnames}
          currentSurnames={lineSurnames}
          onTidy={tidyLayout}
          onWholeTree={showWholeTree}
          onShowLines={showFamilyLines}
          onClose={() => setViewMenu(null)}
        />
      )}
      {chartKind !== "focus" && settingsOpen && (
        <ChartSettingsDialog
          generations={visibleGenerations}
          maxGenerations={isFan ? FAN_MAX_GENERATIONS : MAX_GENERATIONS}
          hint={
            isFan
              ? "How many generations to show, counting the home person as the first. Fan charts go up to 8; further ancestors appear as +N on the outer ring."
              : undefined
          }
          spacing={
            isFan
              ? undefined
              : { cardGap, familyGap, columnGap }
          }
          highlightDim={isFan ? undefined : highlightDim}
          onChange={(next) =>
            setChart((current) =>
              isFan ? { ...current, fanGenerations: next } : { ...current, generations: next },
            )
          }
          onHighlightDimChange={
            isFan
              ? undefined
              : (next) => setChart((current) => ({ ...current, highlightDim: clampHighlightDim(next) }))
          }
          onSpacingChange={
            isFan
              ? undefined
              : (next) =>
                  setChart((current) => ({
                    ...current,
                    cardGap: clampLayoutGap(next.cardGap, "CARD_GAP"),
                    familyGap: clampLayoutGap(next.familyGap, "FAMILY_GAP"),
                    columnGap: clampLayoutGap(next.columnGap, "COLUMN_GAP"),
                  }))
          }
          onResetSpacing={
            isFan
              ? undefined
              : () =>
                  setChart((current) => ({
                    ...current,
                    cardGap: FAMILY_LAYOUT.CARD_GAP,
                    familyGap: FAMILY_LAYOUT.FAMILY_GAP,
                    columnGap: FAMILY_LAYOUT.COLUMN_GAP,
                  }))
          }
          connectorGapHint={isFan ? null : connectorGapHint}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {chartKind !== "focus" && !readOnly && (
      <div className="canvas-fabs">
        {selected && (
          <button
            type="button"
            className="btn btn-secondary delete-fab"
            aria-label="Delete person"
            onClick={() => onDelete(selected.id)}
          >
            <IconTrash size={23} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary edit-fab"
          aria-label="Edit"
          onClick={() => (selected ? onEdit(selected.id) : onAddPerson())}
        >
          <IconPencil size={23} />
        </button>
      </div>
      )}
    </section>
  );
}
