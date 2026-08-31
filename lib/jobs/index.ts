import {copyFile, stat} from "node:fs/promises";
import type {ToolAction} from "@/content/tools/actions";
import {cleanupExpiredFiles, getTemporaryFile, createResultPath, registerResultFile, type StoredFile} from "@/lib/storage/local";
import {getProcessor} from "@/processors/registry";
import type {PdfCompressionLevel} from "@/processors/compression/pdf";
import type {ImageCompressionLevel} from "@/processors/compression/image";
import type {SplitMode} from "@/processors/pdf/split";
import {AppError, ErrorCode, isAppError} from "@/lib/validation/errors";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobRecord = {
  id: string;
  tool: ToolAction;
  fileIds: string[];
  options: JobOptions;
  status: JobStatus;
  progress: number;
  step: string;
  createdAt: number;
  completedAt?: number;
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

const jobs = new Map<string, JobRecord>();

export type JobOptions = {
  compressionLevel?: "best_size" | "standard" | "best_quality";
  pdfCompressionLevel?: PdfCompressionLevel;
  imageCompressionLevel?: ImageCompressionLevel;
  splitMode?: SplitMode;
  splitInterval?: number;
  pageRange?: string;
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
  if (tool === "split_pdf") return ".zip";
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
  jobs.set(jobId, next);
  return next;
}

function stepFor(tool: ToolAction) {
  switch (tool) {
    case "compress_image":
      return "Compression de l'image";
    case "compress_pdf":
      return "Compression du PDF";
    case "merge_pdf":
      return "Fusion des PDF";
    case "split_pdf":
      return "Division du PDF";
    default:
      return "Traitement du document";
  }
}

async function runJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    updateJob(jobId, {status: "processing", progress: 35, step: stepFor(job.tool)});

    const processor = getProcessor(job.tool);

    if (!processor) {
      throw new AppError(ErrorCode.processorMissing, "This processor is not implemented yet.", 501);
    }

    const inputFiles = job.fileIds.map((id) => getTemporaryFile(id));

    if (inputFiles.some((file) => !file)) {
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

    const outputFileName = isCompression
      ? `${fileBaseName(firstFile.fileName)}-${alreadyOptimized ? "optimized" : "compressed"}${result.extension}`
      : job.tool === "split_pdf"
        ? `${fileBaseName(firstFile.fileName)}-split${result.extension}`
      : `${fileBaseName(firstFile.fileName)}-merged${result.extension}`;

    const resultFile = await registerResultFile({
      jobId,
      path: result.path,
      fileName: outputFileName,
      mimeType: result.mimeType
    });

    const patch: Partial<JobRecord> = {
      status: "completed",
      progress: 100,
      step: "Document prêt",
      completedAt: Date.now(),
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
  } catch (error) {
    updateJob(jobId, {
      status: "failed",
      progress: 100,
      step: "Échec du traitement",
      error: error instanceof Error ? error.message : "Processing failed.",
      errorCode: isAppError(error) ? error.code : ErrorCode.processingFailed
    });
  }
}

export function createJob(input: {tool: ToolAction; fileIds: string[]; options?: JobOptions}) {
  void cleanupExpiredFiles();

  const job: JobRecord = {
    id: `job_${crypto.randomUUID()}`,
    tool: input.tool,
    fileIds: input.fileIds,
    options: input.options ?? {},
    status: "queued",
    progress: 0,
    step: "Préparation du fichier",
    createdAt: Date.now()
  };

  jobs.set(job.id, job);
  void runJob(job.id);
  return job;
}

export function getJob(jobId: string) {
  return jobs.get(jobId) ?? null;
}
