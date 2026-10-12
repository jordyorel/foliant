import {mkdir, readFile, readdir, rename, writeFile} from "node:fs/promises";
import path from "node:path";
import {storageRoot} from "@/lib/storage/root";
import {activityActions, type ActivityEvent} from "@/lib/studio/activity-types";
import {logOperationalEvent} from "@/lib/operations/log";

const safeId = /^[a-zA-Z0-9_-]{1,160}$/;
const root = path.join(storageRoot, "workspace", "activity");
const state = globalThis as typeof globalThis & {foliantActivitySequence?: number};
type Row = {id: string; user_id: string; document_id: string; job_id: string | null; action: ActivityEvent["action"]; tool: ActivityEvent["tool"] | null; version_number: number | null; created_at: string};

async function request(query: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Activity storage is not configured");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/workspace_activity${query}`, {
    ...init, headers: {apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers}, cache: "no-store", signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) throw new Error("Activity storage unavailable");
  return response;
}

function fromRow(row: Row): ActivityEvent {
  return {id: row.id, documentId: row.document_id, jobId: row.job_id ?? undefined, action: row.action, tool: row.tool ?? undefined, versionNumber: row.version_number ?? undefined, createdAt: row.created_at};
}

type ActivityInput = Omit<ActivityEvent, "id" | "documentId" | "createdAt" | "documentName" | "sequence"> & {createdAt?: string};

export async function appendWorkspaceActivities(userId: string, documentId: string, inputs: ActivityInput[]) {
  if (!safeId.test(userId) || !safeId.test(documentId) || inputs.length > 101 || inputs.some(input => !activityActions.includes(input.action))) throw new Error("Invalid activity event");
  const events: ActivityEvent[] = inputs.map(input => ({id: crypto.randomUUID(), documentId, action: input.action, jobId: input.jobId, tool: input.tool, versionNumber: input.versionNumber, createdAt: input.createdAt ?? new Date().toISOString(), sequence: state.foliantActivitySequence = Math.max(Date.now() * 1000, (state.foliantActivitySequence ?? 0) + 1)}));
  if (events.length === 0) return [];
  if (process.env.WORKSPACE_STORAGE_DRIVER === "supabase") {
    const rows: Row[] = events.map(event => ({id: event.id, user_id: userId, document_id: documentId, job_id: event.jobId ?? null, action: event.action, tool: event.tool ?? null, version_number: event.versionNumber ?? null, created_at: event.createdAt}));
    await request("", {method: "POST", body: JSON.stringify(rows), headers: {Prefer: "return=minimal"}});
  } else {
    const directory = path.join(root, userId);
    await mkdir(directory, {recursive: true, mode: 0o700});
    for (const event of events) {
      const target = path.join(directory, `${event.id}.json`);
      const temporary = `${target}.tmp`;
      await writeFile(temporary, JSON.stringify(event), {mode: 0o600});
      await rename(temporary, target);
    }
  }
  return events;
}

export async function appendWorkspaceActivity(userId: string, documentId: string, input: ActivityInput) {
  return (await appendWorkspaceActivities(userId, documentId, [input]))[0];
}

// An unavailable activity store must not turn a successful file operation into a retry.
// It is reported operationally; reads return an error rather than a false empty history.
export async function recordWorkspaceActivity(userId: string, documentId: string, input: Parameters<typeof appendWorkspaceActivity>[2]) {
  try { await appendWorkspaceActivity(userId, documentId, input); }
  catch { logOperationalEvent("activity_failed"); }
}

export async function recordWorkspaceActivities(userId: string, documentId: string, inputs: ActivityInput[]) {
  try { await appendWorkspaceActivities(userId, documentId, inputs); }
  catch { logOperationalEvent("activity_failed"); }
}

export async function listWorkspaceActivity(userId: string | undefined, documentId?: string, limit = 40): Promise<ActivityEvent[]> {
  if (!userId || !safeId.test(userId) || (documentId !== undefined && !safeId.test(documentId))) return [];
  const boundedLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 40));
  if (process.env.WORKSPACE_STORAGE_DRIVER === "supabase") {
    const response = await request(`?user_id=eq.${encodeURIComponent(userId)}${documentId ? `&document_id=eq.${encodeURIComponent(documentId)}` : ""}&select=*&order=created_at.desc,sequence.desc&limit=${boundedLimit}`);
    return (await response.json() as Row[]).map(fromRow);
  }
  const directory = path.join(root, userId);
  const entries = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const events: ActivityEvent[] = [];
  for (const entry of entries) {
    if (!/^[a-f0-9-]+\.json$/.test(entry)) continue;
    const event = JSON.parse(await readFile(path.join(directory, entry), "utf8")) as ActivityEvent;
    if (!activityActions.includes(event.action) || !Number.isFinite(Date.parse(event.createdAt))) throw new Error("Invalid activity record");
    if (!documentId || event.documentId === documentId) events.push(event);
  }
  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (b.sequence ?? 0) - (a.sequence ?? 0)).slice(0, boundedLimit);
}
