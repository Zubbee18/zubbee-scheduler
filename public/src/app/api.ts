// All API calls for the Zubbee Scheduler dashboard.
// One function per endpoint. Base URL is set via VITE_API_URL in the frontend env.

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";
export type JobPriority = 1 | 2 | 3;

export interface Job {
  id: number;
  type: string;
  payload: string;
  priority: JobPriority;
  status: JobStatus;
  attemptCount: number;
  maxRetries: number;
  scheduledAt: string | null;
  interval: string | null;
  lastError: string | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  dependsOn?: number | null;
}

export interface AttemptHistory {
  id: number;
  jobId: number;
  status: "success" | "error";
  message: string | null;
  attemptNumber: number;
  createdAt: string;
}

export interface JobWithHistory extends Job {
  attempts: AttemptHistory[];
}

export interface DLQEntry {
  id: number; // dlq entry id
  jobId: number; // original job id
  reason: string;
  createdAt: string;
  job: Job;
}

export interface JobCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface CreateJobPayload {
  type: string;
  payload: object;
  priority: JobPriority;
  scheduledAt?: string | null;
  interval?: string | null;
  dependsOn?: number | null;
}

interface JobDetailResponse {
  job: Job;
  attempts: Array<{
    attemptStatus: "success" | "error";
    response: string | null;
    attemptCreatedAt: string | null;
  }>;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? body.detail ?? message;
    } catch {
      try {
        const text = await res.text();
        if (text.trim()) message = text.trim();
      } catch {
        /* leave default */
      }
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// Unwrap the backend's { status, data } envelope
function unwrap<T>(res: { status: string; data: T }): T {
  return res.data;
}

// Transform a flat DLQ row from backend into the DLQEntry shape the UI expects
// Backend row: { dlqId, reason, failedAt, id (job id), type, payload, priority, attemptCount, maxRetries, lastError, updatedAt }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptDLQEntry(row: any): DLQEntry {
  return {
    id: row.dlqId,
    jobId: row.id,
    reason: row.reason ?? row.lastError ?? "Unknown error",
    createdAt: row.failedAt ?? row.createdAt,
    job: {
      id: row.id,
      type: row.type,
      payload: row.payload,
      priority: row.priority,
      status: "failed",
      attemptCount: row.attemptCount,
      maxRetries: row.maxRetries,
      scheduledAt: null,
      interval: null,
      lastError: row.lastError,
      result: null,
      createdAt: row.failedAt ?? row.updatedAt,
      updatedAt: row.updatedAt,
    },
  };
}

// Transform the backend's array of joined job+attempt rows into JobWithHistory
// Backend returns: { job, attempts }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptJobWithHistory(data: {
  job: Job;
  attempts: Array<{
    attemptStatus: "success" | "error";
    response: string | null;
    attemptCreatedAt: string | null;
  }>;
}): JobWithHistory {
  if (!data?.job) throw new Error("Job not found");
  const attempts: AttemptHistory[] = data.attempts.map((attempt, i) => ({
    id: i + 1,
    jobId: data.job.id,
    status: attempt.attemptStatus,
    message: attempt.response ?? null,
    attemptNumber: i + 1,
    createdAt: attempt.attemptCreatedAt ?? data.job.createdAt,
  }));
  return {
    ...data.job,
    attempts,
  };
}

export const api = {
  getJobs: async (params?: {
    status?: string;
    priority?: number;
    type?: string;
  }): Promise<Job[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.priority) q.set("priority", String(params.priority));
    if (params?.type) q.set("type", params.type);
    const qs = q.toString();
    const res = await request<{ status: string; data: Job[] }>(
      `/jobs${qs ? `?${qs}` : ""}`,
    );
    return unwrap(res);
  },

  getJob: async (id: number): Promise<JobWithHistory> => {
    // Backend returns { status, data: { job, attempts } }
    const res = await request<{ status: string; data: JobDetailResponse }>(
      `/jobs/${id}`,
    );
    return adaptJobWithHistory(unwrap(res));
  },

  createJob: (data: CreateJobPayload) =>
    // Map camelCase scheduledAt → snake_case scheduled_at for backend.
    // When scheduledAt is omitted, the backend treats the job as runnable immediately.
    request<{ id: number; status: string }>("/jobs", {
      method: "POST",
      body: JSON.stringify({
        type: data.type,
        payload: data.payload,
        priority: data.priority,
        scheduled_at: data.scheduledAt ?? undefined,
        interval: data.interval ?? undefined,
        dependsOn: data.dependsOn ? [data.dependsOn] : undefined,
      }),
    }),

  cancelJob: async (id: number): Promise<void> => {
    await request(`/jobs/${id}/cancel`, { method: "PATCH" });
  },

  getJobCounts: async (): Promise<JobCounts> => {
    const res = await request<{ status: string; data: JobCounts }>(
      "/jobs/counts",
    );
    return unwrap(res);
  },

  getDLQ: async (): Promise<DLQEntry[]> => {
    const res = await request<{ status: string; data: unknown[] }>("/dlq");
    return unwrap(res).map(adaptDLQEntry);
  },

  retryDLQ: (id: number) =>
    request<{ message: string }>(`/dlq/${id}/retry`, { method: "POST" }),
};
