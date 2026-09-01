import {readFile, writeFile} from "node:fs/promises";
import {degrees, PDFDocument, rgb, StandardFonts} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";

export type WatermarkPosition = "center" | "diagonal" | "repeated";

export type WatermarkPdfOptions = {
  text?: string;
  position?: WatermarkPosition;
  /** Opacity in the 0..1 range (default 0.2). */
  opacity?: number;
};

function resolvePosition(position?: WatermarkPosition): WatermarkPosition {
  return position ?? "center";
}

function clampOpacity(opacity?: number) {
  const value = typeof opacity === "number" && Number.isFinite(opacity) ? opacity : 0.2;
  return Math.min(1, Math.max(0.05, value));
}

function fontSizeFor(width: number, height: number) {
  return Math.max(24, Math.min(72, Math.round(Math.min(width, height) * 0.08)));
}

function repeatedFontSizeFor(width: number, height: number) {
  return Math.max(8, Math.min(12, Math.round(Math.min(width, height) * 0.019)));
}

export function centeredRotatedOrigin(
  centerX: number,
  centerY: number,
  textWidth: number,
  textHeight: number,
  angleDegrees: number
) {
  const radians = (angleDegrees * Math.PI) / 180;
  const localCenterX = textWidth / 2;
  const localCenterY = textHeight / 2;

  return {
    x: centerX - (localCenterX * Math.cos(radians) - localCenterY * Math.sin(radians)),
    y: centerY - (localCenterX * Math.sin(radians) + localCenterY * Math.cos(radians))
  };
}

export async function watermarkDocument(doc: PDFDocument, options: WatermarkPdfOptions = {}) {
  const text = (options.text ?? "").trim();
  const position = resolvePosition(options.position);
  const opacity = clampOpacity(options.opacity);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const page of doc.getPages()) {
    const {width, height} = page.getSize();
    const fontSize = fontSizeFor(width, height);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const color = rgb(0.45, 0.45, 0.45);

    if (position === "repeated") {
      const repeatedFontSize = repeatedFontSizeFor(width, height);
      const repeatedTextWidth = font.widthOfTextAtSize(text, repeatedFontSize);
      const angle = -32;
      const gapX = Math.max(320, repeatedTextWidth + 230);
      const gapY = Math.max(180, repeatedFontSize * 12);

      for (let y = -gapY; y <= height + gapY; y += gapY) {
        const row = Math.round((y + gapY) / gapY);
        const rowOffset = row % 2 === 0 ? 0 : gapX / 2;

        for (let x = -gapX; x <= width + gapX; x += gapX) {
          const origin = centeredRotatedOrigin(
            x + rowOffset,
            y,
            repeatedTextWidth,
            repeatedFontSize,
            angle
          );

          page.drawText(text, {
            x: origin.x,
            y: origin.y,
            size: repeatedFontSize,
            font,
            color,
            opacity,
            rotate: degrees(angle)
          });
        }
      }
    } else if (position === "diagonal") {
      const angle = (Math.atan2(height, width) * 180) / Math.PI;
      const origin = centeredRotatedOrigin(width / 2, height / 2, textWidth, fontSize, angle);

      page.drawText(text, {
        x: origin.x,
        y: origin.y,
        size: fontSize,
        font,
        color,
        opacity,
        rotate: degrees(angle)
      });
    } else {
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: (height - fontSize) / 2,
        size: fontSize,
        font,
        color,
        opacity
      });
    }
  }
}

export async function watermarkPdf(
  inputPath: string,
  outputPath: string,
  options: WatermarkPdfOptions = {}
) {
  const bytes = await readFile(inputPath);
  const doc = await PDFDocument.load(bytes, {ignoreEncryption: false}).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown PDF watermark error";
    throw new AppError(ErrorCode.processingFailed, `PDF watermark failed: ${message}`, 422);
  });

  await watermarkDocument(doc, options);
  await writeFile(outputPath, await doc.save());
  return outputPath;
}
