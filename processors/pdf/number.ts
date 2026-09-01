import {readFile, writeFile} from "node:fs/promises";
import {PDFDocument, rgb, StandardFonts} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";

export type PageNumberPosition =
  | "bottom_left"
  | "bottom_center"
  | "bottom_right"
  | "top_left"
  | "top_center"
  | "top_right";

export type NumberPdfPagesOptions = {
  position?: PageNumberPosition;
  /** 1-based physical page where numbering starts (default 1, set 2 to skip a cover). */
  startPage?: number;
  /** Number printed on the first numbered page (default 1). */
  startNumber?: number;
};

const FONT_SIZE = 11;
const MARGIN = 36;

function resolvePosition(position?: PageNumberPosition): PageNumberPosition {
  return position ?? "bottom_center";
}

function pageNumberOrigin(
  position: PageNumberPosition,
  width: number,
  height: number,
  textWidth: number
) {
  const topY = height - MARGIN - FONT_SIZE;
  const bottomY = MARGIN;

  switch (position) {
    case "top_left":
      return {x: MARGIN, y: topY};
    case "top_center":
      return {x: (width - textWidth) / 2, y: topY};
    case "top_right":
      return {x: width - MARGIN - textWidth, y: topY};
    case "bottom_left":
      return {x: MARGIN, y: bottomY};
    case "bottom_right":
      return {x: width - MARGIN - textWidth, y: bottomY};
    case "bottom_center":
    default:
      return {x: (width - textWidth) / 2, y: bottomY};
  }
}

export async function numberPdfDocument(doc: PDFDocument, options: NumberPdfPagesOptions = {}) {
  const position = resolvePosition(options.position);
  const startPage = Math.max(1, Math.floor(options.startPage ?? 1));
  const startNumber = Math.max(0, Math.floor(options.startNumber ?? 1));
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const pages = doc.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    const physicalPage = index + 1;
    if (physicalPage < startPage) continue;

    const label = String(startNumber + (physicalPage - startPage));
    const textWidth = font.widthOfTextAtSize(label, FONT_SIZE);
    const page = pages[index];
    const {width, height} = page.getSize();
    const {x, y} = pageNumberOrigin(position, width, height, textWidth);

    // Note: positions are relative to the unrotated page coordinate space.
    page.drawText(label, {x, y, size: FONT_SIZE, font, color: rgb(0.25, 0.25, 0.25)});
  }
}

export async function numberPdfPages(
  inputPath: string,
  outputPath: string,
  options: NumberPdfPagesOptions = {}
) {
  const bytes = await readFile(inputPath);
  const doc = await PDFDocument.load(bytes, {ignoreEncryption: false}).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown PDF numbering error";
    throw new AppError(ErrorCode.processingFailed, `PDF numbering failed: ${message}`, 422);
  });

  await numberPdfDocument(doc, options);
  await writeFile(outputPath, await doc.save());
  return outputPath;
}
