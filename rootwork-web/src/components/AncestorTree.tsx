import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ancestorSpineIds,
  connectorEndpointMismatches,
  connectorLayout,
  extraChildrenOfFamily,
  familyIsCollapsed,
  focusHighlightIds,
  focusHighlightPaths,
  layoutAncestorCards,
  mainLineIds,
  offsetsToMatchPositions,
  positionsFromLayout,
  sameOffsets,
  stabilizeCardOffsets,
  toggleFamilyCollapsed,
  type CardOffset,
  type CardPosition,
} from "../tree/layout";
import { FAMILY_LAYOUT, HIGHLIGHT_SLIDER, highlightLineDim, type FamilyLayoutConstants } from "../chart/familyLayout";
import { setLayoutCheck } from "../dev/layoutCheck";
import { type Person } from "../data/people";
import { IconMinus, IconPlus } from "../icons";
import { hasLifeStory, useLifeStories } from "../stories";
import { PersonCard } from "./PersonCard";
import { PersonContextMenu, type RelativeKind } from "./PersonContextMenu";

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.15;
const ZOOM_SETTLE_MS = 150;
const PANEL_WIDTH = 430;

type View = {
  zoom: number;
  x: number;
  y: number;
};

type AncestorTreeProps = {
  people: Record<string, Person>;
  homeId: string;
  onMakeHome?: (id: string) => void;
  selectedId: string | null;
  locateId?: string | null;
  locateKey?: number;
  panelOpen: boolean;
  maxGenerations: number;
  layoutConstants?: FamilyLayoutConstants;
  highlightDim?: number;
  offsets: Record<string, CardOffset>;
  collapsedIds?: string[];
  collapsedPositions?: Record<string, CardPosition>;
  viewResetKey?: number;
  readOnly?: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, offset: CardOffset) => void;
  onOffsetsChange: (offsets: Record<string, CardOffset>) => void;
  onCollapsedChange?: (ids: string[]) => void;
  onCollapsedPositionsChange?: (positions: Record<string, CardPosition>) => void;
  onAddRelative?: (personId: string, kind: RelativeKind) => void;
  onOpenLifeStory: (id: string) => void;
  onConnectorGap?: (requiredColumnGap: number | null) => void;
};

type Press = {
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  stageX: number;
  stageY: number;
  timer: number;
};

type Drag = {
  id: string;
  ids: string[];
  pointerId: number;
  startWorldX: number;
  startWorldY: number;
  origin: Record<string, CardOffset>;
  deltaX: number;
  deltaY: number;
  lockDeltaX: number | null;
};

type Pan = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

function isToggleClick(event: { ctrlKey: boolean; metaKey: boolean }) {
  return event.ctrlKey || event.metaKey;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function canvasPoint(canvas: HTMLElement, event: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function worldPoint(canvas: HTMLElement, event: { clientX: number; clientY: number }, view: View) {
  const point = canvasPoint(canvas, event);
  return {
    x: (point.x - view.x) / view.zoom,
    y: (point.y - view.y) / view.zoom,
  };
}

function withVerticalLock(drag: Drag, deltaX: number, deltaY: number, shiftKey: boolean): Drag {
  if (!shiftKey) return { ...drag, deltaX, deltaY, lockDeltaX: null };
  const lockDeltaX = drag.lockDeltaX ?? drag.deltaX;
  return { ...drag, deltaX: lockDeltaX, deltaY, lockDeltaX };
}

function offsetsFromDrag(offsets: Record<string, CardOffset>, drag: Drag) {
  const next = { ...offsets };
  for (const id of drag.ids) {
    const origin = drag.origin[id] ?? { dx: 0, dy: 0 };
    next[id] = { dx: origin.dx + drag.deltaX, dy: origin.dy + drag.deltaY };
  }
  return next;
}

function highlightedIds(group: string[], selectedId: string | null) {
  return [...new Set([...group, ...(selectedId ? [selectedId] : [])])];
}

export function AncestorTree({
  people,
  homeId,
  onMakeHome,
  selectedId,
  locateId = null,
  locateKey = 0,
  panelOpen,
  maxGenerations,
  layoutConstants = FAMILY_LAYOUT,
  highlightDim = HIGHLIGHT_SLIDER.fallback,
  offsets,
  collapsedIds = [],
  collapsedPositions = {},
  viewResetKey = 0,
  readOnly = false,
  onSelect,
  onMove: _onMove,
  onOffsetsChange,
  onCollapsedChange,
  onCollapsedPositionsChange,
  onAddRelative,
  onOpenLifeStory,
  onConnectorGap,
}: AncestorTreeProps) {
  useLifeStories();
  const canvasRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<Press | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const panRef = useRef<Pan | null>(null);
  const ignoreClickRef = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [panning, setPanning] = useState(false);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [settledView, setSettledView] = useState<View>({ zoom: 1, x: 40, y: 96 });
  const [menu, setMenu] = useState<{ personId: string; x: number; y: number } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const viewRef = useRef<View>({ zoom: 1, x: 40, y: 96 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const gesturingRef = useRef(false);
  const wheelGestureTimerRef = useRef(0);
  const settleTimerRef = useRef(0);
  const groupRef = useRef(groupIds);
  groupRef.current = groupIds;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const onOffsetsChangeRef = useRef(onOffsetsChange);
  onOffsetsChangeRef.current = onOffsetsChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const collapsedIdsRef = useRef(collapsedIds);
  collapsedIdsRef.current = collapsedIds;
  const collapsedPositionsRef = useRef(collapsedPositions);
  collapsedPositionsRef.current = collapsedPositions;
  const collapsedKey = collapsedIds.slice().sort().join(",");
  const collapsedKeyRef = useRef(collapsedKey);
  const onCollapsedChangeRef = useRef(onCollapsedChange);
  onCollapsedChangeRef.current = onCollapsedChange;
  const onCollapsedPositionsChangeRef = useRef(onCollapsedPositionsChange);
  onCollapsedPositionsChangeRef.current = onCollapsedPositionsChange;

  const shiftRef = useRef(false);
  const liveOffsets = useMemo(() => (drag ? offsetsFromDrag(offsets, drag) : offsets), [offsets, drag]);
  const layoutConstantsRef = useRef(layoutConstants);
  layoutConstantsRef.current = layoutConstants;

  const layout = useMemo(
    () => layoutAncestorCards(people, homeId, maxGenerations, liveOffsets, collapsedIds, layoutConstants),
    [people, homeId, maxGenerations, liveOffsets, collapsedIds, layoutConstants],
  );

  const autoLayout = useMemo(
    () => layoutAncestorCards(people, homeId, maxGenerations, {}, collapsedIds, layoutConstants),
    [people, homeId, maxGenerations, collapsedIds, layoutConstants],
  );

  const spine = useMemo(
    () => ancestorSpineIds(people, homeId, maxGenerations),
    [people, homeId, maxGenerations],
  );

  const fullCardIds = useMemo(
    () => new Set(layoutAncestorCards(people, homeId, maxGenerations, {}, [], layoutConstants).cards.map((card) => card.id)),
    [people, homeId, maxGenerations, layoutConstants],
  );

  const mainLine = useMemo(
    () => mainLineIds(people, homeId, maxGenerations),
    [people, homeId, maxGenerations],
  );

  const layoutRef = useRef(layout);
  const autoLayoutRef = useRef(autoLayout);
  const prevPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const prevCardIdsRef = useRef("");
  const chartReadyRef = useRef(false);
  const stabilizeRanRef = useRef(false);
  const offsetsOnMountRef = useRef<number | null>(null);
  layoutRef.current = layout;
  autoLayoutRef.current = autoLayout;

  function writeTransform() {
    console.log("writeTransform", viewportRef.current == null);
    const viewport = viewportRef.current;
    if (!viewport) return;
    const current = viewRef.current;
    viewport.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) scale(${current.zoom})`;
  }

  function scheduleFrame() {
    console.log("scheduleFrame", frameRef.current);
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      console.log("rAF fired");
      frameRef.current = 0;
      writeTransform();
    });
  }

  function scheduleMirror() {
    window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = 0;
      setSettledView(viewRef.current);
    }, ZOOM_SETTLE_MS);
  }

  function setViewportWillChange(active: boolean) {
    gesturingRef.current = active;
    const viewport = viewportRef.current;
    if (viewport) viewport.style.willChange = active ? "transform" : "auto";
  }

  function startGesture() {
    setViewportWillChange(true);
  }

  function endGesture() {
    if (panRef.current || wheelGestureTimerRef.current) return;
    setViewportWillChange(false);
  }

  function noteWheelGesture() {
    startGesture();
    window.clearTimeout(wheelGestureTimerRef.current);
    wheelGestureTimerRef.current = window.setTimeout(() => {
      wheelGestureTimerRef.current = 0;
      endGesture();
    }, 200);
  }

  function setViewNow(next: View, armSettle = false) {
    console.log("setViewNow", next.x, next.y, next.zoom);
    viewRef.current = next;
    scheduleFrame();
    if (armSettle) scheduleMirror();
  }

  function centerOn(id: string) {
    const canvas = canvasRef.current;
    const card = layoutRef.current.cards.find((item) => item.id === id);
    if (!canvas || !card) return;
    const zoom = viewRef.current.zoom;
    const width = canvas.clientWidth - (panelOpen ? PANEL_WIDTH : 0);
    const height = canvas.clientHeight;
    setViewNow({
      zoom,
      x: width / 2 - (card.x + card.w / 2) * zoom,
      y: height / 2 - (card.y + card.h / 2) * zoom,
    });
  }

  function zoomTo(nextZoom: number, pivotX: number, pivotY: number) {
    const current = viewRef.current;
    const zoom = clampZoom(nextZoom);
    const worldX = (pivotX - current.x) / current.zoom;
    const worldY = (pivotY - current.y) / current.zoom;
    setViewNow({
      zoom,
      x: pivotX - worldX * zoom,
      y: pivotY - worldY * zoom,
    }, true);
  }

  function zoomBy(delta: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth - (panelOpen ? PANEL_WIDTH : 0);
    zoomTo(viewRef.current.zoom + delta, width / 2, canvas.clientHeight / 2);
  }

  function resetZoom() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    viewRef.current = { ...viewRef.current, zoom: 1 };
    const card = layoutRef.current.cards.find((item) => item.id === homeId);
    if (!card) return;
    const zoom = 1;
    const width = canvas.clientWidth - (panelOpen ? PANEL_WIDTH : 0);
    const height = canvas.clientHeight;
    setViewNow({
      zoom,
      x: width / 2 - (card.x + card.w / 2) * zoom,
      y: height / 2 - (card.y + card.h / 2) * zoom,
    }, true);
  }

  useLayoutEffect(() => {
    writeTransform();
  }, []);

  useLayoutEffect(() => {
    centerOn(homeId);
    writeTransform();
    // Recenter when the home person changes or the user asks to reset the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId, viewResetKey]);

  useLayoutEffect(() => {
    if (!locateKey || !locateId) return;
    centerOn(locateId);
    writeTransform();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateKey]);

  useEffect(() => {
    return () => {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = 0;
      window.clearTimeout(wheelGestureTimerRef.current);
      wheelGestureTimerRef.current = 0;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, []);

  useLayoutEffect(() => {
    chartReadyRef.current = false;
    stabilizeRanRef.current = false;
    offsetsOnMountRef.current = null;
    prevPositionsRef.current = {};
    prevCardIdsRef.current = "";
    collapsedKeyRef.current = collapsedIdsRef.current.slice().sort().join(",");
    setGroupIds([]);
    setLayoutCheck({ offsetsOnMount: null, stabilizeRan: false, endpointMismatches: [] });
  }, [homeId]);

  useLayoutEffect(() => {
    if (offsetsOnMountRef.current == null) {
      offsetsOnMountRef.current = Object.keys(offsetsRef.current).length;
      setLayoutCheck({
        offsetsOnMount: offsetsOnMountRef.current,
        stabilizeRan: stabilizeRanRef.current,
      });
    }

    const idKey = autoLayout.cards
      .map((card) => card.id)
      .sort()
      .join(",");
    const idsChanged = idKey !== prevCardIdsRef.current;
    const collapseChanged = collapsedKey !== collapsedKeyRef.current;
    collapsedKeyRef.current = collapsedKey;

    if (!chartReadyRef.current) {
      if (autoLayout.cards.length === 0) return;
      chartReadyRef.current = true;
      prevCardIdsRef.current = idKey;
      prevPositionsRef.current = positionsFromLayout(layout.cards);
      return;
    }

    if (!idsChanged) {
      if (!drag) prevPositionsRef.current = positionsFromLayout(layout.cards);
      return;
    }

    const previousIds = new Set(prevCardIdsRef.current ? prevCardIdsRef.current.split(",") : []);
    prevCardIdsRef.current = idKey;

    const previous = prevPositionsRef.current;
    if (Object.keys(previous).length === 0) {
      prevPositionsRef.current = positionsFromLayout(layout.cards);
      return;
    }

    if (collapseChanged) {
      const remainingIds = autoLayout.cards.map((card) => card.id).filter((id) => previous[id]);
      const added = autoLayout.cards.map((card) => card.id).filter((id) => !previousIds.has(id));
      let nextOffsets = offsetsToMatchPositions(
        autoLayout.cards,
        offsetsRef.current,
        previous,
        remainingIds,
      );
      if (added.length > 0) {
        nextOffsets = offsetsToMatchPositions(
          autoLayout.cards,
          nextOffsets,
          collapsedPositionsRef.current,
          added,
        );
      }
      if (!sameOffsets(nextOffsets, offsetsRef.current)) {
        onOffsetsChangeRef.current(nextOffsets);
      }
      prevPositionsRef.current = Object.fromEntries(
        autoLayout.cards.map((card) => {
          const offset = nextOffsets[card.id] ?? { dx: 0, dy: 0 };
          return [card.id, { x: card.x + offset.dx, y: card.y + offset.dy }];
        }),
      );
      return;
    }

    const nextOffsets = stabilizeCardOffsets(autoLayout.cards, previous, offsetsRef.current);
    stabilizeRanRef.current = true;
    setLayoutCheck({
      offsetsOnMount: offsetsOnMountRef.current,
      stabilizeRan: true,
    });
    prevPositionsRef.current = Object.fromEntries(
      autoLayout.cards.map((card) => {
        const offset = nextOffsets[card.id] ?? { dx: 0, dy: 0 };
        return [card.id, { x: card.x + offset.dx, y: card.y + offset.dy }];
      }),
    );
    if (!sameOffsets(nextOffsets, offsetsRef.current)) {
      onOffsetsChangeRef.current(nextOffsets);
    }
  }, [autoLayout, people, layout, drag, collapsedKey, layoutConstants]);

  useEffect(() => {
    if (!selectedId) {
      setGroupIds([]);
      return;
    }
    setGroupIds((current) => (current.length === 0 || current.includes(selectedId) ? current : []));
  }, [selectedId]);

  useEffect(() => {
    const visible = new Set(layout.cards.map((card) => card.id));
    setGroupIds((current) => {
      const next = current.filter((id) => visible.has(id));
      return next.length === current.length ? current : next;
    });
  }, [layout.cards]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".dialog-backdrop")) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target.isContentEditable) {
          return;
        }
      }
      setGroupIds([]);
      setMenu(null);
      onSelectRef.current(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const host = canvasRef.current;
      if (!host) return;
      noteWheelGesture();
      const point = canvasPoint(host, event);
      const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomTo(viewRef.current.zoom * factor, point.x, point.y);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function clearPress() {
    if (pressRef.current) {
      window.clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
  }

  function beginDrag(press: Press) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shown = layoutRef.current.cards.find((card) => card.id === press.id);
    if (!shown) return;
    const highlighted = highlightedIds(groupRef.current, selectedIdRef.current);
    const ids = highlighted.includes(press.id) && highlighted.length > 1 ? highlighted : [press.id];
    const origin: Record<string, CardOffset> = {};
    for (const id of ids) {
      origin[id] = offsetsRef.current[id] ?? { dx: 0, dy: 0 };
    }
    const next: Drag = {
      id: press.id,
      ids,
      pointerId: press.pointerId,
      startWorldX: press.stageX,
      startWorldY: press.stageY,
      origin,
      deltaX: 0,
      deltaY: 0,
      lockDeltaX: shiftRef.current ? 0 : null,
    };
    dragRef.current = next;
    setDrag(next);
    canvas.setPointerCapture(press.pointerId);
  }

  useEffect(() => {
    function onMovePointer(event: PointerEvent) {
      const pan = panRef.current;
      if (pan && event.pointerId === pan.pointerId) {
        event.preventDefault();
        setViewNow({
          ...viewRef.current,
          x: pan.originX + (event.clientX - pan.startX),
          y: pan.originY + (event.clientY - pan.startY),
        });
        return;
      }
      const press = pressRef.current;
      if (press && event.pointerId === press.pointerId && !dragRef.current) {
        const dist = Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY);
        if (dist > MOVE_CANCEL_PX) clearPress();
        return;
      }
      const current = dragRef.current;
      const canvas = canvasRef.current;
      if (!current || !canvas || event.pointerId !== current.pointerId) return;
      event.preventDefault();
      const point = worldPoint(canvas, event, viewRef.current);
      const next = withVerticalLock(
        current,
        point.x - current.startWorldX,
        point.y - current.startWorldY,
        shiftRef.current || event.shiftKey,
      );
      dragRef.current = next;
      setDrag(next);
    }

    function onShift(event: KeyboardEvent) {
      if (event.key !== "Shift") return;
      shiftRef.current = event.type === "keydown";
      const current = dragRef.current;
      if (!current) return;
      const next = withVerticalLock(current, current.deltaX, current.deltaY, shiftRef.current);
      dragRef.current = next;
      setDrag(next);
    }

    function onUp(event: PointerEvent) {
      const press = pressRef.current;
      const current = dragRef.current;
      const pan = panRef.current;
      if (press && event.pointerId === press.pointerId) clearPress();
      if (pan && event.pointerId === pan.pointerId) {
        panRef.current = null;
        setPanning(false);
        canvasRef.current?.releasePointerCapture(event.pointerId);
        endGesture();
      }
      if (current && event.pointerId === current.pointerId) {
        ignoreClickRef.current = true;
        onOffsetsChangeRef.current(offsetsFromDrag(offsetsRef.current, current));
        dragRef.current = null;
        setDrag(null);
        canvasRef.current?.releasePointerCapture(event.pointerId);
      }
    }

    window.addEventListener("pointermove", onMovePointer, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onShift);
    window.addEventListener("keyup", onShift);
    return () => {
      window.removeEventListener("pointermove", onMovePointer);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onShift);
      window.removeEventListener("keyup", onShift);
    };
  }, []);

  function toggleCollapse(personId: string) {
    const nextCollapsed = toggleFamilyCollapsed(collapsedIdsRef.current, people, personId);
    const hiding = familyIsCollapsed(nextCollapsed, people, personId);
    const currentCards = layoutRef.current.cards;
    const previous = positionsFromLayout(currentCards);
    const nextAuto = layoutAncestorCards(
      people,
      homeId,
      maxGenerations,
      {},
      nextCollapsed,
      layoutConstantsRef.current,
    );
    let snapshot = collapsedPositionsRef.current;
    if (hiding) {
      const nextVisible = new Set(nextAuto.cards.map((card) => card.id));
      snapshot = { ...collapsedPositionsRef.current };
      for (const card of currentCards) {
        if (nextVisible.has(card.id)) continue;
        snapshot[card.id] = { x: card.x, y: card.y };
      }
      onCollapsedPositionsChangeRef.current?.(snapshot);
    }
    const remainingIds = nextAuto.cards.map((card) => card.id).filter((id) => previous[id]);
    const added = nextAuto.cards.map((card) => card.id).filter((id) => !previous[id]);
    let nextOffsets = offsetsToMatchPositions(nextAuto.cards, offsetsRef.current, previous, remainingIds);
    if (added.length > 0) {
      nextOffsets = offsetsToMatchPositions(nextAuto.cards, nextOffsets, snapshot, added);
    }
    if (!sameOffsets(nextOffsets, offsetsRef.current)) {
      onOffsetsChangeRef.current(nextOffsets);
    }
    onCollapsedChangeRef.current?.(nextCollapsed);
  }

  function extraCountFor(personId: string) {
    return extraChildrenOfFamily(people, personId, spine).filter((id) => fullCardIds.has(id)).length;
  }

  function handleSelect(id: string, event?: { shiftKey?: boolean; ctrlKey: boolean; metaKey: boolean }) {
    if (event?.shiftKey) return;
    if (event && isToggleClick(event)) {
      const base = groupRef.current.length
        ? groupRef.current
        : selectedIdRef.current
          ? [selectedIdRef.current]
          : [];
      if (base.includes(id)) {
        const next = base.filter((item) => item !== id);
        setGroupIds(next.length > 1 ? next : []);
        if (next.length === 0) onSelect(null);
        else if (id === selectedIdRef.current) onSelect(next[next.length - 1]);
        return;
      }
      setGroupIds([...base, id]);
      onSelect(id);
      return;
    }

    setGroupIds([]);
    onSelect(id);
  }

  function handleCardPointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (readOnly || event.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    clearPress();
    const point = worldPoint(canvas, event.nativeEvent, viewRef.current);
    pressRef.current = {
      id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      stageX: point.x,
      stageY: point.y,
      timer: window.setTimeout(() => {
        const press = pressRef.current;
        if (press && press.id === id) {
          pressRef.current = null;
          beginDrag(press);
        }
      }, LONG_PRESS_MS),
    };
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    if (event.button === 0 && target.closest(".person-card, .tree-zoom, .card-menu")) return;
    event.preventDefault();
    clearPress();
    const current = viewRef.current;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
    };
    setPanning(true);
    canvasRef.current?.setPointerCapture(event.pointerId);
    startGesture();
  }

  const familyConnectors = useMemo(() => connectorLayout(layout.cards), [layout.cards]);
  const focusId = hoverId ?? selectedId;
  const hotPaths = useMemo(
    () => focusHighlightPaths(layout.cards, focusId),
    [layout.cards, focusId],
  );
  const hotCardIds = useMemo(
    () => focusHighlightIds(layout.cards, focusId),
    [layout.cards, focusId],
  );

  useEffect(() => {
    const nameOf = (id: string) => {
      const person = people[id];
      return person ? `${person.givenName} ${person.familyName}`.trim() : id;
    };
    const endpointMismatches = connectorEndpointMismatches(familyConnectors.paths, layout.cards, nameOf);
    for (const mismatch of endpointMismatches) {
      console.warn("[connectors]", mismatch);
    }
    setLayoutCheck({ endpointMismatches });
  }, [familyConnectors.paths, layout.cards, people]);

  useEffect(() => {
    onConnectorGap?.(familyConnectors.requiredColumnGap);
  }, [familyConnectors.requiredColumnGap, onConnectorGap]);

  const zoomLabel = `${Math.round(settledView.zoom * 100)}%`;

  return (
    <div
      ref={canvasRef}
      className={`tree-scroll${drag || panning ? " is-dragging" : ""}`}
      onPointerDown={handleCanvasPointerDown}
    >
      <div ref={viewportRef} className="tree-viewport">
        <div
          className={`tree-stage${focusId ? " is-focusing" : ""}`}
          style={{
            width: layout.width,
            height: Math.max(layout.height, 420),
            ["--highlight-card-dim" as string]: String(highlightDim / 100),
            ["--highlight-line-dim" as string]: String(highlightLineDim(highlightDim) / 100),
          }}
        >
          <svg
            className={`tree-lines${focusId ? " is-focusing" : ""}`}
            style={{
              left: layout.originX,
              top: layout.originY,
              ["--tree-zoom" as string]: String(settledView.zoom),
              ["--highlight-line-dim" as string]: String(highlightLineDim(highlightDim) / 100),
            }}
            width={layout.width}
            height={layout.height}
            viewBox={`${layout.originX} ${layout.originY} ${layout.width} ${layout.height}`}
            aria-hidden="true"
          >
            <g className="tree-lines-base">
              {familyConnectors.paths.map((edge) => (
                <path
                  key={edge.key}
                  d={edge.d}
                  className={`tree-line${edge.role === "bracket" ? " tree-line-bracket" : " tree-line-kin"}`}
                />
              ))}
            </g>
            {hotPaths.length > 0 ? (
              <g className="tree-lines-hot">
                {hotPaths.map((edge) => (
                  <path
                    key={edge.key}
                    d={edge.d}
                    className="tree-line is-hot"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            ) : null}
          </svg>
          {layout.cards.map((card) => {
            const person = people[card.id];
            if (!person) return null;
            const isDragging = Boolean(drag?.ids.includes(card.id));
            return (
              <div
                key={card.id}
                className={`tree-node${isDragging ? " is-dragging" : ""}${hotCardIds.has(person.id) ? " is-line-hot" : ""}`}
                style={{ left: card.x, top: card.y, width: card.w, height: card.h }}
                onPointerEnter={() => setHoverId(person.id)}
                onPointerLeave={() => setHoverId((current) => (current === person.id ? null : current))}
              >
                <PersonCard
                  person={person}
                  selected={selectedId === person.id || groupIds.includes(person.id)}
                  lineHot={hotCardIds.has(person.id)}
                  mainLine={mainLine.has(person.id)}
                  dragging={isDragging}
                  onSelect={(id, event) => {
                    if (ignoreClickRef.current) {
                      ignoreClickRef.current = false;
                      return;
                    }
                    handleSelect(id, event);
                  }}
                  onPointerDown={(event) => handleCardPointerDown(event, person.id)}
                  onContextMenu={(event, id) => {
                    if (dragRef.current || panRef.current) return;
                    clearPress();
                    handleSelect(id);
                    setMenu({ personId: id, x: event.clientX, y: event.clientY });
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="tree-zoom">
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom in"
          disabled={settledView.zoom >= MAX_ZOOM}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          <IconPlus size={18} />
        </button>
        <button type="button" className="tree-zoom-label" onClick={resetZoom} title="Reset zoom">
          {zoomLabel}
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom out"
          disabled={settledView.zoom <= MIN_ZOOM}
          onClick={() => zoomBy(-ZOOM_STEP)}
        >
          <IconMinus size={18} />
        </button>
      </div>
      {menu && people[menu.personId] && (
        <PersonContextMenu
          x={menu.x}
          y={menu.y}
          canAddParent={people[menu.personId].parentIds.length < 2}
          onMakeHome={
            onMakeHome && !readOnly && menu.personId !== homeId
              ? () => {
                  const personId = menu.personId;
                  setMenu(null);
                  onMakeHome(personId);
                }
              : undefined
          }
          collapseLabel={
            extraCountFor(menu.personId) > 0
              ? familyIsCollapsed(collapsedIds, people, menu.personId)
                ? "Show children"
                : "Hide children"
              : undefined
          }
          onToggleCollapse={
            extraCountFor(menu.personId) > 0 ? () => toggleCollapse(menu.personId) : undefined
          }
          onLifeStory={
            hasLifeStory(menu.personId)
              ? () => {
                  const personId = menu.personId;
                  setMenu(null);
                  onOpenLifeStory(personId);
                }
              : undefined
          }
          onAdd={
            readOnly || !onAddRelative
              ? undefined
              : (kind) => {
                  const personId = menu.personId;
                  setMenu(null);
                  onAddRelative(personId, kind);
                }
          }
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
