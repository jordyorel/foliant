import {readFile, writeFile} from "node:fs/promises";
import {PDFDocument} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";
import {parsePageRange} from "./page-range";

export async function extractPdfPages(inputPath: string, outputPath: string, pageRange: string) {
  const bytes = await readFile(inputPath);
  const source = await PDFDocument.load(bytes, {ignoreEncryption: false}).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown PDF extraction error";
    throw new AppError(ErrorCode.processingFailed, `PDF extraction failed: ${message}`, 422);
  });

  const pageIndexes = parsePageRange(pageRange, source.getPageCount()).map((page) => page - 1);

  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, pageIndexes);
  pages.forEach((page) => output.addPage(page));

  await writeFile(outputPath, await output.save());
  return outputPath;
}
