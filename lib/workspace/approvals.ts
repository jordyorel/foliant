import {mkdir, readFile, readdir, rename, writeFile} from "node:fs/promises";
import path from "node:path";
import {storageRoot} from "@/lib/storage/root";
import {findWorkspaceDocument, getWorkspaceDocumentVersion, readWorkspaceDocumentVersionFile} from "./documents";
import {recordWorkspaceActivity} from "./activity";
import {approvalStatuses, type ApprovalDecision, type ApprovalRecord} from "@/lib/studio/approval-types";

const safeId = /^[a-zA-Z0-9_-]{1,160}$/;
const root = path.join(storageRoot, "workspace", "approvals");
const state = globalThis as typeof globalThis & {foliantApprovalLocks?: Map<string, Promise<unknown>>};
const locks = state.foliantApprovalLocks ??= new Map();

export class ApprovalError extends Error {
  constructor(public code: "not_found" | "recipient_unavailable" | "invalid_request" | "conflict", public status: number) {super(code);}
}

function validateId(value: string) {
  if (!safeId.test(value)) throw new ApprovalError("invalid_request", 400);
}

export function approvalText(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 2000) throw new ApprovalError("invalid_request", 400);
  return value.trim();
}

export function approvalEmail(value: unknown): string {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new ApprovalError("invalid_request", 400);
  return value.trim().toLowerCase();
}

async function request(endpoint: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Approval storage is not configured");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${endpoint}`, {
    ...init, headers: {apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers},
    cache: "no-store", signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    if (response.status === 409) throw new ApprovalError("conflict", 409);
    // Only allowlisted domain errors from the RPC reach the client.
    if (response.status === 400) {
      const error = await response.json().catch(() => null) as {message?: string} | null;
      if (error?.message === "recipient_unavailable") throw new ApprovalError("recipient_unavailable", 400);
      if (error?.message === "not_found") throw new ApprovalError("not_found", 404);
    }
    throw new Error("Approval storage unavailable");
  }
  return response;
}

type Row = {id: string; owner_id: string; reviewer_id: string; owner_email: string; reviewer_email: string; document_id: string; document_name: string; version_id: string; version_number: number; status: ApprovalRecord["status"]; note: string; comment: string; created_at: string; decided_at: string | null};
function fromRow(row: Row): ApprovalRecord {
  return {id: row.id, ownerId: row.owner_id, reviewerId: row.reviewer_id, ownerEmail: row.owner_email, reviewerEmail: row.reviewer_email, documentId: row.document_id, documentName: row.document_name, versionId: row.version_id, versionNumber: row.version_number, status: row.status, note: row.note, comment: row.comment, createdAt: row.created_at, decidedAt: row.decided_at};
}

async function locked<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  locks.set(key, current);
  try {return await current;}
  finally {if (locks.get(key) === current) locks.delete(key);}
}

async function readLocal(id: string): Promise<ApprovalRecord | null> {
  let value: ApprovalRecord;
  try {value = JSON.parse(await readFile(path.join(root, `${id}.json`), "utf8"));}
  catch (error) {if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error;}
  if (value.id !== id || !safeId.test(value.ownerId) || !safeId.test(value.reviewerId) || !approvalStatuses.includes(value.status)) throw new Error("Invalid approval record");
  return value;
}

async function writeLocal(record: ApprovalRecord) {
  await mkdir(root, {recursive: true, mode: 0o700});
  const target = path.join(root, `${record.id}.json`);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(record), {mode: 0o600});
  await rename(temporary, target);
}

export async function listApprovals(userId: string, documentId?: string): Promise<ApprovalRecord[]> {
  validateId(userId);
  if (documentId) validateId(documentId);
  if (process.env.WORKSPACE_STORAGE_DRIVER === "supabase") {
    const response = await request(`workspace_approvals?or=(owner_id.eq.${encodeURIComponent(userId)},reviewer_id.eq.${encodeURIComponent(userId)})${documentId ? `&document_id=eq.${encodeURIComponent(documentId)}` : ""}&select=*&order=created_at.desc,id.desc&limit=100`);
    return (await response.json() as Row[]).map(fromRow);
  }
  return (await listLocalApprovals(userId, documentId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, 100);
}

async function listLocalApprovals(userId: string, documentId?: string) {
  const names = await readdir(root).catch((error: NodeJS.ErrnoException) => {if (error.code === "ENOENT") return []; throw error;});
  const records: ApprovalRecord[] = [];
  for (const name of names) {
    if (!/^[a-f0-9-]+\.json$/.test(name)) continue;
    const record = await readLocal(name.slice(0, -5));
    if (record && (record.ownerId === userId || record.reviewerId === userId) && (!documentId || record.documentId === documentId)) records.push(record);
  }
  return records;
}

export async function findApproval(id: string, userId: string): Promise<ApprovalRecord | null> {
  if (!safeId.test(id) || !safeId.test(userId)) return null;
  if (process.env.WORKSPACE_STORAGE_DRIVER === "supabase") {
    const response = await request(`workspace_approvals?id=eq.${encodeURIComponent(id)}&or=(owner_id.eq.${encodeURIComponent(userId)},reviewer_id.eq.${encodeURIComponent(userId)})&select=*&limit=1`);
    const rows = await response.json() as Row[];
    return rows[0] ? fromRow(rows[0]) : null;
  }
  const record = await readLocal(id);
  return record && (record.ownerId === userId || record.reviewerId === userId) ? record : null;
}

export async function createApproval(input: {userId: string; email: string; documentId: string; versionId: string; recipientEmail: unknown; note?: unknown; requestId?: string}) {
  validateId(input.userId); validateId(input.documentId); validateId(input.versionId);
  if (input.requestId && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.requestId)) throw new ApprovalError("invalid_request", 400);
  const recipientEmail = approvalEmail(input.recipientEmail);
  const note = approvalText(input.note);
  if (recipientEmail === input.email.toLowerCase()) throw new ApprovalError("recipient_unavailable", 400);
  const document = await findWorkspaceDocument(input.documentId, input.userId);
  const version = await getWorkspaceDocumentVersion(input.documentId, input.versionId, input.userId);
  if (!document || !version || version.id.startsWith("legacy_")) throw new ApprovalError("not_found", 404);
  if (version.resultMimeType !== "application/pdf") throw new ApprovalError("invalid_request", 400);
  let record: ApprovalRecord;
  let reused = false;
  if (process.env.WORKSPACE_STORAGE_DRIVER === "supabase") {
    const response = await request("rpc/request_workspace_approval", {method: "POST", body: JSON.stringify({p_id: crypto.randomUUID(), p_owner_id: input.userId, p_document_id: document.id, p_version_id: version.id, p_recipient_email: recipientEmail, p_note: note})});
    const rows = await response.json() as Row[];
    if (!rows[0]) throw new ApprovalError("not_found", 404);
    record = fromRow(rows[0]);
  } else {
    // Local document storage still uses verified Supabase accounts, never a client-supplied user id.
    const response = await request("rpc/resolve_workspace_approver", {method: "POST", body: JSON.stringify({p_email: recipientEmail})});
    const reviewerId = await response.json() as string | null;
    if (!reviewerId || !safeId.test(reviewerId) || reviewerId === input.userId) throw new ApprovalError("recipient_unavailable", 400);
    record = await locked(`create:${document.id}`, async () => {
      if (input.requestId) {
        const previous = await findApproval(input.requestId, input.userId);
        if (previous) {
          if (previous.ownerId !== input.userId || previous.documentId !== document.id || previous.versionId !== version.id || previous.reviewerId !== reviewerId) throw new ApprovalError("conflict",409);
          reused = true;
          return previous;
        }
      }
      if ((await listLocalApprovals(input.userId, document.id)).some(item => item.versionId === version.id && item.reviewerId === reviewerId && item.status === "pending")) throw new ApprovalError("conflict", 409);
      const created: ApprovalRecord = {id: input.requestId ?? crypto.randomUUID(), ownerId: input.userId, reviewerId, ownerEmail: input.email, reviewerEmail: recipientEmail, documentId: document.id, documentName: document.name, versionId: version.id, versionNumber: version.versionNumber, status: "pending", note, comment: "", createdAt: new Date().toISOString(), decidedAt: null};
      await writeLocal(created);
      return created;
    });
  }
  if (!reused) await recordWorkspaceActivity(record.ownerId, record.documentId, {action: "approval_requested", versionNumber: record.versionNumber});
  return record;
}

export async function decideApproval(id: string, userId: string, decision: ApprovalDecision, comment: unknown = "") {
  validateId(id); validateId(userId);
  if (!["approved", "rejected", "canceled"].includes(decision)) throw new ApprovalError("invalid_request", 400);
  const text = approvalText(comment);
  const change = async () => {
    const record = await findApproval(id, userId);
    if (!record || (decision === "canceled" ? record.ownerId !== userId : record.reviewerId !== userId)) throw new ApprovalError("not_found", 404);
    if (record.status !== "pending") throw new ApprovalError("conflict", 409);
    if (decision !== "canceled" && !await getWorkspaceDocumentVersion(record.documentId, record.versionId, record.ownerId)) throw new ApprovalError("not_found", 404);
    const decidedAt = new Date().toISOString();
    if (process.env.WORKSPACE_STORAGE_DRIVER === "supabase") {
      // Compare-and-set protects decisions across processes and concurrent requests.
      const response = await request(`workspace_approvals?id=eq.${encodeURIComponent(id)}&status=eq.pending&${decision === "canceled" ? "owner_id" : "reviewer_id"}=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH", headers: {Prefer: "return=representation"}, body: JSON.stringify({status: decision, comment: text, decided_at: decidedAt})
      });
      const rows = await response.json() as Row[];
      if (!rows[0]) throw new ApprovalError("conflict", 409);
      return fromRow(rows[0]);
    }
    const updated: ApprovalRecord = {...record, status: decision, comment: text, decidedAt};
    await writeLocal(updated);
    return updated;
  };
  const record = process.env.WORKSPACE_STORAGE_DRIVER === "supabase" ? await change() : await locked(id, change);
  await recordWorkspaceActivity(record.ownerId, record.documentId, {action: `approval_${decision}`, versionNumber: record.versionNumber});
  return record;
}

export async function readApprovalFile(id: string, userId: string) {
  const record = await findApproval(id, userId);
  if (!record || record.status === "canceled") return null;
  // This is the sole delegated file read. Owner-only document routes stay unchanged.
  return readWorkspaceDocumentVersionFile(record.documentId, record.versionId, record.ownerId);
}
