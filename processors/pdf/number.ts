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

export type PageNumberFormat = "number" | "page" | "page_of_total";

export type NumberPdfPagesOptions = {
  position?: PageNumberPosition;
  /** 1-based physical page where numbering starts (default 1, set 2 to skip a cover). */
  startPage?: number;
  /** Number printed on the first numbered page (default 1). */
  startNumber?: number;
  format?: PageNumberFormat;
  color?: string;
  fontSize?: number;
  margin?: number;
};

const DEFAULT_FONT_SIZE = 11;
const DEFAULT_MARGIN = 36;
const allowedColors = new Map([
  ["#141412", rgb(0.08, 0.08, 0.07)],
  ["#334155", rgb(0.2, 0.25, 0.33)],
  ["#1d4ed8", rgb(0.11, 0.31, 0.85)],
  ["#047857", rgb(0.02, 0.47, 0.34)],
  ["#b45309", rgb(0.71, 0.33, 0.04)],
  ["#b91c1c", rgb(0.73, 0.11, 0.11)],
  ["#7e22ce", rgb(0.49, 0.13, 0.81)]
]);

function resolvePosition(position?: PageNumberPosition): PageNumberPosition {
  return position ?? "bottom_center";
}

function pageNumberOrigin(
  position: PageNumberPosition,
  width: number,
  height: number,
  textWidth: number,
  fontSize: number,
  margin: number
) {
  const topY = height - margin - fontSize;
  const bottomY = margin;

  switch (position) {
    case "top_left":
      return {x: margin, y: topY};
    case "top_center":
      return {x: (width - textWidth) / 2, y: topY};
    case "top_right":
      return {x: width - margin - textWidth, y: topY};
    case "bottom_left":
      return {x: margin, y: bottomY};
    case "bottom_right":
      return {x: width - margin - textWidth, y: bottomY};
    case "bottom_center":
    default:
      return {x: (width - textWidth) / 2, y: bottomY};
  }
}

function pageNumberLabel(format: PageNumberFormat, value: number, total: number) {
  if (format === "page") return `Page ${value}`;
  if (format === "page_of_total") return `${value} / ${total}`;
  return String(value);
}

export async function numberPdfDocument(doc: PDFDocument, options: NumberPdfPagesOptions = {}) {
  const position = resolvePosition(options.position);
  const startPage = Math.max(1, Math.floor(options.startPage ?? 1));
  const startNumber = Math.max(0, Math.floor(options.startNumber ?? 1));
  const format = options.format ?? "number";
  const fontSize = Math.max(8, Math.min(48, Math.floor(options.fontSize ?? DEFAULT_FONT_SIZE)));
  const margin = Math.max(12, Math.min(96, Math.floor(options.margin ?? DEFAULT_MARGIN)));
  const color = allowedColors.get(options.color ?? "#334155") ?? allowedColors.get("#334155")!;
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const pages = doc.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    const physicalPage = index + 1;
    if (physicalPage < startPage) continue;

    const value = startNumber + (physicalPage - startPage);
    const label = pageNumberLabel(format, value, pages.length - startPage + startNumber);
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const page = pages[index];
    const {width, height} = page.getSize();
    const {x, y} = pageNumberOrigin(position, width, height, textWidth, fontSize, margin);

    // Note: positions are relative to the unrotated page coordinate space.
    page.drawText(label, {x, y, size: fontSize, font, color});
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
