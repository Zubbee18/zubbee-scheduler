import db from "./db.js";
import { MinHeap as HeapClass } from "./heap.js";
import { logger } from "./logger.js";
import { emailHandler } from "./handlers/emailHandler.js";
import { genericHandler } from "./handlers/genericHandler.js";

const MinHeap = new HeapClass();
const DLQ_ALERT_THRESHOLD = parseInt(process.env.DLQ_ALERT_THRESHOLD ?? "10");

async function runWorker() {
  const getReadyJobs = db.prepare(`
    SELECT * FROM jobs 
    WHERE status = 'pending'
    AND datetime(scheduledAt) <= datetime('now')
  `);

  const lockProcessing = db.prepare(`
    UPDATE jobs 
    SET status = 'processing', lockedAt = datetime('now'), updatedAt = datetime('now')
    WHERE id = ? AND status = 'pending'
    RETURNING *
  `);

  const createNewJob = db.prepare(`
    INSERT INTO jobs (type, payload, priority, interval, scheduledAt)
          VALUES (?, ?, ?, ?, ?)
    `);

  const updateCompleted = db.prepare(
    "UPDATE jobs \
        SET status = 'completed', \
        result = ?, \
        updatedAt = ? \
        WHERE id = ? \
        ",
  );

  const updateFailed = db.prepare(
    "UPDATE jobs \
      SET status = 'failed', \
      lastError = ?, \
      updatedAt = ? \
      WHERE id = ? \
      ",
  );

  const updateRetry = db.prepare(
    "UPDATE jobs \
      SET status = 'pending', \
      lastError = ?, \
      scheduledAt = ?, \
      updatedAt = ? \
      WHERE id = ? \
      ",
  );

  const recordAttempt = db.prepare(
    "INSERT INTO attempts (jobId, status, error, response, attemptNumber) VALUES (?, ?, ?, ?, ?)",
  );

  const insertDLQ = db.prepare(
    "INSERT OR IGNORE INTO dlq (jobId, reason) VALUES (?, ?)",
  );
  const checkCancelled = db.prepare("SELECT status FROM jobs WHERE id = ?");
  const getDLQCount = db.prepare("SELECT COUNT(*) as count FROM dlq");

  const incrementAttemptCount = db.prepare(
    "UPDATE jobs SET attemptCount = ? \
      WHERE id = ?",
  );

  const finishCompleted = db.transaction(
    (attemptCount, handlerResult, now, id) => {
      incrementAttemptCount.run(attemptCount, id);
      updateCompleted.run(handlerResult, now, id);
      recordAttempt.run(id, "success", null, handlerResult, attemptCount);
    },
  );

  const finishFailed = db.transaction((attemptCount, errorMsg, now, id) => {
    incrementAttemptCount.run(attemptCount, id);
    updateFailed.run(errorMsg, now, id);
    recordAttempt.run(id, "error", errorMsg, null, attemptCount);
    insertDLQ.run(id, errorMsg);
  });

  const finishRetry = db.transaction(
    (attemptCount, errorMsg, now, scheduledAt, id) => {
      incrementAttemptCount.run(attemptCount, id);
      updateRetry.run(errorMsg, scheduledAt, now, id);
      recordAttempt.run(id, "error", errorMsg, null, attemptCount);
    },
  );

  // ================================================================================

  const readyJobs = getReadyJobs.all();
  for (const job of readyJobs) {
    MinHeap.insert(job);
  }

  const priorityJob = getFromHeap();
  const processingJob = priorityJob ? lockProcessing.get(priorityJob.id) : null;

  if (processingJob) {
    const { id, type, payload, priority, attemptCount, maxRetries, interval } =
      processingJob;

    const backoffMs = 1000;
    const parsedPayload = JSON.parse(payload);

    // Shared handler: runs the job fn, writes result/failure, handles DLQ alert
    async function handleJob(handlerFn) {
      try {
        const result = await handlerFn();

        const { status: currentStatus } = checkCancelled.get(id);
        if (currentStatus === "cancelled") {
          logger.info(
            `job with id=${id} was cancelled during processing - skipping finalization`,
          );
          return;
        }

        const now = new Date().toISOString();
        finishCompleted(attemptCount + 1, JSON.stringify(result), now, id);
        logger.info(`job with id=${id} (${type}) completed successfully`);

        if (interval) {
          const nextScheduledAt = new Date(Date.now() + interval).toISOString();
          createNewJob.run(type, payload, priority, interval, nextScheduledAt);
          logger.info(
            `job with id=${id} - recurring job scheduled at ${nextScheduledAt}`,
          );
        }
      } catch (err) {
        const isPermanentFailure =
          err.message === "Invalid email address" ||
          err.message === "Subject is required";

        try {
          const newAttemptCount = attemptCount + 1;
          if (isPermanentFailure || newAttemptCount >= maxRetries) {
            const now = new Date().toISOString();
            finishFailed(newAttemptCount, err.message, now, id);
            logger.info(
              `job with id=${id} (${type}) marked as "failed": ${err.message}`,
            );

            const { count } = getDLQCount.get();
            if (count >= DLQ_ALERT_THRESHOLD) {
              logger.warn(
                `DLQ threshold reached: ${count} jobs in dead-letter queue`,
              );
              emailHandler({
                to: process.env.ALERT_EMAIL || "admin@example.com",
                subject: `[Alert] DLQ has ${count} failed jobs`,
              }).catch(() => {});
            }
          } else {
            const jitter = 0.8 + Math.random() * 0.4;
            const wait = backoffMs * 5 ** attemptCount * jitter;
            const now = new Date().toISOString();
            const nextRetryAt = new Date(Date.now() + wait).toISOString();
            finishRetry(newAttemptCount, err.message, now, nextRetryAt, id);
            logger.info(
              `job with id=${id} scheduled retry #${newAttemptCount} in ${Math.round(wait)}ms`,
            );
          }
        } catch (dbErr) {
          logger.error(
            `job with id=${id} could not be updated after failure: ${dbErr.message}`,
          );
        }
      }
    }

    if (type === "send_email") {
      await handleJob(() => emailHandler(parsedPayload));
    } else {
      await handleJob(() => genericHandler(type, parsedPayload));
    }
  }

  // Always poll again after 500ms
  setTimeout(runWorker, 500);
}

// ============================= HELPER FUNCTIONS ===============================

function getFromHeap() {
  const getDependencies = db.prepare(`
    SELECT d.dependsOnJobId, j.status 
    FROM job_dependencies d
    JOIN jobs j ON j.id = d.dependsOnJobId
    WHERE d.jobId = ?
  `);

  const blockedJobs = [];

  while (MinHeap.size() > 0) {
    const processingJob = MinHeap.extractMin();
    if (!processingJob) break;

    const dependencies = getDependencies.all(processingJob.id);
    const allDone = dependencies.every((dep) => dep.status === "completed");

    if (dependencies.length === 0 || allDone) {
      for (const blockedJob of blockedJobs) {
        MinHeap.insert(blockedJob);
      }
      return processingJob;
    }

    blockedJobs.push(processingJob);
  }

  for (const blockedJob of blockedJobs) {
    MinHeap.insert(blockedJob);
  }

  return null;
}

export { runWorker };
