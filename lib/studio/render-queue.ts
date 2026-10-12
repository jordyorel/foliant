type Entry = {
  key: object;
  priority: number;
  signal: AbortSignal;
  task: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
  abort: () => void;
};

export class PdfRenderQueue {
  private pending: Entry[] = [];
  private activeKeys = new Set<object>();

  constructor(private concurrency = 2) {}

  run(task: () => Promise<void>, key: object, signal: AbortSignal, priority = 0) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const entry: Entry = {task, key, signal, priority, resolve, reject, abort: () => {
        const index = this.pending.indexOf(entry);
        if (index < 0) return;
        this.pending.splice(index, 1);
        signal.removeEventListener("abort", entry.abort);
        reject(signal.reason);
      }};
      signal.addEventListener("abort", entry.abort, {once: true});
      this.pending.push(entry);
      this.pending.sort((left, right) => left.priority - right.priority);
      this.drain();
    });
  }

  private drain() {
    while (this.activeKeys.size < this.concurrency) {
      // A cancelled render must finish before its canvas can be used again.
      const index = this.pending.findIndex((entry) => !this.activeKeys.has(entry.key));
      if (index < 0) return;
      const [entry] = this.pending.splice(index, 1);
      this.activeKeys.add(entry.key);
      void Promise.resolve().then(() => {
        entry.signal.throwIfAborted();
        return entry.task();
      }).then(entry.resolve, entry.reject).finally(() => {
        entry.signal.removeEventListener("abort", entry.abort);
        this.activeKeys.delete(entry.key);
        this.drain();
      });
    }
  }
}

export const pdfRenderQueue = new PdfRenderQueue();
