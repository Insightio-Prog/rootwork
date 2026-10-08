import type { ReactNode } from "react";
import { IconAncestor, IconFan, IconRelationship, IconTimeline } from "../icons";
import { CHART_TABS, type ChartTabId } from "../state/useTreeUi";

const ICONS: Record<ChartTabId, ReactNode> = {
  ancestor: <IconAncestor size={18} />,
  focus: <IconRelationship size={18} />,
  fan: <IconFan size={18} />,
  timeline: <IconTimeline size={18} />,
};

type ChartTabsProps = {
  tab: ChartTabId;
  onTab: (id: ChartTabId) => void;
};

export function ChartTabs({ tab, onTab }: ChartTabsProps) {
  return (
    <nav className="chart-tabs">
      {CHART_TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`chart-tab${tab === item.id ? " is-active" : ""}`}
          aria-current={tab === item.id ? "page" : undefined}
          onClick={() => onTab(item.id)}
        >
          {ICONS[item.id]}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
