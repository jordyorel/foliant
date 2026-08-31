import {toolActions, type ToolAction} from "@/content/tools/actions";
import {ErrorCode} from "./errors";

const supportedTools = new Set<ToolAction>(["auto", ...Object.values(toolActions)]);

const defaultMaxSize = 25 * 1024 * 1024;

const maxSizeByTool: Partial<Record<ToolAction, number>> = {
  auto: defaultMaxSize,
  compress_pdf: defaultMaxSize,
  compress_image: 15 * 1024 * 1024,
  merge_pdf: 50 * 1024 * 1024,
  split_pdf: defaultMaxSize
};

const supportedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif"
]);

const pdfTools: ToolAction[] = ["compress_pdf", "merge_pdf", "split_pdf"];
const imageTools: ToolAction[] = ["compress_image", "image_to_pdf"];

function hasExtension(fileName: string, extensions: string[]) {
  const normalizedName = fileName.toLowerCase();
  return extensions.some((extension) => normalizedName.endsWith(extension));
}

export type UploadInitInput = {
  tool: ToolAction;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type ValidationResult =
  | {ok: true; value: UploadInitInput; maxSize: number}
  | {ok: false; error: string; code: string; status: number; maxSize?: number};

export type FileKind = "pdf" | "jpeg" | "png" | "heif";

/**
 * Content kinds a tool expects, used for magic-byte validation after the bytes
 * actually arrive. An empty array means "no content-level validation".
 */
export function expectedKindsFor(tool: ToolAction): FileKind[] {
  if (pdfTools.includes(tool)) return ["pdf"];
  if (imageTools.includes(tool)) return ["jpeg", "png", "heif"];
  return [];
}

export function validateUploadInit(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") {
    return {ok: false, error: "Invalid upload request", code: ErrorCode.invalidRequest, status: 400};
  }

  const body = input as Record<string, unknown>;
  const tool = body.tool;
  const fileName = body.fileName;
  const fileSize = body.fileSize;
  const mimeType = body.mimeType;

  if (
    typeof tool !== "string" ||
    typeof fileName !== "string" ||
    typeof fileSize !== "number" ||
    typeof mimeType !== "string"
  ) {
    return {ok: false, error: "Invalid upload request", code: ErrorCode.invalidRequest, status: 400};
  }

  if (!supportedTools.has(tool as ToolAction)) {
    return {ok: false, error: "Unsupported tool", code: ErrorCode.unsupportedTool, status: 400};
  }

  const maxSize = maxSizeByTool[tool as ToolAction] ?? defaultMaxSize;

  if (fileSize > maxSize) {
    return {ok: false, error: "File too large", code: ErrorCode.fileTooLarge, status: 413, maxSize};
  }

  if (
    pdfTools.includes(tool as ToolAction) &&
    mimeType !== "application/pdf" &&
    !hasExtension(fileName, [".pdf"])
  ) {
    return {ok: false, error: "Unsupported file type", code: ErrorCode.unsupportedType, status: 415};
  }

  if (
    imageTools.includes(tool as ToolAction) &&
    !supportedImageMimeTypes.has(mimeType) &&
    !hasExtension(fileName, [".jpg", ".jpeg", ".png", ".heic", ".heif"])
  ) {
    return {ok: false, error: "Unsupported file type", code: ErrorCode.unsupportedType, status: 415};
  }

  return {
    ok: true,
    maxSize,
    value: {
      tool: tool as ToolAction,
      fileName,
      fileSize,
      mimeType
    }
  };
}
