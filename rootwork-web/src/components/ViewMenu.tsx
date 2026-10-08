import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSearch } from "../icons";
import { MAX_FAMILY_LINES, normalizeFamilyName } from "../tree/layout";

type ViewMenuProps = {
  x: number;
  y: number;
  surnames: { name: string; count: number }[];
  currentSurnames: string[];
  onTidy: () => void;
  onWholeTree: () => void;
  onShowLines: (surnames: string[]) => void;
  onClose: () => void;
};

export function ViewMenu({
  x,
  y,
  surnames,
  currentSurnames,
  onTidy,
  onWholeTree,
  onShowLines,
  onClose,
}: ViewMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(currentSurnames);
  const pickedKeys = useMemo(() => new Set(picked.map(normalizeFamilyName)), [picked]);
  const atLimit = picked.length >= MAX_FAMILY_LINES;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return surnames.filter((item) => !needle || item.name.toLowerCase().includes(needle));
  }, [query, surnames]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const left = Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad));
    const top = Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y, matches.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  function toggle(name: string) {
    const key = normalizeFamilyName(name);
    if (pickedKeys.has(key)) {
      setPicked(picked.filter((item) => normalizeFamilyName(item) !== key));
      return;
    }
    if (atLimit) return;
    setPicked([...picked, name]);
  }

  const applyLabel =
    picked.length <= 1 ? "Show this line" : `Show ${picked.length} lines`;

  return createPortal(
    <div ref={menuRef} className="card-menu view-menu" role="dialog" aria-label="Tree view" style={{ left: x, top: y }}>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onTidy();
          onClose();
        }}
      >
        Tidy layout
      </button>
      <button type="button" role="menuitem" disabled={currentSurnames.length === 0} onClick={onWholeTree}>
        Whole tree
      </button>
      <div className="card-menu-label">Family lines</div>
      <p className="view-menu-hint">Select up to {MAX_FAMILY_LINES}</p>
      <div className="view-menu-search">
        <IconSearch size={14} />
        <input
          type="search"
          value={query}
          placeholder="Search surnames"
          aria-label="Search surnames"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="view-menu-list" role="group" aria-label="Family lines">
        {matches.length === 0 ? (
          <p className="view-menu-empty">No matching surnames.</p>
        ) : (
          matches.map((item) => {
            const checked = pickedKeys.has(normalizeFamilyName(item.name));
            return (
              <label key={item.name} className="view-menu-opt">
                <input
                  type="checkbox"
                  name="family-line"
                  checked={checked}
                  disabled={!checked && atLimit}
                  onChange={() => toggle(item.name)}
                />
                <span>{item.name}</span>
                <span className="view-menu-count">{item.count}</span>
              </label>
            );
          })
        )}
      </div>
      <button
        type="button"
        className="btn btn-primary view-menu-apply"
        disabled={picked.length === 0}
        onClick={() => onShowLines(picked)}
      >
        {applyLabel}
      </button>
    </div>,
    document.body,
  );
}
