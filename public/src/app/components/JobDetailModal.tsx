import { useEffect, useState, type ReactNode } from "react";
import { X, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { api, type JobWithHistory, type AttemptHistory } from "../api";

// Skeleton for loading state
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${className}`}
    />
  );
}

// Pretty-printed JSON in a dark code block
function JsonBlock({ value }: { value: string }) {
  let display = value;
  try {
    display = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // not JSON, show as-is
  }
  return (
    <pre className="rounded-lg bg-neutral-900 p-3 font-mono text-[11px] text-neutral-200 overflow-x-auto whitespace-pre-wrap break-all">
      {display}
    </pre>
  );
}

const priorityLabels: Record<number, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
};
const priorityColors: Record<number, string> = {
  1: "text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-400",
  2: "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400",
  3: "text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-400",
};

const statusColors: Record<string, string> = {
  pending: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
  processing:
    "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400",
  completed:
    "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400",
  failed: "text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-400",
  cancelled:
    "text-neutral-500 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusColors[status] ?? "text-neutral-600"}`}
    >
      {status}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <span className="text-[12px] text-neutral-400 dark:text-neutral-500 pt-0.5">
        {label}
      </span>
      <div className="text-[13px] text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </div>
  );
}

function AttemptRow({ attempt }: { attempt: AttemptHistory }) {
  const isSuccess = attempt.status === "success";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <div className="mt-0.5">
        {isSuccess ? (
          <CheckCircle2 className="size-4 text-emerald-500" />
        ) : (
          <XCircle className="size-4 text-rose-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
            Attempt #{attempt.attemptNumber}
          </span>
          <span
            className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium capitalize ${
              isSuccess
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
            }`}
          >
            {attempt.status}
          </span>
        </div>
        {attempt.message && (
          <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400 break-all">
            {attempt.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-neutral-400 shrink-0">
        <Clock className="size-3" />
        {new Date(attempt.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

export function JobDetailModal({
  jobId,
  onClose,
}: {
  jobId: number;
  onClose: () => void;
}) {
  const [job, setJob] = useState<JobWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getJob(jobId)
      .then(setJob)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-5 py-3.5 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">
              Job Detail
            </span>
            {job && (
              <span className="font-mono text-[11px] text-neutral-400">
                #{job.id}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[140px_1fr] gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-[13px] text-rose-600 dark:text-rose-400">
              Failed to load job: {error}
            </p>
          )}

          {job && !loading && (
            <>
              {/* Job fields */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                <Field label="ID">
                  <span className="font-mono text-[12px]">{job.id}</span>
                </Field>
                <Field label="Type">
                  <span className="capitalize">
                    {job.type.replace(/_/g, " ")}
                  </span>
                </Field>
                <Field label="Status">
                  <StatusBadge status={job.status} />
                </Field>
                <Field label="Priority">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityColors[job.priority]}`}
                  >
                    {job.priority} — {priorityLabels[job.priority]}
                  </span>
                </Field>
                <Field label="Attempt Count">
                  {job.attemptCount} / {job.maxRetries} retries
                </Field>
                <Field label="Scheduled At">
                  {job.scheduledAt ? (
                    new Date(job.scheduledAt).toLocaleString()
                  ) : (
                    <span className="text-neutral-400">Immediate</span>
                  )}
                </Field>
                <Field label="Interval">
                  {job.interval ?? (
                    <span className="text-neutral-400">None</span>
                  )}
                </Field>
                <Field label="Created At">
                  {new Date(job.createdAt).toLocaleString()}
                </Field>
                <Field label="Updated At">
                  {new Date(job.updatedAt).toLocaleString()}
                </Field>
              </div>

              {/* Payload */}
              <div className="mt-4">
                <p className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                  Payload
                </p>
                <JsonBlock value={job.payload} />
              </div>

              {/* Result */}
              {job.result && (
                <div className="mt-4">
                  <p className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                    Result
                  </p>
                  <JsonBlock value={job.result} />
                </div>
              )}

              {/* Last Error */}
              {job.lastError && (
                <div className="mt-4">
                  <p className="text-[12px] font-medium text-rose-500 mb-1.5 uppercase tracking-wide">
                    Last Error
                  </p>
                  <p className="rounded-lg bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 p-3 text-[12px] text-rose-700 dark:text-rose-300 font-mono break-all">
                    {job.lastError}
                  </p>
                </div>
              )}

              {/* Attempt History */}
              <div className="mt-5">
                <p className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
                  Attempt History
                </p>
                {job.attempts && job.attempts.length > 0 ? (
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-4">
                    {job.attempts.map((a) => (
                      <AttemptRow key={a.id} attempt={a} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-neutral-400 dark:text-neutral-500 py-4 text-center">
                    No attempts recorded yet.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
