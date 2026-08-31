import {readFile, writeFile} from "node:fs/promises";
import {PDFDocument} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";

/**
 * Merges multiple PDFs by copying their pages into a single document. This is a
 * structural operation: pages are not re-encoded, so content and quality are
 * preserved.
 */
export async function mergePdfs(inputPaths: string[], outputPath: string) {
  const merged = await PDFDocument.create();

  try {
    for (const inputPath of inputPaths) {
      const bytes = await readFile(inputPath);
      const source = await PDFDocument.load(bytes, {ignoreEncryption: false});
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown merge error";
    throw new AppError(ErrorCode.processingFailed, `PDF merge failed: ${message}`, 422);
  }

  await writeFile(outputPath, await merged.save());
  return outputPath;
}
