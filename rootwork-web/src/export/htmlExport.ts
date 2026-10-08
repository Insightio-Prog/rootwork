import type { CardOffset, CardPosition, LayoutSnapshot } from "../tree/layout";
import type { LifeStory } from "../stories";
import type { TreeState } from "../state/useTreeStore";

export type HtmlExportChart = {
  generations?: number;
  fanGenerations?: number;
  lineSurname?: string;
  lineSurnames?: string[];
  cardGap?: number;
  familyGap?: number;
  columnGap?: number;
  highlightDim?: number;
  offsetsByHome?: Record<string, Record<string, CardOffset>>;
  collapsedByHome?: Record<string, string[]>;
  collapsedPositionsByHome?: Record<string, Record<string, CardPosition>>;
  fullLayoutByHome?: Record<string, LayoutSnapshot>;
  lineOffsetsByHome?: Record<string, Record<string, CardOffset>>;
  lineCollapsedByHome?: Record<string, string[]>;
  lineCollapsedPositionsByHome?: Record<string, Record<string, CardPosition>>;
};

export type HtmlExportMedia = {
  mime: string;
  data: string;
};

export type HtmlExportTree = {
  id: string;
  name: string;
  tree: TreeState;
  stories: Record<string, LifeStory>;
  chart?: HtmlExportChart;
  media: Record<string, HtmlExportMedia>;
};

export type HtmlExportPayload = {
  exportedAt: string;
  /** Flag pictures by country code, as data addresses. */
  flags?: Record<string, string>;
  trees: HtmlExportTree[];
};

declare global {
  interface Window {
    ROOTWORK_EXPORT?: HtmlExportPayload | null;
  }
}

export function readHtmlExportPayload(): HtmlExportPayload | null {
  const embedded = document.getElementById("rootwork-export")?.textContent;
  if (embedded?.trim()) {
    try {
      return JSON.parse(embedded) as HtmlExportPayload;
    } catch {
      // Fall through to window payload.
    }
  }
  const payload = window.ROOTWORK_EXPORT;
  if (!payload || !Array.isArray(payload.trees) || payload.trees.length === 0) return null;
  return payload;
}
