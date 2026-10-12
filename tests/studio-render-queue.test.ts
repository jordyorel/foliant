import {describe, expect, it, vi} from "vitest";
import {PdfRenderQueue} from "@/lib/studio/render-queue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return {promise, resolve};
}

const flush = async () => {
  for (let index = 0; index < 10; index++) await Promise.resolve();
};

describe("PDF render queue", () => {
  it("limits concurrent raster work", async () => {
    const queue = new PdfRenderQueue(2);
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];
    const jobs = gates.map((gate, index) => queue.run(async () => {
      started.push(index);
      await gate.promise;
    }, {}, new AbortController().signal));
    await flush();
    expect(started).toEqual([0, 1]);
    gates[0].resolve();
    await flush();
    expect(started).toEqual([0, 1, 2]);
    gates[1].resolve();
    gates[2].resolve();
    await Promise.all(jobs);
  });

  it("never renders twice into the same canvas concurrently", async () => {
    const queue = new PdfRenderQueue(2);
    const canvas = {};
    const gate = deferred();
    const next = vi.fn(async () => {});
    const first = queue.run(() => gate.promise, canvas, new AbortController().signal);
    const second = queue.run(next, canvas, new AbortController().signal);
    await flush();
    expect(next).not.toHaveBeenCalled();
    gate.resolve();
    await first;
    await second;
    expect(next).toHaveBeenCalledOnce();
  });

  it("prioritizes document pages over queued thumbnails", async () => {
    const queue = new PdfRenderQueue(1);
    const gate = deferred();
    const order: string[] = [];
    const first = queue.run(() => gate.promise, {}, new AbortController().signal);
    const thumbnail = queue.run(async () => { order.push("thumbnail"); }, {}, new AbortController().signal, 1);
    const page = queue.run(async () => { order.push("page"); }, {}, new AbortController().signal);
    gate.resolve();
    await first;
    await page;
    await thumbnail;
    expect(order).toEqual(["page", "thumbnail"]);
  });

  it("removes cancelled pending work without starting it", async () => {
    const queue = new PdfRenderQueue(1);
    const gate = deferred();
    const controller = new AbortController();
    const task = vi.fn(async () => {});
    const first = queue.run(() => gate.promise, {}, new AbortController().signal);
    const cancelled = queue.run(task, {}, controller.signal).catch((error) => error);
    controller.abort();
    expect((await cancelled).name).toBe("AbortError");
    gate.resolve();
    await first;
    await flush();
    expect(task).not.toHaveBeenCalled();
  });

  it("releases slots after failures and rejects already aborted work", async () => {
    const queue = new PdfRenderQueue(1);
    const failed = queue.run(async () => { throw new Error("render failed"); }, {}, new AbortController().signal);
    const next = vi.fn(async () => {});
    const second = queue.run(next, {}, new AbortController().signal);
    await expect(failed).rejects.toThrow("render failed");
    await second;
    expect(next).toHaveBeenCalledOnce();
    const controller = new AbortController();
    controller.abort();
    await expect(queue.run(next, {}, controller.signal)).rejects.toHaveProperty("name", "AbortError");
    expect(next).toHaveBeenCalledOnce();
  });
});
