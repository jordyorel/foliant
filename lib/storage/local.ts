import {mkdir, readFile, stat, unlink, writeFile} from "node:fs/promises";
import path from "node:path";
import type {ToolAction} from "@/content/tools/actions";
import {AppError, ErrorCode} from "@/lib/validation/errors";
import {expectedKindsFor, type FileKind} from "@/lib/validation/uploads";

export type StoredFile = {
  id: string;
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tool: ToolAction;
  maxSize: number;
  path: string;
  createdAt: string;
  expiresAt: string;
};

export type ResultFile = {
  id: string;
  jobId: string;
  path: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const uploads = new Map<string, StoredFile>();
const results = new Map<string, ResultFile>();

const storageRoot = path.join(process.cwd(), ".tmp");
const uploadRoot = path.join(storageRoot, "uploads");
const resultRoot = path.join(storageRoot, "results");
const uploadTtlMs = 15 * 60 * 1000;
const resultTtlMs = 6 * 60 * 60 * 1000;

export async function ensureStorageDirs() {
  await mkdir(uploadRoot, {recursive: true});
  await mkdir(resultRoot, {recursive: true});
}

function safeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension || ".bin";
}

export function createTemporaryFile(input: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  tool: ToolAction;
  maxSize: number;
}) {
  const uploadId = `upl_${crypto.randomUUID()}`;
  const fileId = `file_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + uploadTtlMs).toISOString();
  const filePath = path.join(uploadRoot, `${fileId}${safeExtension(input.fileName)}`);

  const storedFile: StoredFile = {
    id: fileId,
    uploadId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    tool: input.tool,
    maxSize: input.maxSize,
    path: filePath,
    createdAt: new Date().toISOString(),
    expiresAt
  };

  uploads.set(fileId, storedFile);
  return storedFile;
}

export function hasTemporaryFile(fileId: string) {
  return uploads.has(fileId);
}

export function getTemporaryFile(fileId: string) {
  return uploads.get(fileId) ?? null;
}

/**
 * Detects the real content type from magic bytes, independent of the declared
 * MIME type or file extension.
 */
export function sniffKind(buffer: Buffer): FileKind | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return "pdf";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp") {
    return "heif";
  }

  return null;
}

export async function saveTemporaryFile(fileId: string, bytes: ArrayBuffer) {
  const file = getTemporaryFile(fileId);
  if (!file) return null;
  const buffer = Buffer.from(bytes);

  if (buffer.length > file.maxSize) {
    const mb = Math.round(file.maxSize / 1024 / 1024);
    throw new AppError(
      ErrorCode.fileTooLarge,
      `File exceeds the ${mb} MB limit.`,
      413
    );
  }

  const kind = sniffKind(buffer);
  const expected = expectedKindsFor(file.tool);

  if (expected.length > 0 && (kind === null || !expected.includes(kind))) {
    const isPdfTool = expected.includes("pdf");
    throw new AppError(
      ErrorCode.invalidFile,
      isPdfTool ? "Invalid PDF file." : "Unsupported or invalid image file.",
      415
    );
  }

  await ensureStorageDirs();
  await writeFile(file.path, buffer);
  const savedFile = {
    ...file,
    fileSize: buffer.length
  };
  uploads.set(fileId, savedFile);
  return savedFile;
}

export async function createResultPath(jobId: string, extension = ".pdf") {
  await ensureStorageDirs();
  return path.join(resultRoot, `${jobId}${extension}`);
}

export async function registerResultFile(input: {
  jobId: string;
  path: string;
  fileName: string;
  mimeType: string;
}) {
  const resultStat = await stat(input.path);
  const result: ResultFile = {
    id: `result_${crypto.randomUUID()}`,
    jobId: input.jobId,
    path: input.path,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: resultStat.size,
    createdAt: new Date().toISOString()
  };

  results.set(input.jobId, result);
  return result;
}

export function getResultFile(jobId: string) {
  return results.get(jobId) ?? null;
}

export async function readResultFile(jobId: string) {
  const result = getResultFile(jobId);
  if (!result) return null;

  return {
    result,
    bytes: await readFile(result.path)
  };
}

async function unlinkIfExists(filePath: string) {
  await unlink(filePath).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  });
}

export async function cleanupExpiredFiles(now = Date.now()) {
  const expiredUploadIds: string[] = [];
  const expiredResultIds: string[] = [];

  for (const [fileId, file] of uploads) {
    if (Date.parse(file.expiresAt) <= now) {
      await unlinkIfExists(file.path);
      expiredUploadIds.push(fileId);
    }
  }

  for (const [jobId, result] of results) {
    if (Date.parse(result.createdAt) + resultTtlMs <= now) {
      await unlinkIfExists(result.path);
      expiredResultIds.push(jobId);
    }
  }

  expiredUploadIds.forEach((fileId) => uploads.delete(fileId));
  expiredResultIds.forEach((jobId) => results.delete(jobId));

  return {
    uploads: expiredUploadIds.length,
    results: expiredResultIds.length
  };
}
