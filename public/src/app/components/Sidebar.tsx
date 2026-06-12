import {
  Play,
  ScrollText,
  BarChart3,
  Search,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Flame } from "./primitives";

export type PageId = "playground" | "logs" | "dlq" | "stats";

const nav: { id: PageId; label: string; icon: typeof Play }[] = [
  { id: "playground", label: "Playground", icon: Play },
  { id: "logs", label: "Jobs", icon: ScrollText },
  { id: "dlq", label: "Dead-Letter Queue", icon: AlertTriangle },
  { id: "stats", label: "Stats", icon: BarChart3 },
];

export function Sidebar({
  active,
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  active: PageId;
  onNavigate: (id: PageId) => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const go = (id: PageId) => {
    onNavigate(id);
    onClose?.();
  };

  const itemClass = (isActive: boolean) =>
    `flex w-full items-center rounded-lg py-[7px] text-[13px] transition-colors ${
      isActive
        ? "bg-orange-50 text-orange-700"
        : "text-neutral-600 hover:bg-neutral-100"
    }`;

  const shellClass = collapsed ? "w-[72px]" : "w-[248px]";

  return (
    <div
      className={`relative flex h-full flex-col border-r border-neutral-200 bg-[#FBFBFA] transition-[width] duration-200 ${shellClass}`}
    >
      <div className={`flex h-14 items-center ${collapsed ? "justify-center px-2" : "gap-2 px-4"}`}>
        <Flame className="size-[18px]" />
        {!collapsed && (
          <span className="text-[15px] tracking-tight text-neutral-900">
            Zubbee
          </span>
        )}
      </div>

      <div className={`pb-2 ${collapsed ? "px-2" : "px-3"}`}>
        <button className={`flex w-full items-center rounded-lg py-2 text-neutral-500 hover:bg-neutral-100 ${collapsed ? "justify-center px-0" : "gap-2 px-2.5"}`}>
          <Search className="size-4" />
          {!collapsed && (
            <>
              <span className="text-[13px]">Search</span>
              <kbd className="ml-auto rounded border border-neutral-200 bg-white px-1.5 text-[11px] text-neutral-400">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav className={`flex-1 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}>
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={itemClass(id === active)}
            title={label}
            aria-label={label}
          >
            <Icon
              className={`size-4 shrink-0 ${collapsed ? "mx-auto" : "ml-2.5"} ${id === active ? "text-orange-600" : "text-neutral-400"}`}
            />
            {!collapsed && <span className="ml-2.5">{label}</span>}
          </button>
        ))}
      </nav>

      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute bottom-3 right-3 grid size-7 place-items-center rounded-md border border-neutral-200 bg-white text-neutral-500 shadow-sm hover:bg-neutral-50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}
