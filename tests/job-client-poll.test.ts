import {afterEach, describe, expect, it, vi} from "vitest";
import {pollJobUntilSettled} from "@/lib/jobs/client-poll";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("shared browser job polling", () => {
  it("waits for completion and reports actual statuses", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({id: "job_qa", status: "processing"}))
      .mockResolvedValueOnce(Response.json({id: "job_qa", status: "completed"}));
    vi.stubGlobal("fetch", fetch);
    const updated = vi.fn();
    const result = pollJobUntilSettled("job_qa", "Failed", undefined, updated);
    await vi.runAllTimersAsync();
    expect((await result).status).toBe("completed");
    expect(updated.mock.calls.map(([job]) => job.status)).toEqual(["processing", "completed"]);
  });
  it("returns a failed job without polling indefinitely", async () => {
    const fetch = vi.fn(async () => Response.json({id: "job_qa", status: "failed"}));
    vi.stubGlobal("fetch", fetch);
    expect((await pollJobUntilSettled("job_qa", "Failed")).status).toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("stops observation when the window is abandoned, without claiming server cancellation", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => Response.json({id: "job_qa", status: "processing"}));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const result = pollJobUntilSettled("job_qa", "Failed", controller.signal);
    const rejected = expect(result).rejects.toMatchObject({name: "AbortError"});
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await rejected;
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/jobs/job_qa", {cache: "no-store", signal: controller.signal});
  });
  it("does not continue after an expired or inaccessible job", async () => {
    const fetch = vi.fn(async () => new Response(null, {status: 404}));
    vi.stubGlobal("fetch", fetch);
    await expect(pollJobUntilSettled("job_expired", "Expired")).rejects.toThrow("Expired");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
