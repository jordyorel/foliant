import {readFile, writeFile} from "node:fs/promises";
import {degrees, PDFDocument, type PDFPage} from "pdf-lib";
import {drawAnnotations, normalizePageOrder, normalizedRotation, type PdfEditorAnnotation} from "./reorder";

export type InsertPdfPagesOptions = {
  insertAfterPage?: number;
  pageAnnotations?: PdfEditorAnnotation[];
  pageOrder?: number[];
  pageRotations?: Record<string, number>;
};

function normalizeInsertAfterPage(value: unknown, pageCount: number) {
  if (value === undefined || value === null) return pageCount;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > pageCount) {
    throw new Error("Invalid insert position.");
  }

  return value;
}

export async function insertPdfPages(
  inputPaths: string[],
  outputPath: string,
  options: InsertPdfPagesOptions | number = {}
) {
  if (inputPaths.length < 2) {
    throw new Error("Insert pages requires at least two PDF files.");
  }

  const [sourcePath, ...insertPaths] = inputPaths;
  const source = await PDFDocument.load(await readFile(sourcePath), {ignoreEncryption: false}).catch((error: unknown) => {
    throw new Error(error instanceof Error ? error.message : "Unable to read PDF.");
  });
  const sourcePageCount = source.getPageCount();
  const insertOptions = typeof options === "number" ? {insertAfterPage: options} : options;
  const insertionPage = normalizeInsertAfterPage(insertOptions.insertAfterPage, sourcePageCount);
  const sourcePageIndexes = insertOptions.pageOrder
    ? normalizePageOrder(insertOptions.pageOrder, sourcePageCount)
    : Array.from({length: sourcePageCount}, (_, index) => index);
  const insertionIndex = Math.max(0, sourcePageIndexes.findIndex((pageIndex) => pageIndex + 1 === insertionPage) + 1);
  const output = await PDFDocument.create();
  const sourceEntries: Array<{page: PDFPage; sourcePageNumber: number}> = [];

  for (const sourcePageIndex of sourcePageIndexes) {
    const [page] = await output.copyPages(source, [sourcePageIndex]);
    const sourcePageNumber = sourcePageIndex + 1;
    const rotation = normalizedRotation(insertOptions.pageRotations?.[String(sourcePageNumber)]);

    if (rotation) {
      page.setRotation(degrees(((page.getRotation().angle + rotation) % 360) as 0 | 90 | 180 | 270));
    }

    sourceEntries.push({page, sourcePageNumber});
  }

  sourceEntries.slice(0, insertionIndex).forEach(({page}) => output.addPage(page));

  for (const insertPath of insertPaths) {
    const insertSource = await PDFDocument.load(await readFile(insertPath), {ignoreEncryption: false}).catch((error: unknown) => {
      throw new Error(error instanceof Error ? error.message : "Unable to read inserted PDF.");
    });
    const insertedPages = await output.copyPages(
      insertSource,
      Array.from({length: insertSource.getPageCount()}, (_, index) => index)
    );

    insertedPages.forEach((page) => output.addPage(page));
  }

  sourceEntries.slice(insertionIndex).forEach(({page}) => output.addPage(page));
  await Promise.all(sourceEntries.map(({page, sourcePageNumber}) => (
    drawAnnotations({
      annotations: insertOptions.pageAnnotations,
      output,
      page,
      sourcePageNumber
    })
  )));
  await writeFile(outputPath, await output.save());

  return outputPath;
}
