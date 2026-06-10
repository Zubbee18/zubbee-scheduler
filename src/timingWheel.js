export class timingWheel {
  constructor(tickMs = 1000, slots = 3600) {
    this.tickMs = tickMs;
    this.slots = slots;
    this.cursor = 0;
    this.buckets = Array.from({ length: slots }, () => ({
      1: [],
      2: [],
      3: [],
    }));
  }

  // put job in future slot
  schedule(job) {
    const { id, priority, scheduledAt, createdAt } = job;
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const scheduledMs = scheduledAt ? new Date(scheduledAt).getTime() : now;
    const createdAtMs = new Date(createdAt).getTime();
    const delayMs = Math.max(1000, scheduledMs - now);

    const ticks = Math.max(1, Math.ceil(delayMs / this.tickMs));
    const slot = (this.cursor + ticks) % this.slots;
    const rounds = Math.floor((ticks - 1) / this.slots);
    this.buckets[slot][priority].push({ id, rounds, createdAtMs });
  }

  // return runnable jobs
  tick() {
    this.cursor = (this.cursor + 1) % this.slots;
    const bucket = this.buckets[this.cursor];
    const run = [];

    for (const priority in bucket) {
      const keep = [];
      const due = [];
      for (const job of bucket[priority]) {
        if (job.rounds > 0) {
          job.rounds -= 1;
          keep.push(job);
        } else {
          due.push(job);
        }
      }

      // consider created time when creating run
      due.sort((a, b) => a.createdAtMs - b.createdAtMs);
      run.push(...due);

      bucket[priority] = keep;
    }

    return run;
  }
}
