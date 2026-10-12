import {afterEach, describe, expect, it, vi} from "vitest";
import {fetchStudioDocument} from "@/lib/studio/client";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Studio document loading", () => {
  it("treats a revoked or missing document as unavailable without retrying", async () => {
    const fetch = vi.fn(async () => new Response(null, {status: 404}));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchStudioDocument("job_expired", "fr")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns the current document when it is available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({document: {id: "job_current"}})));
    expect(await fetchStudioDocument("job_current", "fr")).toEqual({id: "job_current"});
  });

  it("does not retry an access denial", async () => {
    const fetch = vi.fn(async () => new Response(null, {status: 403}));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchStudioDocument("private", "fr")).rejects.toThrow("403");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not start an already abandoned request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchStudioDocument("old", "fr", controller.signal)).rejects.toMatchObject({name: "AbortError"});
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries a temporary server failure", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, {status: 503}))
      .mockResolvedValueOnce(Response.json({document: {id: "recovered"}}));
    vi.stubGlobal("fetch", fetch);
    const result = fetchStudioDocument("current", "fr");
    await vi.runAllTimersAsync();
    expect(await result).toEqual({id: "recovered"});
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts the retry delay without sending another request", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response(null, {status: 503}));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const result = fetchStudioDocument("old", "fr", controller.signal);
    const rejection = expect(result).rejects.toMatchObject({name: "AbortError"});
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await rejection;
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
