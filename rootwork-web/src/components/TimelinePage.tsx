import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { type Person } from "../data/people";
import { timelineStorageKey } from "../state/workspaces";
import { loadChartSettings } from "./FamilyTreeCanvas";
import { peopleForFamilyLine } from "../tree/layout";
import { IconClose, IconMinus, IconPlus } from "../icons";
import {
  DEFAULT_FAMILY_LINES,
  collectAllTimelineEvents,
  collectTimelineEvents,
  familyNamesInTree,
  linesMatch,
  normalizeFamilyLine,
  placeTimelineLabels,
  type TimelineKind,
} from "../tree/timeline";

function settingsKey(treeId: string) {
  return timelineStorageKey(treeId);
}
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.18;
const YEAR_PX = 56;
const PAD_YEARS = 2;
const LABEL_WIDTH = 176;
const LANE_H = 56;
const STEM = 22;

type TimelineSettings = {
  lines: string[];
  /** "tree" follows whatever the Ancestor Tree is showing; "custom" uses the chips below. */
  mode: "tree" | "custom";
};

function loadSettings(treeId: string): TimelineSettings {
  if (!treeId) return { lines: [...DEFAULT_FAMILY_LINES], mode: "tree" };
  try {
    const raw = localStorage.getItem(settingsKey(treeId));
    if (!raw) return { lines: [...DEFAULT_FAMILY_LINES], mode: "tree" };
    const parsed = JSON.parse(raw) as Partial<TimelineSettings>;
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines.map(normalizeFamilyLine).filter(Boolean)
      : [...DEFAULT_FAMILY_LINES];
    return { lines: lines.length ? lines : [...DEFAULT_FAMILY_LINES], mode: parsed.mode === "custom" ? "custom" : "tree" };
  } catch {
    return { lines: [...DEFAULT_FAMILY_LINES], mode: "tree" };
  }
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function tickStep(zoom: number) {
  if (zoom >= 1.35) return 1;
  if (zoom >= 0.75) return 5;
  return 10;
}

function kindClass(kind: TimelineKind) {
  return `is-${kind}`;
}

type TimelinePageProps = {
  treeId: string;
  people: Record<string, Person>;
  homePersonId: string | null;
};

export function TimelinePage({ treeId, people, homePersonId }: TimelinePageProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; startX: number; originX: number } | null>(null);
  const [settings, setSettings] = useState(() => loadSettings(treeId));
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [panning, setPanning] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const zoomRef = useRef(zoom);
  const offsetRef = useRef(offsetX);
  zoomRef.current = zoom;
  offsetRef.current = offsetX;
  const { lines, mode } = settings;
  const followTree = mode === "tree";
  const treeLines = useMemo(() => (treeId ? loadChartSettings(treeId).lineSurnames : []), [treeId]);
  const viewPeople = useMemo(
    () => (treeLines.length > 0 && homePersonId ? peopleForFamilyLine(people, treeLines, homePersonId) : people),
    [people, treeLines, homePersonId],
  );
  const viewLabel = treeLines.length > 0 ? `${treeLines.join(" & ")} line` : "whole tree";

  useEffect(() => {
    if (!treeId) return;
    const json = JSON.stringify(settings);
    localStorage.setItem(settingsKey(treeId), json);
    return () => {
      localStorage.setItem(settingsKey(treeId), json);
    };
  }, [treeId, settings]);

  const events = useMemo(
    () => (followTree ? collectAllTimelineEvents(viewPeople) : collectTimelineEvents(people, lines)),
    [followTree, viewPeople, people, lines],
  );
  const surnames = useMemo(() => familyNamesInTree(people), [people]);
  const extraNames = surnames.filter((name) => !linesMatch(name, lines));

  const range = useMemo(() => {
    if (events.length === 0) {
      const year = new Date().getFullYear();
      return { min: year - 10, max: year + 2 };
    }
    const years = events.map((event) => event.year);
    return {
      min: Math.min(...years) - PAD_YEARS,
      max: Math.max(...years) + PAD_YEARS,
    };
  }, [events]);

  const span = Math.max(1, range.max - range.min);
  const contentWidth = span * YEAR_PX * zoom;
  const xFor = (at: number) => ((at - range.min) / span) * contentWidth;
  const placed = useMemo(
    () => placeTimelineLabels(events, xFor, LABEL_WIDTH),
    [events, contentWidth],
  );
  const maxLane = placed.reduce((max, event) => Math.max(max, event.lane), 0);
  const halfH = STEM + (maxLane + 1) * LANE_H + 12;

  const ticks = useMemo(() => {
    const step = tickStep(zoom);
    const start = Math.ceil(range.min / step) * step;
    const items: number[] = [];
    for (let year = start; year <= range.max; year += step) items.push(year);
    return items;
  }, [range, zoom]);

  function setView(nextZoom: number, nextX: number) {
    zoomRef.current = nextZoom;
    offsetRef.current = nextX;
    setZoom(nextZoom);
    setOffsetX(nextX);
  }

  function fitView() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(320, canvas.clientWidth - 80);
    const nextZoom = clampZoom(width / (span * YEAR_PX));
    const nextWidth = span * YEAR_PX * nextZoom;
    setView(nextZoom, (canvas.clientWidth - nextWidth) / 2);
  }

  function zoomBy(delta: number, pivot?: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = zoomRef.current;
    const next = clampZoom(current + delta);
    const pivotX = pivot ?? canvas.clientWidth / 2;
    const world = (pivotX - offsetRef.current) / current;
    setView(next, pivotX - world * next);
  }

  const eventKey = events.map((event) => event.id).join(",");

  useLayoutEffect(() => {
    fitView();
    // Refit when the set of events or year span changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, range.min, range.max]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomBy(event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP, event.offsetX);
        return;
      }
      const dx = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const next = offsetRef.current - dx;
      offsetRef.current = next;
      setOffsetX(next);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".tree-zoom, .timeline-toolbar, .timeline-add")) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      originX: offsetRef.current,
    };
    setPanning(true);
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || event.pointerId !== pan.pointerId) return;
    const next = pan.originX + (event.clientX - pan.startX);
    offsetRef.current = next;
    setOffsetX(next);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || event.pointerId !== pan.pointerId) return;
    panRef.current = null;
    setPanning(false);
    canvasRef.current?.releasePointerCapture(event.pointerId);
  }

  function addLine(name: string) {
    const line = normalizeFamilyLine(name);
    if (!line || linesMatch(line, lines)) return;
    setSettings({ ...settings, lines: [...lines, line] });
    setAddOpen(false);
  }

  function removeLine(name: string) {
    setSettings({
      ...settings,
      lines: lines.filter((line) => line.trim().toLowerCase() !== name.trim().toLowerCase()),
    });
  }

  const axisY = halfH;
  const stageH = halfH * 2;
  const zoomLabel = `${Math.round(zoom * 100)}%`;

  return (
    <section className="timeline-page">
      <div className="timeline-toolbar">
        <div className="timeline-mode" role="group" aria-label="Timeline source">
          <button
            type="button"
            className={followTree ? "is-active" : ""}
            onClick={() => setSettings({ ...settings, mode: "tree" })}
          >
            Follow tree view
          </button>
          <button
            type="button"
            className={followTree ? "" : "is-active"}
            onClick={() => setSettings({ ...settings, mode: "custom" })}
          >
            Pick lines
          </button>
        </div>
        {followTree && <span className="timeline-kicker">Showing the {viewLabel}</span>}
        {!followTree && lines.map((line) => (
          <span key={line} className="timeline-chip">
            {line}
            <button type="button" aria-label={`Remove ${line}`} onClick={() => removeLine(line)}>
              <IconClose size={12} />
            </button>
          </span>
        ))}
        {!followTree && extraNames.length > 0 && (
          <div className="timeline-add">
            {addOpen ? (
              <select
                className="input timeline-add-select"
                autoFocus
                defaultValue=""
                onChange={(event) => addLine(event.target.value)}
                onBlur={() => setAddOpen(false)}
              >
                <option value="" disabled>
                  Add a line
                </option>
                {extraNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <button type="button" className="btn btn-secondary timeline-add-btn" onClick={() => setAddOpen(true)}>
                Add line
              </button>
            )}
          </div>
        )}
        <div className="timeline-legend">
          <span className="timeline-key is-birth">Birth</span>
          <span className="timeline-key is-marriage">Marriage</span>
          <span className="timeline-key is-death">Death</span>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`timeline-canvas${panning ? " is-panning" : ""}`}
        onPointerDown={onPointerDown}
        onDragStart={(event) => event.preventDefault()}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {events.length === 0 ? (
          <div className="timeline-empty">
            <div className="timeline-empty-kicker">Timeline</div>
            <h3>No dated events yet</h3>
            <p>
              {followTree
                ? `Add birth, marriage, or death dates for the ${viewLabel}.`
                : lines.length === 0
                ? "Add a family line to plot births, marriages, and deaths."
                : `Add birth, marriage, or death dates for the ${lines.join(" and ")} line${lines.length === 1 ? "" : "s"}.`}
            </p>
          </div>
        ) : (
          <div
            className="timeline-stage"
            style={{
              width: contentWidth + 80,
              height: stageH,
              transform: `translate(${offsetX}px, calc(50% - ${axisY}px))`,
            }}
          >
            <svg className="timeline-svg" width={contentWidth + 80} height={stageH} aria-hidden="true">
              <line
                className="timeline-axis"
                x1={0}
                x2={contentWidth + 80}
                y1={axisY}
                y2={axisY}
              />
              {ticks.map((year) => {
                const x = xFor(year);
                return (
                  <g key={year}>
                    <line className="timeline-tick" x1={x} x2={x} y1={axisY - 7} y2={axisY + 7} />
                    <text className="timeline-year" x={x} y={axisY + 22} textAnchor="middle">
                      {year}
                    </text>
                  </g>
                );
              })}
              {placed.map((event) => {
                const y2 = axisY - event.side * (STEM + event.lane * LANE_H);
                return (
                  <line
                    key={`${event.id}-stem`}
                    className={`timeline-stem ${kindClass(event.kind)}`}
                    x1={event.x}
                    x2={event.x}
                    y1={axisY}
                    y2={y2}
                  />
                );
              })}
              {placed.map((event) => (
                <circle
                  key={`${event.id}-dot`}
                  className={`timeline-dot ${kindClass(event.kind)}`}
                  cx={event.x}
                  cy={axisY}
                  r={5}
                />
              ))}
            </svg>
            {placed.map((event) => {
              const top =
                event.side === 1
                  ? axisY - (STEM + event.lane * LANE_H) - 38
                  : axisY + (STEM + event.lane * LANE_H) + 4;
              return (
                <div
                  key={event.id}
                  className={`timeline-label ${kindClass(event.kind)}`}
                  style={{ left: event.x, top, width: LABEL_WIDTH }}
                >
                  <div className="timeline-label-title">{event.title}</div>
                  <div className="timeline-label-date">{event.dateLabel}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tree-zoom">
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          <IconPlus size={18} />
        </button>
        <button type="button" className="tree-zoom-label" onClick={fitView} title="Fit all events">
          {zoomLabel}
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => zoomBy(-ZOOM_STEP)}
        >
          <IconMinus size={18} />
        </button>
      </div>
    </section>
  );
}
