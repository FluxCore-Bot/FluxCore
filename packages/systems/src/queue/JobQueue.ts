export interface Identifiable {
  id: string | number;
}

export class JobQueue<T extends Identifiable> {
  private buffer: T[] = [];
  private inFlight: Set<string | number> = new Set();
  private consumer: (item: T) => Promise<void>;
  private _running = false;
  private _processing = false;

  constructor(consumer: (item: T) => Promise<void>) {
    this.consumer = consumer;
  }

  enqueue(items: T[]): void {
    for (const item of items) {
      if (!this.inFlight.has(item.id)) {
        this.inFlight.add(item.id);
        this.buffer.push(item);
      }
    }
    if (this._running && !this._processing) {
      this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (!this._running || this.buffer.length === 0) {
      this._processing = false;
      return;
    }

    this._processing = true;
    const item = this.buffer.shift()!;

    try {
      await this.consumer(item);
    } catch {
      // Consumer errors are the consumer's responsibility to handle.
      // We suppress here to prevent unhandled rejections.
    } finally {
      this.inFlight.delete(item.id);
      if (this._running && this.buffer.length > 0) {
        this.processNext();
      } else {
        this._processing = false;
      }
    }
  }

  start(): void {
    this._running = true;
    if (this.buffer.length > 0 && !this._processing) {
      this.processNext();
    }
  }

  stop(): void {
    this._running = false;
    this._processing = false;
    this.buffer = [];
    this.inFlight.clear();
  }

  get pending(): number {
    return this.buffer.length;
  }

  get isProcessing(): boolean {
    return this._processing;
  }
}
