import { useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { BarMini } from "../primitives";
import { api, type JobCounts } from "../../api";
import { usePolling } from "../../hooks/usePolling";

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 ${color}`}>
      <p className="text-[12px] text-neutral-400">{label}</p>
      <p className="mt-1 text-[26px] tabular-nums tracking-tight text-neutral-900">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// Skeleton card
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="h-3 w-20 rounded bg-neutral-200 animate-pulse mb-3" />
      <div className="h-7 w-16 rounded bg-neutral-200 animate-pulse" />
    </div>
  );
}

// Chart data shape
type Point = { day: string; pages: number };

function buildChartData(counts: JobCounts): Point[] {
  // Build a simple bar chart from the totals across the week
  // Since we only have aggregate counts, we use them as proportional bars
  return [
    { day: "Pending", pages: counts.pending },
    { day: "Processing", pages: counts.processing },
    { day: "Completed", pages: counts.completed },
    { day: "Failed", pages: counts.failed },
    { day: "Cancelled", pages: counts.cancelled },
  ];
}

export function Stats() {
  const [counts, setCounts] = useState<JobCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const data = await api.getJobCounts();
      setCounts(data);
      setHasLoaded(true);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchCounts, 3000);

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const chartData = counts ? buildChartData(counts) : [];

  const statCards = counts
    ? [
        { label: "Pending", value: counts.pending, color: "border-blue-100" },
        {
          label: "Processing",
          value: counts.processing,
          color: "border-amber-100",
        },
        {
          label: "Completed",
          value: counts.completed,
          color: "border-emerald-100",
        },
        { label: "Failed", value: counts.failed, color: "border-rose-100" },
        {
          label: "Cancelled",
          value: counts.cancelled,
          color: "border-neutral-200",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-[38px] font-bold tracking-tight text-neutral-900">
        Stats
      </h1>
      <p className="mt-1.5 text-[14px] text-neutral-500">
        Overview of all background job activity.
      </p>

      {/* Server unreachable banner */}
      {!loading && fetchError && !hasLoaded && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
          <span className="font-medium">Cannot reach the server.</span>
          <span>Make sure the backend is running at localhost:3000.</span>
        </div>
      )}

      {/* Status breakdown cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Bar chart */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-[14px] text-neutral-900">Jobs by Status</h2>
        <div className="mt-4">
          {loading ? (
            <div className="h-[224px] rounded bg-neutral-100 animate-pulse" />
          ) : (
            <BarMini data={chartData} height={224} />
          )}
        </div>
        <p className="mt-2 text-[12px] text-neutral-400">
          {total.toLocaleString()} total jobs.
        </p>
      </div>

      {/* Summary table */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[1fr_120px] gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-2.5 text-[11px] uppercase tracking-wide text-neutral-400">
          <span>Status</span>
          <span className="text-right">Count</span>
        </div>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_120px] gap-3 border-b border-neutral-100 px-5 py-3"
              >
                <div className="h-3.5 w-24 rounded bg-neutral-200 animate-pulse" />
                <div className="h-3.5 w-10 rounded bg-neutral-200 animate-pulse ml-auto" />
              </div>
            ))
          : statCards.map((s) => (
              <div
                key={s.label}
                className="grid grid-cols-[1fr_120px] items-center gap-3 border-b border-neutral-100 px-5 py-3 text-[13px] last:border-0"
              >
                <span className="capitalize text-neutral-700">{s.label}</span>
                <span className="text-right tabular-nums text-neutral-500">
                  {s.value.toLocaleString()}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
