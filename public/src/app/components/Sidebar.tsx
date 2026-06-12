import {
  Play,
  ScrollText,
  BarChart3,
  Search,
  AlertTriangle,
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
}: {
  active: PageId;
  onNavigate: (id: PageId) => void;
  onClose?: () => void;
}) {
  const go = (id: PageId) => {
    onNavigate(id);
    onClose?.();
  };

  const itemClass = (isActive: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors ${
      isActive
        ? "bg-orange-50 text-orange-700"
        : "text-neutral-600 hover:bg-neutral-100"
    }`;

  return (
    <div className="flex h-full w-[248px] flex-col bg-[#FBFBFA] border-r border-neutral-200">
      <div className="flex items-center gap-2 px-4 h-14">
        <Flame className="size-[18px]" />
        <span className="text-[15px] tracking-tight text-neutral-900">
          Zubbee
        </span>
      </div>

      <div className="px-3 pb-2">
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-neutral-500 hover:bg-neutral-100">
          <Search className="size-4" />
          <span className="text-[13px]">Search</span>
          <kbd className="ml-auto rounded border border-neutral-200 bg-white px-1.5 text-[11px] text-neutral-400">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={itemClass(id === active)}
          >
            <Icon
              className={`size-4 ${id === active ? "text-orange-600" : "text-neutral-400"}`}
            />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
