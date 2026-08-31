import {NextResponse} from "next/server";
import {createJob, type JobOptions} from "@/lib/jobs";
import {hasTemporaryFile} from "@/lib/storage/local";
import type {ToolAction} from "@/content/tools/actions";
import {ErrorCode} from "@/lib/validation/errors";

const splitModes = new Set(["every_page", "interval", "range"]);

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
