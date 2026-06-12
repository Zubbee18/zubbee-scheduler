import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Code2,
  ArrowLeftRight,
  Loader2,
  X,
  ExternalLink,
  RefreshCcw,
  AlertTriangle,
  Search,
  RotateCcw,
} from "lucide-react";
import { Card, StatusDot } from "../primitives";
import { api, type Job, type CreateJobPayload, type DLQEntry } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useJobDrawer } from "../../context/JobDrawerContext";
import { JobDetailModal } from "../JobDetailModal";
import { usePolling } from "../../hooks/usePolling";

type Mode = "Create" | "Rerun";
type JobTypeOption = { value: string; label: string; payloadTemplate: string };

const JOB_TYPES: JobTypeOption[] = [
  {
    value: "send_email",
    label: "Send Email",
    payloadTemplate: JSON.stringify({ to: "", subject: "", body: "" }, null, 2),
  },
];

const PRIORITY_OPTIONS = [
  { value: 1 as const, label: "1 High" },
  { value: 2 as const, label: "2 Medium" },
  { value: 3 as const, label: "3 Low" },
];

const INTERVAL_PRESETS = [
  { value: "", label: "None" },
  { value: "every_1_minute", label: "Every 1 minute" },
  { value: "every_5_minutes", label: "Every 5 minutes" },
  { value: "every_1_hour", label: "Every 1 hour" },
];

// ─── Reusable mini dropdown ───────────────────────────────────────────────────
function MiniSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-700 hover:bg-neutral-50"
      >
        {current?.label ?? value}
        <ChevronDown className="size-3 text-neutral-400" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 mt-1 w-max min-w-[130px] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-1.5 text-left text-[13px] text-neutral-700 hover:bg-neutral-100"
            >
              {o.label}
              {o.value === value && (
                <span className="text-orange-500 text-[11px]">&#10003;</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${value ? "bg-orange-500" : "bg-neutral-300"}`}
    >
      <span
        className={`size-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : ""}`}
      />
    </button>
  );
}

// ─── Success modal ────────────────────────────────────────────────────────────
function SuccessModal({
  jobId,
  onViewJob,
  onClose,
}: {
  jobId: number;
  onViewJob: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl text-center animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-emerald-100">
          <Code2 className="size-6 text-emerald-600" />
        </div>
        <h2 className="text-[15px] font-semibold text-neutral-900">
          Job created
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          Job #{jobId} has been queued successfully.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-neutral-200 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50"
          >
            Go back
          </button>
          <button
            onClick={onViewJob}
            className="flex-1 rounded-lg bg-orange-500 py-2 text-[13px] text-white hover:bg-orange-600"
          >
            View job
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DLQ Panel (Rerun mode) ───────────────────────────────────────────────────
function DLQPanel() {
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});
  const [fading, setFading] = useState<Record<number, boolean>>({});
  const { addToast } = useToast();
  const { openJob } = useJobDrawer();

  const fetchDLQ = useCallback(async () => {
    try {
      const data = await api.getDLQ();
      setDlqEntries(data);
    } catch {
      // Silently fail on background polling — no spam toasts
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
      setTimeout(
        () => setDlqEntries((prev) => prev.filter((e) => e.id !== entry.id)),
        400,
      );
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Retry failed", "error");
    } finally {
      setRetrying((r) => ({ ...r, [entry.id]: false }));
    }
  };

  if (loading)
    return (
      <div className="space-y-2 mt-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 rounded-xl border border-neutral-100 bg-neutral-100 animate-pulse"
          />
        ))}
      </div>
    );

  if (dlqEntries.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-neutral-400">
        <div className="grid size-12 place-items-center rounded-full bg-neutral-100">
          <RefreshCcw className="size-5" />
        </div>
        <p className="text-[13px]">
          No dead-lettered jobs. Everything is running smoothly.
        </p>
      </div>
    );

  return (
    <div>
      {dlqEntries.length > 10 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12px] text-amber-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          DLQ threshold exceeded: {dlqEntries.length} jobs require attention.
        </div>
      )}
      {dlqEntries.map((entry) => (
        <div
          key={entry.id}
          style={{
            opacity: fading[entry.id] ? 0 : 1,
            transition: "opacity 0.4s",
          }}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 mb-2 text-[13px]"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-700 capitalize">
                {entry.job?.type?.replace(/_/g, " ") ?? "Unknown"}
              </span>
              <span className="text-neutral-300">·</span>
              <span className="font-mono text-[11px] text-neutral-400">
                #{entry.jobId}
              </span>
            </div>
            <p
              className="mt-0.5 truncate text-[12px] text-neutral-400"
              title={entry.reason}
            >
              {entry.reason.length > 60
                ? entry.reason.slice(0, 60) + "…"
                : entry.reason}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openJob(entry.jobId)}
            className="grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            title="View job"
          >
            <ExternalLink className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleRetry(entry)}
            disabled={retrying[entry.id]}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[12px] text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {retrying[entry.id] ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RotateCcw className="size-3" />
            )}
            Retry
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Options overlay panel (positioned below the card) ────────────────────────
function OptionsPanel({
  priority,
  setPriority,
  payload,
  setPayload,
  payloadError,
  validatePayload,
  scheduledAt,
  setScheduledAt,
  intervalPreset,
  setIntervalPreset,
  intervalNum,
  setIntervalNum,
  intervalUnit,
  setIntervalUnit,
  dependsOnId,
  setDependsOnId,
  dependsOnSearch,
  setDependsOnSearch,
  jobSearchResults,
  onSearchJobs,
  onClose,
  scrapeResults,
  setScrapeResults,
}: {
  priority: 1 | 2 | 3;
  setPriority: (v: 1 | 2 | 3) => void;
  payload: string;
  setPayload: (v: string) => void;
  payloadError: string | null;
  validatePayload: () => void;
  scheduledAt: string;
  setScheduledAt: (v: string) => void;
  intervalPreset: string;
  setIntervalPreset: (v: string) => void;
  intervalNum: string;
  setIntervalNum: (v: string) => void;
  intervalUnit: string;
  setIntervalUnit: (v: string) => void;
  dependsOnId: number | null;
  setDependsOnId: (v: number | null) => void;
  dependsOnSearch: string;
  setDependsOnSearch: (v: string) => void;
  jobSearchResults: Job[];
  onSearchJobs: (q: string) => void;
  onClose: () => void;
  scrapeResults: boolean;
  setScrapeResults: (v: boolean) => void;
}) {
  return (
    <div className="mt-1.5 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <span className="text-[13px] text-neutral-700 font-medium">
          Options
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-6 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Priority */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-neutral-600">Priority</span>
          <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-[12px]">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`px-3 py-1.5 transition-colors ${priority === p.value ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payload */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] text-neutral-600">Payload (JSON)</span>
            {payloadError && (
              <span className="text-[11px] text-rose-500">{payloadError}</span>
            )}
          </div>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            onBlur={validatePayload}
            rows={5}
            className={`w-full rounded-lg border px-3 py-2 font-mono text-[12px] outline-none resize-none bg-neutral-50 text-neutral-800 ${payloadError ? "border-rose-400" : "border-neutral-200 focus:border-orange-400"}`}
          />
        </div>

        {/* Scrape content toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-neutral-600">
            Scrape content from results
          </span>
          <Toggle value={scrapeResults} onChange={setScrapeResults} />
        </div>

        {/* Schedule At */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-[13px] text-neutral-600">Schedule At</span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Leave empty to run immediately
            </p>
          </div>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-700 outline-none focus:border-orange-400"
          />
        </div>

        {/* Interval */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] text-neutral-600">Interval</span>
          <div className="flex items-center gap-2">
            <MiniSelect
              options={INTERVAL_PRESETS}
              value={intervalPreset}
              onChange={(v) => {
                setIntervalPreset(v);
                if (v) setIntervalNum("");
              }}
            />
            {!intervalPreset && (
              <>
                <input
                  type="number"
                  min={1}
                  value={intervalNum}
                  onChange={(e) => setIntervalNum(e.target.value)}
                  placeholder="n"
                  className="w-12 rounded-md border border-neutral-200 px-2 py-1.5 text-[12px] text-center outline-none focus:border-orange-400"
                />
                <MiniSelect
                  options={[
                    { value: "sec", label: "sec" },
                    { value: "min", label: "min" },
                    { value: "hour", label: "hour" },
                  ]}
                  value={intervalUnit}
                  onChange={setIntervalUnit}
                />
              </>
            )}
          </div>
        </div>

        {/* Depends On */}
        <div>
          <div className="mb-1.5">
            <span className="text-[13px] text-neutral-600">Depends On</span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              This job will not run until the selected job has been completed.
            </p>
          </div>
          {dependsOnId ? (
            <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[12px]">
              <span className="text-neutral-700">Job #{dependsOnId}</span>
              <button
                type="button"
                onClick={() => setDependsOnId(null)}
                className="ml-auto text-neutral-400 hover:text-neutral-600"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5">
                <Search className="size-3.5 text-neutral-400" />
                <input
                  value={dependsOnSearch}
                  onChange={(e) => onSearchJobs(e.target.value)}
                  placeholder="Search for job"
                  className="flex-1 bg-transparent text-[12px] text-neutral-700 outline-none placeholder:text-neutral-400"
                />
              </div>
              {jobSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                  {jobSearchResults.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => {
                        setDependsOnId(j.id);
                        setDependsOnSearch("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-neutral-700 hover:bg-neutral-100"
                    >
                      <span className="font-mono text-neutral-400">
                        #{j.id}
                      </span>
                      <span className="capitalize">
                        {j.type.replace(/_/g, " ")}
                      </span>
                      <span className="ml-auto text-neutral-400 capitalize">
                        {j.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reset settings */}
        <div className="pt-1 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setPriority(2);
              setScheduledAt("");
              setIntervalPreset("");
              setIntervalNum("");
              setScrapeResults(true);
              setDependsOnId(null);
              setDependsOnSearch("");
            }}
            className="rounded-lg border border-neutral-200 px-4 py-1.5 text-[12px] text-neutral-600 hover:bg-neutral-50"
          >
            Reset settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Job Form (matches the exact Playground card layout) ───────────────
function CreateJobForm() {
  const { addToast } = useToast();
  const [jobType, setJobType] = useState("send_email");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [payload, setPayload] = useState(JOB_TYPES[0].payloadTemplate);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [intervalNum, setIntervalNum] = useState("");
  const [intervalUnit, setIntervalUnit] = useState("min");
  const [intervalPreset, setIntervalPreset] = useState("");
  const [dependsOnSearch, setDependsOnSearch] = useState("");
  const [dependsOnId, setDependsOnId] = useState<number | null>(null);
  const [jobSearchResults, setJobSearchResults] = useState<Job[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [scrapeResults, setScrapeResults] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successJobId, setSuccessJobId] = useState<number | null>(null);
  const [viewJobId, setViewJobId] = useState<number | null>(null);
  const [dlqCount, setDlqCount] = useState(0);

  useEffect(() => {
    api
      .getDLQ()
      .then((entries) => setDlqCount(entries.length))
      .catch(() => {});
  }, []);

  const handleTypeChange = (type: string) => {
    setJobType(type);
    const t = JOB_TYPES.find((j) => j.value === type);
    if (t) setPayload(t.payloadTemplate);
    setPayloadError(null);
  };

  const buildInterval = (): string | null => {
    if (intervalPreset) return intervalPreset;
    if (!intervalNum) return null;
    const n = parseInt(intervalNum, 10);
    if (!n || n < 1) return null;
    const map: Record<string, string> = {
      sec: "second",
      min: "minute",
      hour: "hour",
    };
    return `every_${n}_${map[intervalUnit]}${n > 1 ? "s" : ""}`;
  };

  const validatePayload = () => {
    try {
      JSON.parse(payload);
      setPayloadError(null);
      return true;
    } catch {
      setPayloadError("Invalid JSON");
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validatePayload()) return;
    setSubmitting(true);
    try {
      const body: CreateJobPayload = {
        type: jobType,
        payload: JSON.parse(payload),
        priority,
        scheduledAt: scheduledAt || null,
        interval: buildInterval(),
        dependsOn: dependsOnId,
      };
      const job = await api.createJob(body);
      setSuccessJobId(job.id);
    } catch (e: unknown) {
      addToast(
        e instanceof Error ? e.message : "Failed to create job",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDependsOnSearch = async (q: string) => {
    setDependsOnSearch(q);
    if (!q.trim()) {
      setJobSearchResults([]);
      return;
    }
    try {
      const jobs = await api.getJobs();
      setJobSearchResults(
        jobs
          .filter(
            (j) =>
              String(j.id).includes(q) ||
              j.type.toLowerCase().includes(q.toLowerCase()),
          )
          .slice(0, 5),
      );
    } catch {
      setJobSearchResults([]);
    }
  };

  const typeOptions = JOB_TYPES.map((j) => ({
    value: j.value,
    label: j.label,
  }));

  return (
    <div className="relative">
      {successJobId !== null && (
        <SuccessModal
          jobId={successJobId}
          onClose={() => setSuccessJobId(null)}
          onViewJob={() => {
            setViewJobId(successJobId);
            setSuccessJobId(null);
          }}
        />
      )}
      {viewJobId !== null && (
        <JobDetailModal jobId={viewJobId} onClose={() => setViewJobId(null)} />
      )}

      {/* Main input card — exact Firecrawl Playground layout */}
      <Card className="mt-6 shadow-sm">
        {/* Top row: icon + text input */}
        <div className="flex items-center gap-2 px-1 pt-1 pb-0">
          <button
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100"
          >
            <ArrowLeftRight className="size-4" />
          </button>
          {/* Type label acts as the main "query input" line */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <MiniSelect
              options={typeOptions}
              value={jobType}
              onChange={handleTypeChange}
            />
            <span className="text-[14px] text-neutral-400 truncate">
              {jobType === "send_email"
                ? "to, subject, body…"
                : "configure job…"}
            </span>
          </div>
        </div>

        {/* Bottom row: source/format controls + Get code + CTA */}
        <div className="flex items-center gap-2 border-t border-neutral-100 px-2 py-2 mt-1">
          {/* Source pill button */}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-600 hover:bg-neutral-50"
          >
            <span className="grid size-3.5 place-items-center rounded-sm bg-neutral-200 text-[9px] text-neutral-500">
              &#9776;
            </span>
            Source: {priority}
          </button>

          {/* Doc count pill */}
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-600 hover:bg-neutral-50"
          >
            <Code2 className="size-3.5 text-neutral-400" />1
          </button>

          {/* Options button */}
          <button
            type="button"
            onClick={() => setShowOptions((s) => !s)}
            className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-600 hover:bg-neutral-50"
          >
            Options
            {dlqCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1 py-0.5 text-[9px] text-white leading-none ml-1">
                {dlqCount}
              </span>
            )}
            <ChevronDown
              className={`size-3 text-neutral-400 transition-transform ${showOptions ? "rotate-180" : ""}`}
            />
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* Get code */}
            <button
              type="button"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-50"
            >
              <Code2 className="size-3.5 text-neutral-400" /> Get code
            </button>
            {/* Create job CTA */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-1.5 text-[13px] text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              {submitting ? "Creating…" : "Create job"}
            </button>
          </div>
        </div>
      </Card>

      {/* Options overlay panel — floats below the card */}
      {showOptions && (
        <OptionsPanel
          priority={priority}
          setPriority={setPriority}
          payload={payload}
          setPayload={setPayload}
          payloadError={payloadError}
          validatePayload={validatePayload}
          scheduledAt={scheduledAt}
          setScheduledAt={setScheduledAt}
          intervalPreset={intervalPreset}
          setIntervalPreset={setIntervalPreset}
          intervalNum={intervalNum}
          setIntervalNum={setIntervalNum}
          intervalUnit={intervalUnit}
          setIntervalUnit={setIntervalUnit}
          dependsOnId={dependsOnId}
          setDependsOnId={setDependsOnId}
          dependsOnSearch={dependsOnSearch}
          setDependsOnSearch={setDependsOnSearch}
          jobSearchResults={jobSearchResults}
          onSearchJobs={handleDependsOnSearch}
          onClose={() => setShowOptions(false)}
          scrapeResults={scrapeResults}
          setScrapeResults={setScrapeResults}
        />
      )}
    </div>
  );
}

// ─── Recent Jobs grid (matches Firecrawl "Recent Runs") ───────────────────────
function RecentJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const { openJob } = useJobDrawer();

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.getJobs();
      setJobs(data.slice(0, 6));
    } catch {
      /* silently ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchJobs, 3000);

  const runStatus = (s: string): "success" | "failed" | "running" =>
    s === "completed"
      ? "success"
      : s === "failed" || s === "cancelled"
        ? "failed"
        : "running";

  if (loading)
    return (
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100"
          />
        ))}
      </div>
    );

  if (jobs.length === 0)
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-white py-12 text-center">
        <p className="text-[13px] text-neutral-400">
          No jobs yet. Create your first job above.
        </p>
      </div>
    );

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className="p-4 transition-shadow hover:shadow-sm cursor-pointer"
          onClick={() => openJob(job.id)}
        >
          {/* Card header row */}
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded bg-neutral-100 text-[10px] font-bold text-neutral-500">
                {job.type.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-[13px] text-neutral-700 capitalize">
                {job.type.replace(/_/g, " ")}
              </span>
            </div>
            <ExternalLink className="size-3.5 shrink-0 text-neutral-300" />
          </div>
          {/* Card body — same label/value rows as "Recent Runs" */}
          <div className="mt-4 space-y-2 text-[12px]">
            <Row label="Type">
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 capitalize">
                {job.type.replace(/_/g, " ")}
              </span>
            </Row>
            <Row label="Status">
              <span className="flex items-center gap-1.5 capitalize text-neutral-700">
                <StatusDot status={runStatus(job.status)} /> {job.status}
              </span>
            </Row>
            <Row label="Started">
              <span className="text-neutral-500">
                {new Date(job.createdAt).toLocaleString()}
              </span>
            </Row>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-400">{label}</span>
      {children}
    </div>
  );
}

// ─── Main Playground page ─────────────────────────────────────────────────────
export function Playground() {
  const [mode, setMode] = useState<Mode>("Create");
  const { openJobId, closeJob } = useJobDrawer();

  return (
    <div className="mx-auto max-w-[900px]">
      {openJobId !== null && (
        <JobDetailModal jobId={openJobId} onClose={closeJob} />
      )}

      {/* Hero heading */}
      <div className="pt-2 text-center">
        <h1 className="text-[40px] font-bold tracking-tight text-neutral-900">
          Playground
        </h1>
        <p className="mt-1.5 text-[14px] text-neutral-500">
          Create and manage background jobs — all in one place
        </p>
      </div>

      {/* Mode tab switcher — same pill style as Firecrawl Scrape/Search/Map/Crawl */}
      <div className="mt-6 flex justify-center">
        <div className="flex rounded-xl border border-neutral-200 bg-white p-1">
          {(["Create", "Rerun"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 rounded-lg px-5 py-1.5 text-[13px] transition-colors ${
                mode === m
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Page body */}
      {mode === "Create" ? (
        <>
          <CreateJobForm />
          <h2 className="mt-10 text-[16px] font-normal text-neutral-900">
            Recent Jobs
          </h2>
          <RecentJobs />
        </>
      ) : (
        <div className="mt-6">
          <Card className="p-4 shadow-sm">
            <h2 className="text-[14px] font-medium text-neutral-900 mb-3">
              Dead-Letter Queue
            </h2>
            <DLQPanel />
          </Card>
        </div>
      )}
    </div>
  );
}
