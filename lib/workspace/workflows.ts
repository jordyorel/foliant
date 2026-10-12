import {mkdir, readFile, readdir, rename, writeFile, link, unlink} from "node:fs/promises";
import path from "node:path";
import {storageRoot} from "@/lib/storage/root";
import {workflowToolChoices} from "@/lib/studio/workflow-tools";
import type {WorkflowRule, WorkflowRun} from "@/lib/studio/workflow-types";
import {approvalEmail, ApprovalError, createApproval, findApproval} from "./approvals";
import {findWorkspaceDocument, listWorkspaceDocumentVersions} from "./documents";

const safeId = /^[a-zA-Z0-9_-]{1,160}$/;
const root = path.join(storageRoot, "workspace", "workflows");
const remote = () => process.env.WORKSPACE_STORAGE_DRIVER === "supabase";
const creationLocks = new Map<string, Promise<void>>();
const supportedTools = new Set<string>(workflowToolChoices.map(item => item.tool));
export class WorkflowError extends Error {
  constructor(public code: "invalid_request" | "not_found" | "limit_reached" | "recipient_unavailable", public status: number) {super(code);}
}
class WorkflowSchemaError extends Error {}
function validateId(id: string) {if (!safeId.test(id)) throw new WorkflowError("invalid_request", 400);}
async function request(endpoint: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Workflow storage is not configured");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${endpoint}`, {
    ...init, headers: {apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers}, cache: "no-store", signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as {code?:string} | null;
    if (failure?.code === "42703" || failure?.code === "PGRST204") throw new WorkflowSchemaError("Workflow migration required");
    throw new Error("Workflow storage unavailable");
  }
  return response;
}
type RuleRow = {id: string; user_id: string; name: string; enabled: boolean; tool: WorkflowRule["tool"]; max_bytes: number | null; recipient_email: string; created_at: string; updated_at?: string | null; archived_at?: string | null};
type RunRow = {id: string; user_id: string; workflow_id: string; workflow_name: string; document_id: string; document_name: string; version_id: string; status: WorkflowRun["status"]; reason: WorkflowRun["reason"]; approval_id: string | null; created_at: string; finished_at: string | null; durable?: boolean};
const ruleFromRow = (row: RuleRow): WorkflowRule => ({id: row.id, name: row.name, enabled: row.enabled, tool: row.tool, maxBytes: row.max_bytes, recipientEmail: row.recipient_email, createdAt: row.created_at, updatedAt: row.updated_at ?? null, archivedAt: row.archived_at ?? null, managementAvailable: Object.hasOwn(row,"archived_at") && Object.hasOwn(row,"updated_at")});
const runFromRow = (row: RunRow): WorkflowRun => ({id: row.id, workflowId: row.workflow_id, workflowName: row.workflow_name, documentId: row.document_id, documentName: row.document_name, versionId: row.version_id, status: row.status, reason: row.reason, approvalId: row.approval_id, createdAt: row.created_at, finishedAt: row.finished_at, durable: row.durable ?? false});
async function localRecords<T>(userId: string, kind: "rules" | "runs"): Promise<T[]> {
  const directory = path.join(root, userId, kind);
  const names = await readdir(directory).catch((error: NodeJS.ErrnoException) => {if (error.code === "ENOENT") return []; throw error;});
  return Promise.all(names.filter(name => /^[a-zA-Z0-9_-]+\.json$/.test(name)).map(async name => JSON.parse(await readFile(path.join(directory, name), "utf8")) as T));
}
async function writeLocal(userId: string, kind: "rules" | "runs", id: string, value: unknown, exclusive = false) {
  const directory = path.join(root, userId, kind);
  await mkdir(directory, {recursive: true, mode: 0o700});
  const target = path.join(directory, `${id}.json`);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), {mode: 0o600});
  try {
    if (exclusive) await link(temporary, target);
    else await rename(temporary, target);
    return true;
  } catch (error) {if (exclusive && (error as NodeJS.ErrnoException).code === "EEXIST") return false; throw error;}
  finally {await unlink(temporary).catch((error: NodeJS.ErrnoException) => {if (error.code !== "ENOENT") throw error;});}
}
export async function listWorkflows(userId: string, includeArchived = false): Promise<WorkflowRule[]> {
  validateId(userId);
  if (remote()) {
    try {return (await (await request(`workspace_workflows?user_id=eq.${encodeURIComponent(userId)}&${includeArchived ? "order=archived_at.asc.nullsfirst,created_at.desc&limit=100" : "archived_at=is.null&order=created_at.desc&limit=5"}`)).json() as RuleRow[]).map(ruleFromRow);}
    catch (error) {
      if (!(error instanceof WorkflowSchemaError)) throw error;
      // Older deployments keep their existing rules usable until the additive migration.
      return (await (await request(`workspace_workflows?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=5`)).json() as RuleRow[]).map(ruleFromRow);
    }
  }
  return (await localRecords<WorkflowRule>(userId, "rules")).filter(rule => includeArchived || !rule.archivedAt).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function findWorkflow(userId: string, id: string): Promise<WorkflowRule> {
  validateId(userId); validateId(id);
  const rule = remote()
    ? (await (await request(`workspace_workflows?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`)).json() as RuleRow[]).map(ruleFromRow)[0]
    : (await localRecords<WorkflowRule>(userId,"rules")).find(item => item.id === id);
  if (!rule) throw new WorkflowError("not_found",404);
  return rule;
}
export async function listWorkflowRuns(userId: string): Promise<WorkflowRun[]> {
  validateId(userId);
  if (remote()) return (await (await request(`workspace_workflow_runs?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=100`)).json() as RunRow[]).map(runFromRow);
  return (await localRecords<WorkflowRun>(userId, "runs")).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,100);
}
async function ruleFields(userId: string, email: string, body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80 || body.consent !== true || (body.tool !== null && (typeof body.tool !== "string" || !supportedTools.has(body.tool))) || (body.maxBytes !== null && (typeof body.maxBytes !== "number" || !Number.isInteger(body.maxBytes) || body.maxBytes < 1 || body.maxBytes > 1000000000))) throw new WorkflowError("invalid_request", 400);
  const recipientEmail = approvalEmail(body.recipientEmail);
  if (recipientEmail === email.toLowerCase()) throw new WorkflowError("recipient_unavailable", 400);
  const recipient = await (await request("rpc/resolve_workspace_approver", {method: "POST", body: JSON.stringify({p_email: recipientEmail})})).json() as string | null;
  if (!recipient || !safeId.test(recipient) || recipient === userId) throw new WorkflowError("recipient_unavailable", 400);
  return {name:body.name.trim(),tool:body.tool as WorkflowRule["tool"],maxBytes:body.maxBytes as number|null,recipientEmail};
}
async function withLocalLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
  const previous = creationLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const lock = new Promise<void>(resolve => {release = resolve;});
  const queued = previous.then(() => lock);
  creationLocks.set(userId, queued);
  await previous;
  try {return await action();}
  finally {release(); if (creationLocks.get(userId) === queued) creationLocks.delete(userId);}
}
export async function createWorkflow(userId: string, email: string, body: Record<string, unknown>) {
  validateId(userId);
  const rule: WorkflowRule = {id: crypto.randomUUID(), ...await ruleFields(userId,email,body), enabled: true, createdAt: new Date().toISOString()};
  if (remote()) {
    const response = await request("rpc/create_workspace_workflow", {method: "POST", body: JSON.stringify({p_user_id: userId, p_id: rule.id, p_name: rule.name, p_tool: rule.tool, p_max_bytes: rule.maxBytes, p_recipient_email: rule.recipientEmail})});
    const rows = await response.json() as RuleRow[];
    if (!rows[0]) throw new WorkflowError("limit_reached", 409);
    return ruleFromRow(rows[0]);
  }
  // Local storage is single-process; serialize creation without persistent stale locks.
  await withLocalLock(userId,async () => {
    if ((await listWorkflows(userId)).length >= 5) throw new WorkflowError("limit_reached", 409);
    await writeLocal(userId, "rules", rule.id, rule);
  });
  return rule;
}
export async function setWorkflowEnabled(userId: string, id: string, enabled: boolean) {
  validateId(userId); validateId(id);
  if (remote()) {
    const endpoint = `workspace_workflows?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;
    const init = {method: "PATCH", headers: {Prefer: "return=representation"}, body: JSON.stringify({enabled})};
    let response:Response;
    try {response = await request(`${endpoint}&archived_at=is.null`,init);}
    catch (error) {if (!(error instanceof WorkflowSchemaError)) throw error;response = await request(endpoint,init);}
    const rows = await response.json() as RuleRow[];
    if (!rows[0]) throw new WorkflowError("not_found",404);
    return ruleFromRow(rows[0]);
  }
  return withLocalLock(userId,async () => {
    const rule = await findWorkflow(userId,id);
    if (rule.archivedAt) throw new WorkflowError("not_found",404);
    const updated = {...rule, enabled};
    await writeLocal(userId,"rules",id,updated);
    return updated;
  });
}
export async function updateWorkflow(userId: string, email: string, id: string, body: Record<string,unknown>) {
  validateId(userId); validateId(id);
  if (typeof body.enabled !== "boolean") throw new WorkflowError("invalid_request",400);
  const original = await findWorkflow(userId,id);
  if (original.managementAvailable === false) throw new Error("Workflow migration required");
  if (original.archivedAt) throw new WorkflowError("not_found",404);
  const fields = await ruleFields(userId,email,body);
  const updatedAt = new Date().toISOString();
  if (remote()) {
    const rows = await (await request(`workspace_workflows?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&archived_at=is.null`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({name:fields.name,tool:fields.tool,max_bytes:fields.maxBytes,recipient_email:fields.recipientEmail,enabled:body.enabled,updated_at:updatedAt})})).json() as RuleRow[];
    if (!rows[0]) throw new WorkflowError("not_found",404);
    return ruleFromRow(rows[0]);
  }
  return withLocalLock(userId,async () => {
    const rule = await findWorkflow(userId,id);
    if (rule.archivedAt) throw new WorkflowError("not_found",404);
    const updated = {...rule,...fields,enabled:body.enabled as boolean,updatedAt};
    await writeLocal(userId,"rules",id,updated);
    return updated;
  });
}
export async function archiveWorkflow(userId: string, id: string) {
  validateId(userId); validateId(id);
  if (remote()) {
    const rows = await (await request(`workspace_workflows?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&archived_at=is.null`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({enabled:false,archived_at:new Date().toISOString()})})).json() as RuleRow[];
    return rows[0] ? ruleFromRow(rows[0]) : findWorkflow(userId,id);
  }
  return withLocalLock(userId,async () => {
    const rule = await findWorkflow(userId,id);
    const updated = {...rule,enabled:false,archivedAt:rule.archivedAt ?? new Date().toISOString()};
    await writeLocal(userId,"rules",id,updated);
    return updated;
  });
}
async function claim(userId: string, run: WorkflowRun) {
  if (!remote()) return writeLocal(userId, "runs", `${run.workflowId}_${run.documentId}`, run, true);
  const row: RunRow = {id: run.id, user_id: userId, workflow_id: run.workflowId, workflow_name: run.workflowName, document_id: run.documentId, document_name: run.documentName, version_id: run.versionId, status: run.status, reason: run.reason, approval_id: run.approvalId, created_at: run.createdAt, finished_at: run.finishedAt};
  const rows = await (await request("workspace_workflow_runs?on_conflict=workflow_id,document_id", {method: "POST", headers: {Prefer: "resolution=ignore-duplicates,return=representation"}, body: JSON.stringify(row)})).json() as RunRow[];
  return rows.length === 1;
}
async function finish(userId: string, run: WorkflowRun) {
  if (!remote()) {await writeLocal(userId,"runs",`${run.workflowId}_${run.documentId}`,run); return;}
  await request(`workspace_workflow_runs?id=eq.${run.id}&user_id=eq.${encodeURIComponent(userId)}&status=eq.running`, {method:"PATCH", body:JSON.stringify({status:run.status,reason:run.reason,approval_id:run.approvalId,finished_at:run.finishedAt})});
}

// Runs are claimed before sharing. An interrupted run is never blindly retried.
export async function runDocumentWorkflows(userId: string, email: string, documentId: string) {
  validateId(userId); validateId(documentId);
  const rules = (await listWorkflows(userId)).filter(rule => rule.enabled && !rule.archivedAt);
  if (!rules.length) return;
  const document = await findWorkspaceDocument(documentId,userId);
  const version = (await listWorkspaceDocumentVersions(documentId,userId)).find(item => item.versionNumber === 1 && !item.id.startsWith("legacy_"));
  if (!document || !version) throw new WorkflowError("not_found",404);
  for (const rule of rules) {
    if (Date.parse(rule.updatedAt ?? rule.createdAt) > Date.parse(document.createdAt)) continue;
    const run: WorkflowRun = {id:crypto.randomUUID(),workflowId:rule.id,workflowName:rule.name,documentId,documentName:document.name,versionId:version.id,status:"running",reason:null,approvalId:null,createdAt:new Date().toISOString(),finishedAt:null};
    if (!await claim(userId,run)) continue;
    if (version.resultMimeType !== "application/pdf" || (rule.tool && rule.tool !== version.kindTool) || (rule.maxBytes !== null && version.resultSize > rule.maxBytes)) {
      run.status = "skipped"; run.reason = "conditions_not_met";
    } else {
      try {
        const approval = await createApproval({userId,email,documentId,versionId:version.id,recipientEmail:rule.recipientEmail,note:rule.name});
        run.status = "succeeded"; run.reason = "approval_requested"; run.approvalId = approval.id;
      } catch (error) {
        run.status = "failed";
        run.reason = error instanceof ApprovalError && (error.code === "recipient_unavailable" || error.code === "conflict") ? error.code : "unavailable";
      }
    }
    run.finishedAt = new Date().toISOString();
    await finish(userId,run);
  }
}

type QueuedRun = WorkflowRun & {durable: true; ownerEmail: string; ruleRevision: string};

export async function enqueueDocumentWorkflows(userId: string, email: string, documentId: string) {
  validateId(userId); validateId(documentId);
  if (remote()) {
    await request("rpc/enqueue_workspace_workflows", {method:"POST",body:JSON.stringify({p_user_id:userId,p_document_id:documentId})});
    return;
  }
  await withLocalLock(userId,async () => {
    const rules = (await listWorkflows(userId)).filter(rule => rule.enabled && !rule.archivedAt);
    if (!rules.length) return;
    const document = await findWorkspaceDocument(documentId,userId);
    const version = (await listWorkspaceDocumentVersions(documentId,userId)).find(item => item.versionNumber === 1 && !item.id.startsWith("legacy_"));
    if (!document || !version) throw new WorkflowError("not_found",404);
    for (const rule of rules) {
      const revision = rule.updatedAt ?? rule.createdAt;
      if (Date.parse(revision) > Date.parse(document.createdAt)) continue;
      const run: QueuedRun = {id:crypto.randomUUID(),workflowId:rule.id,workflowName:rule.name,documentId,documentName:document.name,versionId:version.id,status:"running",reason:null,approvalId:null,createdAt:new Date().toISOString(),finishedAt:null,durable:true,ownerEmail:email,ruleRevision:revision};
      await writeLocal(userId,"runs",`${rule.id}_${documentId}`,run,true);
    }
  });
}

// Supabase commits sharing and its journal together. Old inline runs are never replayed.
export async function processQueuedWorkflows(userId?: string, limit = 5): Promise<number> {
  if (userId) validateId(userId);
  const boundedLimit = Math.min(10,Math.max(1,Number.isFinite(limit) ? Math.floor(limit) : 5));
  if (remote()) {
    return await (await request("rpc/process_workspace_workflows",{method:"POST",body:JSON.stringify({p_user_id:userId ?? null,p_limit:boundedLimit})})).json() as number;
  }
  const users = userId ? [userId] : (await readdir(root).catch((error:NodeJS.ErrnoException) => {if (error.code === "ENOENT") return []; throw error;})).filter(id => safeId.test(id));
  let processed = 0;
  for (const ownerId of users) {
    await withLocalLock(ownerId,async () => {
      const runs = (await localRecords<QueuedRun>(ownerId,"runs")).filter(run => run.durable && run.status === "running").sort((a,b) => a.createdAt.localeCompare(b.createdAt));
      for (const run of runs.slice(0,boundedLimit-processed)) {
        // A crash after writing the approval is resolved by its stable run id, even after a decision.
        const previous = await findApproval(run.id,ownerId);
        if (previous && previous.ownerId === ownerId && previous.documentId === run.documentId && previous.versionId === run.versionId) {
          run.status = "succeeded"; run.reason = "approval_requested"; run.approvalId = previous.id;
        } else {
          const rule = await findWorkflow(ownerId,run.workflowId);
          const document = await findWorkspaceDocument(run.documentId,ownerId);
          const version = (await listWorkspaceDocumentVersions(run.documentId,ownerId)).find(item => item.id === run.versionId && item.versionNumber === 1);
          if (!rule.enabled || rule.archivedAt || (rule.updatedAt ?? rule.createdAt) !== run.ruleRevision || !document || !version || version.resultMimeType !== "application/pdf" || (rule.tool && rule.tool !== version.kindTool) || (rule.maxBytes !== null && version.resultSize > rule.maxBytes)) {
            run.status = "skipped"; run.reason = "conditions_not_met";
          } else {
            try {
              const approval = await createApproval({userId:ownerId,email:run.ownerEmail,documentId:run.documentId,versionId:run.versionId,recipientEmail:rule.recipientEmail,note:run.workflowName,requestId:run.id});
              run.status = "succeeded"; run.reason = "approval_requested"; run.approvalId = approval.id;
            } catch (error) {
              // Provider outages leave the durable entry pending for a later worker.
              if (!(error instanceof ApprovalError)) throw error;
              run.status = "failed"; run.reason = error.code === "recipient_unavailable" || error.code === "conflict" ? error.code : "unavailable";
            }
          }
        }
        run.finishedAt = new Date().toISOString();
        await finish(ownerId,run);
        processed++;
      }
    });
    if (processed >= boundedLimit) break;
  }
  return processed;
}
