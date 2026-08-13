import Database from "better-sqlite3";

const filePath = process.env.SQLITE_PATH || "database.db";
const db = new Database(filePath);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
export default db;

function createJobTable() {
  db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 2,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending','processing','completed','failed','cancelled')),
        attemptCount INTEGER NOT NULL DEFAULT 0,
        maxRetries INTEGER NOT NULL DEFAULT 3,
        scheduledAt DATETIME NOT NULL,
        interval INTEGER,
        lastError TEXT,
        result TEXT,
        lockedAt DATETIME,
        createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updatedAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
}

function createAttemptTable() {
  db.exec(`
      CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jobId INTEGER NOT NULL REFERENCES jobs(id),
        status TEXT NOT NULL CHECK(status IN ('success','error')),
        error TEXT,
        response TEXT,
        attemptNumber INTEGER NOT NULL,
        createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
}

function createJobDepTable() {
  db.exec(`
      CREATE TABLE IF NOT EXISTS job_dependencies (
        jobId INTEGER NOT NULL REFERENCES jobs(id),
        dependsOnJobId INTEGER NOT NULL REFERENCES jobs(id),
        PRIMARY KEY (jobId, dependsOnJobId)
      )
    `);
}

function createDLQTable() {
  db.exec(`
      CREATE TABLE IF NOT EXISTS dlq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jobId INTEGER NOT NULL REFERENCES jobs(id),
        reason TEXT,
        createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
}

createJobTable();
createAttemptTable();
createJobDepTable();
createDLQTable();
