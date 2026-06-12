import { useState, useCallback } from "react";
import {
  RefreshCcw,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, API_BASE_URL, type DLQEntry } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useJobDrawer } from "../../context/JobDrawerContext";
import { JobDetailModal } from "../JobDetailModal";
import { usePolling } from "../../hooks/usePolling";

const PAGE_SIZE = 15;

// Skeleton rows matching the table layout
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[120px_80px_130px_1fr_100px] items-center gap-3 border-b border-neutral-100 px-5 py-3.5"
        >
          {Array.from({ length: 5 }).map((_, j) => (
            <div
              key={j}
              className="h-3.5 rounded bg-neutral-200 animate-pulse"
            />
          ))}
        </div>
      ))}
    </>
  );
}

function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }) {
  const labels = ["", "High", "Medium", "Low"];
  const colors = ["", "text-rose-600", "text-amber-500", "text-sky-500"];
  return (
    <span className={`text-[12px] tabular-nums ${colors[priority]}`}>
      {priority} — {labels[priority]}
    </span>
  );
}

export function DLQPage() {
  const [entries, setEntries] = useState<DLQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});
  const [fading, setFading] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(1);
  const [viewJobId, setViewJobId] = useState<number | null>(null);
  const { addToast } = useToast();
  const { openJobId, closeJob } = useJobDrawer();

  const fetchDLQ = useCallback(async () => {
    try {
      const data = await api.getDLQ();
      setEntries(data);
      setHasLoaded(true);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchDLQ, 3000);

  const handleRetry = async (entry: DLQEntry) => {
    setRetrying((r) => ({ ...r, [entry.id]: true }));
    try {
      await api.retryDLQ(entry.id);
      addToast("Job has been requeued.", "success");
      setFading((f) => ({ ...f, [entry.id]: true }));
      setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        setFading((f) => {
          const n = { ...f };
          delete n[entry.id];
          return n;
        });
      }, 400);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Retry failed", "error");
    } finally {
      setRetrying((r) => ({ ...r, [entry.id]: false }));
    }
  };

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paged = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-[1080px]">
      {(viewJobId !== null || openJobId !== null) && (
        <JobDetailModal
          jobId={(viewJobId ?? openJobId)!}
          onClose={() => {
            setViewJobId(null);
            closeJob();
          }}
        />
      )}

      <h1 className="text-[38px] font-bold tracking-tight text-neutral-900">
        Dead-Letter Queue
      </h1>
      <p className="mt-1.5 text-[14px] text-neutral-500">
        Jobs that exhausted all retry attempts. Investigate and retry manually.
      </p>

      {/* Warning banner when threshold exceeded */}
      {!loading && entries.length > 10 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            DLQ threshold exceeded: <strong>{entries.length}</strong> jobs
            require attention.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {/* Header */}
        <div className="grid grid-cols-[120px_80px_130px_1fr_100px] items-center gap-3 border-b border-neutral-200 px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
          <span>Type</span>
          <span>Priority</span>
          <span>Time</span>
          <span>Reason</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : fetchError && !hasLoaded ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center text-neutral-400">
            <div className="grid size-12 place-items-center rounded-full bg-neutral-100">
              <AlertTriangle className="size-5 text-amber-400" />
            </div>
            <p className="text-[14px] font-medium text-neutral-400">
              Cannot reach the server
            </p>
            <p className="text-[12px] text-neutral-400">
              Make sure the backend is running at {API_BASE_URL}
            </p>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center text-neutral-400">
            <div className="grid size-12 place-items-center rounded-full bg-neutral-100">
              <RefreshCcw className="size-5" />
            </div>
            <p className="text-[13px]">
              No dead-lettered jobs. Everything is running smoothly.
            </p>
          </div>
        ) : (
          paged.map((entry) => (
            <div
              key={entry.id}
              style={{
                opacity: fading[entry.id] ? 0 : 1,
                transition: "opacity 0.4s",
              }}
              className="grid grid-cols-[120px_80px_130px_1fr_100px] items-center gap-3 border-b border-neutral-100 px-6 py-4 text-[13px] last:border-0 hover:bg-neutral-50/70"
            >
              {/* Type */}
              <span className="font-mono text-[11px] uppercase text-neutral-400">
                {entry.job?.type === "send_email"
                  ? "email"
                  : (entry.job?.type ?? "unknown")}
              </span>
              {/* Priority */}
              {entry.job ? (
                <PriorityBadge priority={entry.job.priority} />
              ) : (
                <span className="text-neutral-400">—</span>
              )}
              {/* Time */}
              <span className="leading-tight text-neutral-600">
                {new Date(entry.createdAt).toLocaleDateString()}
                <span className="block text-[11px] text-neutral-400">
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </span>
              </span>
              {/* Reason — truncated 60 chars with tooltip */}
              <span
                className="truncate text-[12px] text-neutral-500"
                title={entry.reason}
              >
                {entry.reason.length > 60
                  ? entry.reason.slice(0, 60) + "…"
                  : entry.reason}
              </span>
              {/* Actions */}
              <span className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => setViewJobId(entry.jobId)}
                  className="grid size-8 place-items-center rounded-md border border-neutral-200 bg-neutral-100 text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-600"
                  title="View job"
                >
                  <ExternalLink className="size-3.5" />
                </button>
                <button
                  onClick={() => handleRetry(entry)}
                  disabled={retrying[entry.id]}
                  className="flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] text-white hover:bg-orange-600 disabled:opacity-60"
                  title="Retry job"
                >
                  {retrying[entry.id] ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCcw className="size-3" />
                  )}
                  Retry
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-[13px] text-neutral-500">
        <span>Page {page}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="grid size-7 place-items-center rounded-md border border-neutral-200 text-neutral-400 disabled:text-neutral-300 hover:bg-neutral-50 disabled:cursor-default"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="grid size-7 place-items-center rounded-md border border-neutral-200 text-neutral-600 disabled:text-neutral-300 hover:bg-neutral-50 disabled:cursor-default"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
