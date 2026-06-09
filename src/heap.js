export class MinHeap {
  constructor() {
    this.heap = [];
  }

  parentIndex(i) {
    return Math.floor((i - 1) / 2);
  }

  leftChildIndex() {
    return 2 * i + 1;
  }

  rightChildIndex() {
    return 2 * i + 2;
  }

  swap(i1, i2) {
    [this.heap[i1], this.heap[i2]] = [this.heap[i2], this.heap[i1]];
  }

  compare(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.scheduledAt !== b.scheduledAt)
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  }

  insert(value) {
    this.heap.push(value);
    this.bubbleUp();
  }

  bubbleUp() {
    for (let i = this.heap.length - 1; i >= 1; i--) {
      const a = this.heap[i];
      const b = this.heap[this.leftChildIndex(i)];
      const c = this.heap[this.rightChildIndex(i)];

      if (c < this.heap.length) {
        // compare right and left
        const diff = this.compare(a, c);
      }

      // a > b -> diff +ve -> swap
      if (diff > 0) {
        this.swap(i, this.parentIndex(i));
      }
    }
  }

  bubbleDown() {
    for (let i = 0; i < this.heap.length; i++) {
      const a = this.heap[i];
      const b = this.heap[this.parentIndex(i)];

      // compare the priority, createdAt, scheduledAt
      const diff = this.compare(a, b);

      // a < b -> diff -ve -> swap
      if (diff < 0) {
        this.swap(i, this.parentIndex(i));
      }
    }
  }

  peek() {
    return this.heap.length === 0 ? null : this.heap[0];
  }

  // Remove and return the minimum element
  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop(); // Move the last element to the root
    this.bubbleDown();
    return min;
  }

  size() {
    return this.array.length;
  }
}
