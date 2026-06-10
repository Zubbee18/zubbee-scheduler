import db from "./db";
import { MinHeap } from "./heap.js";
import { TimingWheel } from "./timingWheel.js";
import { log, logger } from "./logger";
import { emailHandler } from "./handlers/emailHandler.js";

async function runWorker() {
  const getReadyJobs = db.prepare(`
    SELECT * FROM jobs 
    WHERE status = 'pending'
    AND scheduledAt <= datetime('now')
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
    "INSERT INTO attempts (jobId, status, message) \
      VALUES (?, ?, ?)",
  );

  const incrementAttemptCount = db.prepare(
    "UPDATE jobs SET attemptCount = ? \
      WHERE id = ?",
  );

  const finishCompleted = db.transaction((attemptCount, result, now, id) => {
    incrementAttemptCount.run(attemptCount, id);
    updateCompleted.run(result, now, id);
    recordAttempt.run(id, "success", result);
  });

  const finishFailed = db.transaction((attemptCount, result, now, id) => {
    incrementAttemptCount.run(attemptCount, id);
    updateFailed.run(result, now, id);
    recordAttempt.run(id, "error", result);
  });

  const finishRetry = db.transaction(
    (attemptCount, result, now, scheduledAt, id) => {
      incrementAttemptCount.run(attemptCount, id);
      updateRetry.run(result, scheduledAt, now, id);
      recordAttempt.run(id, "error", result);
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
    const {
      id,
      type,
      payload,
      priority,
      status,
      attemptCount,
      scheduledAt,
      interval,
      result,
      lockedAt,
      updatedAt,
    } = processingJob;

    const backoffMs = 1000;

    // run handlers
    if (type === "send_email") {
      try {
        // run email handler
        const { delivered, to, subject, sentAt } = await emailHandler(payload);

        // successful
        if (delivered) {
          logger.info(`job with id=${id} - email was successfully sent`);

          try {
            const now = new Date().toISOString().replace("T", " ").slice(0, 19);
            const newAttemptCount = attemptCount + 1;
            finishCompleted(newAttemptCount, result, now, id);
            if (interval) {
              const nextScheduledAt = new Date(
                Date.now() + interval,
              ).toISOString();
              const newJob = createNewJob.run(
                type,
                payload,
                priority,
                interval,
                nextScheduledAt,
              );

              log();
            }
            logger.info(
              `job with id=${id} was successfully updated as "completed" }`,
            );
          } catch (err) {
            logger.error(
              `job with id=${id} was could not be updated as "completed" }`,
            );
          }
        }
      } catch (err) {
        if (
          err.message === "Invalid email address" ||
          err.message === "Subject is required"
        ) {
          logger.info(`job with id=${id} was failed with 4xx error`);

          try {
            const now = new Date().toISOString().replace("T", " ").slice(0, 19);
            const newAttemptCount = attemptCount + 1;
            finishFailed(newAttemptCount, result, now, id);
            logger.info(
              `job with id=${id} was successfully updated as "failed" }`,
            );
          } catch (err) {
            logger.error(
              `job with id=${id} was could not be updated as "failed" }`,
            );
          }
        } else if (err.message === "Mail server timeout") {
          logger.info(`job with id=${id} was failed with 5xx error`);

          try {
            const newAttemptCount = attemptCount + 1;
            if (newAttemptCount > 3) {
              const now = new Date().toISOString();
              finishFailed(newAttemptCount, result, now, id);
              logger.info(
                `job with id=${id} was successfully updated as "failed" }`,
              );
            } else {
              const jitter = 0.8 + Math.random() * 0.4;
              const wait = backoffMs * 5 ** attemptCount * jitter;
              const now = new Date().toISOString();
              const scheduledAt = new Date(Date.now() + wait).toISOString();
              finishRetry(newAttemptCount, result, now, scheduledAt, id);
              logger.info(
                `job with id=${id} scheduled retry #${newAttemptCount} in ${Math.round(wait)}ms`,
              );
            }
            logger.info(
              `job with id=${id} was successfully updated as "pending" }`,
            );
          } catch (err) {
            logger.error(
              `job with id=${id} could not be updated as "pending" or "failed": ${err.message}`,
            );
          }
        }
      }
    }
  }

  // Sleep 500ms, then call runWorker() again
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

  // get job from heap
  const processingJob = MinHeap.extractMin();

  if (processingJob) {
    // check dependencies
    const dependencies = getDependencies.all(processingJob.id);

    if (dependencies.length === 0) {
      return processingJob;
    }

    const allDone = dependencies.every((dep) => dep.status === "completed");
    if (!allDone) {
      return null;
    }

    return processingJob;
  }

  return null;
}

runWorker();
