import {AppError, ErrorCode} from "@/lib/validation/errors";
import {logOperationalEvent} from "@/lib/operations/log";

export function workerLimit(value: string | undefined, fallback: number, maximum: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`Worker limit must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

/** In-process admission control, not a distributed or retrying queue. */
export class JobScheduler {
  private active = 0;
  private stopping = false;
  private pending: Array<() => Promise<void>> = [];

  constructor(private concurrency: number, private maxPending: number,
    private onError: () => void = () => { logOperationalEvent("worker_failed"); }) {}

  assertCapacity() {
    if (this.stopping || this.active + this.pending.length >= this.concurrency + this.maxPending) {
      throw new AppError(ErrorCode.serverBusy, "Server is busy. Please try again shortly.", 503);
    }
  }

  beginShutdown() {
    this.stopping = true;
    return this.status();
  }

  status() {
    return {stopping: this.stopping, active: this.active, pending: this.pending.length,
      drained: this.stopping && this.active === 0 && this.pending.length === 0};
  }

  enqueue(task: () => Promise<void>) {
    this.assertCapacity();
    this.pending.push(task);
    this.drain();
  }

  private drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const task = this.pending.shift()!;
      this.active++;
      void Promise.resolve().then(task).catch(() => this.onError()).finally(() => {
        this.active--;
        this.drain();
      });
    }
  }
}
