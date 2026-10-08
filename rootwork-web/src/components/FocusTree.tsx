import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { familyTrunks, layoutFocusCards, pathHomeToPerson } from "../tree/layout";
import { orderedParents, type Person } from "../data/people";
import { hasLifeStory, useLifeStories } from "../stories";
import { IconMinus, IconPlus } from "../icons";
import { FocusContextMenu } from "./FocusContextMenu";
import { NoteTab } from "./NoteTab";
import { PersonCard } from "./PersonCard";

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

type Pan = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type FocusTreeProps = {
  people: Record<string, Person>;
  homeId: string;
  onMakeHome?: (id: string) => void;
  onOpenNotes?: (id: string) => void;
  selectedId: string | null;
  locateId?: string | null;
  locateKey?: number;
  panelOpen: boolean;
  viewResetKey?: number;
  onViewProfile: (id: string) => void;
  onOpenLifeStory: (id: string) => void;
};

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function canvasPoint(canvas: HTMLElement, event: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function FocusTree({
  people,
  homeId,
  onMakeHome,
  onOpenNotes,
  selectedId,
  locateId = null,
  locateKey = 0,
  panelOpen,
  viewResetKey = 0,
  onViewProfile,
  onOpenLifeStory,
}: FocusTreeProps) {
  useLifeStories();
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<Pan | null>(null);
  const [panning, setPanning] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([homeId]);
  const [view, setView] = useState<View>({ zoom: 1, x: 40, y: 96 });
  const [renderZoom, setRenderZoom] = useState(1);
  const [menu, setMenu] = useState<{ personId: string; x: number; y: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const renderZoomRef = useRef(1);
  const settleTimerRef = useRef(0);
  const layoutRef = useRef(layoutFocusCards(people, homeId, expandedIds));

  const layout = useMemo(
    () => layoutFocusCards(people, homeId, expandedIds),
    [people, homeId, expandedIds],
  );
  layoutRef.current = layout;

  useLayoutEffect(() => {
    setExpandedIds([homeId]);
  }, [homeId]);

  function setViewNow(next: View) {
    viewRef.current = next;
    setView(next);
  }

  function bakeZoom(zoom: number) {
    window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = 0;
    if (renderZoomRef.current === zoom) return;
    renderZoomRef.current = zoom;
    setRenderZoom(zoom);
  }

  function scheduleBake(zoom: number) {
    window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      bakeZoom(zoom);
    }, ZOOM_SETTLE_MS);
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
    });
    scheduleBake(zoom);
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
    bakeZoom(1);
    viewRef.current = { ...viewRef.current, zoom: 1 };
    centerOn(homeId);
  }

  useLayoutEffect(() => {
    bakeZoom(viewRef.current.zoom);
    centerOn(homeId);
    // Recenter when the home person changes or the user resets the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId, viewResetKey]);

  const pendingLocateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!locateKey || !locateId) return;
    pendingLocateRef.current = locateId;
    const path = pathHomeToPerson(people, homeId, locateId);
    if (!path) return;
    setExpandedIds(path.slice(0, -1).length ? path.slice(0, -1) : [homeId]);
  }, [locateKey, locateId, homeId, people]);

  useLayoutEffect(() => {
    const id = pendingLocateRef.current;
    if (!id) return;
    if (!layout.cards.some((card) => card.id === id)) return;
    centerOn(id);
    pendingLocateRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, locateKey]);

  useEffect(() => {
    return () => window.clearTimeout(settleTimerRef.current);
  }, []);

  useEffect(() => {
    const visible = new Set(layout.cards.map((card) => card.id));
    setExpandedIds((current) => {
      const next = current.filter((id) => id === homeId || visible.has(id));
      return next.length === current.length ? current : next.length ? next : [homeId];
    });
  }, [layout.cards, homeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const host = canvasRef.current;
      if (!host) return;
      const point = canvasPoint(host, event);
      const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomTo(viewRef.current.zoom * factor, point.x, point.y);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function expandPerson(id: string) {
    const person = people[id];
    if (!person) return;
    const visible = new Set(layoutRef.current.cards.map((card) => card.id));
    const parents = orderedParents(people, person).slice(0, 2);
    if (parents.length === 0) return;
    if (parents.every((parent) => visible.has(parent.id))) return;
    setExpandedIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function collapseToPerson(id: string) {
    if (id === homeId) {
      setExpandedIds([homeId]);
      return;
    }
    const path = pathHomeToPerson(people, homeId, id);
    if (!path) return;
    setExpandedIds(path.slice(0, -1).length ? path.slice(0, -1) : [homeId]);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    if (event.button === 0 && target.closest(".person-card, .tree-zoom, .card-menu")) return;
    event.preventDefault();
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
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const pan = panRef.current;
      if (!pan || event.pointerId !== pan.pointerId) return;
      event.preventDefault();
      setViewNow({
        ...viewRef.current,
        x: pan.originX + (event.clientX - pan.startX),
        y: pan.originY + (event.clientY - pan.startY),
      });
    }
    function onUp(event: PointerEvent) {
      const pan = panRef.current;
      if (!pan || event.pointerId !== pan.pointerId) return;
      panRef.current = null;
      setPanning(false);
      canvasRef.current?.releasePointerCapture(event.pointerId);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const familyLines = familyTrunks(layout.cards);
  const zoomLabel = `${Math.round(view.zoom * 100)}%`;
  const previewScale = view.zoom / renderZoom;
  const zoomSettled = Math.abs(previewScale - 1) < 0.001;

  return (
    <div
      ref={canvasRef}
      className={`tree-scroll${panning ? " is-dragging" : ""}`}
      onPointerDown={handleCanvasPointerDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className={`tree-viewport${zoomSettled ? " is-settled" : ""}`}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${previewScale})`,
        }}
      >
        <div
          className="tree-stage"
          style={{
            width: layout.width,
            height: Math.max(layout.height, 420),
            zoom: renderZoom,
          }}
        >
          <svg
            className="tree-lines"
            style={{ left: layout.originX, top: layout.originY }}
            width={layout.width}
            height={layout.height}
            viewBox={`${layout.originX} ${layout.originY} ${layout.width} ${layout.height}`}
            aria-hidden="true"
          >
            {familyLines.map((edge) => (
              <path key={edge.key} d={edge.d} className="tree-line" />
            ))}
          </svg>
          {layout.cards.map((card) => {
            const person = people[card.id];
            if (!person) return null;
            return (
              <div
                key={card.id}
                className="tree-node"
                style={{ left: card.x, top: card.y, width: card.w, height: card.h }}
              >
                <PersonCard
                  touchMenu
                  person={person}
                  selected={selectedId === person.id}
                  onSelect={(id) => expandPerson(id)}
                  onContextMenu={(event, id) => {
                    if (panRef.current && event.type !== "longpress") return;
                    setMenu({ personId: id, x: event.clientX, y: event.clientY });
                  }}
                />
                <NoteTab person={person} onOpen={onOpenNotes} />
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
          disabled={view.zoom >= MAX_ZOOM}
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
          disabled={view.zoom <= MIN_ZOOM}
          onClick={() => zoomBy(-ZOOM_STEP)}
        >
          <IconMinus size={18} />
        </button>
      </div>
      {menu && people[menu.personId] && (
        <FocusContextMenu
          x={menu.x}
          y={menu.y}
          onViewProfile={() => onViewProfile(menu.personId)}
          onCollapse={() => collapseToPerson(menu.personId)}
          onAddNote={
            onOpenNotes
              ? () => {
                  const personId = menu.personId;
                  setMenu(null);
                  onOpenNotes(personId);
                }
              : undefined
          }
          onMakeHome={
            onMakeHome && menu.personId !== homeId
              ? () => {
                  const personId = menu.personId;
                  setMenu(null);
                  onMakeHome(personId);
                }
              : undefined
          }
          onLifeStory={
            hasLifeStory(menu.personId) ? () => onOpenLifeStory(menu.personId) : undefined
          }
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
