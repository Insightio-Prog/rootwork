import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type RelativeKind = "parent" | "spouse" | "child";

type PersonContextMenuProps = {
  x: number;
  y: number;
  canAddParent: boolean;
  onLifeStory?: () => void;
  collapseLabel?: string;
  onToggleCollapse?: () => void;
  onAdd?: (kind: RelativeKind) => void;
  onClose: () => void;
};

export function PersonContextMenu({
  x,
  y,
  canAddParent,
  onLifeStory,
  collapseLabel,
  onToggleCollapse,
  onAdd,
  onClose,
}: PersonContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const left = Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad));
    const top = Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    function onScroll() {
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="card-menu"
      role="menu"
      aria-label={onAdd ? "Add a relative" : "Person"}
      style={{ left: x, top: y }}
    >
      {onLifeStory && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onLifeStory();
            onClose();
          }}
        >
          Life story
        </button>
      )}
      {onToggleCollapse && collapseLabel && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onToggleCollapse();
            onClose();
          }}
        >
          {collapseLabel}
        </button>
      )}
      {onAdd && (
        <>
          <div className="card-menu-label">Add a relative</div>
          <button
            type="button"
            role="menuitem"
            disabled={!canAddParent}
            title={canAddParent ? undefined : "Two parents already recorded"}
            onClick={() => onAdd("parent")}
          >
            Parent
          </button>
          <button type="button" role="menuitem" onClick={() => onAdd("spouse")}>
            Spouse
          </button>
          <button type="button" role="menuitem" onClick={() => onAdd("child")}>
            Child
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
