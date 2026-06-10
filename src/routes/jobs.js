import express from "express";
import { log, logger } from "../logger.js";

export const jobRouter = express.Router();

// POST /jobs
jobRouter.post("/", (req, res) => {
  const { type, payload, priority, maxRetries, interval } = req.body;

  const { isValid, sanitizedPayload, normalizedInterval } = validatePostJob(
    type,
    payload,
    priority,
    maxRetries,
    interval,
    res,
  );

  if (!isValid) return;

  try {
    // store in db
    const insert = db.prepare(`
          INSERT INTO requests (url, method, body, status, maxRetries, backoffMs)
          VALUES (@url, @method, @body, 'pending', @maxRetries, @backoffMs)
        `);
    const result = insert.run({
      url: `/jobs/${type}`,
      method: "POST",
      body: sanitizedPayload ? JSON.stringify(sanitizedPayload) : null,
      maxRetries: maxRetries ?? 5,
      backoffMs: normalizedInterval ?? 1000,
    });

    logger.info(
      `POST /request - Request created with id=${result.lastInsertRowid} url=/jobs/${type} method=POST`,
    );

    // return a response with id and pending
    res
      .status(201)
      .location(`/requests/${result.lastInsertRowid}`)
      .json({ id: result.lastInsertRowid, status: "pending" });
  } catch (err) {
    // if it fails
    logger.error(`POST /request - DB insert failed: ${err.message}`);
    res.status(500).json({
      status: "error",
      message: "request was not recorded successfully",
    });
  }
});

// GET /jobs/:id
jobRouter.get("/:id", (req, res) => {
  const { id } = req.params;

  const getRequestAndAttempts = db.prepare(
    "SELECT r.*, a.status as attemptStatus, a.message, a.createdAt as attemptCreatedAt FROM requests AS r \
      JOIN attempts AS a ON r.id = a.requestId \
      WHERE r.id = ?",
  );

  try {
    const requestHistory = getRequestAndAttempts.all(id);

    if (requestHistory.length === 0) {
      logger.info(`GET /requests/${id} - Not found`);
      return res
        .status(404)
        .json({ status: "error", message: "Request not found" });
    }

    logger.info(
      `GET /requests/${id} - Returned ${requestHistory.length} attempt(s)`,
    );
    res.status(200).json({
      status: "success",
      data: requestHistory,
    });
  } catch (err) {
    logger.error(`GET /requests/${id} - DB query failed: ${err.message}`);
    res
      .status(500)
      .json({ status: "error", message: "Could not retrieve request" });
  }
});

// GET /jobs?status=pending
jobRouter.get("/", (req, res) => {
  const { status } = req.query;

  if (!["pending", "retrying", "completed", "failed"].includes(status)) {
    return res.status(400).json({
      status: "error",
      message:
        "Invalid status. Status must be 'pending', 'retrying', 'completed', 'failed' ",
    });
  }

  const getRequestsByStatus = db.prepare(
    "SELECT * FROM requests \
      WHERE status = ?",
  );

  try {
    const result = getRequestsByStatus.all(status);
    logger.info(
      `GET /requests?status=${status} - Returned ${result.length} request(s)`,
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (err) {
    logger.error(
      `GET /requests?status=${status} - DB query failed: ${err.message}`,
    );
    res
      .status(500)
      .json({ status: "error", message: "Could not retrieve request" });
  }
});

// PATCH /jobs/:id/cancel
jobRouter.patch("/:id/cancel", (req, res) => {});

// ============================ HELPER FUNCTIONS =========================================
function validatePostJob(type, payload, priority, maxRetries, interval, res) {
  if (!type) {
    res.status(400).json({
      status: "error",
      message: "Missing type. Please input type in your request",
    });
    return { isValid: false };
  }

  if (!payload) {
    res.status(400).json({
      status: "error",
      message: "Missing payload. Please input the payload in your request",
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
      const intervalRegex = /^every_(\d+)_(second|seconds|minute|minutes|hour|hours)$/i;
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

  return { isValid: true, sanitizedPayload, normalizedInterval };
}

