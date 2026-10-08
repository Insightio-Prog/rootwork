import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getLayoutCheck, subscribeLayoutCheck } from "./layoutCheck";
import {
  LAYOUT_IDS,
  LAYOUT_LABELS,
  PANEL_GROUP,
  applyLayoutOffsets,
  emptyLayoutOffsets,
  isLayoutId,
  layoutLabEnabledByQuery,
  localDelta,
  roundOffset,
  type LayoutId,
  type LayoutOffset,
  type LayoutOffsets,
} from "./layoutOffsets";
import "./layout-lab.css";

type Drag = {
  ids: LayoutId[];
  origin: Record<LayoutId, LayoutOffset>;
  startX: number;
  startY: number;
  el: HTMLElement;
};

export function LayoutLab() {
  const [on, setOn] = useState(() => layoutLabEnabledByQuery());
  const [offsets, setOffsets] = useState(emptyLayoutOffsets);
  const [groupPanel, setGroupPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [layoutCheck, setLayoutCheckState] = useState(getLayoutCheck);
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const groupRef = useRef(groupPanel);
  groupRef.current = groupPanel;
  const onRef = useRef(on);
  onRef.current = on;
  const dragRef = useRef<Drag | null>(null);
  const movedRef = useRef(false);

  useEffect(() => subscribeLayoutCheck(() => setLayoutCheckState(getLayoutCheck())), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "l") {
        return;
      }
      event.preventDefault();
      setOn((current) => !current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("is-layout-lab", on);
    if (!on) document.documentElement.classList.remove("is-layout-dragging");
    return () => {
      document.documentElement.classList.remove("is-layout-lab");
      document.documentElement.classList.remove("is-layout-dragging");
    };
  }, [on]);

  useEffect(() => {
    applyLayoutOffsets(on ? offsets : null);
  }, [on, offsets]);

  useEffect(() => {
    return () => applyLayoutOffsets(null);
  }, []);

  useEffect(() => {
    function idsFor(id: LayoutId): LayoutId[] {
      if (groupRef.current && PANEL_GROUP.includes(id)) return [...PANEL_GROUP];
      return [id];
    }

    function onPointerDown(event: PointerEvent) {
      if (!onRef.current || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".layout-lab")) return;
      const host = target?.closest("[data-layout]") as HTMLElement | null;
      const id = host?.dataset.layout;
      if (!host || !isLayoutId(id)) return;
      event.preventDefault();
      event.stopPropagation();
      const ids = idsFor(id);
      const current = offsetsRef.current;
      dragRef.current = {
        ids,
        origin: Object.fromEntries(ids.map((item) => [item, { ...current[item] }])) as Record<
          LayoutId,
          LayoutOffset
        >,
        startX: event.clientX,
        startY: event.clientY,
        el: host,
      };
      movedRef.current = false;
      document.documentElement.classList.add("is-layout-dragging");
    }

    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = localDelta(drag.el, event.clientX - drag.startX, event.clientY - drag.startY);
      if (Math.hypot(delta.x, delta.y) > 1) movedRef.current = true;
      const next: LayoutOffsets = { ...offsetsRef.current };
      for (const id of drag.ids) {
        const origin = drag.origin[id];
        next[id] = {
          x: roundOffset(origin.x + delta.x),
          y: roundOffset(origin.y + delta.y),
        };
      }
      setOffsets(next);
    }

    function onPointerUp(event: PointerEvent) {
      if (!dragRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = null;
      document.documentElement.classList.remove("is-layout-dragging");
      if (!movedRef.current) return;
      function swallowClick(click: MouseEvent) {
        click.preventDefault();
        click.stopPropagation();
        window.removeEventListener("click", swallowClick, true);
      }
      window.addEventListener("click", swallowClick, true);
    }

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
    };
  }, []);

  async function copyJson() {
    const text = `${JSON.stringify(offsetsRef.current, null, 2)}\n`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.info("[layout-lab]\n" + text);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!on) return null;

  return createPortal(
    <aside className="layout-lab" role="dialog" aria-label="Layout lab">
      <div className="layout-lab-kicker">Dev</div>
      <h2 className="layout-lab-title">Layout lab</h2>
      <div className="layout-lab-row">
        <span>Offsets count on mount</span>
        <span>{layoutCheck.offsetsOnMount == null ? "—" : layoutCheck.offsetsOnMount}</span>
      </div>
      <div className="layout-lab-row">
        <span>stabilizeCardOffsets</span>
        <span>{layoutCheck.stabilizeRan ? "ran this session" : "did not run"}</span>
      </div>
      <div className="layout-lab-mismatches">
        <div className="layout-lab-row">
          <span>Endpoint mismatches</span>
          <span>{(layoutCheck.endpointMismatches ?? []).length}</span>
        </div>
        {(layoutCheck.endpointMismatches ?? []).length === 0 ? (
          <p className="layout-lab-hint">No path endpoints miss their fromIds/toIds.</p>
        ) : (
          <ul className="layout-lab-mismatch-list">
            {(layoutCheck.endpointMismatches ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
      {LAYOUT_IDS.map((id) => (
        <div key={id} className="layout-lab-row">
          <span>{LAYOUT_LABELS[id]}</span>
          <span>
            {offsets[id].x}, {offsets[id].y}
          </span>
        </div>
      ))}
      <label className="layout-lab-check">
        <input
          type="checkbox"
          checked={groupPanel}
          onChange={(event) => setGroupPanel(event.target.checked)}
        />
        Move photo and flag together
      </label>
      <div className="layout-lab-actions">
        <button type="button" className="btn btn-secondary" onClick={() => void copyJson()}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
        <button type="button" className="btn" onClick={() => setOffsets(emptyLayoutOffsets())}>
          Reset
        </button>
      </div>
      <p className="layout-lab-hint">Ctrl+Shift+L to close. Paste the JSON in chat to hardcode.</p>
    </aside>,
    document.body,
  );
}
