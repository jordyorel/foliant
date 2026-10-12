import {describe, expect, it, vi} from "vitest";
import {JobScheduler, workerLimit} from "@/lib/jobs/scheduler";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
}

describe("job admission control", () => {
  it("drains accepted work while refusing new jobs", async () => {
    const scheduler = new JobScheduler(1, 2);
    const gate = deferred();
    const second = vi.fn(async () => {});
    scheduler.enqueue(() => gate.promise);
    scheduler.enqueue(second);
    expect(scheduler.beginShutdown()).toEqual({stopping: true, active: 1, pending: 1, drained: false});
    expect(() => scheduler.enqueue(async () => {})).toThrow(/busy/);
    gate.resolve();
    await vi.waitFor(() => expect(scheduler.status().drained).toBe(true));
    expect(second).toHaveBeenCalledOnce();
    expect(scheduler.beginShutdown().drained).toBe(true);
  });
  it("limits active work and starts waiting jobs in order", async () => {
    const scheduler = new JobScheduler(2, 2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const started: number[] = [];
    gates.forEach((gate, index) => scheduler.enqueue(async () => {started.push(index); await gate.promise;}));
    await vi.waitFor(() => expect(started).toEqual([0, 1]));
    expect(() => scheduler.enqueue(async () => {})).toThrow(/busy/);
    gates[0].resolve();
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));
    gates[1].resolve();
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3]));
    gates[2].resolve(); gates[3].resolve();
  });

  it("releases the slot after rejection and handles synchronous failures", async () => {
    const onError = vi.fn();
    const scheduler = new JobScheduler(1, 2, onError);
    const next = vi.fn(async () => {});
    scheduler.enqueue(() => {throw new Error("private error");});
    scheduler.enqueue(async () => {throw new Error("private error");});
    scheduler.enqueue(next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith();
  });

  it("uses bounded explicit configuration", () => {
    expect(workerLimit(undefined, 2, 16)).toBe(2);
    expect(workerLimit("4", 2, 16)).toBe(4);
    for (const value of ["", "0", "-1", "1.5", "NaN", "17"]) {
      expect(() => workerLimit(value, 2, 16)).toThrow();
    }
  });
});
