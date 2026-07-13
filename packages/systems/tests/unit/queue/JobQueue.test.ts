import { describe, it, expect, vi, afterEach } from "vitest";
import { JobQueue } from "../../../src/queue/JobQueue.js";

interface TestItem {
  id: number;
  value: string;
}

function createItem(id: number, value = `item-${id}`): TestItem {
  return { id, value };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("JobQueue", () => {
  describe("enqueue", () => {
    it("adds items to pending count", () => {
      const consumer = vi.fn();
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1), createItem(2)]);

      expect(queue.pending).toBe(2);
    });

    it("deduplicates items with same id via inFlight", () => {
      const consumer = vi.fn();
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1), createItem(1)]);

      expect(queue.pending).toBe(1);
    });

    it("does not start processing if not started", () => {
      const consumer = vi.fn();
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1)]);

      expect(consumer).not.toHaveBeenCalled();
    });
  });

  describe("start", () => {
    it("processes all buffered items immediately", async () => {
      const results: string[] = [];
      const consumer = vi.fn(async (item: TestItem) => {
        results.push(item.value);
      });
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1, "a"), createItem(2, "b"), createItem(3, "c")]);
      queue.start();

      // Wait for async processing to complete
      await vi.waitFor(() => {
        expect(queue.pending).toBe(0);
      });

      expect(results).toEqual(["a", "b", "c"]);
      expect(consumer).toHaveBeenCalledTimes(3);
    });

    it("no-ops if queue is empty", () => {
      const consumer = vi.fn();
      const queue = new JobQueue<TestItem>(consumer);

      expect(() => queue.start()).not.toThrow();
      expect(consumer).not.toHaveBeenCalled();
    });
  });

  describe("processing order", () => {
    it("processes items in FIFO order", async () => {
      const results: number[] = [];
      const consumer = vi.fn(async (item: TestItem) => {
        results.push(item.id);
      });
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1), createItem(2), createItem(3)]);
      queue.start();

      await vi.waitFor(() => {
        expect(queue.pending).toBe(0);
      });

      expect(results).toEqual([1, 2, 3]);
    });

    it("processes items sequentially (one at a time)", async () => {
      const concurrency = { current: 0, max: 0 };
      const consumer = vi.fn(async (item: TestItem) => {
        concurrency.current++;
        concurrency.max = Math.max(concurrency.max, concurrency.current);
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrency.current--;
      });
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1), createItem(2), createItem(3)]);
      queue.start();

      await vi.waitFor(() => {
        expect(queue.pending).toBe(0);
      });

      expect(concurrency.max).toBe(1);
    });
  });

  describe("producer-consumer flow", () => {
    it("enqueues new items while draining previous batch", async () => {
      const results: number[] = [];
      const consumer = vi.fn(async (item: TestItem) => {
        results.push(item.id);
      });
      const queue = new JobQueue<TestItem>(consumer);

      // First batch
      queue.enqueue([createItem(1)]);
      queue.start();

      await vi.waitFor(() => {
        expect(results).toEqual([1]);
      });

      // Second batch — simulates next producer tick
      queue.enqueue([createItem(2), createItem(3)]);

      await vi.waitFor(() => {
        expect(results).toEqual([1, 2, 3]);
      });

      expect(queue.pending).toBe(0);
    });

    it("does not re-enqueue items still in-flight", async () => {
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => { resolveFirst = resolve; });

      const consumer = vi.fn(async (item: TestItem) => {
        if (item.id === 1) {
          await firstPromise;
        }
      });
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1)]);
      queue.start();

      // Try to re-enqueue item 1 while it's still processing
      queue.enqueue([createItem(1)]);

      expect(queue.pending).toBe(0); // Should still be 0 (not re-added)

      // Clean up
      resolveFirst!();
      await vi.waitFor(() => {
        expect(queue.isProcessing).toBe(false);
      });
    });
  });

  describe("stop", () => {
    it("clears the buffer and inFlight set", () => {
      const consumer = vi.fn();
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1), createItem(2)]);
      queue.stop();

      expect(queue.pending).toBe(0);
    });

    it("does not process items enqueued after stop", async () => {
      const consumer = vi.fn(async () => {});
      const queue = new JobQueue<TestItem>(consumer);

      queue.start();

      queue.enqueue([createItem(1)]);
      await vi.waitFor(() => {
        expect(queue.isProcessing).toBe(false);
      });
      expect(consumer).toHaveBeenCalledTimes(1);

      queue.stop();
      queue.enqueue([createItem(2)]);

      // Item is buffered but not processed (queue is stopped)
      expect(queue.pending).toBe(1);
      expect(consumer).toHaveBeenCalledTimes(1);
    });
  });

  describe("consumer error handling", () => {
    it("removes failed item from inFlight", async () => {
      const consumer = vi.fn(async () => {
        throw new Error("fail");
      });
      const queue = new JobQueue<TestItem>(consumer);

      queue.enqueue([createItem(1), createItem(2)]);
      queue.start();

      await vi.waitFor(() => {
        expect(queue.isProcessing).toBe(false);
      });

      // Item 1 failed but was removed from inFlight.
      // Item 2 should also have been processed.
      expect(consumer).toHaveBeenCalledTimes(2);
    });
  });
});
