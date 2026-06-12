import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MinHeap } from "./heap.js";
import { genericHandler } from "./handlers/genericHandler.js";

// ── Heap ──────────────────────────────────────────────────────────────────────

describe("MinHeap", () => {
  test("extracts jobs in priority order (1=high, 3=low)", () => {
    const heap = new MinHeap();
    const now = new Date().toISOString();
    heap.insert({ id: 1, priority: 3, scheduledAt: now, createdAt: now });
    heap.insert({ id: 2, priority: 1, scheduledAt: now, createdAt: now });
    heap.insert({ id: 3, priority: 2, scheduledAt: now, createdAt: now });
    assert.equal(heap.extractMin().id, 2);
    assert.equal(heap.extractMin().id, 3);
    assert.equal(heap.extractMin().id, 1);
  });

  test("returns null when heap is empty", () => {
    const heap = new MinHeap();
    assert.equal(heap.extractMin(), null);
    assert.equal(heap.peek(), null);
  });

  test("same priority: breaks ties by scheduledAt then createdAt", () => {
    const heap = new MinHeap();
    const earlier = "2026-01-01T00:00:00.000Z";
    const later = "2026-01-02T00:00:00.000Z";
    heap.insert({ id: 10, priority: 2, scheduledAt: later, createdAt: later });
    heap.insert({
      id: 11,
      priority: 2,
      scheduledAt: earlier,
      createdAt: earlier,
    });
    assert.equal(heap.extractMin().id, 11);
  });

  test("size reflects inserts and extractions", () => {
    const heap = new MinHeap();
    const now = new Date().toISOString();
    heap.insert({ id: 1, priority: 1, scheduledAt: now, createdAt: now });
    heap.insert({ id: 2, priority: 2, scheduledAt: now, createdAt: now });
    assert.equal(heap.size(), 2);
    heap.extractMin();
    assert.equal(heap.size(), 1);
  });
});

// ── genericHandler ────────────────────────────────────────────────────────────

describe("genericHandler", () => {
  test("returns a result object with expected shape", async () => {
    // Retry up to 10 times to account for the 20% random failure rate
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const result = await genericHandler("log_process", {
          message: "hello",
        });
        assert.equal(result.processed, true);
        assert.equal(result.type, "log_process");
        assert.ok(result.processedAt);
        return;
      } catch {
        /* random failure — retry */
      }
    }
    assert.fail("genericHandler failed 10 consecutive times");
  });

  test("throws when type is empty string", async () => {
    await assert.rejects(
      () => genericHandler("", { foo: "bar" }),
      /Job type is required/,
    );
  });
});

const app = express();

let failCount = 0;

app.get("/mock", (req, res) => {
  failCount++;
  if (failCount <= 3) {
    res.status(500).json({ error: `Simulated failure #${failCount}` });
  } else {
    res.status(200).json({ message: "Success after retries!" });
  }
});

// Always returns 400 — for demo: 4xx is never retried
app.get("/mock-4xx", (req, res) => {
  res.status(400).json({ error: "Bad request — this will never be retried" });
});

// Always returns 500 — for demo: dead-letter after maxRetries
app.get("/mock-always-fail", (req, res) => {
  res.status(500).json({ error: "Server error — always fails" });
});

app.listen(3001, async () => {
  console.log(chalk.blue.bold("Mock server running on port 3001"));

  // Helper: register a request and poll until done
  async function runScenario(label, body) {
    console.log(chalk.blue.bold(`\n--- ${label} ---`));
    console.log(
      chalk.cyan(
        `→ POST http://localhost:3000/request\n  url: ${body.url}\n  method: ${body.method}${body.maxRetries !== undefined ? `\n  maxRetries: ${body.maxRetries}` : ""}${body.backoffMs !== undefined ? `\n  backoffMs: ${body.backoffMs}` : ""}${body.body !== undefined ? `\n  body: ${body.body}` : ""}`,
      ),
    );
    const res = await fetch("http://localhost:3000/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const { id } = await res.json();
    console.log(chalk.green(`✓ Request registered with id=${id}`));

    return new Promise((resolve) => {
      let lastLoggedKey = null;
      const interval = setInterval(async () => {
        const response = await fetch(`http://localhost:3000/requests/${id}`);
        const responseData = await response.json();
        if (!responseData.data) {
          console.log(chalk.gray("Waiting for first attempt..."));
          return;
        }
        const requestHistory = responseData.data[0];
        const { status, attemptCount, nextRetryAt, lastError, updatedAt } =
          requestHistory;

        const currentKey = `${status}-${attemptCount}`;
        if (currentKey === lastLoggedKey) return;
        lastLoggedKey = currentKey;

        if (status === "retrying") {
          const waitedMs =
            nextRetryAt && updatedAt
              ? new Date(nextRetryAt) - new Date(updatedAt)
              : null;
          const waitedSec = waitedMs ? Math.round(waitedMs / 1000) : "?";
          console.log(
            chalk.yellow(
              `⟳  [attempt ${attemptCount}] Failed — next retry in ~${waitedSec}s | error: ${lastError}`,
            ),
          );
        } else if (status === "completed") {
          console.log(
            chalk.green(
              `✓  [attempt ${attemptCount}] SUCCESS — request completed!`,
            ),
          );
        } else if (status === "failed") {
          console.log(
            chalk.red(
              `✗  [attempt ${attemptCount}] FAILED — Last error: ${lastError}`,
            ),
          );
        } else {
          console.log(chalk.gray(`·  [${status}] attempt=${attemptCount}`));
        }

        if (status === "completed" || status === "failed") {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  }

  // Scenario 1: 5xx fails 3 times then succeeds
  await runScenario("SCENARIO 1: 5xx retries then succeeds", {
    url: "http://localhost:3001/mock",
    method: "GET",
  });

  // Scenario 2: 4xx — never retried, fails immediately
  await runScenario("SCENARIO 2: 4xx — not retried", {
    url: "http://localhost:3001/mock-4xx",
    method: "GET",
  });

  // Scenario 3: always 500 — dead-lettered after maxRetries
  await runScenario("SCENARIO 3: dead-letter after maxRetries=3", {
    url: "http://localhost:3001/mock-always-fail",
    method: "GET",
    maxRetries: 3,
    backoffMs: 500,
  });

  console.log(chalk.blue.bold("\n--- All scenarios complete ---"));
  process.exit(0);
});
