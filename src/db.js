import Database from "better-sqlite3";

const db = new Database("database.db");
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
        nextRetryAt DATETIME,
        scheduledAt DATETIME NOT NULL,
        interval TEXT,
        lastError TEXT,
        result TEXT,
        lockedAt DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
}

createJobTable();
createAttemptTable();
createJobDepTable();
createDLQTable();
