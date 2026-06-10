import express from "express";

export const jobRouter = express.Router();

// POST /jobs
jobRouter.post("/", (req, res) => {
  const { url, method, body, maxRetries, backoffMs } = req.body;

  // validation
  if (
    url === "" ||
    url === undefined ||
    method === "" ||
    method === undefined
  ) {
    return res.status(400).json({
      status: "error",
      message: "url and method is required",
    });
  }

  if (!validator.isURL(url, { require_tld: false })) {
    return res.status(400).json({
      status: "error",
      message: "url is not valid",
    });
  }

  if (
    body &&
    !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
  ) {
    return res.status(400).json({
      status: "error",
      message: "method is not valid",
    });
  }

  if (body) {
    try {
      JSON.parse(body);
    } catch (err) {
      return res.status(400).json({
        status: "error",
        message: "body is not valid json",
      });
    }
  }

  if (maxRetries !== undefined && !Number.isInteger(maxRetries)) {
    return res.status(400).json({
      status: "error",
      message: "max retries must be a valid number",
    });
  }

  if (backoffMs !== undefined && !Number.isInteger(backoffMs)) {
    return res.status(400).json({
      status: "error",
      message: "backoff in milliseconds must be a valid number",
    });
  }

  try {
    // store in db
    const insert = db.prepare(`
          INSERT INTO requests (url, method, body, status, maxRetries, backoffMs)
          VALUES (@url, @method, @body, 'pending', @maxRetries, @backoffMs)
        `);
    const result = insert.run({
      url,
      method,
      body: body ?? null,
      maxRetries: maxRetries ?? 5,
      backoffMs: backoffMs ?? 1000,
    });

    logger.info(
      `POST /request - Request created with id=${result.lastInsertRowid} url=${url} method=${method}`,
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
