import {catalogSections, type CatalogToolLabel} from "@/content/catalog";
import {toolActions, type ToolAction} from "@/content/tools/actions";
import type {StudioDocument, StudioDocumentKind, StudioDocumentStatus, StudioTone} from "@/content/studio";
import {canAccessGuestJob, getJob, listJobs, type JobRecord, type JobStatus} from "@/lib/jobs";
import {getResultFile, getTemporaryFile, resultTtlMs, type StoredFile} from "@/lib/storage/local";
import {findWorkspaceDocument, listWorkspaceDocuments, type WorkspaceDocumentRecord} from "@/lib/workspace/documents";

const toolLabelByAction = new Map<ToolAction, CatalogToolLabel>();

for (const section of catalogSections) {
  for (const [slug, label] of section.links) {
    const action = toolActions[slug as keyof typeof toolActions];

    if (action && !toolLabelByAction.has(action)) {
      toolLabelByAction.set(action, label);
    }
  }
}

const editActions = new Set<ToolAction>([
  "add_text_pdf",
  "delete_pdf_pages",
  "extract_pdf_pages",
  "fill_pdf",
  "insert_pdf_pages",
  "merge_pdf",
  "number_pdf_pages",
  "reorder_pdf",
  "rotate_pdf",
  "split_pdf",
  "watermark_pdf"
]);

const securityActions = new Set<ToolAction>([
  "protect_pdf",
  "sign_pdf",
  "unlock_pdf"
]);

function kindFor(tool: ToolAction): StudioDocumentKind {
  if (tool === "compress_pdf" || tool === "compress_image") return "compressed";
  if (securityActions.has(tool)) return "secured";
  if (editActions.has(tool)) return "organized";
  if (tool === "heic_to_jpg" || tool === "heic_to_png") return "image";
  if (tool.includes("_to_")) return "converted";
  return "document";
}

function toneFor(status: JobStatus): StudioTone {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "processing") return "blue";
  return "amber";
}

function statusFor(status: JobStatus): StudioDocumentStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "processing") return "processing";
  return "queued";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function dateLabel(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function valueFor(job: JobRecord, inputSize: number, outputSize?: number) {
  if (job.result) {
    if (job.result.alreadyOptimized) return "0%";
    return `-${job.result.savedPercent}%`;
  }

  if (outputSize) return formatBytes(outputSize);
  if (inputSize > 0) return formatBytes(inputSize);

  return `${job.fileIds.length} file${job.fileIds.length > 1 ? "s" : ""}`;
}

function isStoredFile(file: StoredFile | null): file is StoredFile {
  return file !== null;
}

function canPreviewPdf(mimeType: string | undefined, tool: ToolAction) {
  // Protected PDFs require a password in a dedicated viewer; keep their download and unlock paths available.
  return mimeType === "application/pdf" && tool !== "protect_pdf";
}

function workspaceDocumentToStudioDocument(document: WorkspaceDocumentRecord, locale: string): StudioDocument {
  const isPdfResult = !document.isProtected && canPreviewPdf(document.resultMimeType, document.kindTool);

  return {
    id: document.id,
    name: document.name,
    kind: kindFor(document.kindTool),
    owner: "tools",
    amount: formatBytes(document.resultSize),
    status: "completed",
    date: dateLabel(Date.parse(document.updatedAt), locale),
    pages: Math.max(1, document.pageCount ?? 1),
    confidence: "Saved",
    tone: "green",
    sourceName: document.sourceName,
    tool: document.kindTool,
    toolLabel: toolLabelByAction.get(document.kindTool),
    resultUrl: `/api/studio/documents/${document.id}/download`,
    previewUrl: isPdfResult ? `/api/studio/documents/${document.id}/preview` : undefined,
    resultMimeType: document.resultMimeType,
    sourceMimeType: document.sourceMimeType,
    inputSize: document.inputSize,
    resultSize: document.resultSize,
    isGuest: false,
    isProtected: document.isProtected,
    isLive: true
  };
}

function jobToStudioDocument(job: JobRecord, locale: string): StudioDocument {
  const files = job.fileIds.map((fileId) => getTemporaryFile(fileId)).filter(isStoredFile);
  const firstFile = files[0] ?? null;
  const inputSize = files.reduce((total, file) => total + file.fileSize, 0);
  const result = getResultFile(job.id);
  const isPdfResult = canPreviewPdf(result?.mimeType, job.tool);
  const isPdfSource = firstFile?.mimeType === "application/pdf";
  const resultExpiresAt = result ? new Date(Date.parse(result.createdAt) + resultTtlMs).toISOString() : undefined;

  return {
    id: job.id,
    name: result?.fileName ?? firstFile?.fileName ?? `${job.tool}-${job.id.slice(-6)}`,
    kind: kindFor(job.tool),
    owner: "tools",
    amount: valueFor(job, inputSize, result?.size),
    status: statusFor(job.status),
    date: dateLabel(job.createdAt, locale),
    pages: Math.max(1, job.pageCount ?? job.fileIds.length),
    confidence: `${job.progress}%`,
    tone: toneFor(job.status),
    progress: job.progress,
    step: job.step,
    sourceName: firstFile?.fileName,
    tool: job.tool,
    toolLabel: toolLabelByAction.get(job.tool),
      resultUrl: job.resultUrl,
      previewUrl: isPdfResult ? `/api/jobs/${job.id}/preview` : isPdfSource ? `/api/jobs/${job.id}/source-preview` : undefined,
      sourcePreviewUrl: isPdfSource ? `/api/jobs/${job.id}/source-preview` : undefined,
      resultMimeType: result?.mimeType,
    sourceMimeType: firstFile?.mimeType,
    resultExpiresAt,
    inputSize,
    resultSize: result?.size,
    error: job.error,
    isGuest: true,
    isLive: true
  };
}

export async function buildStudioDocuments(input: {locale?: string; limit?: number; guestSessionId?: string; userId?: string} = {}): Promise<StudioDocument[]> {
  const locale = input.locale ?? "fr";
  const limit = input.limit ?? 20;
  const savedDocuments = (await listWorkspaceDocuments({limit, userId: input.userId}))
    .map((document) => workspaceDocumentToStudioDocument(document, locale));
  const temporaryDocuments = listJobs({limit: Infinity})
    .filter((job) => canAccessGuestJob(job, input.guestSessionId))
    .slice(0, limit)
    .map((job) => jobToStudioDocument(job, locale));

  return [...savedDocuments, ...temporaryDocuments].slice(0, limit);
}

export async function getStudioDocumentById(input: {documentId: string; locale?: string; guestSessionId?: string; userId?: string}) {
  const locale = input.locale ?? "fr";
  const workspaceDocument = input.documentId.startsWith("doc_") ? await findWorkspaceDocument(input.documentId, input.userId) : null;

  if (workspaceDocument) return workspaceDocumentToStudioDocument(workspaceDocument, locale);

  const job = getJob(input.documentId);
  return job && canAccessGuestJob(job, input.guestSessionId) ? jobToStudioDocument(job, locale) : null;
}
