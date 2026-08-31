import {readFile, writeFile} from "node:fs/promises";
import {PDFDocument} from "pdf-lib";
import sharp from "sharp";
import {AppError, ErrorCode} from "@/lib/validation/errors";

const maxPdfPageSide = 14400;

function scaleToPdfBounds(width: number, height: number) {
  const scale = Math.min(1, maxPdfPageSide / width, maxPdfPageSide / height);
  return {
    width: Math.max(1, width * scale),
    height: Math.max(1, height * scale)
  };
}

async function normalizeImage(inputPath: string) {
  try {
    return await sharp(inputPath)
      .rotate()
      .flatten({background: "#ffffff"})
      .jpeg({quality: 92, mozjpeg: true})
      .toBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image conversion error";
    throw new AppError(ErrorCode.processingFailed, `Image to PDF failed: ${message}`, 422);
  }
}

export async function imageToPdf(inputPaths: string[], outputPath: string) {
  if (inputPaths.length === 0) {
    throw new AppError(ErrorCode.invalidRequest, "At least one image is required.", 400);
  }

  const pdf = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const normalized = await normalizeImage(inputPath);
    const embedded = await pdf.embedJpg(normalized);
    const size = scaleToPdfBounds(embedded.width, embedded.height);
    const page = pdf.addPage([size.width, size.height]);

    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height
    });
  }

  const bytes = await pdf.save();
  await writeFile(outputPath, bytes);
  return outputPath;
}
