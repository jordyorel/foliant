import {NextResponse} from "next/server";
import {createJob, type JobOptions} from "@/lib/jobs";
import {hasTemporaryFile} from "@/lib/storage/local";
import type {ToolAction} from "@/content/tools/actions";
import {ErrorCode} from "@/lib/validation/errors";

const splitModes = new Set(["every_page", "interval", "range"]);
const rotateDegrees = new Set([90, 180, 270]);
const pageNumberPositions = new Set([
  "bottom_left",
  "bottom_center",
  "bottom_right",
  "top_left",
  "top_center",
  "top_right"
]);
const watermarkPositions = new Set(["center", "diagonal", "repeated"]);

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {error, code: ErrorCode.invalidRequest},
    {status}
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.tool || !Array.isArray(body?.fileIds) || body.fileIds.length === 0) {
    return jsonError("Invalid job request", 400);
  }

  const hasMissingFile = body.fileIds.some((fileId: unknown) => (
    typeof fileId !== "string" || !hasTemporaryFile(fileId)
  ));

  if (hasMissingFile) {
    return NextResponse.json(
      {error: "Uploaded file not found", code: ErrorCode.uploadNotFound},
      {status: 404}
    );
  }

  if (body.tool === "merge_pdf" && body.fileIds.length < 2) {
    return jsonError("Merge requires at least two files", 400);
  }

  const options: JobOptions = typeof body.options === "object" && body.options !== null ? body.options : {};

  if (body.tool === "image_to_pdf" && body.fileIds.length > 20) {
    return jsonError("Image to PDF is limited to 20 images in this version", 400);
  }

  if (body.tool === "pdf_to_image") {
    if (body.fileIds.length !== 1) {
      return jsonError("PDF to image requires exactly one PDF", 400);
    }

    const format = options.pdfToImageFormat ?? "jpg";
    if (format !== "jpg" && format !== "png") {
      return jsonError("Unsupported image format", 400);
    }
  }

  if (body.tool === "rotate_pdf") {
    if (body.fileIds.length !== 1) {
      return jsonError("Rotate PDF requires exactly one PDF", 400);
    }

    if (
      typeof options.rotateDegrees !== "number" ||
      !rotateDegrees.has(options.rotateDegrees)
    ) {
      return jsonError("Unsupported rotation angle", 400);
    }
  }

  if (body.tool === "extract_pdf_pages" || body.tool === "delete_pdf_pages") {
    if (body.fileIds.length !== 1) {
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
    if (body.fileIds.length !== 1) {
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
  }

  if (body.tool === "watermark_pdf") {
    if (body.fileIds.length !== 1) {
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
  }

  if (body.tool === "protect_pdf" || body.tool === "unlock_pdf") {
    if (body.fileIds.length !== 1) {
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
    if (body.fileIds.length !== 1) {
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

  const job = createJob({
    tool: body.tool as ToolAction,
    fileIds: body.fileIds,
    options
  });

  return NextResponse.json(job);
}
