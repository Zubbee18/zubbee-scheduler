import { useMemo, useState, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  XCircle,
  AlertCircle,
  Clock,
  CalendarDays,
} from "lucide-react";
import { api, type Job, type JobStatus } from "../../api";
import { API_BASE_URL } from "../../api";
import { useToast } from "../../context/ToastContext";
import { JobDetailModal } from "../JobDetailModal";
import { usePolling } from "../../hooks/usePolling";

const DATE_FILTERS = [
  "Last 7 days",
  "Last 24 hours",
  "Last 30 days",
  "All time",
] as const;
const STATUS_FILTERS = [
  "All Statuses",
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

const PAGE_SIZE = 15;

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, string> = {
    pending: "text-sky-600",
    processing: "text-amber-500",
    completed: "text-emerald-600",
    failed: "text-rose-600",
    cancelled: "text-neutral-400",
  };
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-wider ${map[status]}`}
    >
      {status}
    </span>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }) {
  const labels = ["", "High", "Medium", "Low"];
  const colors = ["", "text-rose-600", "text-amber-500", "text-sky-500"];
  return (
    <span className={`text-[12px] tabular-nums ${colors[priority]}`}>
      {priority} — {labels[priority]}
    </span>
  );
}

// ─── Dropdown ────────────────────────────────────────────────────────────────
function Dropdown({
  options,
  value,
  onChange,
  icon,
  align = "left",
  header,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  align?: "left" | "right";
  header?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-[7px] text-[13px] text-neutral-700 hover:bg-neutral-50"
      >
        {icon}
        {value}
        <ChevronDown className="size-3.5 text-neutral-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-20 mt-1.5 w-52 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
          >
            {header && (
              <p className="px-2.5 py-1.5 text-[11px] text-neutral-400">
                {header}
              </p>
            )}
            {options.map((o) => (
              <button
                key={o}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] text-neutral-700 hover:bg-neutral-100"
              >
                {o}{" "}
                {o === value && (
                  <span className="text-orange-500">&#10003;</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[100px_1fr_120px_100px_100px_130px_84px] items-center gap-3 border-b border-neutral-100 px-5 py-3.5"
        >
          {Array.from({ length: 7 }).map((_, j) => (
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

// ─── Confirm cancel dialog ────────────────────────────────────────────────────
function ConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-neutral-200 bg-white p-5 shadow-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="size-5 text-amber-500 shrink-0" />
          <p className="text-[14px] font-medium text-neutral-900">
            Are you sure?
          </p>
        </div>
        <p className="text-[13px] text-neutral-500 mb-4">
          This job will be cancelled and cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-neutral-200 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50"
          >
            No, keep it
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-rose-500 py-2 text-[13px] text-white hover:bg-rose-600"
          >
            Yes, cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function labelType(type: string): string {
  if (type === "send_email") return "Send Email";
  return "Other";
}

// ─── Main ActivityLogs / Jobs Table ──────────────────────────────────────────
export function ActivityLogs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTERS[0]);
  const [dateFilter, setDateFilter] = useState<string>(DATE_FILTERS[0]);
  const [page, setPage] = useState(1);
  const [viewJobId, setViewJobId] = useState<number | null>(null);
  const [cancelJobId, setCancelJobId] = useState<number | null>(null);
  const { addToast } = useToast();

  const fetchJobs = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== STATUS_FILTERS[0]) params.status = statusFilter;
      const data = await api.getJobs(params);
      setJobs(data);
      setHasLoaded(true);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  usePolling(fetchJobs, 3000);

  // Date cutoff helper
  const cutoff = useMemo(() => {
    const now = Date.now();
    if (dateFilter === "Last 24 hours") return now - 86400000;
    if (dateFilter === "Last 7 days") return now - 7 * 86400000;
    if (dateFilter === "Last 30 days") return now - 30 * 86400000;
    return 0;
  }, [dateFilter]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      const matchQuery =
        !query ||
        j.type.toLowerCase().includes(query.toLowerCase()) ||
        String(j.id).includes(query);
      const matchDate =
        cutoff === 0 || new Date(j.createdAt).getTime() > cutoff;
      return matchQuery && matchDate;
    });
  }, [jobs, query, cutoff]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCancel = async (id: number) => {
    try {
      await api.cancelJob(id);
      addToast("Job cancelled.", "success");
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: "cancelled" } : j)),
      );
    } catch (e: unknown) {
      addToast(
        e instanceof Error ? e.message : "Failed to cancel job",
        "error",
      );
    } finally {
      setCancelJobId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1080px]">
      {viewJobId !== null && (
        <JobDetailModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
      )}
      {cancelJobId !== null && (
        <ConfirmDialog
          onConfirm={() => handleCancel(cancelJobId)}
          onCancel={() => setCancelJobId(null)}
        />
      )}

      <h1 className="text-[38px] font-bold tracking-tight text-neutral-900">
        Jobs
      </h1>
      <p className="mt-1.5 text-[14px] text-neutral-500">
        Track all background jobs and their current status.
      </p>

      {/* Filters row — matches Firecrawl Activity Logs exactly */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="flex w-full max-w-[260px] items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-[7px]">
          <Search className="size-[15px] text-neutral-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search..."
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
          />
        </div>
        {/* Status filter */}
        <Dropdown
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          header="Filter by Status"
        />
        {/* Date filter — pushed far right */}
        <div className="ml-auto">
          <Dropdown
            options={DATE_FILTERS}
            value={dateFilter}
            onChange={(v) => {
              setDateFilter(v);
              setPage(1);
            }}
            align="right"
            icon={<CalendarDays className="size-3.5 text-neutral-500" />}
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {/* Header row — matches Firecrawl column layout */}
        <div className="grid grid-cols-[110px_1fr_130px_110px_90px_140px_80px] items-center gap-3 border-b border-neutral-200 px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
          <span>Type</span>
          <span>ID</span>
          <span>Status</span>
          <span>Priority</span>
          <span># Retries</span>
          <span>Time</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : fetchError && !hasLoaded ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle
              className="size-10 text-neutral-300 mb-4"
              strokeWidth={1.5}
            />
            <p className="text-[15px] font-medium text-neutral-400">
              Cannot reach the server
            </p>
            <p className="mt-1 text-[13px] text-neutral-400">
              Make sure the backend is running at {API_BASE_URL}
            </p>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock
              className="size-10 text-neutral-300 mb-4"
              strokeWidth={1.5}
            />
            <p className="text-[15px] font-medium text-neutral-400">
              No jobs found
            </p>
            <p className="mt-1 text-[13px] text-neutral-400">
              Jobs will appear here once they are created
            </p>
          </div>
        ) : (
          paged.map((job) => (
            <div
              key={job.id}
              className="grid grid-cols-[110px_1fr_130px_110px_90px_140px_80px] items-center gap-3 border-b border-neutral-100 px-6 py-4 text-[13px] last:border-0 hover:bg-neutral-50/70"
            >
              {/* Type */}
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                {job.type === "send_email" ? "/email" : "/other"}
              </span>
              {/* ID */}
              <span className="font-mono text-[12px] text-neutral-600">
                #{job.id}
              </span>
              {/* Status */}
              <StatusBadge status={job.status} />
              {/* Priority */}
              <PriorityBadge priority={job.priority} />
              {/* Retries */}
              <span className="tabular-nums text-[13px] text-neutral-600">
                {job.attemptCount}/{job.maxRetries}
              </span>
              {/* Time */}
              <span className="leading-tight text-[13px] text-neutral-700">
                {new Date(job.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "2-digit",
                })}
                <span className="block text-[11px] text-neutral-400">
                  {new Date(job.createdAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              {/* Actions */}
              <span className="flex items-center justify-end gap-1.5">
                {/* View */}
                <button
                  onClick={() => setViewJobId(job.id)}
                  className="grid size-7 place-items-center rounded-md border border-neutral-200 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                  title="View details"
                >
                  <Eye className="size-3.5" />
                </button>
                {/* Cancel — only for pending */}
                {job.status === "pending" && (
                  <button
                    onClick={() => setCancelJobId(job.id)}
                    className="grid size-7 place-items-center rounded-md border border-rose-200 bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600"
                    title="Cancel job"
                  >
                    <XCircle className="size-3.5" />
                  </button>
                )}
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
