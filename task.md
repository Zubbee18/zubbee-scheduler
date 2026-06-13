Stage 9 — Background Job Scheduler

Welcome to Stage 9. You've earned the Junior Systems Engineer title.

You're a Backend Engineer at Dilamme.

Build a background job scheduler with a working UI. Jobs get created, queued, processed, and tracked. Workers run independently. The system handles failure on its own. A scheduler that only works in the happy path is broken.

Jobs
Each job has a type, payload, priority, scheduled time, and an optional recurring interval.

Priority levels:
1 = High
2 = Medium
3 = Low
Example job:
{
"type": "send_email",
"priority": 1,
"payload": {
"to": "test@gmail.com",
"subject": "Welcome"
}
}

Statuses
Every job moves through this flow:
pending → processing → completed / failed / cancelled
No exceptions.

Note: You can use any database of your choice. Redis is allowed.

Workers
Workers run independently from the main app. They poll for jobs, process them, and update statuses. The main application does not wait for any of this.

Job Handler
Implement one working handler. Options:

- Email simulation
- Webhook delivery
- Log processing
  Mock the external service, but execute real logic. Returning 200 does not count.

Retries
Failed jobs retry automatically up to 3 times. The retry count increments on each failure. After 3 failed attempts, the job is marked failed and moves to the dead-letter queue.
Backoff with jitter:
Attempt 1 → ~1s
Attempt 2 → ~5s
Attempt 3 → ~25s

Dead-Letter Queue (DLQ)
Jobs that exhaust all retries land here. They sit for inspection. Engineers can view the error details, investigate what went wrong, and manually trigger a retry after fixing the underlying issue. If it fails again, it goes back to the DLQ.

When the DLQ crosses a set threshold, an email alert goes out automatically. Define the threshold and document it.

Scheduled Jobs
Jobs with a future scheduled_at do not run until that time has passed.
Example:
{
"type": "send_email",
"scheduled_at": "2026-06-10T10:00:00Z"
}

Recurring Jobs
When a recurring job completes, the next run schedules itself automatically. No user action required.
Example intervals:
every_1_minute
every_5_minutes
every_1_hour

Cancellation
Cancelled jobs do not get processed. If a job is already processing when it gets cancelled, handle it and document what you decided.

Live Updates
The UI reflects status changes without a page refresh. Pick one approach and stay consistent:

- Polling
- Server-Sent Events (SSE)
- WebSockets

Duplicate Protection
One job cannot be picked up by two workers at the same time. This applies even on a single worker setup.

Starvation Prevention
Low-priority jobs cannot wait forever while high-priority jobs keep jumping the queue. The longer a job sits, the higher its effective priority becomes. Define the threshold, build the logic, and be prepared to walk through it at presentation.

Logging
Log every significant event:

- Job created
- Job started
- Retry attempted
- Job failed
- Job cancelled
- Job completed
  Structured format only. console.log("done") is not logging.

Required: Heap-Based Priority Queue
The scheduler uses a heap internally. Jobs are ordered by:

1.  Priority
2.  Scheduled time
3.  Creation time
    Scheduled jobs only enter the heap when their time is due. Recurring jobs re-enter after completion. You will be asked to explain how your heap works.

Required: DAG Workflow
Jobs can depend on other jobs. A job does not run until all its dependencies have completed successfully.

Example workflow:
Generate Report
↓
Upload File
↓
Send Email
Build this. It will be evaluated.

Required: Alternative Scheduling Algorithm
Implement a second scheduling algorithm alongside the heap.
Options:

- Timing wheels
- Indexed priority queues
- Skip lists
  Benchmark it against the heap and submit the numbers. Be prepared to explain the tradeoffs.

The UI
Stack: React, HTML, CSS, or plain JavaScript.
• Dashboard — job counts by status
• Jobs table — ID, type, priority, status, retry count, scheduled time, interval, created time
• Create job form — all fields, self-explanatory to use
• DLQ view — failed jobs with error details visible and a manual retry button on each

Submission Requirement:
GitHub repo
Live UI URL
API docs (Swagger, Postman)
Architecture doc (Markdown, or Google Doc)
Deployed server URL:
Manually deployed to a server (no Heroku, Render, Railway, or any managed platform)
Configure a publicly accessible domain using any dynamic DNS provider.
HTTPS enabled
Nginx configured as a reverse proxy
