import {readFile, writeFile} from "node:fs/promises";
import {degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage} from "pdf-lib";

export type PdfEditorAnnotation = {
  bold?: boolean;
  fontFamily?: "mono" | "sans" | "serif";
  fontSize?: number;
  height: number;
  id?: string;
  page: number;
  rotation?: number;
  text: string;
  textAlign?: "center" | "left" | "right";
  textColor?: string;
  signatureStrokes?: Array<Array<{x: number; y: number}>>;
  signatureColor?: string;
  signatureImage?: string;
  signatureStyle?: "elegant" | "plain" | "script";
  type: "signature" | "text";
  width: number;
  x: number;
  y: number;
};

const annotationColor = rgb(0.06, 0.15, 0.1);
const annotationColors = new Set(["#141412", "#334155", "#1d4ed8", "#047857", "#b45309", "#b91c1c", "#7e22ce"]);
const signatureColors = new Set(["#141412", "#1d4ed8", "#047857"]);
const signatureStyles = new Set(["script", "elegant", "plain"]);
const annotationFonts = new Set(["sans", "serif", "mono"]);
const annotationAlignments = new Set(["left", "center", "right"]);

export function normalizePageOrder(pageOrder: number[] | undefined, pageCount: number) {
  if (pageOrder === undefined) {
    return Array.from({length: pageCount}, (_, index) => index);
  }

  if (!Array.isArray(pageOrder) || pageOrder.length === 0 || pageOrder.length > pageCount) {
    throw new Error("Invalid page order.");
  }

  const seen = new Set<number>();

  for (const page of pageOrder) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount || seen.has(page)) {
      throw new Error("Invalid page order.");
    }

    seen.add(page);
  }

  return pageOrder.map((page) => page - 1);
}

export function normalizedRotation(value: unknown) {
  if (value !== 90 && value !== 180 && value !== 270) return 0;
  return value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cleanAnnotation(annotation: PdfEditorAnnotation) {
  if (annotation.type !== "text" && annotation.type !== "signature") return null;
  if (!Number.isInteger(annotation.page) || annotation.page < 1) return null;

  const text = typeof annotation.text === "string" ? annotation.text.trim() : "";

  const signatureStrokes = annotation.type === "signature" && Array.isArray(annotation.signatureStrokes)
    ? annotation.signatureStrokes.map((stroke) => stroke.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).map((point) => ({x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1)}))).filter((stroke) => stroke.length > 1)
    : [];
  const signatureImage = annotation.type === "signature" && typeof annotation.signatureImage === "string" && /^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(annotation.signatureImage) && annotation.signatureImage.length <= 220_000
    ? annotation.signatureImage
    : undefined;
  if (!text && signatureStrokes.length === 0 && !signatureImage) return null;

  const fontFamily = annotationFonts.has(annotation.fontFamily ?? "") ? annotation.fontFamily : "sans";
  const textAlign = annotationAlignments.has(annotation.textAlign ?? "") ? annotation.textAlign : "left";
  const textColor = annotationColors.has(annotation.textColor ?? "") ? annotation.textColor : "#141412";
  const rotation = typeof annotation.rotation === "number" && Number.isFinite(annotation.rotation) ? clamp(annotation.rotation, -180, 180) : 0;

  return {
    bold: annotation.type === "text" && annotation.bold === true,
    fontFamily,
    fontSize: clamp(typeof annotation.fontSize === "number" ? annotation.fontSize : 14, 8, 48),
    height: clamp(annotation.height, 0.02, 0.35),
    page: annotation.page,
    rotation,
    signatureStrokes,
    signatureColor: annotation.type === "signature" && signatureColors.has(annotation.signatureColor ?? "") ? annotation.signatureColor : "#141412",
    signatureImage,
    signatureStyle: annotation.type === "signature" && signatureStyles.has(annotation.signatureStyle ?? "") ? annotation.signatureStyle as "elegant" | "plain" | "script" : "script",
    text,
    textAlign,
    textColor,
    type: annotation.type,
    width: clamp(annotation.width, 0.04, 0.9),
    x: clamp(annotation.x, 0, 0.98),
    y: clamp(annotation.y, 0, 0.98)
  } satisfies PdfEditorAnnotation;
}

function colorFromHex(value: string) {
  const red = Number.parseInt(value.slice(1, 3), 16) / 255;
  const green = Number.parseInt(value.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(value.slice(5, 7), 16) / 255;
  return rgb(red, green, blue);
}

function rotatePoint(point: {x: number; y: number}, center: {x: number; y: number}, angle: number) {
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return {x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine};
}

export function fitSignatureImage(image: {width: number; height: number}, box: {width: number; height: number}) {
  const scale = Math.min(box.width / image.width, box.height / image.height);
  return {width: image.width * scale, height: image.height * scale};
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const lines: string[] = [];

  for (const sourceLine of text.split(/\r?\n/)) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }

    if (line) lines.push(line);
  }

  return lines.length > 0 ? lines : [text];
}

export async function drawAnnotations(input: {
  annotations: PdfEditorAnnotation[] | undefined;
  output: PDFDocument;
  page: PDFPage;
  sourcePageNumber: number;
}) {
  const annotations = (input.annotations ?? [])
    .map((annotation) => cleanAnnotation(annotation))
    .filter((annotation): annotation is NonNullable<ReturnType<typeof cleanAnnotation>> => annotation !== null)
    .filter((annotation) => annotation.page === input.sourcePageNumber);

  if (annotations.length === 0) return;

  const regular = await input.output.embedFont(StandardFonts.Helvetica);
  const bold = await input.output.embedFont(StandardFonts.HelveticaBold);
  const mono = await input.output.embedFont(StandardFonts.Courier);
  const monoBold = await input.output.embedFont(StandardFonts.CourierBold);
  const serif = await input.output.embedFont(StandardFonts.TimesRoman);
  const serifBold = await input.output.embedFont(StandardFonts.TimesRomanBold);
  const signatureScript = await input.output.embedFont(StandardFonts.HelveticaOblique);
  const signatureElegant = await input.output.embedFont(StandardFonts.TimesRomanItalic);
  const {width: pageWidth, height: pageHeight} = input.page.getSize();

  for (const annotation of annotations) {
    const x = annotation.x * pageWidth;
    const top = annotation.y * pageHeight;
    const boxWidth = annotation.width * pageWidth;
    const boxHeight = annotation.height * pageHeight;
    const font = annotation.type === "signature"
      ? annotation.signatureStyle === "elegant" ? signatureElegant : annotation.signatureStyle === "plain" ? regular : signatureScript
      : annotation.fontFamily === "serif"
        ? annotation.bold ? serifBold : serif
        : annotation.fontFamily === "mono"
          ? annotation.bold ? monoBold : mono
          : annotation.bold ? bold : regular;
    const fontSize = annotation.type === "signature"
      ? clamp(boxHeight * 0.72, 13, 42)
      : annotation.fontSize ?? 14;
    const lineHeight = fontSize * 1.18;

    if (annotation.type === "signature") {
      const signatureColor = colorFromHex(annotation.signatureColor ?? "#141412");
      const y = pageHeight - top - boxHeight + Math.max(6, boxHeight * 0.18);
      const rotation = -(annotation.rotation ?? 0);
      const center = {x: x + boxWidth / 2, y: pageHeight - top - boxHeight / 2};

      if (annotation.signatureImage) {
        const [, header, encoded] = annotation.signatureImage.match(/^data:(image\/(?:png|jpeg));base64,([a-zA-Z0-9+/=]+)$/) ?? [];
        if (header && encoded) {
          const image = header === "image/png"
            ? await input.output.embedPng(Buffer.from(encoded, "base64"))
            : await input.output.embedJpg(Buffer.from(encoded, "base64"));
          const fitted = fitSignatureImage(image, {width: boxWidth, height: boxHeight});
          const origin = rotatePoint({x: center.x - fitted.width / 2, y: center.y - fitted.height / 2}, center, rotation);
          input.page.drawImage(image, {...origin, ...fitted, rotate: degrees(rotation)});
          continue;
        }
      }

      if (annotation.signatureStrokes?.length) {
        for (const stroke of annotation.signatureStrokes) {
          for (let index = 1; index < stroke.length; index += 1) {
            const from = stroke[index - 1];
            const to = stroke[index];
            const start = rotatePoint({x: x + from.x * boxWidth, y: pageHeight - top - from.y * boxHeight}, center, rotation);
            const end = rotatePoint({x: x + to.x * boxWidth, y: pageHeight - top - to.y * boxHeight}, center, rotation);
            input.page.drawLine({
              start,
              end,
              thickness: Math.max(0.65, boxHeight * 0.008), color: signatureColor
            });
          }
        }
        continue;
      }

      input.page.drawText(annotation.text, {
        x,
        y,
        size: fontSize,
        font,
        color: signatureColor,
        rotate: degrees(rotation)
      });
      input.page.drawLine({
        start: {x, y: y - 4},
        end: {x: x + Math.min(boxWidth, font.widthOfTextAtSize(annotation.text, fontSize) + 18), y: y - 4},
        thickness: 1.2,
        color: signatureColor,
        opacity: 0.48
      });
      continue;
    }

    const lines = wrapText(annotation.text, font, fontSize, boxWidth);
    const maxLines = Math.max(1, Math.floor(boxHeight / lineHeight));

    lines.slice(0, maxLines).forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      const lineX = annotation.textAlign === "center"
        ? x + Math.max(0, (boxWidth - lineWidth) / 2)
        : annotation.textAlign === "right"
          ? x + Math.max(0, boxWidth - lineWidth)
          : x;
      input.page.drawText(line, {
        x: lineX,
        y: pageHeight - top - fontSize - index * lineHeight,
        size: fontSize,
        font,
        color: annotation.textColor ? colorFromHex(annotation.textColor) : annotationColor
      });
    });
  }
}

export async function reorderPdf(
  inputPath: string,
  outputPath: string,
  pageOrder: number[] | undefined,
  pageRotations: Record<string, number> | undefined,
  pageAnnotations?: PdfEditorAnnotation[]
) {
  const bytes = await readFile(inputPath);
  const source = await PDFDocument.load(bytes, {ignoreEncryption: false}).catch((error: unknown) => {
    throw new Error(error instanceof Error ? error.message : "Unable to read PDF.");
  });
  const pageIndexes = normalizePageOrder(pageOrder, source.getPageCount());
  const hasPageOrderChange = pageIndexes.length !== source.getPageCount() || pageIndexes.some((pageIndex, index) => pageIndex !== index);
  const hasRotation = Object.values(pageRotations ?? {}).some((rotation) => normalizedRotation(rotation) !== 0);
  const hasAnnotation = (pageAnnotations ?? []).some((annotation) => cleanAnnotation(annotation) !== null);

  // Studio imports pass through this processor before there are any edits. Keep the
  // original bytes in that case so AcroForms, signatures, and other PDF metadata survive.
  if (!hasPageOrderChange && !hasRotation && !hasAnnotation) {
    await writeFile(outputPath, bytes);
    return outputPath;
  }

  // Annotating existing pages must retain the document-level AcroForm tree.
  const output = hasPageOrderChange ? await PDFDocument.create() : source;
  const pages = hasPageOrderChange ? await output.copyPages(source, pageIndexes) : output.getPages();

  pages.forEach((page, index) => {
    const sourcePageNumber = pageIndexes[index] + 1;
    const rotation = normalizedRotation(pageRotations?.[String(sourcePageNumber)]);

    if (rotation) {
      page.setRotation(degrees(((page.getRotation().angle + rotation) % 360) as 0 | 90 | 180 | 270));
    }

    if (hasPageOrderChange) output.addPage(page);
  });

  await Promise.all(output.getPages().map((page, index) => (
    drawAnnotations({
      annotations: pageAnnotations,
      output,
      page,
      sourcePageNumber: pageIndexes[index] + 1
    })
  )));
  await writeFile(outputPath, await output.save());

  return outputPath;
}
