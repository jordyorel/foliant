import {copyFile, readFile, stat} from "node:fs/promises";
import {deleteTemporaryResult, retainJobFiles} from "@/lib/storage/local";
import type {ToolAction} from "@/content/tools/actions";
import {cleanupExpiredFiles, getTemporaryFile, createResultPath, registerResultFile, resultTtlMs, type StoredFile} from "@/lib/storage/local";
import {getProcessor} from "@/processors/registry";
import {PDFDocument} from "pdf-lib";
import type {PdfCompressionLevel} from "@/processors/compression/pdf";
import type {ImageCompressionLevel} from "@/processors/compression/image";
import type {SplitMode} from "@/processors/pdf/split";
import type {PdfToImageFormat} from "@/processors/pdf/to-image";
import type {RotateDegrees} from "@/processors/pdf/rotate";
import type {PageNumberFormat, PageNumberPosition} from "@/processors/pdf/number";
import type {PdfEditorAnnotation} from "@/processors/pdf/reorder";
import type {WatermarkPosition} from "@/processors/pdf/watermark";
import {AppError, ErrorCode, isAppError} from "@/lib/validation/errors";
import {storageRoot} from "@/lib/storage/root";
import {loadJobStore, persistJobStore, type JobStore} from "./persistence";
import {JobScheduler, workerLimit} from "./scheduler";
import {logOperationalEvent} from "@/lib/operations/log";
import type {ActivityEvent} from "@/lib/studio/activity-types";
import {recordWorkspaceActivity} from "@/lib/workspace/activity";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobRecord = {
  activity?: ActivityEvent[];
  workspaceDocumentId?: string;
  workspaceUserId?: string;
  guestSessionId?: string;
  guestChainId?: string;
  id: string;
  tool: ToolAction;
  fileIds: string[];
  options: JobOptions;
  status: JobStatus;
  progress: number;
  step: string;
  createdAt: number;
  completedAt?: number;
  pageCount?: number;
  resultUrl?: string;
  result?: {
    originalSize: number;
    outputSize: number;
    savedBytes: number;
    savedPercent: number;
    alreadyOptimized: boolean;
  };
  error?: string;
  errorCode?: string;
};

// Route handlers and server components can load separate module instances.
// One writer process per persistent volume; this is not a distributed queue.
const processState = globalThis as typeof globalThis & {foliantJobStore?: JobStore; foliantJobScheduler?: JobScheduler};
const scheduler = processState.foliantJobScheduler ??= new JobScheduler(
  workerLimit(process.env.JOB_CONCURRENCY, 2, 16),
  workerLimit(process.env.JOB_MAX_PENDING, 20, 200)
);
const store = processState.foliantJobStore ??= loadJobStore(storageRoot, resultTtlMs);
const {jobs, closedGuestChains, guestClients} = store;
const persist = () => persistJobStore(storageRoot, store);

export function beginJobShutdown() {
  return scheduler.beginShutdown();
}

export function cleanupExpiredJobState(now = Date.now()) {
  let removed = 0;
  for (const [id, job] of jobs) {
    if (job.createdAt + resultTtlMs <= now && job.status !== "processing" && job.status !== "queued") {
      jobs.delete(id);
      removed++;
    }
  }
  const activeChains = new Set([...jobs.values()].map(job => job.guestChainId ?? job.id));
  for (const id of closedGuestChains) if (!activeChains.has(id)) closedGuestChains.delete(id);
  for (const id of guestClients.keys()) if (!activeChains.has(id)) guestClients.delete(id);
  persist();
  return removed;
}

export function touchGuestClient(jobId: string, sessionId: string | undefined, clientId: string) {
  const job = getJob(jobId);
  if (!job || !canAccessGuestJob(job, sessionId)) return false;
  const chainId = job.guestChainId ?? job.id;
  const clients = guestClients.get(chainId) ?? new Set<string>();
  clients.add(clientId);
  guestClients.set(chainId, clients);
  persist();
  return true;
}

export function releaseGuestClient(jobId: string, sessionId: string | undefined, clientId: string) {
  const job = getJob(jobId);
  if (!job || !canAccessGuestJob(job, sessionId)) return false;
  const chainId = job.guestChainId ?? job.id;
  const clients = guestClients.get(chainId);
  if (!clients?.delete(clientId)) return false;
  if (clients.size === 0) closeGuestChain(jobId, sessionId);
  else persist();
  return true;
}

export async function revokeGuestSession(sessionId: string | undefined) {
  if (!sessionId) return;
  for (const job of jobs.values()) {
    if (job.guestSessionId !== sessionId) continue;
    closeGuestChain(job.id, sessionId);
    await cleanupGuestChain(job.id);
  }
}

export function publicJob(job: JobRecord) {
  const {guestSessionId: _sessionId, guestChainId: _chainId, workspaceUserId: _userId, ...publicFields} = job;
  const {pdfPassword: _password, ...options} = publicFields.options;
  return {...publicFields, options};
}

export function canAccessGuestJob(job: JobRecord | null, sessionId?: string) {
  return Boolean(job && sessionId && job.guestSessionId === sessionId &&
    !closedGuestChains.has(job.guestChainId ?? job.id) && job.createdAt + resultTtlMs > Date.now());
}

export function closeGuestChain(jobId: string, sessionId?: string) {
  const job = getJob(jobId);
  if (!canAccessGuestJob(job, sessionId)) return false;
  closedGuestChains.add(job!.guestChainId ?? job!.id);
  guestClients.delete(job!.guestChainId ?? job!.id);
  persist();
  return true;
}

export async function cleanupGuestChain(jobId: string) {
  const root = getJob(jobId);
  if (!root) return;
  const chainId = root.guestChainId ?? root.id;
  if (!closedGuestChains.has(chainId)) return;
  for (const job of jobs.values()) {
    if ((job.guestChainId ?? job.id) === chainId && job.status === "completed") {
      await deleteTemporaryResult(job.id);
    }
  }
}

export type JobOptions = {
  compressionLevel?: "best_size" | "standard" | "best_quality";
  pdfCompressionLevel?: PdfCompressionLevel;
  imageCompressionLevel?: ImageCompressionLevel;
  splitMode?: SplitMode;
  splitInterval?: number;
  pageRange?: string;
  pdfToImageFormat?: PdfToImageFormat;
  pdfToImageDpi?: number;
  formValues?: Record<string, boolean | string>;
  pageAnnotations?: PdfEditorAnnotation[];
  insertAfterPage?: number;
  pageOrder?: number[];
  pageRotations?: Record<string, number>;
  rotateDegrees?: RotateDegrees;
  pageNumberPosition?: PageNumberPosition;
  pageNumberStartPage?: number;
  pageNumberStartNumber?: number;
  pageNumberFormat?: PageNumberFormat;
  pageNumberColor?: string;
  pageNumberFontSize?: number;
  pageNumberMargin?: number;
  watermarkText?: string;
  watermarkColor?: string;
  watermarkFontSize?: number;
  watermarkPosition?: WatermarkPosition;
  watermarkOpacity?: number;
  pdfPassword?: string;
};

function resolvePdfCompressionLevel(level?: JobOptions["compressionLevel"]): PdfCompressionLevel {
  if (level === "best_size") return "screen";
  if (level === "best_quality") return "printer";
  return "ebook";
}

function resolveImageCompressionLevel(level?: JobOptions["compressionLevel"]): ImageCompressionLevel {
  if (level === "best_size") return "best_size";
  if (level === "best_quality") return "best_quality";
  return "standard";
}

function fileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/i, "");
}

function outputExtensionFor(tool: ToolAction) {
  if (tool === "compress_image") return ".jpg";
  if (tool === "heic_to_jpg") return ".jpg";
  if (tool === "heic_to_png") return ".png";
  if (tool === "pdf_to_word") return ".docx";
  if (tool === "pdf_to_excel") return ".xlsx";
  if (tool === "pdf_to_powerpoint") return ".pptx";
  if (tool === "split_pdf" || tool === "pdf_to_image") return ".zip";
  return ".pdf";
}

/**
 * Keep the original when re-encoding does not produce a smaller file. This
 * avoids a confusing "0% saved" result where the output is larger than input.
 */
export function shouldKeepOriginal(inputSize: number, outputSize: number) {
  return outputSize >= inputSize;
}

function updateJob(jobId: string, patch: Partial<JobRecord>) {
  const current = jobs.get(jobId);
  if (!current) return null;
  const next = {...current, ...patch};
  if (patch.status && patch.status !== current.status && (patch.status === "completed" || patch.status === "failed")) {
    next.activity = [...(current.activity ?? []), {
      id: `${jobId}_${patch.status}`, jobId, tool: current.tool,
      action: patch.status === "completed" ? "processing_completed" : "processing_failed",
      createdAt: new Date().toISOString()
    }];
  }
  jobs.set(jobId, next);
  persist();
  return next;
}

function stepFor(tool: ToolAction) {
  switch (tool) {
    case "compress_image":
      return "Compression de l'image";
    case "compress_pdf":
      return "Compression du PDF";
    case "delete_pdf_pages":
      return "Suppression des pages";
    case "extract_pdf_pages":
      return "Extraction des pages";
    case "fill_pdf":
      return "Remplissage du formulaire";
    case "heic_to_jpg":
      return "Conversion HEIC en JPG";
    case "heic_to_png":
      return "Conversion HEIC en PNG";
    case "image_to_pdf":
      return "Création du PDF";
    case "insert_pdf_pages":
      return "Insertion des pages";
    case "markdown_to_pdf":
      return "Conversion Markdown en PDF";
    case "word_to_pdf":
      return "Conversion Word en PDF";
    case "excel_to_pdf":
      return "Conversion Excel en PDF";
    case "powerpoint_to_pdf":
      return "Conversion PowerPoint en PDF";
    case "merge_pdf":
      return "Fusion des PDF";
    case "number_pdf_pages":
      return "Numérotation des pages";
    case "pdf_to_image":
      return "Conversion en images";
    case "pdf_to_word":
      return "Conversion PDF en Word";
    case "pdf_to_excel":
      return "Conversion PDF en Excel";
    case "pdf_to_powerpoint":
      return "Conversion PDF en PowerPoint";
    case "protect_pdf":
      return "Protection du PDF";
    case "reorder_pdf":
      return "Réorganisation du PDF";
    case "sign_pdf":
      return "Ajout de la signature";
    case "rotate_pdf":
      return "Rotation du PDF";
    case "split_pdf":
      return "Division du PDF";
    case "unlock_pdf":
      return "Déverrouillage du PDF";
    case "watermark_pdf":
      return "Ajout du filigrane";
    default:
      return "Traitement du document";
  }
}

function outputFileNameFor(job: JobRecord, firstFile: StoredFile, extension: string, alreadyOptimized: boolean) {
  const baseName = fileBaseName(firstFile.fileName);

  switch (job.tool) {
    case "compress_image":
    case "compress_pdf":
      return `${baseName}-${alreadyOptimized ? "optimized" : "compressed"}${extension}`;
    case "delete_pdf_pages":
      return `${baseName}-pages-removed${extension}`;
    case "extract_pdf_pages":
      return `${baseName}-extracted${extension}`;
    case "fill_pdf":
      return `${baseName}-filled${extension}`;
    case "heic_to_jpg":
    case "heic_to_png":
      return `${baseName}-converted${extension}`;
    case "image_to_pdf":
      return `${job.fileIds.length > 1 ? "images" : baseName}-converted${extension}`;
    case "insert_pdf_pages":
      return `${baseName}-inserted${extension}`;
    case "markdown_to_pdf":
    case "word_to_pdf":
    case "excel_to_pdf":
    case "powerpoint_to_pdf":
      return `${baseName}-converted${extension}`;
    case "merge_pdf":
      return `${baseName}-merged${extension}`;
    case "number_pdf_pages":
      return `${baseName}-numbered${extension}`;
    case "pdf_to_image":
      return `${baseName}-images${extension}`;
    case "pdf_to_word":
    case "pdf_to_excel":
    case "pdf_to_powerpoint":
      return `${baseName}-converted${extension}`;
    case "protect_pdf":
      return `${baseName}-protected${extension}`;
    case "reorder_pdf":
      return `${baseName}-reordered${extension}`;
    case "sign_pdf":
      return `${baseName}-signed${extension}`;
    case "rotate_pdf":
      return `${baseName}-rotated${extension}`;
    case "split_pdf":
      return `${baseName}-split${extension}`;
    case "unlock_pdf":
      return `${baseName}-unlocked${extension}`;
    case "watermark_pdf":
      return `${baseName}-watermarked${extension}`;
    default:
      return `${baseName}-processed${extension}`;
  }
}

async function pageCountForResult(filePath: string, mimeType: string) {
  if (mimeType !== "application/pdf") return undefined;

  try {
    const pdf = await PDFDocument.load(await readFile(filePath), {ignoreEncryption: true});
    return pdf.getPageCount();
  } catch {
    return undefined;
  }
}

async function runJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    if (job.workspaceDocumentId && job.workspaceUserId) await recordWorkspaceActivity(job.workspaceUserId, job.workspaceDocumentId, {action: "job_created", jobId, tool: job.tool, createdAt: new Date(job.createdAt).toISOString()});
    if (closedGuestChains.has(job.guestChainId ?? job.id) || job.createdAt + resultTtlMs <= Date.now()) {
      throw new AppError(ErrorCode.jobNotFound, "Temporary session is no longer available.", 404);
    }
    updateJob(jobId, {status: "processing", progress: 35, step: stepFor(job.tool)});

    const processor = getProcessor(job.tool);

    if (!processor) {
      throw new AppError(ErrorCode.processorMissing, "This processor is not implemented yet.", 501);
    }

    const inputFiles = job.fileIds.map((id) => getTemporaryFile(id));

    if (inputFiles.some((file) => !file || Date.parse(file.expiresAt) <= Date.now())) {
      throw new AppError(ErrorCode.uploadNotFound, "Uploaded file not found.", 404);
    }

    const files = inputFiles as StoredFile[];
    const firstFile = files[0];
    const isCompression = job.tool === "compress_pdf" || job.tool === "compress_image";

    const outputPath = await createResultPath(job.id, outputExtensionFor(job.tool));

    updateJob(jobId, {progress: 65});
    const result = await processor(files.map((file) => file.path), outputPath, {
      options: {
        ...job.options,
        pdfCompressionLevel: resolvePdfCompressionLevel(job.options.compressionLevel),
        imageCompressionLevel: resolveImageCompressionLevel(job.options.compressionLevel)
      }
    });

    const compressedSize = (await stat(result.path)).size;
    const alreadyOptimized = isCompression && shouldKeepOriginal(firstFile.fileSize, compressedSize);

    if (alreadyOptimized) {
      await copyFile(firstFile.path, result.path);
    }

    const outputFileName = outputFileNameFor(job, firstFile, result.extension, alreadyOptimized);

    const resultFile = await registerResultFile({
      jobId,
      path: result.path,
      fileName: outputFileName,
      mimeType: result.mimeType
    });
    const pageCount = await pageCountForResult(resultFile.path, resultFile.mimeType);

    const patch: Partial<JobRecord> = {
      status: "completed",
      progress: 100,
      step: "Document prêt",
      completedAt: Date.now(),
      pageCount,
      resultUrl: `/api/jobs/${jobId}/download`
    };

    if (isCompression) {
      const savedBytes = Math.max(0, firstFile.fileSize - resultFile.size);
      const savedPercent = firstFile.fileSize > 0 ? Math.round((savedBytes / firstFile.fileSize) * 100) : 0;

      patch.result = {
        originalSize: firstFile.fileSize,
        outputSize: resultFile.size,
        savedBytes,
        savedPercent,
        alreadyOptimized
      };
    }

    updateJob(jobId, patch);
    if (job.workspaceDocumentId && job.workspaceUserId) await recordWorkspaceActivity(job.workspaceUserId, job.workspaceDocumentId, {action: "processing_completed", jobId, tool: job.tool});
    logOperationalEvent("job_completed", {tool: job.tool, durationMs: Date.now() - job.createdAt});
    await cleanupGuestChain(jobId);
  } catch (error) {
    logOperationalEvent("job_failed", {tool: job.tool, code: isAppError(error) ? error.code : ErrorCode.processingFailed});
    updateJob(jobId, {
      status: "failed",
      progress: 100,
      step: "Échec du traitement",
      error: "Processing failed. Please check your file and try again.",
      errorCode: isAppError(error) ? error.code : ErrorCode.processingFailed
    });
    if (job.workspaceDocumentId && job.workspaceUserId) await recordWorkspaceActivity(job.workspaceUserId, job.workspaceDocumentId, {action: "processing_failed", jobId, tool: job.tool});
  }
}

export function createJob(input: {tool: ToolAction; fileIds: string[]; options?: JobOptions; guestSessionId?: string; guestChainId?: string; workspaceDocumentId?: string; workspaceUserId?: string}) {
  scheduler.assertCapacity();
  if (input.guestSessionId && [...jobs.values()].filter(job => job.guestSessionId === input.guestSessionId &&
    (job.status === "queued" || job.status === "processing")).length >= 4) {
    throw new AppError(ErrorCode.serverBusy, "Too many active jobs in this session. Please try again shortly.", 503);
  }
  void cleanupExpiredFiles().catch(() => logOperationalEvent("cleanup_failed"));

  const job: JobRecord = {
    workspaceDocumentId: input.workspaceDocumentId,
    workspaceUserId: input.workspaceUserId,
    guestSessionId: input.guestSessionId,
    guestChainId: input.guestChainId,
    id: `job_${crypto.randomUUID()}`,
    tool: input.tool,
    fileIds: input.fileIds,
    options: input.options ?? {},
    status: "queued",
    progress: 0,
    step: "Préparation du fichier",
    createdAt: Date.now()
  };
  job.activity = [
    ...(!input.guestChainId && !input.workspaceDocumentId ? [{id: `${job.id}_imported`, action: "imported" as const, jobId: job.id, tool: job.tool, createdAt: new Date(job.createdAt).toISOString()}] : []),
    {id: `${job.id}_created`, action: "job_created", jobId: job.id, tool: job.tool, createdAt: new Date(job.createdAt).toISOString()}
  ];

  jobs.set(job.id, job);
  try {
    persist();
  } catch (error) {
    jobs.delete(job.id);
    throw error;
  }
  const release = retainJobFiles(job.id, job.fileIds);
  scheduler.enqueue(async () => {
    try { await runJob(job.id); } finally { release(); }
  });
  return job;
}

export function getJob(jobId: string) {
  return jobs.get(jobId) ?? null;
}

export function recordJobDownload(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  try { updateJob(jobId, {activity: [...(job.activity ?? []), {
    id: crypto.randomUUID(), jobId, tool: job.tool, action: "download_requested" as const, createdAt: new Date().toISOString()
  }].slice(-100)}); } catch { logOperationalEvent("activity_failed"); }
}

export function listGuestActivity(jobId: string, sessionId: string | undefined) {
  const job = getJob(jobId);
  if (!job || !canAccessGuestJob(job, sessionId)) return [];
  const chain = job.guestChainId ?? job.id;
  return [...jobs.values()].filter((entry) => (entry.guestChainId ?? entry.id) === chain && canAccessGuestJob(entry, sessionId))
    .flatMap((entry) => entry.activity ?? [])
    .reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
}

export function listJobs(input: {limit?: number} = {}) {
  const limit = input.limit ?? 50;

  return Array.from(jobs.values())
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}
