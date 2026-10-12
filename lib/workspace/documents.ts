import {copyFile, mkdir, readFile, readdir, rm, rmdir, stat} from "node:fs/promises";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {storageRoot} from "@/lib/storage/root";
import type {ToolAction} from "@/content/tools/actions";
import {getJob, listGuestActivity} from "@/lib/jobs";
import {recordWorkspaceActivity, recordWorkspaceActivities} from "@/lib/workspace/activity";
import {getResultFile, getTemporaryFile} from "@/lib/storage/local";

export type WorkspaceDocumentRecord = {
  userId?: string;
  id: string;
  sourceJobId?: string;
  sourceInboxId?: string;
  isProtected?: boolean;
  name: string;
  kindTool: ToolAction;
  sourceName?: string;
  sourceMimeType?: string;
  inputSize?: number;
  resultPath: string;
  resultFileName: string;
  resultMimeType: string;
  resultSize: number;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
  workflowsQueued?: boolean;
};

export type WorkspaceDocumentVersionRecord = {
  id: string;
  documentId: string;
  sourceJobId?: string;
  sourceInboxId?: string;
  isProtected?: boolean;
  versionNumber: number;
  kindTool: ToolAction;
  resultPath: string;
  resultFileName: string;
  resultMimeType: string;
  resultSize: number;
  pageCount?: number;
  createdAt: string;
};

const workspaceRoot = path.join(storageRoot, "workspace");
const workspaceFileRoot = path.join(workspaceRoot, "files");
const workspaceMetaRoot = path.join(workspaceRoot, "documents");
const workspaceVersionMetaRoot = path.join(workspaceRoot, "versions");
const workspaceDriver = process.env.WORKSPACE_STORAGE_DRIVER ?? "local";
const supabaseBucket = process.env.SUPABASE_WORKSPACE_BUCKET ?? "workspace-documents";

type SupabaseWorkspaceDocumentRow = {
  user_id: string | null;
  id: string;
  source_job_id: string | null;
  source_inbox_id?: string | null;
  protected_pdf?: boolean;
  name: string;
  kind_tool: ToolAction;
  source_name: string | null;
  source_mime_type: string | null;
  input_size: number | null;
  result_object_key: string;
  result_file_name: string;
  result_mime_type: string;
  result_size: number;
  page_count: number | null;
  created_at: string;
  updated_at: string;
};

type SupabaseWorkspaceDocumentVersionRow = {
  id: string;
  document_id: string;
  source_job_id: string | null;
  source_inbox_id?: string | null;
  protected_pdf?: boolean;
  version_number: number;
  kind_tool: ToolAction;
  result_object_key: string;
  result_file_name: string;
  result_mime_type: string;
  result_size: number;
  page_count: number | null;
  created_at: string;
};

function shouldUseSupabaseWorkspace() {
  return workspaceDriver === "supabase";
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase workspace storage requires SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  return {
    secretKey,
    url: url.replace(/\/$/, "")
  };
}

async function supabaseRequest(pathname: string, init: RequestInit = {}) {
  const config = supabaseConfig();
  const headers = new Headers(init.headers);

  headers.set("apikey", config.secretKey);
  headers.set("Authorization", `Bearer ${config.secretKey}`);

  const response = await fetch(`${config.url}${pathname}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  return response;
}

function toWorkspaceDocument(row: SupabaseWorkspaceDocumentRow): WorkspaceDocumentRecord {
  return {
    userId: row.user_id ?? undefined,
    id: row.id,
    sourceJobId: row.source_job_id ?? undefined,
    sourceInboxId: row.source_inbox_id ?? undefined,
    isProtected: row.protected_pdf ?? row.kind_tool === "protect_pdf",
    name: row.name,
    kindTool: row.kind_tool,
    sourceName: row.source_name ?? undefined,
    sourceMimeType: row.source_mime_type ?? undefined,
    inputSize: row.input_size ?? undefined,
    resultPath: row.result_object_key,
    resultFileName: row.result_file_name,
    resultMimeType: row.result_mime_type,
    resultSize: row.result_size,
    pageCount: row.page_count ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSupabaseRow(document: WorkspaceDocumentRecord): SupabaseWorkspaceDocumentRow {
  return {
    user_id: document.userId ?? null,
    id: document.id,
    source_job_id: document.sourceJobId ?? null,
    source_inbox_id: document.sourceInboxId ?? null,
    protected_pdf: document.isProtected ?? document.kindTool === "protect_pdf",
    name: document.name,
    kind_tool: document.kindTool,
    source_name: document.sourceName ?? null,
    source_mime_type: document.sourceMimeType ?? null,
    input_size: document.inputSize ?? null,
    result_object_key: document.resultPath,
    result_file_name: document.resultFileName,
    result_mime_type: document.resultMimeType,
    result_size: document.resultSize,
    page_count: document.pageCount ?? null,
    created_at: document.createdAt,
    updated_at: document.updatedAt
  };
}

function toWorkspaceDocumentVersion(row: SupabaseWorkspaceDocumentVersionRow): WorkspaceDocumentVersionRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    sourceJobId: row.source_job_id ?? undefined,
    sourceInboxId: row.source_inbox_id ?? undefined,
    isProtected: row.protected_pdf ?? row.kind_tool === "protect_pdf",
    versionNumber: row.version_number,
    kindTool: row.kind_tool,
    resultPath: row.result_object_key,
    resultFileName: row.result_file_name,
    resultMimeType: row.result_mime_type,
    resultSize: row.result_size,
    pageCount: row.page_count ?? undefined,
    createdAt: row.created_at
  };
}

function toSupabaseVersionRow(version: WorkspaceDocumentVersionRecord): SupabaseWorkspaceDocumentVersionRow {
  return {
    id: version.id,
    document_id: version.documentId,
    source_job_id: version.sourceJobId ?? null,
    source_inbox_id: version.sourceInboxId ?? null,
    protected_pdf: version.isProtected ?? version.kindTool === "protect_pdf",
    version_number: version.versionNumber,
    kind_tool: version.kindTool,
    result_object_key: version.resultPath,
    result_file_name: version.resultFileName,
    result_mime_type: version.resultMimeType,
    result_size: version.resultSize,
    page_count: version.pageCount ?? null,
    created_at: version.createdAt
  };
}

function ensureWorkspaceDirsSync() {
  mkdirSync(workspaceFileRoot, {recursive: true});
  mkdirSync(workspaceMetaRoot, {recursive: true});
  mkdirSync(workspaceVersionMetaRoot, {recursive: true});
}

export async function ensureWorkspaceDirs() {
  await mkdir(workspaceFileRoot, {recursive: true});
  await mkdir(workspaceMetaRoot, {recursive: true});
  await mkdir(workspaceVersionMetaRoot, {recursive: true});
}

function safeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension || ".bin";
}

function isSafeRecordId(value: string) {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

function isWorkspaceFilePath(filePath: string) {
  const relativePath = path.relative(workspaceFileRoot, filePath);
  return relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function workspaceMetadataPath(documentId: string) {
  return path.join(workspaceMetaRoot, `${documentId}.json`);
}

function workspaceVersionMetadataPath(versionId: string) {
  return path.join(workspaceVersionMetaRoot, `${versionId}.json`);
}

function isWorkspaceDocument(value: unknown): value is WorkspaceDocumentRecord {
  if (!value || typeof value !== "object") return false;
  const document = value as WorkspaceDocumentRecord;

  return (
    typeof document.id === "string" &&
    typeof document.sourceJobId === "string" &&
    typeof document.name === "string" &&
    typeof document.kindTool === "string" &&
    typeof document.resultPath === "string" &&
    typeof document.resultFileName === "string" &&
    typeof document.resultMimeType === "string" &&
    typeof document.resultSize === "number" &&
    typeof document.createdAt === "string" &&
    typeof document.updatedAt === "string"
  );
}

function isWorkspaceDocumentVersion(value: unknown): value is WorkspaceDocumentVersionRecord {
  if (!value || typeof value !== "object") return false;
  const version = value as WorkspaceDocumentVersionRecord;

  return (
    typeof version.id === "string" &&
    typeof version.documentId === "string" &&
    typeof version.sourceJobId === "string" &&
    Number.isInteger(version.versionNumber) &&
    version.versionNumber > 0 &&
    typeof version.kindTool === "string" &&
    typeof version.resultPath === "string" &&
    typeof version.resultFileName === "string" &&
    typeof version.resultMimeType === "string" &&
    typeof version.resultSize === "number" &&
    typeof version.createdAt === "string"
  );
}

function readWorkspaceDocumentSync(documentId: string) {
  const metadataPath = workspaceMetadataPath(documentId);

  if (!existsSync(metadataPath)) return null;

  try {
    const value = JSON.parse(readFileSync(metadataPath, "utf8"));
    return isWorkspaceDocument(value) ? value : null;
  } catch {
    return null;
  }
}

function persistWorkspaceDocument(document: WorkspaceDocumentRecord) {
  ensureWorkspaceDirsSync();
  writeFileSync(workspaceMetadataPath(document.id), JSON.stringify(document), "utf8");
}

function persistWorkspaceDocumentVersion(version: WorkspaceDocumentVersionRecord) {
  ensureWorkspaceDirsSync();
  writeFileSync(workspaceVersionMetadataPath(version.id), JSON.stringify(version), "utf8");
}

function legacyVersionFor(document: WorkspaceDocumentRecord): WorkspaceDocumentVersionRecord {
  return {
    id: `legacy_${document.id}_1`,
    documentId: document.id,
    sourceJobId: document.sourceJobId,
    versionNumber: 1,
    kindTool: document.kindTool,
    resultPath: document.resultPath,
    resultFileName: document.resultFileName,
    resultMimeType: document.resultMimeType,
    resultSize: document.resultSize,
    pageCount: document.pageCount,
    createdAt: document.createdAt
  };
}

export async function listWorkspaceDocuments(input: {userId: string | undefined; limit?: number}) {
  if (!input.userId) return [];
  if (shouldUseSupabaseWorkspace()) {
    const limit = input.limit ?? 50;
    const response = await supabaseRequest(
      `/rest/v1/workspace_documents?user_id=eq.${encodeURIComponent(input.userId)}&select=*&order=updated_at.desc&limit=${encodeURIComponent(String(limit))}`,
      {headers: {"Accept": "application/json"}}
    );
    const rows = await response.json() as SupabaseWorkspaceDocumentRow[];

    return rows.map(toWorkspaceDocument);
  }

  await ensureWorkspaceDirs();
  const entries = await readdir(workspaceMetaRoot).catch(() => []);
  const documents = await Promise.all(entries.map(async (entry) => {
    if (!entry.endsWith(".json")) return null;

    try {
      const value = JSON.parse(await readFile(path.join(workspaceMetaRoot, entry), "utf8"));
      return isWorkspaceDocument(value) ? value : null;
    } catch {
      return null;
    }
  }));

  return documents
    .filter((document): document is WorkspaceDocumentRecord => document !== null && document.userId === input.userId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, input.limit ?? 50);
}

function getWorkspaceDocument(documentId: string) {
  return readWorkspaceDocumentSync(documentId);
}

export async function findWorkspaceDocument(documentId: string, userId: string | undefined) {
  if (!userId || !isSafeRecordId(documentId)) return null;
  const document = shouldUseSupabaseWorkspace()
    ? await getSupabaseWorkspaceDocument(documentId, userId)
    : getWorkspaceDocument(documentId);
  return document?.userId === userId ? document : null;
}

export async function readWorkspaceDocumentFile(documentId: string, userId: string | undefined) {
  const document = await findWorkspaceDocument(documentId, userId);
  if (!document) return null;
  if (shouldUseSupabaseWorkspace()) {

    const response = await supabaseRequest(
      `/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${document.resultPath}`
    );

    return {
      document,
      bytes: Buffer.from(await response.arrayBuffer())
    };
  }

  try {
    return {
      document,
      bytes: await readFile(document.resultPath)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function getSupabaseWorkspaceDocument(documentId: string, userId: string) {
  const response = await supabaseRequest(
    `/rest/v1/workspace_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    {headers: {"Accept": "application/json"}}
  );
  const rows = await response.json() as SupabaseWorkspaceDocumentRow[];
  const row = rows[0];

  return row ? toWorkspaceDocument(row) : null;
}

export async function listWorkspaceDocumentVersions(documentId: string, userId: string | undefined) {
  const document = await findWorkspaceDocument(documentId, userId);
  if (!document) return [];
  if (shouldUseSupabaseWorkspace()) {
    const response = await supabaseRequest(
      `/rest/v1/workspace_document_versions?document_id=eq.${encodeURIComponent(documentId)}&select=*&order=version_number.asc`,
      {headers: {"Accept": "application/json"}}
    );
    const rows = await response.json() as SupabaseWorkspaceDocumentVersionRow[];

    if (rows.length > 0) return rows.map(toWorkspaceDocumentVersion);

    return document ? [legacyVersionFor(document)] : [];
  }

  await ensureWorkspaceDirs();
  const entries = await readdir(workspaceVersionMetaRoot).catch(() => []);
  const versions = await Promise.all(entries.map(async (entry) => {
    if (!entry.endsWith(".json")) return null;

    try {
      const value = JSON.parse(await readFile(path.join(workspaceVersionMetaRoot, entry), "utf8"));
      return isWorkspaceDocumentVersion(value) && value.documentId === documentId ? value : null;
    } catch {
      return null;
    }
  }));
  const matchingVersions = versions
    .filter((version): version is WorkspaceDocumentVersionRecord => version !== null)
    .sort((left, right) => left.versionNumber - right.versionNumber);

  if (matchingVersions.length > 0) return matchingVersions;

  return document ? [legacyVersionFor(document)] : [];
}

async function getSupabaseWorkspaceDocumentVersion(document: WorkspaceDocumentRecord, versionId: string) {
  const documentId = document.id;
  const response = await supabaseRequest(
    `/rest/v1/workspace_document_versions?id=eq.${encodeURIComponent(versionId)}&document_id=eq.${encodeURIComponent(documentId)}&select=*&limit=1`,
    {headers: {"Accept": "application/json"}}
  );
  const rows = await response.json() as SupabaseWorkspaceDocumentVersionRow[];

  if (rows[0]) return toWorkspaceDocumentVersion(rows[0]);

  const legacyVersion = legacyVersionFor(document);
  return legacyVersion.id === versionId ? legacyVersion : null;
}

export async function getWorkspaceDocumentVersion(documentId: string, versionId: string, userId: string | undefined) {
  if (!isSafeRecordId(versionId)) return null;
  const document = await findWorkspaceDocument(documentId, userId);
  if (!document) return null;
  if (shouldUseSupabaseWorkspace()) {
    return getSupabaseWorkspaceDocumentVersion(document, versionId);
  }

  const metadataPath = workspaceVersionMetadataPath(versionId);

  if (existsSync(metadataPath)) {
    try {
      const value = JSON.parse(await readFile(metadataPath, "utf8"));
      if (isWorkspaceDocumentVersion(value) && value.documentId === documentId) return value;
    } catch {
      return null;
    }
  }

  const legacyVersion = legacyVersionFor(document);
  return legacyVersion.id === versionId ? legacyVersion : null;
}

export async function readWorkspaceDocumentVersionFile(documentId: string, versionId: string, userId: string | undefined) {
  const version = await getWorkspaceDocumentVersion(documentId, versionId, userId);
  if (!version) return null;

  if (shouldUseSupabaseWorkspace()) {
    const response = await supabaseRequest(
      `/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${version.resultPath}`
    );

    return {
      version,
      bytes: Buffer.from(await response.arrayBuffer())
    };
  }

  try {
    return {
      version,
      bytes: await readFile(version.resultPath)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function persistInitialVersion(document: WorkspaceDocumentRecord) {
  const version = {
    ...legacyVersionFor(document),
    id: `version_${document.id}_1`
  };

  if (shouldUseSupabaseWorkspace()) {
    await supabaseRequest("/rest/v1/workspace_document_versions", {
      method: "POST",
      body: JSON.stringify(toSupabaseVersionRow(version)),
      headers: {
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      }
    });
  } else {
    persistWorkspaceDocumentVersion(version);
  }

  return version;
}

async function saveSupabaseWorkspaceDocument(input: {
  document: WorkspaceDocumentRecord;
  sourcePath: string;
}) {
  await supabaseRequest(
    `/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${input.document.resultPath}`,
    {
      method: "POST",
      body: await readFile(input.sourcePath),
      headers: {
        "Content-Type": input.document.resultMimeType,
        "x-upsert": "false"
      }
    }
  );

  const response = await supabaseRequest("/rest/v1/rpc/save_workspace_document", {
    method: "POST",
    body: JSON.stringify({p_document:toSupabaseRow(input.document)}),
    headers: {
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    }
  });
  const rows = await response.json() as SupabaseWorkspaceDocumentRow[];
  if (!rows[0]) throw new Error("Workspace save did not return a document");
  return {...toWorkspaceDocument(rows[0]),workflowsQueued:true};
}

export async function saveJobResultToWorkspace(jobId: string, userId: string) {
  if (!userId) return null;
  const job = getJob(jobId);

  if (!job || job.status !== "completed") return null;

  const result = getResultFile(jobId);
  if (!result) return null;

  const firstFile = job.fileIds[0] ? getTemporaryFile(job.fileIds[0]) : null;
  const documentId = `doc_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const resultObjectKey = `${documentId}${safeExtension(result.fileName)}`;
  const resultPath = shouldUseSupabaseWorkspace()
    ? resultObjectKey
    : path.join(workspaceFileRoot, resultObjectKey);

  if (!shouldUseSupabaseWorkspace()) {
    await ensureWorkspaceDirs();
    await copyFile(result.path, resultPath);
  }
  const copiedStat = shouldUseSupabaseWorkspace() ? await stat(result.path) : await stat(resultPath);

  const document: WorkspaceDocumentRecord = {
    userId,
    id: documentId,
    sourceJobId: job.id,
    name: result.fileName,
    kindTool: job.tool,
    sourceName: firstFile?.fileName,
    sourceMimeType: firstFile?.mimeType,
    inputSize: firstFile?.fileSize,
    resultPath,
    resultFileName: result.fileName,
    resultMimeType: result.mimeType,
    resultSize: copiedStat.size,
    pageCount: job.pageCount,
    createdAt: now,
    updatedAt: now
  };

  if (shouldUseSupabaseWorkspace()) {
    const saved = await saveSupabaseWorkspaceDocument({
      document,
      sourcePath: result.path
    });
    await recordSavedActivity(saved, job.id, userId);
    return saved;
  }

  persistWorkspaceDocument(document);
  await persistInitialVersion(document);
  await recordSavedActivity(document, job.id, userId);
  return document;
}

async function recordSavedActivity(document: WorkspaceDocumentRecord, jobId: string, userId: string) {
  const job = getJob(jobId);
  await recordWorkspaceActivities(userId, document.id, [
    ...listGuestActivity(jobId, job?.guestSessionId).reverse(),
    {action: "saved", jobId, tool: document.kindTool, versionNumber: 1}
  ]);
}

export async function appendJobResultToWorkspaceDocument(input: {documentId: string; jobId: string; userId: string}) {
  const job = getJob(input.jobId);

  if (!job || job.status !== "completed") return null;

  const result = getResultFile(input.jobId);
  if (!result) return null;

  const document = await findWorkspaceDocument(input.documentId, input.userId);
  if (!document) return null;

  let versions = await listWorkspaceDocumentVersions(document.id, input.userId);

  if (versions.length === 1 && versions[0].id === `legacy_${document.id}_1`) {
    await persistInitialVersion(document);
    versions = [versions[0]];
  }

  const versionNumber = Math.max(0, ...versions.map((version) => version.versionNumber)) + 1;
  const versionId = `version_${crypto.randomUUID()}`;
  const resultObjectKey = shouldUseSupabaseWorkspace()
    ? `documents/${document.id}/versions/${versionId}${safeExtension(result.fileName)}`
    : path.join(workspaceFileRoot, document.id, `${versionId}${safeExtension(result.fileName)}`);

  if (shouldUseSupabaseWorkspace()) {
    await supabaseRequest(
      `/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${resultObjectKey}`,
      {
        method: "POST",
        body: await readFile(result.path),
        headers: {
          "Content-Type": result.mimeType,
          "x-upsert": "false"
        }
      }
    );
  } else {
    await mkdir(path.dirname(resultObjectKey), {recursive: true});
    await copyFile(result.path, resultObjectKey);
  }

  const copiedStat = shouldUseSupabaseWorkspace() ? await stat(result.path) : await stat(resultObjectKey);
  const now = new Date().toISOString();
  const version: WorkspaceDocumentVersionRecord = {
    id: versionId,
    documentId: document.id,
    sourceJobId: job.id,
    versionNumber,
    kindTool: job.tool,
    resultPath: resultObjectKey,
    resultFileName: result.fileName,
    resultMimeType: result.mimeType,
    resultSize: copiedStat.size,
    pageCount: job.pageCount,
    createdAt: now
  };
  const updatedDocument: WorkspaceDocumentRecord = {
    ...document,
    sourceJobId: job.id,
    isProtected: job.tool === "protect_pdf",
    kindTool: job.tool,
    resultPath: version.resultPath,
    resultFileName: version.resultFileName,
    resultMimeType: version.resultMimeType,
    resultSize: version.resultSize,
    pageCount: version.pageCount,
    updatedAt: now
  };

  if (shouldUseSupabaseWorkspace()) {
    await supabaseRequest("/rest/v1/workspace_document_versions", {
      method: "POST",
      body: JSON.stringify(toSupabaseVersionRow(version)),
      headers: {
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      }
    });
    const response = await supabaseRequest(
      `/rest/v1/workspace_documents?id=eq.${encodeURIComponent(document.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(toSupabaseRow(updatedDocument)),
        headers: {
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        }
      }
    );
    const rows = await response.json() as SupabaseWorkspaceDocumentRow[];

    await recordWorkspaceActivity(input.userId, document.id, {action: "modified", jobId: job.id, tool: job.tool, versionNumber});
    return {
      document: rows[0] ? toWorkspaceDocument(rows[0]) : updatedDocument,
      version
    };
  }

  persistWorkspaceDocumentVersion(version);
  persistWorkspaceDocument(updatedDocument);

  await recordWorkspaceActivity(input.userId, document.id, {action: "modified", jobId: job.id, tool: job.tool, versionNumber});
  return {document: updatedDocument, version};
}

export async function restoreWorkspaceDocumentVersion(input: {documentId: string; versionId: string; userId: string}) {
  const document = await findWorkspaceDocument(input.documentId, input.userId);
  if (!document) return null;

  const source = await readWorkspaceDocumentVersionFile(input.documentId, input.versionId, input.userId);
  if (!source) return null;

  let versions = await listWorkspaceDocumentVersions(document.id, input.userId);

  if (versions.length === 1 && versions[0].id === `legacy_${document.id}_1`) {
    await persistInitialVersion(document);
    versions = [{...versions[0], id: `version_${document.id}_1`}];
  }

  const versionNumber = Math.max(0, ...versions.map((version) => version.versionNumber)) + 1;
  const versionId = `version_${crypto.randomUUID()}`;
  const resultObjectKey = shouldUseSupabaseWorkspace()
    ? `documents/${document.id}/versions/${versionId}${safeExtension(source.version.resultFileName)}`
    : path.join(workspaceFileRoot, document.id, `${versionId}${safeExtension(source.version.resultFileName)}`);

  if (shouldUseSupabaseWorkspace()) {
    await supabaseRequest(
      `/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${resultObjectKey}`,
      {
        method: "POST",
        body: source.bytes,
        headers: {
          "Content-Type": source.version.resultMimeType,
          "x-upsert": "false"
        }
      }
    );
  } else {
    await mkdir(path.dirname(resultObjectKey), {recursive: true});
    await copyFile(source.version.resultPath, resultObjectKey);
  }

  const now = new Date().toISOString();
  const version: WorkspaceDocumentVersionRecord = {
    ...source.version,
    id: versionId,
    documentId: document.id,
    versionNumber,
    resultPath: resultObjectKey,
    createdAt: now
  };
  const updatedDocument: WorkspaceDocumentRecord = {
    ...document,
    sourceJobId: version.sourceJobId,
    isProtected: version.isProtected ?? version.kindTool === "protect_pdf",
    kindTool: version.kindTool,
    resultPath: version.resultPath,
    resultFileName: version.resultFileName,
    resultMimeType: version.resultMimeType,
    resultSize: version.resultSize,
    pageCount: version.pageCount,
    updatedAt: now
  };

  if (shouldUseSupabaseWorkspace()) {
    await supabaseRequest("/rest/v1/workspace_document_versions", {
      method: "POST",
      body: JSON.stringify(toSupabaseVersionRow(version)),
      headers: {
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      }
    });
    const response = await supabaseRequest(
      `/rest/v1/workspace_documents?id=eq.${encodeURIComponent(document.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(toSupabaseRow(updatedDocument)),
        headers: {
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        }
      }
    );
    const rows = await response.json() as SupabaseWorkspaceDocumentRow[];

    await recordWorkspaceActivity(input.userId, document.id, {action: "restored", jobId: version.sourceJobId, tool: version.kindTool, versionNumber});
    return {
      document: rows[0] ? toWorkspaceDocument(rows[0]) : updatedDocument,
      version
    };
  }

  persistWorkspaceDocumentVersion(version);
  persistWorkspaceDocument(updatedDocument);

  await recordWorkspaceActivity(input.userId, document.id, {action: "restored", jobId: version.sourceJobId, tool: version.kindTool, versionNumber});
  return {document: updatedDocument, version};
}

export async function deleteWorkspaceDocument(documentId: string, userId: string | undefined) {
  if (!isSafeRecordId(documentId)) return false;

  const document = await findWorkspaceDocument(documentId, userId);
  if (!document) return false;

  const versions = await listWorkspaceDocumentVersions(document.id, userId);
  const resultPaths = [...new Set([
    document.resultPath,
    ...versions.map((version) => version.resultPath)
  ])];

  if (shouldUseSupabaseWorkspace()) {
    if (resultPaths.length > 0) {
      await supabaseRequest(
        `/storage/v1/object/${encodeURIComponent(supabaseBucket)}`,
        {
          method: "DELETE",
          body: JSON.stringify({prefixes: resultPaths}),
          headers: {"Content-Type": "application/json"}
        }
      );
    }

    const response = await supabaseRequest(
      `/rest/v1/workspace_documents?id=eq.${encodeURIComponent(document.id)}`,
      {
        method: "DELETE",
        headers: {"Prefer": "return=representation"}
      }
    );
    const rows = await response.json() as SupabaseWorkspaceDocumentRow[];
    if (rows.length > 0) await recordWorkspaceActivity(userId!, document.id, {action: "deleted"});
    return rows.length > 0;
  }

  for (const resultPath of resultPaths) {
    if (isWorkspaceFilePath(resultPath)) {
      await rm(resultPath, {force: true});
    }
  }

  for (const version of versions) {
    if (isSafeRecordId(version.id)) {
      await rm(workspaceVersionMetadataPath(version.id), {force: true});
    }
  }

  await rm(workspaceMetadataPath(document.id), {force: true});
  await rmdir(path.join(workspaceFileRoot, document.id)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") throw error;
  });

  await recordWorkspaceActivity(userId!, document.id, {action: "deleted"});
  return true;
}
