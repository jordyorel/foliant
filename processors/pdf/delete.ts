import {readFile, writeFile} from "node:fs/promises";
import {PDFDocument} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";
import {parsePageRange} from "./page-range";

export async function deletePdfPages(inputPath: string, outputPath: string, pageRange: string) {
  const bytes = await readFile(inputPath);
  const doc = await PDFDocument.load(bytes, {ignoreEncryption: false}).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown PDF deletion error";
    throw new AppError(ErrorCode.processingFailed, `PDF deletion failed: ${message}`, 422);
  });

  const pageCount = doc.getPageCount();
  const pageNumbers = parsePageRange(pageRange, pageCount);

  if (pageNumbers.length >= pageCount) {
    throw new AppError(ErrorCode.invalidRequest, "Cannot delete all pages from the PDF.", 400);
  }

  const toDelete = new Set(pageNumbers.map((page) => page - 1));
  for (let index = pageCount - 1; index >= 0; index -= 1) {
    if (toDelete.has(index)) doc.removePage(index);
  }

  await writeFile(outputPath, await doc.save());
  return outputPath;
}
