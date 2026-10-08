import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { displayName, yearsLabel, type Gender, type Person } from "../data/people";
import { IconMinus, IconPlus } from "../icons";
import {
  branchClass,
  buildFanSlots,
  donutPath,
  FAN_SPAN,
  FAN_START,
  FAN_MAX_GENERATIONS,
  fanMetrics,
  polar,
  ringRadii,
  slotAngles,
} from "../tree/fan";
import { segmentLabel } from "../tree/fanLabel";
import { PersonContextMenu, type RelativeKind } from "./PersonContextMenu";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.15;
const PANEL_WIDTH = 430;

type View = { zoom: number; x: number; y: number };

type Pan = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type FanChartProps = {
  people: Record<string, Person>;
  homeId: string;
  selectedId: string | null;
  panelOpen: boolean;
  maxGenerations: number;
  viewResetKey?: number;
  onSelect: (id: string) => void;
  onAddParent: (childId: string, gender?: Gender) => void;
  onAddRelative: (personId: string, kind: RelativeKind) => void;
};

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function canvasPoint(canvas: HTMLElement, event: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function wrapWords(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || maxLines < 1) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

export function FanChart({
  people,
  homeId,
  selectedId,
  panelOpen,
  maxGenerations,
  viewResetKey = 0,
  onSelect,
  onAddParent,
  onAddRelative,
}: FanChartProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<Pan | null>(null);
  const [panning, setPanning] = useState(false);
  const [view, setView] = useState<View>({ zoom: 1, x: 40, y: 40 });
  const [menu, setMenu] = useState<{ personId: string; x: number; y: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const home = people[homeId];
  const generations = Math.min(FAN_MAX_GENERATIONS, Math.max(2, maxGenerations));
  const metrics = useMemo(() => fanMetrics(generations), [generations]);
  const slots = useMemo(
    () => buildFanSlots(people, homeId, generations),
    [people, homeId, generations],
  );

  function setViewNow(next: View) {
    viewRef.current = next;
    setView(next);
  }

  function fitView() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.clientWidth < 10) return;
    const width = canvas.clientWidth - (panelOpen ? PANEL_WIDTH : 0);
    const height = canvas.clientHeight;
    const zoom = clampZoom(Math.min(width / metrics.width, height / metrics.height) * 0.92);
    setViewNow({
      zoom,
      x: (width - metrics.width * zoom) / 2,
      y: (height - metrics.height * zoom) / 2,
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
  }

  function zoomBy(delta: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth - (panelOpen ? PANEL_WIDTH : 0);
    zoomTo(viewRef.current.zoom + delta, width / 2, canvas.clientHeight / 2);
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fitView();
    if (canvas.clientWidth > 10) return;
    const observer = new ResizeObserver(() => {
      if (canvas.clientWidth > 10) {
        fitView();
        observer.disconnect();
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId, viewResetKey, generations]);

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

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    if (target.closest(".tree-zoom, .card-menu, .fan-seg, .fan-hub, .fan-more")) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
    };
    setPanning(true);
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  const zoomLabel = `${Math.round(view.zoom * 100)}%`;
  const plate = donutPath(metrics.cx, metrics.cy, metrics.hubR, metrics.maxR, FAN_START, FAN_START - FAN_SPAN);

  if (!home) return null;

  return (
    <div
      ref={canvasRef}
      className={`tree-scroll${panning ? " is-dragging" : ""}`}
      onPointerDown={handleCanvasPointerDown}
    >
      <div
        className="tree-viewport fan-viewport"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <svg
          className="fan-chart"
          width={metrics.width}
          height={metrics.height}
          viewBox={`0 0 ${metrics.width} ${metrics.height}`}
        >
          <path className="fan-plate" d={plate} />
          {slots.map((slot) => {
            const { inner, outer } = ringRadii(metrics, slot.generation);
            const { a0, a1, mid } = slotAngles(slot.generation, slot.index);
            const path = donutPath(metrics.cx, metrics.cy, inner, outer, a0, a1);
            const filled = Boolean(slot.person);
            const selected = Boolean(slot.person && slot.person.id === selectedId);
            const canAdd = !filled && Boolean(slot.childId);
            const className = [
              "fan-seg",
              filled ? branchClass(slot.generation, slot.index) : "fan-seg--empty",
              selected ? "is-selected" : "",
              canAdd || filled ? "is-action" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const label = segmentLabel({
              person: slot.person,
              role: slot.role,
              canAdd,
              generation: slot.generation,
              index: slot.index,
              cx: metrics.cx,
              cy: metrics.cy,
              inner,
              outer,
              a0,
              a1,
              mid,
            });
            const clipId = `fan-clip-${slot.generation}-${slot.index}`;
            const title = slot.person
              ? `${displayName(slot.person)} · ${yearsLabel(slot.person)}`
              : canAdd
                ? slot.role === "father"
                  ? "Add father"
                  : "Add mother"
                : undefined;

            return (
              <g
                key={`${slot.generation}-${slot.index}`}
                className={className}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  if (slot.person) onSelect(slot.person.id);
                  else if (slot.childId) onAddParent(slot.childId, slot.role === "father" ? "male" : "female");
                }}
                onContextMenu={(event) => {
                  if (!slot.person) return;
                  event.preventDefault();
                  onSelect(slot.person.id);
                  setMenu({ personId: slot.person.id, x: event.clientX, y: event.clientY });
                }}
              >
                {title ? <title>{title}</title> : null}
                <defs>
                  <clipPath id={clipId}>
                    <path d={path} />
                  </clipPath>
                  {label?.mode === "arc" &&
                    label.lines.map((line) => <path key={line.id} id={line.id} d={line.d} />)}
                </defs>
                <path d={path} />
                {label?.mode === "arc" && (
                  <g clipPath={`url(#${clipId})`}>
                    {label.lines.map((line) => (
                      <text
                        key={line.id}
                        className={
                          line.years
                            ? "fan-text fan-text--years"
                            : slot.person
                              ? "fan-text"
                              : "fan-text fan-text--empty"
                        }
                        textAnchor="middle"
                        fontSize={line.years ? label.fontSize * 0.92 : label.fontSize}
                      >
                        <textPath href={`#${line.id}`} startOffset="50%">
                          {line.text}
                        </textPath>
                      </text>
                    ))}
                  </g>
                )}
                {label?.mode === "radial" && (
                  <g clipPath={`url(#${clipId})`}>
                    <text
                      className={slot.person ? "fan-text" : "fan-text fan-text--empty"}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={label.fontSize}
                      transform={`rotate(${label.rotation} ${label.x} ${label.y})`}
                    >
                      {label.lines.map((line, lineIndex) => (
                        <tspan
                          key={`${line.text}-${lineIndex}`}
                          x={label.x}
                          y={label.y}
                          dy={(-((label.lines.length - 1) / 2) + lineIndex) * label.fontSize * 1.18}
                          className={line.years ? "fan-text--years" : undefined}
                        >
                          {line.text}
                        </tspan>
                      ))}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          <g
            className={`fan-hub${selectedId === home.id ? " is-selected" : ""}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelect(home.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              onSelect(home.id);
              setMenu({ personId: home.id, x: event.clientX, y: event.clientY });
            }}
          >
            <title>{`${displayName(home)} · ${yearsLabel(home)}`}</title>
            <circle cx={metrics.cx} cy={metrics.cy} r={metrics.hubR - 1} />
            {(() => {
              const name = displayName(home);
              const years = yearsLabel(home);
              const hubLines = wrapWords(name, 14, 2);
              if (years !== "Dates unknown") hubLines.push(years);
              const fontSize = 13;
              const lineHeight = 16;
              const startDy = -((hubLines.length - 1) / 2) * lineHeight;
              return (
                <text className="fan-text fan-text--hub" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize}>
                  {hubLines.map((line, lineIndex) => (
                    <tspan
                      key={`${line}-${lineIndex}`}
                      x={metrics.cx}
                      y={metrics.cy}
                      dy={startDy + lineIndex * lineHeight}
                      className={line === years ? "fan-text--years" : undefined}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              );
            })()}
          </g>

          {slots
            .filter((slot) => slot.extraDepth > 0)
            .map((slot) => {
              const { outer } = ringRadii(metrics, slot.generation);
              const { mid } = slotAngles(slot.generation, slot.index);
              const point = polar(metrics.cx, metrics.cy, outer + 16, mid);
              return (
                <g
                  key={`more-${slot.generation}-${slot.index}`}
                  className="fan-more"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => slot.person && onSelect(slot.person.id)}
                >
                  <title>More ancestors beyond this view</title>
                  <circle cx={point.x} cy={point.y} r={11} />
                  <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central">
                    +{slot.extraDepth}
                  </text>
                </g>
              );
            })}
        </svg>
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
        <button type="button" className="tree-zoom-label" onClick={fitView} title="Fit chart">
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
        <PersonContextMenu
          x={menu.x}
          y={menu.y}
          canAddParent={people[menu.personId].parentIds.length < 2}
          onAdd={(kind) => {
            const personId = menu.personId;
            setMenu(null);
            onAddRelative(personId, kind);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
