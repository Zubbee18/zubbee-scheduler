export class timingWheel {
  constructor(tickMs = 1000, slots = 3600) {
    this.tickMs = tickMs;
    this.slots = slots;
    this.cursor = 0;
    this.buckets = Array.from({ length: slots }, () => []);
  }

  // put job in future slot
  schedule(id, delayMs) {
    const ticks = Math.max(1, Math.ceil(delayMs / this.tickMs)); //12
    const slot = (this.cursor + ticks) % this.slots;
    const rounds = Math.floor((ticks - 1) / this.slots);
    this.buckets[slot].push({ id, rounds });
  }

  // return runnable jobs
  tick() {
    this.cursor = (this.cursor + 1) % this.slots;
    const bucket = this.buckets[this.cursor];
    const keep = [];
    const run = [];

    for (const job of bucket) {
      if (job.rounds > 0) {
        job.rounds--;
        keep.push(job);
      } else {
        run.push(job);
      }
    }

    this.buckets[this.cursor] = keep;
    return run;
  }
}
