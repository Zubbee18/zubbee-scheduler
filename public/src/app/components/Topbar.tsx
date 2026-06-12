import { ChevronDown, FileText, Menu } from "lucide-react";
import { API_BASE_URL } from "../api";
import { Flame } from "./primitives";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:px-6">
      <button
        className="md:hidden -ml-1 rounded-lg p-1.5 hover:bg-neutral-100"
        onClick={onMenu}
      >
        <Menu className="size-5" />
      </button>

      <button className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-2.5 hover:bg-neutral-50">
        <span className="grid size-5 place-items-center rounded-full bg-orange-500">
          <Flame className="size-3" />
        </span>
        <span className="text-[13px] text-neutral-700">Personal Team</span>
        <ChevronDown className="size-3.5 text-neutral-400" />
      </button>

      <div className="ml-auto flex items-center gap-1">
        <a
          className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100 sm:flex"
          href={`${API_BASE_URL}/api-docs`}
          target="_blank"
          rel="noreferrer"
        >
          <FileText className="size-4" /> Docs
        </a>
        <button className="ml-1 rounded-lg bg-orange-500 px-3 py-1.5 text-[13px] text-white hover:bg-orange-600">
          Upgrade
        </button>
      </div>
    </header>
  );
}
