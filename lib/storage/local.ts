import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {mkdir, readFile, readdir, stat, unlink, writeFile} from "node:fs/promises";
import path from "node:path";
import {storageRoot} from "./root";
import type {ToolAction} from "@/content/tools/actions";
import {AppError, ErrorCode} from "@/lib/validation/errors";
import {expectedKindsFor, type FileKind} from "@/lib/validation/uploads";

export type StoredFile = {
  guestSessionId?: string;
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
const processState = globalThis as typeof globalThis & {foliantFileLeases?: Map<string, string[]>};
const leases = processState.foliantFileLeases ??= new Map<string, string[]>();

export function retainJobFiles(jobId: string, fileIds: string[]) {
  leases.set(jobId, [...fileIds]);
  return () => {leases.delete(jobId);};
}

function uploadInUse(fileId: string) {
  return [...leases.values()].some(ids => ids.includes(fileId));
}

const uploadRoot = path.join(storageRoot, "uploads");
const resultRoot = path.join(storageRoot, "results");
const uploadMetaRoot = path.join(uploadRoot, "_meta");
const resultMetaRoot = path.join(resultRoot, "_meta");
const uploadTtlMs = 15 * 60 * 1000;
export const resultTtlMs = 6 * 60 * 60 * 1000;

export async function ensureStorageDirs() {
  await mkdir(uploadRoot, {recursive: true});
  await mkdir(resultRoot, {recursive: true});
  await mkdir(uploadMetaRoot, {recursive: true});
  await mkdir(resultMetaRoot, {recursive: true});
}

function ensureStorageDirsSync() {
  mkdirSync(uploadRoot, {recursive: true});
  mkdirSync(resultRoot, {recursive: true});
  mkdirSync(uploadMetaRoot, {recursive: true});
  mkdirSync(resultMetaRoot, {recursive: true});
}

function safeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension || ".bin";
}

function uploadMetadataPath(fileId: string) {
  return path.join(uploadMetaRoot, `${fileId}.json`);
}

function resultMetadataPath(jobId: string) {
  return path.join(resultMetaRoot, `${jobId}.json`);
}

function isStoredFile(value: unknown): value is StoredFile {
  if (!value || typeof value !== "object") return false;
  const file = value as StoredFile;

  return (
    typeof file.id === "string" &&
    typeof file.uploadId === "string" &&
    typeof file.fileName === "string" &&
    typeof file.fileSize === "number" &&
    typeof file.mimeType === "string" &&
    typeof file.tool === "string" &&
    typeof file.maxSize === "number" &&
    typeof file.path === "string" &&
    typeof file.createdAt === "string" &&
    typeof file.expiresAt === "string"
  );
}

function isResultFile(value: unknown): value is ResultFile {
  if (!value || typeof value !== "object") return false;
  const result = value as ResultFile;

  return (
    typeof result.id === "string" &&
    typeof result.jobId === "string" &&
    typeof result.path === "string" &&
    typeof result.fileName === "string" &&
    typeof result.mimeType === "string" &&
    typeof result.size === "number" &&
    typeof result.createdAt === "string"
  );
}

function readJsonSync<T>(filePath: string, guard: (value: unknown) => value is T) {
  if (!existsSync(filePath)) return null;

  try {
    const value = JSON.parse(readFileSync(filePath, "utf8"));
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

function persistTemporaryFileMetadata(file: StoredFile) {
  ensureStorageDirsSync();
  writeFileSync(uploadMetadataPath(file.id), JSON.stringify(file), "utf8");
}

function persistResultFileMetadata(result: ResultFile) {
  ensureStorageDirsSync();
  writeFileSync(resultMetadataPath(result.jobId), JSON.stringify(result), "utf8");
}

async function hydrateUploadMetadata() {
  await ensureStorageDirs();
  const entries = await readdir(uploadMetaRoot).catch(() => []);

  await Promise.all(entries.map(async (entry) => {
    if (!entry.endsWith(".json")) return;

    try {
      const value = JSON.parse(await readFile(path.join(uploadMetaRoot, entry), "utf8"));
      if (isStoredFile(value)) uploads.set(value.id, value);
    } catch {
      // Ignore corrupted metadata; cleanup can remove its files later.
    }
  }));
}

async function hydrateResultMetadata() {
  await ensureStorageDirs();
  const entries = await readdir(resultMetaRoot).catch(() => []);

  await Promise.all(entries.map(async (entry) => {
    if (!entry.endsWith(".json")) return;

    try {
      const value = JSON.parse(await readFile(path.join(resultMetaRoot, entry), "utf8"));
      if (isResultFile(value)) results.set(value.jobId, value);
    } catch {
      // Ignore corrupted metadata; cleanup can remove its files later.
    }
  }));
}

export function createTemporaryFile(input: {
  guestSessionId?: string;
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
    guestSessionId: input.guestSessionId,
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
  persistTemporaryFileMetadata(storedFile);
  return storedFile;
}

export function hasTemporaryFile(fileId: string) {
  return getTemporaryFile(fileId) !== null;
}

export function getTemporaryFile(fileId: string) {
  const cached = uploads.get(fileId);
  if (cached) return cached;

  const storedFile = readJsonSync(uploadMetadataPath(fileId), isStoredFile);
  if (!storedFile) return null;

  uploads.set(fileId, storedFile);
  return storedFile;
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
  persistTemporaryFileMetadata(savedFile);
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
  persistResultFileMetadata(result);
  return result;
}

export function getResultFile(jobId: string) {
  const cached = results.get(jobId);
  if (cached) return cached;

  const result = readJsonSync(resultMetadataPath(jobId), isResultFile);
  if (!result) return null;

  results.set(jobId, result);
  return result;
}

export async function readResultFile(jobId: string) {
  const result = getResultFile(jobId);
  if (!result || Date.parse(result.createdAt) + resultTtlMs <= Date.now()) return null;

  try {
    return {
      result,
      bytes: await readFile(result.path)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readTemporaryFile(fileId: string) {
  const file = getTemporaryFile(fileId);
  if (!file || Date.parse(file.expiresAt) <= Date.now()) return null;

  try {
    return {
      file,
      bytes: await readFile(file.path)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function unlinkIfExists(filePath: string) {
  await unlink(filePath).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  });
}

export async function deleteTemporaryResult(jobId: string) {
  const result = getResultFile(jobId);
  if (!result) return;
  await unlinkIfExists(result.path);
  await unlinkIfExists(resultMetadataPath(jobId));
  results.delete(jobId);
}

export async function cleanupExpiredFiles(now = Date.now()) {
  await hydrateUploadMetadata();
  await hydrateResultMetadata();

  const expiredUploadIds: string[] = [];
  const expiredResultIds: string[] = [];

  for (const [fileId, file] of uploads) {
    if (Date.parse(file.expiresAt) <= now && !uploadInUse(fileId)) {
      await unlinkIfExists(file.path);
      await unlinkIfExists(uploadMetadataPath(fileId));
      expiredUploadIds.push(fileId);
    }
  }

  for (const [jobId, result] of results) {
    if (Date.parse(result.createdAt) + resultTtlMs <= now && !leases.has(jobId)) {
      await unlinkIfExists(result.path);
      await unlinkIfExists(resultMetadataPath(jobId));
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

export async function cleanupOrphanResults(now = Date.now()) {
  await ensureStorageDirs();
  let removed = 0;
  for (const entry of await readdir(resultRoot, {withFileTypes: true})) {
    const match = /^(job_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.[a-z0-9]+$/.exec(entry.name);
    if (!entry.isFile() || !match) continue;
    const jobId = match[1];
    const filePath = path.join(resultRoot, entry.name);
    const info = await stat(filePath).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    });
    // Leave registered results (including corrupt metadata) to normal retention.
    if (!info || info.mtimeMs + resultTtlMs > now || leases.has(jobId) || existsSync(resultMetadataPath(jobId))) continue;
    await unlinkIfExists(filePath);
    removed++;
  }
  return removed;
}
