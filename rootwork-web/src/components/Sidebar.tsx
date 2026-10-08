import { Fragment, type ReactNode } from "react";
import {
  BrandMark,
  IconAsk,
  IconExport,
  IconFan,
  IconHome,
  IconMap,
  IconMedia,
  IconStory,
  IconTasks,
  IconTree,
} from "../icons";
import { isSharedCopy } from "../share/info";
import { NAV_LABELS, type NavId } from "../state/useTreeUi";

const ITEMS: { id: NavId; icon: ReactNode }[] = [
  { id: "home", icon: <IconHome /> },
  { id: "tree", icon: <IconTree /> },
  { id: "fan", icon: <IconFan /> },
  { id: "story", icon: <IconStory /> },
  { id: "map", icon: <IconMap /> },
  { id: "media", icon: <IconMedia /> },
  { id: "todo", icon: <IconTasks /> },
  { id: "export", icon: <IconExport /> },
];

const PHONE_ITEMS = new Set<NavId>(["home", "tree", "fan", "story", "media", "export"]);
const PHONE_LABELS: Partial<Record<NavId, string>> = { tree: "Family", fan: "Fan", story: "Stories", export: "Backup" };

type SidebarProps = {
  collapsed: boolean;
  nav: NavId;
  askOpen?: boolean;
  onNav: (id: NavId) => void;
  onAskClaude: () => void;
  todoOpenCount?: number;
  phone?: boolean;
};

export function Sidebar({
  collapsed,
  nav,
  askOpen = false,
  onNav,
  onAskClaude,
  todoOpenCount = 0,
  phone = false,
}: SidebarProps) {
  return (
    <aside className={`app-sidebar ${collapsed ? "is-collapsed" : "is-expanded"}${phone ? " is-phone" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">
          <BrandMark />
        </div>
        {!collapsed && <span className="brand-name">Rootwork</span>}
      </div>

      {ITEMS.filter((item) => !(isSharedCopy && item.id === "map")).filter((item) => (phone ? PHONE_ITEMS.has(item.id) : item.id !== "fan")).map((item) => (
        <Fragment key={item.id}>
          <button
            type="button"
            className={`nav-item ${nav === item.id && !askOpen ? "is-active" : ""}`}
            onClick={() => onNav(item.id)}
            aria-current={nav === item.id && !askOpen ? "page" : undefined}
            aria-label={NAV_LABELS[item.id]}
          >
            {item.icon}
            {!collapsed && <span className="nav-label">{(phone && PHONE_LABELS[item.id]) || NAV_LABELS[item.id]}</span>}
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
              {!collapsed && <span className="nav-label">{phone ? "Ask" : "Ask Claude"}</span>}
            </button>
          ) : null}
        </Fragment>
      ))}
    </aside>
  );
}
