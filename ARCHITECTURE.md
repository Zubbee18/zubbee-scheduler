# Architecture — Zubbee Scheduler

## Overview

Zubbee Scheduler is a background job processing system with a React dashboard. The backend runs two independent processes: an **Express API server** that accepts and manages jobs, and a **worker process** that polls for ready jobs, processes them, and handles failures automatically.

```
┌─────────────────────────────────────────────────────────────┐
│                        React UI (Vite)                      │
│  Dashboard · Jobs Table · Playground · DLQ · Stats         │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP (polling every 3s)
┌───────────────────────────▼─────────────────────────────────┐
│                   Express API Server (:3000)                 │
│  POST /jobs   GET /jobs   PATCH /jobs/:id/cancel            │
│  GET /jobs/counts   GET /dlq   POST /dlq/:id/retry          │
│  GET /api-docs  (Swagger UI)                                │
└───────────────────────────┬─────────────────────────────────┘
                            │ better-sqlite3 (WAL mode)
┌───────────────────────────▼─────────────────────────────────┐
│                   SQLite Database (database.db)              │
│  jobs · attempts · job_dependencies · dlq                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ reads/writes
┌───────────────────────────▼─────────────────────────────────┐
│                        Worker Process                        │
│  Heap scheduler · TimingWheel scheduler · DAG gate          │
│  Retry/backoff · DLQ insertion · Recurring job re-queue     │
└─────────────────────────────────────────────────────────────┘
```

The API server and worker run as separate Node.js processes (managed by PM2 in production). They communicate only through the shared SQLite database; neither calls the other directly.

---

## Database Schema

| Table              | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `jobs`             | Every job, its current status and all metadata |
| `attempts`         | One row per processing attempt per job         |
| `job_dependencies` | DAG edges — `(jobId, dependsOnJobId)`          |
| `dlq`              | Dead-letter entries for exhausted jobs         |

SQLite runs with `journal_mode = WAL` (Write-Ahead Logging) for safe concurrent reads during writes, and a 5 s `busy_timeout` to handle lock contention between the API server and worker.

---

## Job Lifecycle

```
pending ──► processing ──► completed
               │
               ├──► (retry) ──► pending  (up to 3 attempts)
               │
               └──► failed ──► dlq
```

A job can also be moved to `cancelled` from `pending` or `processing` at any time. If it is cancelled while `processing`, the worker checks the status flag before writing the final result and silently aborts — no completed/failed record is written.

---

## Primary Scheduling Algorithm — Heap-Based Priority Queue

**File:** `src/heap.js`

The worker uses a min-heap to order jobs for processing. On every poll cycle, all ready `pending` jobs (where `scheduledAt <= now`) are loaded from the database and inserted into the heap.

### Comparator (in priority order)

1. **Starvation prevention (aging):** If a job has been waiting longer than `TIMING_MIN` minutes (set via environment variable, default behaviour when unset treats all jobs as non-expired), it is treated as highest priority regardless of its declared priority level — so low-priority jobs cannot be starved indefinitely.
2. **Declared priority:** `1` (High) beats `2` (Medium) beats `3` (Low).
3. **Scheduled time:** Earlier `scheduledAt` wins among equal-priority jobs.
4. **Creation time:** Earlier `createdAt` breaks remaining ties (FIFO within the same priority bucket).

```js
compare(a, b) {
  const aTooLong = now - new Date(a.createdAt) >= TIMING_MIN_MS;
  const bTooLong = now - new Date(b.createdAt) >= TIMING_MIN_MS;
  if (aTooLong !== bTooLong) return aTooLong ? -1 : 1;   // aged job runs first
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.scheduledAt !== b.scheduledAt) return new Date(a.scheduledAt) - new Date(b.scheduledAt);
  return new Date(a.createdAt) - new Date(b.createdAt);
}
```

**Heap operations:** O(log n) insert and extract-min; O(1) peek.

### Starvation Prevention Threshold

Set `TIMING_MIN=5` in the environment to promote any job that has waited more than 5 minutes to the front of the queue, regardless of its priority level. This prevents a flood of high-priority jobs from permanently blocking lower-priority ones.

---

## Alternative Scheduling Algorithm — Timing Wheel

**File:** `src/timingWheel.js`

The timing wheel is a circular buffer with `3600` slots, each representing one `tickMs` (1 second) of time. Jobs are placed into the slot corresponding to how far in the future they are scheduled.

### How it works

1. **Schedule:** Given a job's `scheduledAt`, compute `delayMs = scheduledAt - now`. Calculate `ticks = ceil(delayMs / tickMs)`, then `slot = (cursor + ticks) % 3600`. A `rounds` counter handles delays longer than one full revolution of the wheel (`rounds = floor((ticks - 1) / 3600)`).
2. **Tick:** Advance the cursor by one slot. For each job in that slot, decrement `rounds`. Jobs with `rounds == 0` are due and returned for processing. Within a slot, jobs are sorted by creation time (FIFO).
3. **Priority:** Each bucket slot is partitioned by priority (1/2/3) so high-priority due jobs are returned first within the same tick.

**Complexity:** O(1) schedule and O(1) tick (amortised over the number of due jobs). For large volumes of short-interval recurring jobs, the timing wheel significantly outperforms the heap on tick throughput.

---

## Benchmark — Heap vs Timing Wheel

Run with: `node benchmark.js`

| Operation   | Min-Heap | Timing Wheel  |
| ----------- | -------- | ------------- |
| Insert 10k  | 36.78ms  | 47.83ms       |
| Extract 10k | 514.58ms | 4.29ms (tick) |

_(Measured with `node benchmark.js` on the current workspace.)_

**Tradeoffs:**

- **Heap:** Better for dynamic priority changes and small job counts. O(log n) per operation.
- **Timing Wheel:** Better for high-throughput fixed-interval scheduling. O(1) amortised, but uses fixed memory proportional to the number of slots (3600 × tick count).

---

## DAG Workflow (Job Dependencies)

Jobs can declare dependencies via `dependsOn: [jobId, ...]` at creation time. Edges are stored in the `job_dependencies` table.

Before the worker processes a job extracted from the heap, it queries all dependency job statuses:

```sql
SELECT d.dependsOnJobId, j.status
FROM job_dependencies d
JOIN jobs j ON j.id = d.dependsOnJobId
WHERE d.jobId = ?
```

If any dependency is not `completed`, the job is skipped for this cycle and returned to the pool. It will be re-evaluated on the next worker poll (every 500 ms).

### Example DAG

```
Job A (Generate Report)   ← no dependencies, runs immediately
       │
       ▼
Job B (Upload File)       ← dependsOn: [A], waits for A to complete
       │
       ▼
Job C (Send Email)        ← dependsOn: [B], waits for B to complete
```

---

## Retry Logic & Backoff

Failed jobs are retried automatically up to `maxRetries` times (default: 3). Each failure schedules the next attempt using exponential backoff with jitter:

```
wait = 1000ms × 5^attemptCount × jitter   (jitter = random in [0.8, 1.2])

Attempt 1 → ~1 000 ms  (~1s)
Attempt 2 → ~5 000 ms  (~5s)
Attempt 3 → ~25 000 ms (~25s)
```

**Permanent failures** (e.g. invalid email address, missing subject) bypass retries and go directly to the DLQ regardless of remaining attempts.

---

## Dead-Letter Queue (DLQ)

Jobs that exhaust all retries (or fail permanently) are inserted into the `dlq` table with the error reason. They sit there for manual inspection.

- **Threshold:** When the DLQ reaches **10 entries**, an alert email is automatically sent to `process.env.ALERT_EMAIL` (defaults to `admin@example.com`).
- **Manual retry:** `POST /dlq/:id/retry` removes the DLQ entry, resets the job to `pending` with a fresh attempt count, and re-queues it. If it fails again, it re-enters the DLQ.

---

## Recurring Jobs

If a job has an `interval` value (`every_1_minute` → 60 000 ms, `every_5_minutes` → 300 000 ms, `every_1_hour` → 3 600 000 ms), the worker automatically inserts a new job of the same type, payload, priority, and interval when the current run completes successfully, scheduled `interval` milliseconds from now. No user action is required.

---

## Duplicate Protection

The worker uses an atomic SQLite `UPDATE ... WHERE status = 'pending' RETURNING *` (locked via SQLite's serialised write mode in WAL) to claim a job. If two worker instances race to pick up the same job, only one will receive the `RETURNING` row — the other receives zero rows and skips. This prevents double-processing even if multiple worker processes are running.

---

## Live Updates (UI Polling)

The React dashboard uses a `usePolling` hook that re-fetches data every **3 seconds** on active browser tabs and pauses automatically when the tab is backgrounded to avoid unnecessary load.

---

## Cancellation of In-Processing Jobs

When `PATCH /jobs/:id/cancel` is called, the database status is set to `cancelled` atomically (only if current status is `pending` or `processing`). If a worker is currently executing the job, it checks the database status immediately after the handler resolves, before writing any result. If `cancelled` is found, finalization is silently skipped — no `completed` or `failed` record is written.

---

## Tech Stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| Backend    | Node.js, Express 5, better-sqlite3                  |
| Worker     | Native Node.js process (no queue lib)               |
| Database   | SQLite (WAL mode)                                   |
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Logging    | Winston (structured JSON)                           |
| API Docs   | Swagger UI (OpenAPI 3.0)                            |
| Production | Nginx (reverse proxy), Let's Encrypt (TLS), PM2     |
