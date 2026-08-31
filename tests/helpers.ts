import {readFileSync} from "node:fs";
import path from "node:path";
import {getJob} from "@/lib/jobs";

const fixturesDir = path.join(process.cwd(), "tests", "fixtures");

export function fixturePath(name: string) {
  return path.join(fixturesDir, name);
}

export function fixtureBytes(name: string) {
  return readFileSync(fixturePath(name));
}

export function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export async function pollJob(jobId: string, timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}
