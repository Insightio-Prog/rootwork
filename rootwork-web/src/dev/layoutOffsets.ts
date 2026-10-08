export const LAYOUT_IDS = ["tree-flag", "panel-photo", "panel-flag"] as const;

export type LayoutId = (typeof LAYOUT_IDS)[number];

export type LayoutOffset = {
  x: number;
  y: number;
};

export type LayoutOffsets = Record<LayoutId, LayoutOffset>;

export const PANEL_GROUP: LayoutId[] = ["panel-photo", "panel-flag"];

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  "tree-flag": "Tree flag",
  "panel-photo": "Panel photo",
  "panel-flag": "Panel flag",
};

export function emptyLayoutOffsets(): LayoutOffsets {
  return {
    "tree-flag": { x: 0, y: 0 },
    "panel-photo": { x: 0, y: 0 },
    "panel-flag": { x: 0, y: 0 },
  };
}

export function isLayoutId(value: string | null | undefined): value is LayoutId {
  return LAYOUT_IDS.includes(value as LayoutId);
}

export function layoutLabEnabledByQuery(): boolean {
  return new URLSearchParams(window.location.search).get("layout") === "1";
}

export function applyLayoutOffsets(offsets: LayoutOffsets | null) {
  const root = document.documentElement;
  for (const id of LAYOUT_IDS) {
    const xName = `--lab-${id}-x`;
    const yName = `--lab-${id}-y`;
    if (!offsets) {
      root.style.removeProperty(xName);
      root.style.removeProperty(yName);
      continue;
    }
    root.style.setProperty(xName, `${offsets[id].x}px`);
    root.style.setProperty(yName, `${offsets[id].y}px`);
  }
}

export function roundOffset(value: number) {
  return Math.round(value);
}

export function localDelta(el: HTMLElement, clientDx: number, clientDy: number) {
  const rect = el.getBoundingClientRect();
  const scaleX = el.offsetWidth === 0 ? 1 : rect.width / el.offsetWidth;
  const scaleY = el.offsetHeight === 0 ? 1 : rect.height / el.offsetHeight;
  return {
    x: clientDx / (scaleX || 1),
    y: clientDy / (scaleY || 1),
  };
}
