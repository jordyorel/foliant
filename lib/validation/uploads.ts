import {toolActions, isBetaToolAction, type ToolAction} from "@/content/tools/actions";
import {ErrorCode} from "./errors";
import {maxUploadBytes} from "@/content/tools/upload-limits";

const supportedTools = new Set<ToolAction>(["auto", ...Object.values(toolActions).filter(isBetaToolAction)]);
const studioOnlyTools = new Set<ToolAction>(["fill_pdf", "sign_pdf"]);


const supportedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif"
]);

const pdfTools: ToolAction[] = [
  "compress_pdf",
  "merge_pdf",
  "split_pdf",
  "pdf_to_word",
  "pdf_to_excel",
  "pdf_to_powerpoint",
  "pdf_to_image",
  "reorder_pdf",
  "delete_pdf_pages",
  "extract_pdf_pages",
  "rotate_pdf",
  "insert_pdf_pages",
  "watermark_pdf",
  "number_pdf_pages",
  "add_text_pdf",
  "fill_pdf",
  "sign_pdf",
  "protect_pdf",
  "unlock_pdf",
  "ocr_pdf",
  "pdf_translator"
];
const imageTools: ToolAction[] = [
  "compress_image",
  "image_to_pdf",
  "heic_to_jpg",
  "heic_to_png",
  "image_to_text"
];
const markdownTools: ToolAction[] = ["markdown_to_pdf"];
const officeTools: Partial<Record<ToolAction, {extensions: string[]; mimeTypes: Set<string>}>> = {
  word_to_pdf: {
    extensions: [".doc", ".docx"],
    mimeTypes: new Set([
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ])
  },
  excel_to_pdf: {
    extensions: [".xls", ".xlsx"],
    mimeTypes: new Set([
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ])
  },
  powerpoint_to_pdf: {
    extensions: [".ppt", ".pptx"],
    mimeTypes: new Set([
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ])
  }
};

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

export function validateUploadInit(input: unknown, options: {allowStudioOnly?: boolean} = {}): ValidationResult {
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

  if (!supportedTools.has(tool as ToolAction) && !(options.allowStudioOnly && studioOnlyTools.has(tool as ToolAction))) {
    return {ok: false, error: "Unsupported tool", code: ErrorCode.unsupportedTool, status: 400};
  }

  const maxSize = maxUploadBytes(tool as ToolAction);

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

  if (
    markdownTools.includes(tool as ToolAction) &&
    mimeType !== "text/markdown" &&
    mimeType !== "text/plain" &&
    !hasExtension(fileName, [".md", ".markdown"])
  ) {
    return {ok: false, error: "Unsupported file type", code: ErrorCode.unsupportedType, status: 415};
  }

  const officeTool = officeTools[tool as ToolAction];
  if (
    officeTool &&
    !officeTool.mimeTypes.has(mimeType) &&
    !hasExtension(fileName, officeTool.extensions)
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
