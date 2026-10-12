import {mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync} from "node:fs";
import path from "node:path";
import type {JobRecord} from "./index";
import {ErrorCode} from "@/lib/validation/errors";

export type JobStore = {
  jobs: Map<string, JobRecord>;
  closedGuestChains: Set<string>;
  guestClients: Map<string, Set<string>>;
};

type Snapshot = {
  version: 1;
  jobs: JobRecord[];
  closedGuestChains: string[];
  guestClients: [string, string[]][];
};

export function loadJobStore(root: string, ttl: number, now = Date.now()): JobStore {
  let data: Snapshot;
  try {
    data = JSON.parse(readFileSync(path.join(root, "jobs", "state.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {jobs: new Map(), closedGuestChains: new Set(), guestClients: new Map()};
    }
    // A corrupt snapshot must not silently resurrect a revoked Guest session.
    throw new Error("Unable to restore temporary job state", {cause: error});
  }
  if (data?.version !== 1 || !Array.isArray(data.jobs) ||
    !Array.isArray(data.closedGuestChains) || !Array.isArray(data.guestClients) ||
    data.closedGuestChains.some(id => typeof id !== "string") ||
    data.guestClients.some(entry => !Array.isArray(entry) || typeof entry[0] !== "string" ||
      !Array.isArray(entry[1]) || entry[1].some(id => typeof id !== "string"))) {
    throw new Error("Invalid temporary job state");
  }
  const jobs = new Map<string, JobRecord>();
  for (const job of data.jobs) {
    if (!job || typeof job.id !== "string" || !Number.isFinite(job.createdAt) ||
      !Array.isArray(job.fileIds) || !job.options || typeof job.options !== "object" ||
      !["queued", "processing", "completed", "failed"].includes(job.status)) {
      throw new Error("Invalid temporary job record");
    }
    if (job.createdAt + ttl <= now) continue;
    const {pdfPassword: _password, ...options} = job.options;
    const interrupted = job.status === "queued" || job.status === "processing";
    jobs.set(job.id, interrupted ? {
      ...job, options, status: "failed", progress: 100,
      step: "Traitement interrompu", errorCode: ErrorCode.processingFailed,
      error: "Processing was interrupted by a server restart. Please try again.",
      resultUrl: undefined, completedAt: now,
      activity: [...(job.activity ?? []), {id: `${job.id}_interrupted`, jobId: job.id, tool: job.tool, action: "processing_failed", createdAt: new Date(now).toISOString()}]
    } : {...job, options});
  }
  const chains = new Set([...jobs.values()].map(job => job.guestChainId ?? job.id));
  return {
    jobs,
    closedGuestChains: new Set(data.closedGuestChains.filter(id => chains.has(id))),
    guestClients: new Map(data.guestClients.filter(([id]) => chains.has(id)).map(([id, clients]) => [id, new Set(clients)]))
  };
}

export function persistJobStore(root: string, state: JobStore) {
  const dir = path.join(root, "jobs");
  mkdirSync(dir, {recursive: true, mode: 0o700});
  const snapshot: Snapshot = {
    version: 1,
    jobs: [...state.jobs.values()].map(job => {
      const {pdfPassword: _password, ...options} = job.options;
      return {...job, options};
    }),
    closedGuestChains: [...state.closedGuestChains],
    guestClients: [...state.guestClients].map(([id, clients]) => [id, [...clients]])
  };
  const temporary = path.join(dir, `${crypto.randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, JSON.stringify(snapshot), {encoding: "utf8", mode: 0o600});
    renameSync(temporary, path.join(dir, "state.json"));
  } finally {
    try { unlinkSync(temporary); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
