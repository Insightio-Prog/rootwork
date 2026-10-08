import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

type FocusContextMenuProps = {
  x: number;
  y: number;
  onViewProfile: () => void;
  onCollapse: () => void;
  onLifeStory?: () => void;
  onMakeHome?: () => void;
  onClose: () => void;
};

export function FocusContextMenu({
  x,
  y,
  onViewProfile,
  onCollapse,
  onLifeStory,
  onMakeHome,
  onClose,
}: FocusContextMenuProps) {
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
      aria-label="Focus tree"
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
      {onMakeHome && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onMakeHome();
            onClose();
          }}
        >
          Make home person
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onViewProfile();
          onClose();
        }}
      >
        View profile
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onCollapse();
          onClose();
        }}
      >
        Collapse to person
      </button>
    </div>,
    document.body,
  );
}
