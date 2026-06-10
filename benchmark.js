import performance from "perf_hooks";
import MinHeap from "./src/heap";
import TimingWheel from "./src/timingWheel";

const JOBS = 10_000;

// Generate 10,000 fake jobs with random delays
const jobs = Array.from({ length: JOBS }, (_, i) => ({
  id: i,
  priority: Math.ceil(Math.random() * 3),
  delayMs: Math.floor(Math.random() * 3600000), // random within 1 hour
  createdAt: new Date().toISOString(),
}));

// --- Heap benchmark ---
const heap = new MinHeap();
const heapInsertStart = performance.now();
jobs.forEach((j) => heap.insert(j));
const heapInsertEnd = performance.now();

const heapExtractStart = performance.now();
while (heap.size() > 0) heap.extractMin();
const heapExtractEnd = performance.now();

// --- Timing wheel benchmark ---
const wheel = new TimingWheel();
const wheelInsertStart = performance.now();
jobs.forEach((j) => wheel.insert(j, j.delayMs));
const wheelInsertEnd = performance.now();

// For timing wheel "extraction" we simulate ticking through all slots
const wheelTickStart = performance.now();
for (let i = 0; i < 3600; i++) wheel.tick();
const wheelTickEnd = performance.now();

// --- Results ---
console.log("\n=== Benchmark Results (10,000 jobs) ===\n");
console.log("HEAP");
console.log(`  Insert: ${(heapInsertEnd - heapInsertStart).toFixed(2)}ms`);
console.log(
  `  Extract all: ${(heapExtractEnd - heapExtractStart).toFixed(2)}ms`,
);
console.log("\nTIMING WHEEL");
console.log(`  Insert: ${(wheelInsertEnd - wheelInsertStart).toFixed(2)}ms`);
console.log(
  `  Tick through all slots: ${(wheelTickEnd - wheelTickStart).toFixed(2)}ms`,
);
