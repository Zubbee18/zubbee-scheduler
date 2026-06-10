import express from "express";
import { log, logger } from "../logger.js";
import db from "../db.js";

export const jobRouter = express.Router();

// POST /jobs
jobRouter.post("/", (req, res) => {
  const { type, payload, priority, max_retries, interval, scheduled_at } =
    req.body;

  const { isValid, sanitizedPayload, normalizedInterval, scheduledAtTs } =
    validatePostJob(
      type,
      payload,
      priority,
      max_retries,
      interval,
      scheduled_at,
      res,
    );

  if (!isValid) return;

  // normalize type
  const normalizedType = type.toLowerCase().replace(" ", "_").trim();

  try {
    // store in db
    const insert = db.prepare(`
          INSERT INTO jobs (type, payload, priority, maxRetries, interval, scheduledAt)
          VALUES (@type, @payload, @priority, @maxRetries, @interval, @scheduledAt)
        `);
    const result = insert.run({
      type: normalizedType,
      payload: JSON.stringify(sanitizedPayload),
      priority: priority ?? 2,
      maxRetries: max_retries ?? 3,
      interval: normalizedInterval ?? null,
      scheduledAt: scheduled_at,
    });

    logger.info(
      `POST /job - job created with id=${result.lastInsertRowid} type=${normalizedType} priority=${priority}`,
    );

    log("job created", { id: result.lastInsertRowid, type: normalizedType });

    // return a response with id and pending
    res
      .status(201)
      .location(`/jobs/${result.lastInsertRowid}`)
      .json({ id: result.lastInsertRowid, status: "pending" });
  } catch (err) {
    // if it fails
    logger.error(`POST /job - DB insert failed: ${err.message}`);
    res.status(500).json({
      status: "error",
      message: "job was not recorded successfully",
    });
  }
});

// GET /jobs/:id
jobRouter.get("/:id", (req, res) => {
  const { id } = req.params;

  const getjobAndAttempts = db.prepare(
    "SELECT j.*, a.status as attemptStatus, a.response, a.createdAt as attemptCreatedAt FROM jobs AS j \
      LEFT JOIN attempts AS a ON j.id = a.jobId \
      WHERE j.id = ?",
  );

  try {
    const jobHistory = getjobAndAttempts.all(id);

    if (jobHistory.length === 0) {
      logger.info(`GET /jobs/:${id} - Not found`);
      return res
        .status(404)
        .json({ status: "error", message: "job not found" });
    }

    logger.info(`GET /jobs/${id} - Returned ${jobHistory.length} attempt(s)`);
    res.status(200).json({
      status: "success",
      data: jobHistory,
    });
  } catch (err) {
    logger.error(`GET /jobs/${id} - DB query failed: ${err.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Could not retrieve job" });
  }
});

// GET /jobs?status=pending
jobRouter.get("/", (req, res) => {
  const { status } = req.query;

  if (
    !["pending", "processing", "completed", "failed", "cancelled"].includes(
      status,
    )
  ) {
    return res.status(400).json({
      status: "error",
      message:
        "Invalid status. Status must be 'pending','processing','completed','failed' or 'cancelled' ",
    });
  }

  const getjobsByStatus = db.prepare(
    "SELECT * FROM jobs \
      WHERE status = ?",
  );

  try {
    const result = getjobsByStatus.all(status);
    logger.info(
      `GET /jobs?status=${status} - Returned ${result.length} job(s)`,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (err) {
    logger.error(
      `GET /jobs?status=${status} - DB query failed: ${err.message}`,
    );
    res
      .status(500)
      .json({ status: "error", message: "Could not retrieve jobs" });
  }
});

// PATCH /jobs/:id/cancel
jobRouter.patch("/:id/cancel", (req, res) => {
  // get job by id
  const { id } = req.params;

  const getJobStatusById = db.prepare(
    "SELECT status FROM jobs \
      WHERE id = ?",
  );

  try {
    const jobStatus = getJobStatusById.get(id);

    if (jobStatus === undefined) {
      logger.info(`GET /jobs/:${id}/cancel - Job Not found`);
      return res
        .status(404)
        .json({ status: "error", message: "job not found" });
    }

    if (jobStatus.status === "cancelled") {
      return res.status(409).json({
        status: "error",
        message: "Job is already cancelled.",
      });
    }

    if (jobStatus.status === "completed") {
      return res.status(409).json({
        status: "error",
        message: "Job is already completed.",
      });
    }

    // update status to cancelled
    const updateStatusToProcessed = db.prepare(
      `UPDATE jobs
        SET status = 'processing', updatedAt = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending';`,
    );

    const updateStatusToCancelled = db.prepare(
      `UPDATE jobs
      SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'processing';`,
    );

    const moveToProcessed = updateStatusToProcessed.run(id);

    const updateResult = updateStatusToCancelled.run(id);

    return res.status(200).json({
      status: "success",
      message: "job has been cancelled successfully",
    });
  } catch (err) {
    logger.error(`GET /jobs/:${id}/cancel - DB query failed: ${err.message}`);
    res.status(500).json({
      status: "error",
      message: "Could not retrieve job. Please try again later.",
    });
  }
});

// ============================ HELPER FUNCTIONS =========================================
function validatePostJob(
  type,
  payload,
  priority,
  maxRetries,
  interval,
  scheduled_at,
  res,
) {
  if (!type) {
    res.status(400).json({
      status: "error",
      message: "Missing type. Please input type in your job",
    });
    return { isValid: false };
  }

  if (!payload) {
    res.status(400).json({
      status: "error",
      message: "Missing payload. Please input the payload in your job",
    });
    return { isValid: false };
  }

  let sanitizedPayload = payload;
  if (typeof payload === "string") {
    try {
      sanitizedPayload = JSON.parse(payload);
    } catch {
      res.status(400).json({
        status: "error",
        message: "Payload must be a valid JSON",
      });
      return { isValid: false };
    }
  }

  if (priority !== undefined && ![1, 2, 3].includes(priority)) {
    res.status(400).json({
      status: "error",
      message: "Priority must be 1, 2 or 3",
    });
    return { isValid: false };
  }

  if (maxRetries !== undefined && !Number.isInteger(maxRetries)) {
    res.status(400).json({
      status: "error",
      message: "max retries must be a valid number",
    });
    return { isValid: false };
  }

  // regex to check for specific format of every_[num]_timing
  let normalizedInterval = interval;
  if (interval !== undefined) {
    if (typeof interval === "number") {
      if (!Number.isInteger(interval) || interval <= 0) {
        res.status(400).json({
          status: "error",
          message: "interval must be a positive integer",
        });
        return { isValid: false };
      }
    } else if (typeof interval === "string") {
      const intervalRegex =
        /^every_(\d+)_(second|seconds|minute|minutes|hour|hours)$/i;
      const match = interval.match(intervalRegex);

      if (!match) {
        res.status(400).json({
          status: "error",
          message:
            "Invalid interval format. Use every_[num]_[second|minute|hour]",
        });
        return { isValid: false };
      }

      const value = Number(match[1]);
      const unit = match[2].toLowerCase();
      const multiplier = unit.startsWith("hour")
        ? 3600000
        : unit.startsWith("minute")
          ? 60000
          : 1000;
      normalizedInterval = value * multiplier;
    } else {
      res.status(400).json({
        status: "error",
        message: "interval must be a number or valid schedule string",
      });
      return { isValid: false };
    }
  }

  if (scheduled_at === undefined) {
    res.status(400).json({
      status: "error",
      message: "scheduled at time must be present",
    });
    return { isValid: false };
  }
  const scheduledAtTs =
    typeof scheduled_at === "number" ? scheduled_at : Date.parse(scheduled_at);

  if (!Number.isFinite(scheduledAtTs)) {
    res.status(400).json({
      status: "error",
      message: "scheduled_at must be a valid date",
    });
    return { isValid: false };
  }

  if (scheduledAtTs <= Date.now()) {
    res.status(400).json({
      status: "error",
      message: "Scheduled date must be in the future",
    });
    return { isValid: false };
  }

  return { isValid: true, sanitizedPayload, normalizedInterval, scheduledAtTs };
}
