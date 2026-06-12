import express from "express";
import db from "../db.js";
import { logger } from "../logger.js";
import { emailHandler } from "../handlers/emailHandler.js";

export const dlqRouter = express.Router();

// GET /dlq — list all dead-letter jobs with error details
dlqRouter.get("/", (req, res) => {
  try {
    const jobs = db
      .prepare(
        `
      SELECT d.id as dlqId, d.reason, d.createdAt as failedAt,
             j.id, j.type, j.payload, j.priority, j.attemptCount,
             j.maxRetries, j.lastError, j.updatedAt
      FROM dlq d
      JOIN jobs j ON j.id = d.jobId
      ORDER BY d.createdAt DESC
    `,
      )
      .all();

    logger.info(`GET /dlq - returned ${jobs.length} job(s)`);
    res.status(200).json({ status: "success", data: jobs });
  } catch (err) {
    logger.error(`GET /dlq - failed: ${err.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Could not retrieve DLQ" });
  }
});

// POST /dlq/:id/retry — reset a DLQ entry back to pending for re-processing
dlqRouter.post("/:id/retry", (req, res) => {
  const { id } = req.params;

  try {
    const entry = db
      .prepare(
        `
      SELECT d.id as dlqId, j.*
      FROM dlq d
      JOIN jobs j ON j.id = d.jobId
      WHERE d.id = ?
    `,
      )
      .get(id);

    if (!entry) {
      return res
        .status(404)
        .json({ status: "error", message: "DLQ entry not found" });
    }

    db.transaction((dlqId, jobId) => {
      db.prepare("DELETE FROM dlq WHERE id = ?").run(dlqId);
      db.prepare(
        `
        UPDATE jobs
        SET status = 'pending',
            attemptCount = 0,
            lastError = NULL,
            scheduledAt = datetime('now'),
            updatedAt = datetime('now')
        WHERE id = ?
      `,
      ).run(jobId);
    })(id, entry.id);

    logger.info(`POST /dlq/${id}/retry - job ${entry.id} reset to pending`);
    res
      .status(200)
      .json({
        status: "success",
        message: "Job queued for retry",
        jobId: entry.id,
      });
  } catch (err) {
    logger.error(`POST /dlq/${id}/retry - failed: ${err.message}`);
    res.status(500).json({ status: "error", message: "Could not retry job" });
  }
});
