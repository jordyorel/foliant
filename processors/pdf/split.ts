import {readFile, writeFile} from "node:fs/promises";
import JSZip from "jszip";
import {PDFDocument} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";

export type SplitMode = "every_page" | "interval" | "range";

export type SplitPdfOptions = {
  mode?: SplitMode;
  interval?: number;
  pageRange?: string;
};

function padPage(page: number) {
  return String(page).padStart(3, "0");
}

function assertPage(page: number, pageCount: number) {
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw new AppError(ErrorCode.invalidRequest, "Page range is outside the PDF page count.", 400);
  }
}

export function parsePageRange(input: string, pageCount: number) {
  const pages: number[] = [];
  const seen = new Set<number>();

  for (const rawPart of input.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^\d+$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (end < start) {
        throw new AppError(ErrorCode.invalidRequest, "Page range end must be after the start.", 400);
      }
      assertPage(start, pageCount);
      assertPage(end, pageCount);

      for (let page = start; page <= end; page += 1) {
        if (!seen.has(page)) {
          pages.push(page);
          seen.add(page);
        }
      }
    } else if (singleMatch) {
      const page = Number(part);
      assertPage(page, pageCount);
      if (!seen.has(page)) {
        pages.push(page);
        seen.add(page);
      }
    } else {
      throw new AppError(ErrorCode.invalidRequest, "Page range format is invalid.", 400);
    }
  }

  if (pages.length === 0) {
    throw new AppError(ErrorCode.invalidRequest, "At least one page must be selected.", 400);
  }

  return pages;
}

async function buildPdf(source: PDFDocument, pageIndexes: number[]) {
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, pageIndexes);
  pages.forEach((page) => output.addPage(page));
  return output.save();
}

export async function splitPdf(inputPath: string, outputPath: string, options: SplitPdfOptions = {}) {
  const bytes = await readFile(inputPath);
  const source = await PDFDocument.load(bytes, {ignoreEncryption: false}).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown PDF split error";
    throw new AppError(ErrorCode.processingFailed, `PDF split failed: ${message}`, 422);
  });
  const pageCount = source.getPageCount();
  const zip = new JSZip();
  const mode = options.mode ?? "every_page";

  if (mode === "interval") {
    const interval = Math.max(1, Math.floor(options.interval ?? 1));

    for (let start = 0; start < pageCount; start += interval) {
      const end = Math.min(start + interval, pageCount);
      const pageIndexes = Array.from({length: end - start}, (_, index) => start + index);
      const name = `pages-${padPage(start + 1)}-${padPage(end)}.pdf`;
      zip.file(name, await buildPdf(source, pageIndexes));
    }
  } else if (mode === "range") {
    const pageIndexes = parsePageRange(options.pageRange ?? "", pageCount).map((page) => page - 1);
    zip.file("selected-pages.pdf", await buildPdf(source, pageIndexes));
  } else {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      zip.file(`page-${padPage(pageIndex + 1)}.pdf`, await buildPdf(source, [pageIndex]));
    }
  }

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE"
  });

  await writeFile(outputPath, archive);
  return outputPath;
}
