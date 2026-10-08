import type { ReactNode } from "react";
import { IconAncestor, IconFan, IconRelationship, IconTimeline } from "../icons";
import { CHART_TABS, type ChartTabId } from "../state/useTreeUi";

const ICONS: Record<ChartTabId, ReactNode> = {
  ancestor: <IconAncestor size={22} />,
  focus: <IconRelationship size={22} />,
  fan: <IconFan size={22} />,
  timeline: <IconTimeline size={22} />,
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
          className="chart-tab"
          onClick={() => onTab(item.id)}
        >
          {ICONS[item.id]}
          {item.label}
          {tab === item.id && <div className="chart-tab-underline" />}
        </button>
      ))}
    </nav>
  );
}
