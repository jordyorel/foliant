import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {promisify} from "node:util";
import {PDFDocument} from "pdf-lib";
import {maxUploadBytes} from "@/content/tools/upload-limits";
import {readLimitedBody} from "@/lib/validation/body";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const inboxMaxBytes = maxUploadBytes("import_pdf");
export type InboxStatus = "received" | "accepted" | "archived";
type Row = {
  id: string; user_id: string; request_id: string; name: string; object_key: string;
  size: number; sha256: string; page_count: number | null; protected_pdf: boolean;
  status: InboxStatus | "uploading"; origin: "manual"; document_id: string | null;
  created_at: string; accepted_at: string | null; archived_at: string | null;
};
export class InboxError extends Error {
  constructor(public code: string, public status: number) {super(code);}
}
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.WORKSPACE_STORAGE_DRIVER !== "supabase" || !url || !key) throw new InboxError("inbox_unavailable",503);
  return {url: url.replace(/\/$/,""),key,bucket:process.env.SUPABASE_WORKSPACE_BUCKET ?? "workspace-documents"};
}
async function request(resource: string, init: RequestInit = {}) {
  const {url,key} = config();
  const headers = new Headers(init.headers);
  headers.set("apikey",key); headers.set("Authorization",`Bearer ${key}`);
  const response = await fetch(`${url}${resource}`,{...init,headers,cache:"no-store",signal:AbortSignal.timeout(15000)});
  if (!response.ok) {
    const body = await response.json().catch(()=>null);
    const code = body?.message;
    if (resource.startsWith("/rest/") && ["not_found","conflict","quota_exceeded","invalid_request"].includes(code)) {
      throw new InboxError(code,code==="not_found"?404:code==="conflict"?409:code==="quota_exceeded"?429:400);
    }
    throw new InboxError("inbox_unavailable",503);
  }
  return response;
}
async function rpc(name:string,body:Record<string,unknown>) {
  const response = await request(`/rest/v1/rpc/${name}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const rows = await response.json() as Row[];
  if (!Array.isArray(rows) || !rows[0]) throw new InboxError("inbox_unavailable",503);
  return rows[0];
}
function ownerId(userId:string) {
  if (!uuid.test(userId)) throw new InboxError("not_found",404);
}
function receiptId(id:string) {
  if (!uuid.test(id)) throw new InboxError("not_found",404);
}
function publicReceipt(row:Row) {
  return {id:row.id,name:row.name,size:row.size,pageCount:row.page_count,isProtected:row.protected_pdf,
    origin:row.origin,status:row.status,documentId:row.document_id,createdAt:row.created_at,
    acceptedAt:row.accepted_at,archivedAt:row.archived_at};
}
export async function validateInboxPdf(bytes:Uint8Array,name:string) {
  if (!bytes.length || bytes.length>inboxMaxBytes) throw new InboxError("file_too_large",413);
  if (!name || name.length>180 || /[\x00-\x1f\x7f/\\]/.test(name) || !/\.pdf$/i.test(name)) throw new InboxError("invalid_file_name",400);
  if (new TextDecoder().decode(bytes.subarray(0,5))!=="%PDF-") throw new InboxError("invalid_pdf",415);
  try {
    const pdf = await PDFDocument.load(bytes,{ignoreEncryption:true,throwOnInvalidObject:true});
    const pageCount = pdf.getPageCount();
    if (pageCount<1 || pageCount>10000) throw new Error("Invalid page count");
    return {pageCount,isProtected:pdf.isEncrypted,sha256:createHash("sha256").update(bytes).digest("hex")};
  } catch {
    // Encrypted object streams cannot be inspected by pdf-lib without a password.
    const directory=await mkdtemp(join(tmpdir(),"foliant-inbox-"));
    try {
      const file=join(directory,"source.pdf");
      await writeFile(file,bytes,{mode:0o600});
      try {
        await promisify(execFile)("qpdf",["--is-encrypted",file],{timeout:15000,maxBuffer:65536});
        return {pageCount:null,isProtected:true,sha256:createHash("sha256").update(bytes).digest("hex")};
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code==="ENOENT") throw new InboxError("inbox_unavailable",503);
        throw new InboxError("invalid_pdf",415);
      }
    } finally {await rm(directory,{recursive:true,force:true});}
  }
}
async function ownedRow(userId:string,id:string) {
  ownerId(userId); receiptId(id);
  const response = await request(`/rest/v1/workspace_inbox?user_id=eq.${encodeURIComponent(userId)}&id=eq.${id}&status=neq.uploading&select=*&limit=1`);
  const rows = await response.json() as Row[];
  if (!rows[0] || rows[0].user_id!==userId) throw new InboxError("not_found",404);
  return rows[0];
}
function storagePath(row:Row,userId:string) {
  const expected = `inbox/${userId}/${row.id}.pdf`;
  if (row.object_key!==expected) throw new InboxError("inbox_unavailable",503);
  return `/storage/v1/object/${encodeURIComponent(config().bucket)}/${expected}`;
}
export async function receiveInboxPdf(userId:string,requestId:string,name:string,bytes:Uint8Array) {
  ownerId(userId);
  if (!uuid.test(requestId)) throw new InboxError("invalid_request",400);
  const inspected = await validateInboxPdf(bytes,name);
  const row = await rpc("reserve_workspace_inbox",{p_user_id:userId,p_request_id:requestId,p_name:name,
    p_size:bytes.length,p_sha256:inspected.sha256,p_page_count:inspected.pageCount,p_protected:inspected.isProtected});
  if (row.user_id!==userId) throw new InboxError("inbox_unavailable",503);
  if (row.status!=="uploading") return publicReceipt(row);
  // Retries of this reservation have identical bytes; no existing document is overwritten.
  await request(storagePath(row,userId),{method:"POST",headers:{"Content-Type":"application/pdf","x-upsert":"true"},body:Uint8Array.from(bytes)});
  return publicReceipt(await rpc("finish_workspace_inbox",{p_user_id:userId,p_id:row.id}));
}
export async function listInbox(userId:string,status:InboxStatus="received",offset=0) {
  ownerId(userId);
  if (!["received","accepted","archived"].includes(status) || !Number.isSafeInteger(offset) || offset<0 || offset>10000) throw new InboxError("invalid_request",400);
  const response = await request(`/rest/v1/workspace_inbox?user_id=eq.${encodeURIComponent(userId)}&status=eq.${status}&select=*&order=created_at.desc,id.desc&limit=50&offset=${offset}`,{headers:{Prefer:"count=exact"}});
  const rows = await response.json() as Row[];
  const total = Number(response.headers.get("content-range")?.split("/")[1]);
  if (!Number.isSafeInteger(total)) throw new InboxError("inbox_unavailable",503);
  return {receipts:rows.map(publicReceipt),total,offset};
}
export async function getInboxReceipt(userId:string,id:string) {
  const row = await ownedRow(userId,id);
  const response = await request(`/rest/v1/workspace_inbox_events?user_id=eq.${encodeURIComponent(userId)}&receipt_id=eq.${id}&select=id,action,created_at&order=created_at.asc,id.asc&limit=100`);
  return {...publicReceipt(row),events:await response.json()};
}
export async function readInboxFile(userId:string,id:string) {
  const row = await ownedRow(userId,id);
  const response = await request(storagePath(row,userId));
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    if (!Number.isSafeInteger(row.size) || row.size < 1 || row.size > inboxMaxBytes) throw new Error("Invalid stored size");
    bytes = new Uint8Array(await readLimitedBody(response,row.size));
  } catch {throw new InboxError("inbox_unavailable",503);}
  if (bytes.length!==row.size || createHash("sha256").update(bytes).digest("hex")!==row.sha256) throw new InboxError("inbox_unavailable",503);
  return {receipt:publicReceipt(row),bytes};
}
export async function acceptInbox(userId:string,id:string) {
  const row = await ownedRow(userId,id);
  if (row.accepted_at) return publicReceipt(row);
  if (row.status!=="received") throw new InboxError("conflict",409);
  const {bytes} = await readInboxFile(userId,id);
  // Independent copy: deleting a workspace document must not delete its Inbox original.
  await request(`/storage/v1/object/${encodeURIComponent(config().bucket)}/inbox-documents/${userId}/${id}.pdf`,{
    method:"POST",headers:{"Content-Type":"application/pdf","x-upsert":"true"},body:Uint8Array.from(bytes)
  });
  return publicReceipt(await rpc("accept_workspace_inbox",{p_user_id:userId,p_id:id}));
}
export async function archiveInbox(userId:string,id:string,archive:boolean) {
  ownerId(userId); receiptId(id);
  return publicReceipt(await rpc("archive_workspace_inbox",{p_user_id:userId,p_id:id,p_archive:archive}));
}
