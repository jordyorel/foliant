import {mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, statSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {loadJobStore, persistJobStore, type JobStore} from "@/lib/jobs/persistence";
import type {JobRecord} from "@/lib/jobs";

const now = Date.now();
const ttl = 6 * 60 * 60 * 1000;
function job(status: JobRecord["status"] = "completed"): JobRecord {
  return {id: "job_test", guestSessionId: "owner", guestChainId: "chain",
    tool: "rotate_pdf", fileIds: ["file_test"], options: {rotateDegrees: 90},
    status, progress: 100, step: "Ready", createdAt: now,
    resultUrl: "/api/jobs/job_test/download"};
}
function state(record = job()): JobStore {
  return {jobs: new Map([[record.id, record]]), closedGuestChains: new Set(),
    guestClients: new Map([["chain", new Set(["tab-a", "tab-b"])]])};
}

describe("single-writer job persistence", () => {
  let root: string;
  beforeEach(() => {root = mkdtempSync(path.join(os.tmpdir(), "foliant-jobs-"));});
  afterEach(() => {rmSync(root, {recursive: true, force: true});});

  it("starts empty only when no snapshot exists", () => {
    expect(loadJobStore(root, ttl).jobs.size).toBe(0);
  });

  it("restores completed jobs, ownership and active tabs from disk", () => {
    persistJobStore(root, state());
    const restored = loadJobStore(root, ttl, now);
    expect(restored.jobs.get("job_test")).toEqual(job());
    expect([...restored.guestClients.get("chain")!]).toEqual(["tab-a", "tab-b"]);
    expect(statSync(path.join(root, "jobs/state.json")).mode & 0o777).toBe(0o600);
  });

  it("retains revocation through a reload", () => {
    const original = state();
    original.closedGuestChains.add("chain");
    original.guestClients.delete("chain");
    persistJobStore(root, original);
    const restored = loadJobStore(root, ttl, now);
    expect(restored.closedGuestChains.has("chain")).toBe(true);
    expect(restored.guestClients.has("chain")).toBe(false);
  });

  it.each(["queued", "processing"] as const)("marks interrupted %s jobs failed without retrying", status => {
    persistJobStore(root, state(job(status)));
    expect(loadJobStore(root, ttl, now).jobs.get("job_test")).toMatchObject({
      status: "failed", errorCode: "processing_failed", progress: 100, resultUrl: undefined
    });
  });

  it("does not persist PDF passwords or mutate the live processor options", () => {
    const record = {...job("processing"), options: {pdfPassword: "private-test-password"}};
    persistJobStore(root, state(record));
    expect(readFileSync(path.join(root, "jobs/state.json"), "utf8")).not.toContain("private-test-password");
    expect(record.options.pdfPassword).toBe("private-test-password");
    expect(loadJobStore(root, ttl, now).jobs.get(record.id)?.options).not.toHaveProperty("pdfPassword");
  });

  it("does not restore expired jobs or their tab/revocation state", () => {
    const original = state();
    original.closedGuestChains.add("chain");
    persistJobStore(root, original);
    const restored = loadJobStore(root, ttl, now + ttl);
    expect(restored.jobs.size).toBe(0);
    expect(restored.closedGuestChains.size).toBe(0);
    expect(restored.guestClients.size).toBe(0);
  });

  it.each(["{broken", '{"version":2}', '{"version":1,"jobs":[{}],"closedGuestChains":[],"guestClients":[]}'])("fails closed on corrupt or unsupported state", content => {
    mkdirSync(path.join(root, "jobs"));
    writeFileSync(path.join(root, "jobs/state.json"), content);
    expect(() => loadJobStore(root, ttl, now)).toThrow();
  });

  it("replaces previous snapshots with the latest state", () => {
    persistJobStore(root, state(job("queued")));
    persistJobStore(root, state(job("completed")));
    expect(loadJobStore(root, ttl, now).jobs.get("job_test")?.status).toBe("completed");
  });
});
