import {copyFile, stat} from "node:fs/promises";
import type {ToolAction} from "@/content/tools/actions";
import {cleanupExpiredFiles, getTemporaryFile, createResultPath, registerResultFile, type StoredFile} from "@/lib/storage/local";
import {getProcessor} from "@/processors/registry";
import type {PdfCompressionLevel} from "@/processors/compression/pdf";
import type {ImageCompressionLevel} from "@/processors/compression/image";
import type {SplitMode} from "@/processors/pdf/split";
import type {PdfToImageFormat} from "@/processors/pdf/to-image";
import type {RotateDegrees} from "@/processors/pdf/rotate";
import type {PageNumberPosition} from "@/processors/pdf/number";
import type {WatermarkPosition} from "@/processors/pdf/watermark";
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
  pdfToImageFormat?: PdfToImageFormat;
  pdfToImageDpi?: number;
  rotateDegrees?: RotateDegrees;
  pageNumberPosition?: PageNumberPosition;
  pageNumberStartPage?: number;
  pageNumberStartNumber?: number;
  watermarkText?: string;
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
  jobs.set(jobId, next);
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
    case "image_to_pdf":
      return "Création du PDF";
    case "merge_pdf":
      return "Fusion des PDF";
    case "number_pdf_pages":
      return "Numérotation des pages";
    case "pdf_to_image":
      return "Conversion en images";
    case "protect_pdf":
      return "Protection du PDF";
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
    case "image_to_pdf":
      return `${job.fileIds.length > 1 ? "images" : baseName}-converted${extension}`;
    case "merge_pdf":
      return `${baseName}-merged${extension}`;
    case "number_pdf_pages":
      return `${baseName}-numbered${extension}`;
    case "pdf_to_image":
      return `${baseName}-images${extension}`;
    case "protect_pdf":
      return `${baseName}-protected${extension}`;
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

    const outputFileName = outputFileNameFor(job, firstFile, result.extension, alreadyOptimized);

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
