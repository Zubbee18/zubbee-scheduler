export class MinHeap {
  constructor() {
    this.heap = [];
  }

  parentIndex(i) {
    return Math.floor((i - 1) / 2);
  }

  leftChildIndex(i) {
    return 2 * i + 1;
  }

  rightChildIndex(i) {
    return 2 * i + 2;
  }

  swap(i1, i2) {
    [this.heap[i1], this.heap[i2]] = [this.heap[i2], this.heap[i1]];
  }

  compare(a, b) {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;

    const aTooLong = now - new Date(a.createdAt).getTime() >= oneHourMs;
    const bTooLong = now - new Date(b.createdAt).getTime() >= oneHourMs;

    // Expired jobs always run first.
    if (aTooLong !== bTooLong) return aTooLong ? -1 : 1;

    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.scheduledAt && b.scheduledAt && a.scheduledAt !== b.scheduledAt)
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    return new Date(a.createdAt) - new Date(b.createdAt);
  }

  insert(value) {
    this.heap.push(value);
    this.bubbleUp();
  }

  // Reorder other elements after removal
  bubbleDown() {
    let i = 0;

    while (i < this.heap.length) {
      const left = this.leftChildIndex(i);
      const right = this.rightChildIndex(i);

      // No children left, heap property holds.
      if (left >= this.heap.length) break;

      let smallest = left;
      if (
        right < this.heap.length &&
        this.compare(this.heap[right], this.heap[left]) < 0
      ) {
        smallest = right;
      }

      if (this.compare(this.heap[i], this.heap[smallest]) <= 0) break;

      this.swap(i, smallest);
      i = smallest;
    }
  }

  // Order the new insert
  bubbleUp() {
    let i = this.heap.length - 1;

    while (i > 0) {
      const p = this.parentIndex(i);

      // Current node is in the right place.
      if (this.compare(this.heap[i], this.heap[p]) >= 0) break;

      this.swap(i, p);
      i = p;
    }
  }

  // Find smallest element
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
    return this.heap.length;
  }
}
