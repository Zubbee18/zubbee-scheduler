import { useState } from "react";
import { Sidebar, PageId } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Playground } from "./components/pages/Playground";
import { ActivityLogs } from "./components/pages/ActivityLogs";
import { DLQPage } from "./components/pages/DLQPage";
import { Stats } from "./components/pages/Stats";
import { ToastProvider } from "./context/ToastContext";
import { JobDrawerProvider } from "./context/JobDrawerContext";

export default function App() {
  const [page, setPage] = useState<PageId>("playground");
  const [navOpen, setNavOpen] = useState(false);

  const render = () => {
    switch (page) {
      case "playground":
        return <Playground />;
      case "logs":
        return <ActivityLogs />;
      case "dlq":
        return <DLQPage />;
      case "stats":
        return <Stats />;
    }
  };

  return (
    <ToastProvider>
      <JobDrawerProvider>
        <div
          className="flex h-full w-full overflow-hidden bg-white text-neutral-900"
        >
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <Sidebar active={page} onNavigate={setPage} />
          </div>

          {/* Mobile sidebar */}
          {navOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="absolute inset-0 bg-black/30"
                onClick={() => setNavOpen(false)}
              />
              <div className="absolute left-0 top-0 h-full">
                <Sidebar
                  active={page}
                  onNavigate={setPage}
                  onClose={() => setNavOpen(false)}
                />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onMenu={() => setNavOpen(true)} />
            <main
              className="flex-1 overflow-auto p-5 md:p-8"
              style={{
                backgroundColor: "#FCFCFB",
                backgroundImage:
                  "radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            >
              {render()}
            </main>
          </div>
        </div>
      </JobDrawerProvider>
    </ToastProvider>
  );
}
