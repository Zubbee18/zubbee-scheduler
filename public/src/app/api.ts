// All API calls for the Zubbee Scheduler dashboard.
// One function per endpoint. Base URL points to the local backend.

const BASE = "http://localhost:3000";

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
  id: number;
  jobId: number;
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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

export const api = {
  getJobs: (params?: { status?: string; priority?: number; type?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.priority) q.set("priority", String(params.priority));
    if (params?.type) q.set("type", params.type);
    const qs = q.toString();
    return request<Job[]>(`/jobs${qs ? `?${qs}` : ""}`);
  },

  getJob: (id: number) => request<JobWithHistory>(`/jobs/${id}`),

  createJob: (data: CreateJobPayload) =>
    request<Job>("/jobs", { method: "POST", body: JSON.stringify(data) }),

  cancelJob: (id: number) =>
    request<Job>(`/jobs/${id}/cancel`, { method: "PATCH" }),

  getJobCounts: () => request<JobCounts>("/jobs/counts"),

  getDLQ: () => request<DLQEntry[]>("/dlq"),

  retryDLQ: (id: number) =>
    request<{ message: string }>(`/dlq/${id}/retry`, { method: "POST" }),
};
