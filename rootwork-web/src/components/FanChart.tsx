import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { displayName, yearsLabel, type Gender, type Person } from "../data/people";
import { IconMinus, IconPlus } from "../icons";
import {
  branchClass,
  buildFanSlots,
  donutPath,
  FAN_MAX_GENERATIONS,
  fanMetrics,
  fanRingsNeeded,
  polar,
  ringRadii,
} from "../tree/fan";
import { countryNameFor, flagCodeFor, flagCodeFromPlace, flagUrl } from "../data/countries";
import { BRANCH_SWATCHES, ERAS, LIFESPANS, swatchFor, type FanColourMode, type Swatch } from "../tree/fanColours";
import { nationOf } from "../tree/heritage";
import { segmentLabel } from "../tree/fanLabel";
import { PersonContextMenu, type RelativeKind } from "./PersonContextMenu";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.15;
const PANEL_WIDTH = 430;

const MODE_KEY = "rootwork.fan.colour";
const MODES: { id: FanColourMode; label: string }[] = [
  { id: "branch", label: "Branches" },
  { id: "heritage", label: "Heritage" },
  { id: "era", label: "Era" },
  { id: "lifespan", label: "Lifespan" },
];

function loadMode(): FanColourMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return value === "heritage" || value === "era" || value === "lifespan" ? value : "branch";
  } catch {
    return "branch";
  }
}

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
  onMakeHome?: (id: string) => void;
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
  onMakeHome,
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
  const [mode, setMode] = useState<FanColourMode>(loadMode);
  const [rootOverride, setRootOverride] = useState<string | null>(null);
  const [hover, setHover] = useState<{ person: Person; x: number; y: number } | null>(null);

  useEffect(() => setRootOverride(null), [homeId]);
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* private window: fine */
    }
  }, [mode]);

  // Double-clicking a wedge centres the fan on that ancestor; the chart then shows their ancestors instead.
  const centreId = rootOverride && people[rootOverride] ? rootOverride : homeId;
  const home = people[centreId];
  const generations = Math.min(FAN_MAX_GENERATIONS, Math.max(2, maxGenerations));
  const rings = useMemo(
    () => fanRingsNeeded(people, centreId, generations),
    [people, centreId, generations],
  );
  const metrics = useMemo(() => fanMetrics(rings + 1), [rings]);
  const slots = useMemo(
    () => buildFanSlots(people, centreId, generations),
    [people, centreId, generations],
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
  }, [homeId, centreId, viewResetKey, generations, rings]);

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
    if (target.closest(".tree-zoom, .card-menu, .fan-seg, .fan-hub, .fan-more, .fan-modes, .fan-legend")) return;
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

  const legend = useMemo(() => {
    const people_ = slots.flatMap((slot) => (slot.person ? [slot.person] : []));
    if (mode === "branch") {
      const name = (index: number) => {
        const found = slots.find((slot) => slot.generation === 2 && slot.index === index)?.person;
        return found ? displayName(found) : "";
      };
      const items = [
        { key: "b0", label: "Father\u2019s father", detail: name(0), bg: BRANCH_SWATCHES[0] },
        { key: "b1", label: "Father\u2019s mother", detail: name(1), bg: BRANCH_SWATCHES[1] },
        { key: "b2", label: "Mother\u2019s father", detail: name(2), bg: BRANCH_SWATCHES[2] },
        { key: "b3", label: "Mother\u2019s mother", detail: name(3), bg: BRANCH_SWATCHES[3] },
      ];
      return { title: "Branches", note: "Each grandparent\u2019s line has its own colour.", items };
    }
    const counts = new Map<string, number>();
    const seen = new Map<string, Swatch>();
    for (const person of people_) {
      const sw = swatchFor(person, mode);
      if (!sw) continue;
      counts.set(sw.key, (counts.get(sw.key) ?? 0) + 1);
      seen.set(sw.key, sw);
    }
    const base: Swatch[] =
      mode === "era" ? ERAS : mode === "lifespan" ? LIFESPANS : [...seen.values()].sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0));
    const items = base
      .filter((sw) => counts.has(sw.key))
      .map((sw) => ({ key: sw.key, label: sw.label, detail: `${counts.get(sw.key)}`, bg: sw.bg }));
    const titles = { heritage: "Heritage", era: "Born in", lifespan: "Age at death" } as const;
    const notes = {
      heritage: "From nationality, else birthplace.",
      era: "Darker is older.",
      lifespan: "How long each person lived.",
    } as const;
    return { title: titles[mode], note: notes[mode], items };
  }, [slots, mode]);

  const zoomLabel = `${Math.round(view.zoom * 100)}%`;

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
          {slots.map((slot) => {
            const { inner, outer } = ringRadii(metrics, slot.generation);
            const { a0, a1, mid } = slot;
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
            const nation = slot.person ? nationOf(slot.person) : null;
            const flagRoom = Boolean(nation) && metrics.ringW >= 64 && Math.abs(a0 - a1) * ((inner + outer) / 2) >= 48;
            const palette = slot.person ? swatchFor(slot.person, mode) : null;
            const fillStyle = palette ? { fill: palette.bg } : undefined;
            const textStyle = palette ? { fill: palette.fg } : undefined;
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
              flagRoom,
            });
            const clipId = `fan-clip-${slot.generation}-${slot.index}`;
            const title = slot.person
              ? undefined
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
                onPointerMove={(event) => {
                  const host = canvasRef.current;
                  if (slot.person && host) setHover({ person: slot.person, ...canvasPoint(host, event) });
                }}
                onPointerLeave={() => setHover(null)}
                onDoubleClick={() => {
                  if (slot.person) setRootOverride(slot.person.id === homeId ? null : slot.person.id);
                }}
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
                <path d={path} style={fillStyle} />
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
                        style={textStyle}
                        fontSize={line.years ? label.fontSize * 0.92 : label.fontSize}
                      >
                        <textPath href={`#${line.id}`} startOffset="50%">
                          {line.text}
                        </textPath>
                      </text>
                    ))}
                  </g>
                )}
                {flagRoom && label?.mode === "arc" && nation && (() => {
                  const at = polar(metrics.cx, metrics.cy, outer - 9, mid);
                  return (
                    <image
                      href={flagUrl(nation)}
                      x={at.x - 8}
                      y={at.y - 5.5}
                      width={16}
                      height={11}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#${clipId})`}
                      className="fan-flag"
                    />
                  );
                })()}
                {label?.mode === "radial" && (
                  <g clipPath={`url(#${clipId})`}>
                    <text
                      className={slot.person ? "fan-text" : "fan-text fan-text--empty"}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={textStyle}
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
            onDoubleClick={() => setRootOverride(null)}
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
              const { mid } = slot;
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
      <div className={`fan-modes${panelOpen ? " is-panel-open" : ""}`} role="group" aria-label="Fan colours">
        {rootOverride && people[rootOverride] && (
          <button type="button" className="fan-back" onClick={() => setRootOverride(null)}>
            ← Back to {displayName(people[homeId])}
          </button>
        )}
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={mode === item.id ? "is-active" : ""}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={`fan-legend${panelOpen ? " is-panel-open" : ""}`} aria-label="Colour key">
        <div className="fan-legend-title">{legend.title}</div>
        <div className="fan-legend-note">{legend.note}</div>
        {legend.items.map((item) => (
          <div key={item.key} className="fan-legend-row">
            <span className="fan-legend-swatch" style={{ background: item.bg }} />
            <span className="fan-legend-label">{item.label}</span>
            {item.detail && <span className="fan-legend-detail">{item.detail}</span>}
          </div>
        ))}
      </div>
      {hover && (
        <div className="fan-hover" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <strong>{displayName(hover.person)}</strong>
          <span>{yearsLabel(hover.person)}</span>
          {hover.person.birthPlace && <span>Born {hover.person.birthPlace}</span>}
          {(() => {
            const code = flagCodeFor(hover.person.nationality) ?? flagCodeFromPlace(hover.person.birthPlace);
            return code ? (
              <span className="fan-hover-nation">
                <img src={flagUrl(code)} alt="" /> {hover.person.nationality || countryNameFor(code)}
              </span>
            ) : null;
          })()}
          <em>Double-click to centre the fan here</em>
        </div>
      )}
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
          onMakeHome={
            onMakeHome && menu.personId !== homeId
              ? () => {
                  const personId = menu.personId;
                  setMenu(null);
                  onMakeHome(personId);
                }
              : undefined
          }
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
