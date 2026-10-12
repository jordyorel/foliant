import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {limitRequest} from "@/lib/validation/rate-limit";
import {readLimitedJson} from "@/lib/validation/body";
import {canAccessGuestJob, createJob, getJob, publicJob, type JobOptions} from "@/lib/jobs";
import {guestSessionId, withGuestSession} from "@/lib/studio/guest-session";
import {
  createTemporaryFile,
  hasTemporaryFile,
  getTemporaryFile,
  readResultFile,
  readTemporaryFile,
  saveTemporaryFile
} from "@/lib/storage/local";
import {isBetaToolAction, type ToolAction} from "@/content/tools/actions";
import {ErrorCode, isAppError} from "@/lib/validation/errors";
import {validateUploadInit} from "@/lib/validation/uploads";
import {readWorkspaceDocumentFile} from "@/lib/workspace/documents";

const splitModes = new Set(["every_page", "interval", "range"]);
const rotateDegrees = new Set([90, 180, 270]);
const officeToPdfTools = new Set(["word_to_pdf", "excel_to_pdf", "powerpoint_to_pdf"]);
const pdfToOfficeTools = new Set(["pdf_to_word", "pdf_to_excel", "pdf_to_powerpoint"]);
const pageNumberPositions = new Set([
  "bottom_left",
  "bottom_center",
  "bottom_right",
  "top_left",
  "top_center",
  "top_right"
]);
const pageNumberFormats = new Set(["number", "page", "page_of_total"]);
const pageNumberColors = new Set(["#141412", "#334155", "#1d4ed8", "#047857", "#b45309", "#b91c1c", "#7e22ce"]);
const watermarkPositions = new Set(["center", "diagonal", "repeated"]);
const watermarkColors = new Set(["#141412", "#334155", "#1d4ed8", "#047857", "#b45309", "#b91c1c", "#7e22ce"]);
// `sign_pdf` uses the same PDF editor payload as `reorder_pdf`: page order,
// rotations, and annotations must therefore be validated identically.
const pageOrderTools = new Set(["reorder_pdf", "sign_pdf"]);
const annotationColors = new Set(["#141412", "#334155", "#1d4ed8", "#047857", "#b45309", "#b91c1c", "#7e22ce"]);
const annotationFonts = new Set(["sans", "serif", "mono"]);
const annotationAlignments = new Set(["left", "center", "right"]);
const signatureColors = new Set(["#141412", "#1d4ed8", "#047857"]);
const signatureStyles = new Set(["script", "elegant", "plain"]);

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {error, code: ErrorCode.invalidRequest},
    {status}
  );
}

function jsonCodedError(error: string, code: string, status: number) {
  return NextResponse.json({error, code}, {status});
}

function isNormalizedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function hasValidPageAnnotations(value: unknown) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 200) return false;

  return value.every((annotation) => {
    if (!annotation || typeof annotation !== "object" || Array.isArray(annotation)) return false;

    const item = annotation as Record<string, unknown>;

    return (
      (item.type === "text" || item.type === "signature") &&
      Number.isInteger(item.page) &&
      Number(item.page) >= 1 &&
      typeof item.text === "string" &&
      (item.type === "text" ? item.text.trim().length > 0 : (item.text.trim().length > 0 || (Array.isArray(item.signatureStrokes) && item.signatureStrokes.some((stroke) => Array.isArray(stroke) && stroke.length > 1)) || (typeof item.signatureImage === "string" && /^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(item.signatureImage)))) &&
      item.text.length <= 500 &&
      isNormalizedNumber(item.x) &&
      isNormalizedNumber(item.y) &&
      typeof item.width === "number" &&
      Number.isFinite(item.width) &&
      item.width > 0 &&
      item.width <= 1 &&
      typeof item.height === "number" &&
      Number.isFinite(item.height) &&
      item.height > 0 &&
      item.height <= 1 &&
      (item.rotation === undefined || (typeof item.rotation === "number" && Number.isFinite(item.rotation) && item.rotation >= -180 && item.rotation <= 180)) &&
      (item.bold === undefined || typeof item.bold === "boolean") &&
      (item.fontFamily === undefined || (typeof item.fontFamily === "string" && annotationFonts.has(item.fontFamily))) &&
      (item.fontSize === undefined || (typeof item.fontSize === "number" && Number.isFinite(item.fontSize) && item.fontSize >= 8 && item.fontSize <= 48)) &&
      (item.textAlign === undefined || (typeof item.textAlign === "string" && annotationAlignments.has(item.textAlign))) &&
      (item.textColor === undefined || (typeof item.textColor === "string" && annotationColors.has(item.textColor))) &&
      (item.signatureColor === undefined || (typeof item.signatureColor === "string" && signatureColors.has(item.signatureColor))) &&
      (item.signatureStyle === undefined || (typeof item.signatureStyle === "string" && signatureStyles.has(item.signatureStyle))) &&
      (item.signatureImage === undefined || (typeof item.signatureImage === "string" && item.signatureImage.length <= 220_000 && /^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(item.signatureImage)))
    );
  });
}

function hasValidFormValues(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.entries(value).length <= 100 && Object.entries(value).every(([name, fieldValue]) => (
    name.length > 0 && name.length <= 200 &&
    (typeof fieldValue === "boolean" || (typeof fieldValue === "string" && fieldValue.length <= 2_000))
  ));
}

type SourceJobFile = {
  bytes: Buffer;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

async function readSourceJobFile(input: {sourceJobId: string; source: "input" | "result"}) {
  if (input.source === "input") {
    const job = getJob(input.sourceJobId);
    const sourceFileId = job?.fileIds[0];

    if (!sourceFileId) return null;

    const sourceFile = await readTemporaryFile(sourceFileId);
    if (!sourceFile) return null;

    return {
      bytes: sourceFile.bytes,
      fileName: sourceFile.file.fileName,
      fileSize: sourceFile.file.fileSize,
      mimeType: sourceFile.file.mimeType
    } satisfies SourceJobFile;
  }

  const result = await readResultFile(input.sourceJobId);
  if (!result) return null;

  return {
    bytes: result.bytes,
    fileName: result.result.fileName,
    fileSize: result.result.size,
    mimeType: result.result.mimeType
  } satisfies SourceJobFile;
}

async function createFileFromSourceJob(input: {sourceJobId: string; source: "input" | "result"; tool: ToolAction}) {
  const sourceFile = await readSourceJobFile({
    sourceJobId: input.sourceJobId,
    source: input.source
  });

  if (!sourceFile) {
    return {
      ok: false as const,
      response: jsonCodedError("Source file not found", ErrorCode.resultNotFound, 404)
    };
  }

  const validation = validateUploadInit({
    tool: input.tool,
    fileName: sourceFile.fileName,
    fileSize: sourceFile.fileSize,
    mimeType: sourceFile.mimeType
  }, {allowStudioOnly: true});

  if (!validation.ok) {
    return {
      ok: false as const,
      response: jsonCodedError(validation.error, validation.code, validation.status)
    };
  }

  const file = createTemporaryFile({
    fileName: sourceFile.fileName,
    fileSize: sourceFile.fileSize,
    mimeType: sourceFile.mimeType,
    tool: input.tool,
    maxSize: validation.maxSize
  });

  await saveTemporaryFile(
    file.id,
    sourceFile.bytes.buffer.slice(sourceFile.bytes.byteOffset, sourceFile.bytes.byteOffset + sourceFile.bytes.byteLength)
  );

  return {ok: true as const, fileId: file.id};
}

async function createFileFromWorkspaceDocument(input: {workspaceDocumentId: string; tool: ToolAction; userId: string | undefined}) {
  const workspaceFile = await readWorkspaceDocumentFile(input.workspaceDocumentId, input.userId);

  if (!workspaceFile) {
    return {
      ok: false as const,
      response: jsonCodedError("Workspace document not found", ErrorCode.resultNotFound, 404)
    };
  }

  const validation = validateUploadInit({
    tool: input.tool,
    fileName: workspaceFile.document.resultFileName,
    fileSize: workspaceFile.document.resultSize,
    mimeType: workspaceFile.document.resultMimeType
  }, {allowStudioOnly: true});

  if (!validation.ok) {
    return {
      ok: false as const,
      response: jsonCodedError(validation.error, validation.code, validation.status)
    };
  }

  const file = createTemporaryFile({
    fileName: workspaceFile.document.resultFileName,
    fileSize: workspaceFile.document.resultSize,
    mimeType: workspaceFile.document.resultMimeType,
    tool: input.tool,
    maxSize: validation.maxSize
  });

  await saveTemporaryFile(
    file.id,
    workspaceFile.bytes.buffer.slice(workspaceFile.bytes.byteOffset, workspaceFile.bytes.byteOffset + workspaceFile.bytes.byteLength)
  );

  return {ok: true as const, fileId: file.id};
}

export async function POST(request: Request) {
  const limited = limitRequest(request, "job");
  if (limited) return limited;
  const body = await readLimitedJson(request).catch(() => null);

  if (!body?.tool) {
    return jsonError("Invalid job request", 400);
  }

  const tool = body.tool as ToolAction;
  // Signature is deliberately Studio-only for now: it needs a placed annotation, not a public one-click upload.
  if ((!isBetaToolAction(tool) && tool !== "sign_pdf" && tool !== "fill_pdf") || tool === "auto") {
    return jsonCodedError("Unsupported tool", ErrorCode.unsupportedTool, 400);
  }
  const sessionId = guestSessionId(request) ?? crypto.randomUUID();
  if (typeof body.sourceJobId === "string" && !canAccessGuestJob(getJob(body.sourceJobId), sessionId)) {
    return jsonCodedError("Source file not found", ErrorCode.resultNotFound, 404);
  }
  if (Array.isArray(body.fileIds) && body.fileIds.some((id: unknown) => {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) return true;
    const file = getTemporaryFile(id);
    return !file || file.guestSessionId !== sessionId || Date.parse(file.expiresAt) <= Date.now();
  })) {
    return jsonCodedError("Uploaded file not found", ErrorCode.uploadNotFound, 404);
  }
  let fileIds = Array.isArray(body.fileIds) ? body.fileIds : [];

  if (typeof body.sourceJobId === "string") {
    const uploadedFileIds = (tool === "insert_pdf_pages" || tool === "merge_pdf") && Array.isArray(body.fileIds) ? body.fileIds : [];
    const source = await createFileFromSourceJob({
      sourceJobId: body.sourceJobId,
      source: body.source === "input" ? "input" : "result",
      tool
    });

    if (!source.ok) return source.response;
    fileIds = [source.fileId, ...uploadedFileIds];
  }

  let workspaceUserId: string | undefined;
  if (typeof body.workspaceDocumentId === "string") {
    workspaceUserId = (await getCurrentUser(request))?.id;
    const uploadedFileIds = (tool === "insert_pdf_pages" || tool === "merge_pdf") && Array.isArray(body.fileIds) ? body.fileIds : [];
    const source = await createFileFromWorkspaceDocument({
      userId: workspaceUserId,
      workspaceDocumentId: body.workspaceDocumentId,
      tool
    });

    if (!source.ok) return source.response;
    fileIds = [source.fileId, ...uploadedFileIds];
  }

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return jsonError("Invalid job request", 400);
  }

  const hasMissingFile = fileIds.some((fileId: unknown) => (
    typeof fileId !== "string" || !hasTemporaryFile(fileId)
  ));

  if (hasMissingFile) {
    return NextResponse.json(
      {error: "Uploaded file not found", code: ErrorCode.uploadNotFound},
      {status: 404}
    );
  }

  if (body.tool === "merge_pdf" && fileIds.length < 2) {
    return jsonError("Merge requires at least two files", 400);
  }

  const options: JobOptions = typeof body.options === "object" && body.options !== null ? body.options : {};

  if (body.tool === "fill_pdf" && !hasValidFormValues(options.formValues)) {
    return jsonError("Invalid form values", 400);
  }

  if (body.tool === "image_to_pdf" && fileIds.length > 20) {
    return jsonError("Image to PDF is limited to 20 images in this version", 400);
  }

  if (body.tool === "heic_to_jpg" || body.tool === "heic_to_png") {
    if (fileIds.length !== 1) {
      return jsonError("This tool requires exactly one image", 400);
    }
  }

  if (body.tool === "markdown_to_pdf" && fileIds.length !== 1) {
    return jsonError("Markdown to PDF requires exactly one file", 400);
  }

  if (officeToPdfTools.has(body.tool) && fileIds.length !== 1) {
    return jsonError("Office to PDF requires exactly one file", 400);
  }

  if (body.tool === "pdf_to_image") {
    if (fileIds.length !== 1) {
      return jsonError("PDF to image requires exactly one PDF", 400);
    }

    const format = options.pdfToImageFormat ?? "jpg";
    if (format !== "jpg" && format !== "png") {
      return jsonError("Unsupported image format", 400);
    }

    if (options.pdfToImageDpi !== undefined && (!Number.isInteger(options.pdfToImageDpi) || options.pdfToImageDpi < 72 || options.pdfToImageDpi > 300)) {
      return jsonError("Image resolution must be between 72 and 300 DPI", 400);
    }
  }

  if (pdfToOfficeTools.has(body.tool) && fileIds.length !== 1) {
    return jsonError("PDF to Office requires exactly one PDF", 400);
  }

  if (body.tool === "rotate_pdf") {
    if (fileIds.length !== 1) {
      return jsonError("Rotate PDF requires exactly one PDF", 400);
    }

    if (
      typeof options.rotateDegrees !== "number" ||
      !rotateDegrees.has(options.rotateDegrees)
    ) {
      return jsonError("Unsupported rotation angle", 400);
    }

    if (
      options.pageRange !== undefined &&
      (typeof options.pageRange !== "string" || options.pageRange.trim().length === 0)
    ) {
      return jsonError("Invalid page range", 400);
    }
  }

  if (pageOrderTools.has(body.tool)) {
    if (fileIds.length !== 1) {
      return jsonError("Reorder PDF requires exactly one PDF", 400);
    }

    if (options.pageOrder !== undefined && (
      !Array.isArray(options.pageOrder) ||
      options.pageOrder.length === 0 ||
      options.pageOrder.some((page) => !Number.isInteger(page) || page < 1)
    )) {
      return jsonError("Invalid page order", 400);
    }

    if (
      options.pageRotations !== undefined &&
      (
        typeof options.pageRotations !== "object" ||
        options.pageRotations === null ||
        Array.isArray(options.pageRotations) ||
        Object.values(options.pageRotations).some((rotation) => rotation !== 90 && rotation !== 180 && rotation !== 270)
      )
    ) {
      return jsonError("Invalid page rotations", 400);
    }

    if (!hasValidPageAnnotations(options.pageAnnotations)) {
      return jsonError("Invalid page annotations", 400);
    }
  }

  if (body.tool === "insert_pdf_pages") {
    if (fileIds.length < 2) {
      return jsonError("Insert pages requires a source PDF and at least one inserted PDF", 400);
    }

    if (
      options.insertAfterPage !== undefined &&
      (
        typeof options.insertAfterPage !== "number" ||
        !Number.isInteger(options.insertAfterPage) ||
        options.insertAfterPage < 0
      )
    ) {
      return jsonError("Invalid insert position", 400);
    }

    if (
      options.pageOrder !== undefined &&
      (
        !Array.isArray(options.pageOrder) ||
        options.pageOrder.length === 0 ||
        options.pageOrder.some((page) => !Number.isInteger(page) || page < 1)
      )
    ) {
      return jsonError("Invalid page order", 400);
    }

    if (
      options.pageRotations !== undefined &&
      (
        typeof options.pageRotations !== "object" ||
        options.pageRotations === null ||
        Array.isArray(options.pageRotations) ||
        Object.values(options.pageRotations).some((rotation) => rotation !== 90 && rotation !== 180 && rotation !== 270)
      )
    ) {
      return jsonError("Invalid page rotations", 400);
    }

    if (!hasValidPageAnnotations(options.pageAnnotations)) {
      return jsonError("Invalid page annotations", 400);
    }
  }

  if (body.tool === "extract_pdf_pages" || body.tool === "delete_pdf_pages") {
    if (fileIds.length !== 1) {
      return jsonError("This tool requires exactly one PDF", 400);
    }

    if (
      typeof options.pageRange !== "string" ||
      options.pageRange.trim().length === 0
    ) {
      return jsonError("Invalid page range", 400);
    }
  }

  if (body.tool === "number_pdf_pages") {
    if (fileIds.length !== 1) {
      return jsonError("Number pages requires exactly one PDF", 400);
    }

    const position = options.pageNumberPosition ?? "bottom_center";
    if (!pageNumberPositions.has(position)) {
      return jsonError("Unsupported page number position", 400);
    }

    if (
      typeof options.pageNumberStartPage === "number" &&
      (!Number.isInteger(options.pageNumberStartPage) || options.pageNumberStartPage < 1)
    ) {
      return jsonError("Invalid page number start page", 400);
    }

    if (
      typeof options.pageNumberStartNumber === "number" &&
      (!Number.isInteger(options.pageNumberStartNumber) || options.pageNumberStartNumber < 0)
    ) {
      return jsonError("Invalid page number start number", 400);
    }

    if (options.pageNumberFormat !== undefined && !pageNumberFormats.has(options.pageNumberFormat)) {
      return jsonError("Unsupported page number format", 400);
    }

    if (options.pageNumberColor !== undefined && !pageNumberColors.has(options.pageNumberColor)) {
      return jsonError("Unsupported page number color", 400);
    }

    if (
      typeof options.pageNumberFontSize === "number" &&
      (!Number.isInteger(options.pageNumberFontSize) || options.pageNumberFontSize < 8 || options.pageNumberFontSize > 48)
    ) {
      return jsonError("Invalid page number font size", 400);
    }

    if (
      typeof options.pageNumberMargin === "number" &&
      (!Number.isInteger(options.pageNumberMargin) || options.pageNumberMargin < 12 || options.pageNumberMargin > 96)
    ) {
      return jsonError("Invalid page number margin", 400);
    }
  }

  if (body.tool === "watermark_pdf") {
    if (fileIds.length !== 1) {
      return jsonError("Watermark requires exactly one PDF", 400);
    }

    if (
      typeof options.watermarkText !== "string" ||
      options.watermarkText.trim().length === 0
    ) {
      return jsonError("Watermark text is required", 400);
    }

    const position = options.watermarkPosition ?? "center";
    if (!watermarkPositions.has(position)) {
      return jsonError("Unsupported watermark position", 400);
    }

    if (
      typeof options.watermarkOpacity === "number" &&
      (!Number.isFinite(options.watermarkOpacity) || options.watermarkOpacity <= 0 || options.watermarkOpacity > 1)
    ) {
      return jsonError("Invalid watermark opacity", 400);
    }

    if (options.watermarkColor !== undefined && (typeof options.watermarkColor !== "string" || !watermarkColors.has(options.watermarkColor))) {
      return jsonError("Invalid watermark color", 400);
    }

    if (options.watermarkFontSize !== undefined && (
      typeof options.watermarkFontSize !== "number" || !Number.isFinite(options.watermarkFontSize) || options.watermarkFontSize < 8 || options.watermarkFontSize > 120
    )) {
      return jsonError("Invalid watermark font size", 400);
    }
  }

  if (body.tool === "protect_pdf" || body.tool === "unlock_pdf") {
    if (fileIds.length !== 1) {
      return jsonError("This tool requires exactly one PDF", 400);
    }

    if (
      typeof options.pdfPassword !== "string" ||
      options.pdfPassword.trim().length === 0
    ) {
      return jsonError("PDF password is required", 400);
    }
  }

  if (body.tool === "split_pdf") {
    if (fileIds.length !== 1) {
      return jsonError("Split requires exactly one PDF", 400);
    }

    const mode = options.splitMode ?? "every_page";
    if (!splitModes.has(mode)) {
      return jsonError("Unsupported split mode", 400);
    }

    if (mode === "interval" && (
      typeof options.splitInterval !== "number" ||
      !Number.isInteger(options.splitInterval) ||
      options.splitInterval < 1 ||
      options.splitInterval > 500
    )) {
      return jsonError("Invalid split interval", 400);
    }

    if (mode === "range" && (
      typeof options.pageRange !== "string" ||
      options.pageRange.trim().length === 0
    )) {
      return jsonError("Invalid page range", 400);
    }
  }

  if (typeof body.sourceJobId === "string" && !canAccessGuestJob(getJob(body.sourceJobId), sessionId)) {
    return jsonCodedError("Source file not found", ErrorCode.resultNotFound, 404);
  }

  try {
    const job = createJob({
      workspaceDocumentId: workspaceUserId && typeof body.workspaceDocumentId === "string" ? body.workspaceDocumentId : undefined,
      workspaceUserId,
      guestSessionId: sessionId,
      guestChainId: typeof body.sourceJobId === "string" ? (getJob(body.sourceJobId)?.guestChainId ?? body.sourceJobId) : undefined,
      tool,
      fileIds: fileIds as string[],
      options
    });

    return withGuestSession(request, sessionId, publicJob(job));
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.serverBusy) {
      const response = jsonCodedError(error.message, error.code, 503);
      response.headers.set("Retry-After", "10");
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    throw error;
  }
}
