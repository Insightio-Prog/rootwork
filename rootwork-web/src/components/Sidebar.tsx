import { Fragment, type ReactNode } from "react";
import {
  BrandMark,
  IconAsk,
  IconExport,
  IconHome,
  IconMap,
  IconMedia,
  IconStory,
  IconTasks,
  IconTree,
} from "../icons";
import { NAV_LABELS, type NavId } from "../state/useTreeUi";

const ITEMS: { id: NavId; icon: ReactNode }[] = [
  { id: "home", icon: <IconHome /> },
  { id: "tree", icon: <IconTree /> },
  { id: "story", icon: <IconStory /> },
  { id: "map", icon: <IconMap /> },
  { id: "media", icon: <IconMedia /> },
  { id: "todo", icon: <IconTasks /> },
  { id: "export", icon: <IconExport /> },
];

type SidebarProps = {
  collapsed: boolean;
  nav: NavId;
  askOpen?: boolean;
  onNav: (id: NavId) => void;
  onAskClaude: () => void;
  todoOpenCount?: number;
};

export function Sidebar({
  collapsed,
  nav,
  askOpen = false,
  onNav,
  onAskClaude,
  todoOpenCount = 0,
}: SidebarProps) {
  return (
    <aside className={`app-sidebar ${collapsed ? "is-collapsed" : "is-expanded"}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">
          <BrandMark />
        </div>
        {!collapsed && <span className="brand-name">Rootwork</span>}
      </div>

      {ITEMS.map((item) => (
        <Fragment key={item.id}>
          <button
            type="button"
            className={`nav-item ${nav === item.id && !askOpen ? "is-active" : ""}`}
            onClick={() => onNav(item.id)}
            aria-current={nav === item.id && !askOpen ? "page" : undefined}
            aria-label={NAV_LABELS[item.id]}
          >
            {item.icon}
            {!collapsed && <span className="nav-label">{NAV_LABELS[item.id]}</span>}
            {item.id === "todo" && !collapsed && todoOpenCount > 0 && (
              <span className="nav-badge">{todoOpenCount}</span>
            )}
          </button>
          {item.id === "tree" ? (
            <button
              type="button"
              className={`nav-item ${askOpen ? "is-active" : ""}`}
              onClick={onAskClaude}
              aria-pressed={askOpen}
              aria-label="Ask Claude"
            >
              <IconAsk />
              {!collapsed && <span className="nav-label">Ask Claude</span>}
            </button>
          ) : null}
        </Fragment>
      ))}
    </aside>
  );
}
