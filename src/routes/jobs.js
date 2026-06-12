import express from "express";
import { log, logger } from "../logger.js";
import db from "../db.js";

export const jobRouter = express.Router();

// POST /jobs
jobRouter.post("/", (req, res) => {
  const { type, payload, priority, interval, scheduled_at, dependsOn } =
    req.body;

  const { isValid, sanitizedPayload, normalizedInterval, scheduledAtTs } =
    validatePostJob(type, payload, priority, interval, scheduled_at, res);

  if (!isValid) return;

  // normalize type
  const normalizedType = type.toLowerCase().replace(" ", "_").trim();

  try {
    // store in db
    const insert = db.prepare(`
          INSERT INTO jobs (type, payload, priority, interval, scheduledAt)
          VALUES (@type, @payload, @priority, @interval, @scheduledAt)
        `);
    const result = insert.run({
      type: normalizedType,
      payload: JSON.stringify(sanitizedPayload),
      priority: priority ?? 2,
      interval: normalizedInterval ?? null,
      scheduledAt: new Date(scheduledAtTs).toISOString(),
    });

    logger.info(
      `POST /job - job created with id=${result.lastInsertRowid} type=${normalizedType} priority=${priority}`,
    );

    log("job created", { id: result.lastInsertRowid, type: normalizedType });

    // wire up DAG dependencies if provided
    if (Array.isArray(dependsOn) && dependsOn.length > 0) {
      const insertDep = db.prepare(
        "INSERT INTO job_dependencies (jobId, dependsOnJobId) VALUES (?, ?)",
      );
      const insertDeps = db.transaction((jobId, deps) => {
        for (const depId of deps) insertDep.run(jobId, depId);
      });
      try {
        insertDeps(result.lastInsertRowid, dependsOn);
      } catch (depErr) {
        logger.error(
          `POST /jobs - failed to insert dependencies for job ${result.lastInsertRowid}: ${depErr.message}`,
        );
      }
    }

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

// GET /jobs/counts  — must be declared BEFORE /:id to avoid route shadowing
jobRouter.get("/counts", (req, res) => {
  try {
    const rows = db
      .prepare(`SELECT status, COUNT(*) as count FROM jobs GROUP BY status`)
      .all();

    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const row of rows) {
      if (row.status in counts) counts[row.status] = row.count;
    }

    logger.info(`GET /jobs/counts - returned counts`);
    res.status(200).json({ status: "success", data: counts });
  } catch (err) {
    logger.error(`GET /jobs/counts - DB query failed: ${err.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Could not retrieve job counts" });
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

// GET /jobs?status=pending  (status is optional; omit to get all jobs)
jobRouter.get("/", (req, res) => {
  const { status } = req.query;
  const validStatuses = [
    "pending",
    "processing",
    "completed",
    "failed",
    "cancelled",
  ];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      status: "error",
      message:
        "Invalid status. Status must be 'pending','processing','completed','failed' or 'cancelled' ",
    });
  }

  const query = status
    ? db.prepare("SELECT * FROM jobs WHERE status = ? ORDER BY createdAt DESC")
    : db.prepare("SELECT * FROM jobs ORDER BY createdAt DESC");

  try {
    const result = status ? query.all(status) : query.all();
    logger.info(
      `GET /jobs${status ? `?status=${status}` : ""} - Returned ${result.length} job(s)`,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (err) {
    logger.error(`GET /jobs - DB query failed: ${err.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Could not retrieve jobs" });
  }
});

// PATCH /jobs/:id/cancel
jobRouter.patch("/:id/cancel", (req, res) => {
  const { id } = req.params;

  try {
    const job = db.prepare("SELECT status FROM jobs WHERE id = ?").get(id);

    if (!job) {
      logger.info(`PATCH /jobs/${id}/cancel - Not found`);
      return res
        .status(404)
        .json({ status: "error", message: "job not found" });
    }

    // Atomically cancel — only if still cancellable
    // Processing jobs are also cancellable; worker checks status before finalizing
    const updateResult = db
      .prepare(
        `UPDATE jobs
         SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('pending', 'processing')`,
      )
      .run(id);

    if (updateResult.changes === 0) {
      return res.status(409).json({
        status: "error",
        message: `Job cannot be cancelled (current status: ${job.status})`,
      });
    }

    logger.info(`PATCH /jobs/${id}/cancel - cancelled`);
    return res.status(200).json({
      status: "success",
      message: "job has been cancelled successfully",
    });
  } catch (err) {
    logger.error(`PATCH /jobs/${id}/cancel - DB query failed: ${err.message}`);
    res.status(500).json({
      status: "error",
      message: "Could not cancel job. Please try again later.",
    });
  }
});

// ============================ HELPER FUNCTIONS =========================================
function validatePostJob(type, payload, priority, interval, scheduled_at, res) {
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

  let scheduledAtTs = Date.now();
  if (scheduled_at !== undefined && scheduled_at !== null) {
    scheduledAtTs =
      typeof scheduled_at === "number" ? scheduled_at : Date.parse(scheduled_at);

    if (!Number.isFinite(scheduledAtTs)) {
      res.status(400).json({
        status: "error",
        message: "scheduled_at must be a valid date",
      });
      return { isValid: false };
    }
  }

  return { isValid: true, sanitizedPayload, normalizedInterval, scheduledAtTs };
}
