import {NextResponse} from "next/server";
import {guestSessionId} from "@/lib/studio/guest-session";

export class RequestLimiter {
  private entries = new Map<string, {count: number; expires: number}>();
  consume(key: string, limit: number, now = Date.now()) {
    for (const [id, entry] of this.entries) if (entry.expires <= now) this.entries.delete(id);
    let entry = this.entries.get(key);
    if (!entry) {
      // Fail closed rather than allowing arbitrary cookie IDs to grow memory forever.
      if (this.entries.size >= 10000) return 60;
      entry = {count: 0, expires: now + 60000};
      this.entries.set(key, entry);
    }
    if (entry.count >= limit) return Math.max(1, Math.ceil((entry.expires - now) / 1000));
    entry.count++;
    return 0;
  }
}

const state = globalThis as typeof globalThis & {foliantRequestLimiter?: RequestLimiter};
const limiter = state.foliantRequestLimiter ??= new RequestLimiter();
const limits = {upload: [120, 600], job: [60, 300], auth: [20, 100], approval: [20, 100], workflow: [20, 100], inbox: [20, 100]} as const;

export function limitRequest(request: Request, scope: keyof typeof limits, userId?: string) {
  const [sessionLimit, globalLimit] = limits[scope];
  const retry = limiter.consume(`${scope}:global`, globalLimit) ||
    limiter.consume(`${scope}:${userId ?? guestSessionId(request) ?? "anonymous"}`, sessionLimit);
  return retry ? NextResponse.json({error: "Too many requests. Please try again shortly.", code: "rate_limited"}, {
    status: 429, headers: {"Retry-After": String(retry), "Cache-Control": "no-store"}
  }) : null;
}
