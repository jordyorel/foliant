import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {compressPdf} from "@/processors/compression/pdf";
import {compressImage} from "@/processors/compression/image";
import {mergePdfs} from "@/processors/pdf/merge";
import {parsePageRange, splitPdf} from "@/processors/pdf/split";
import {imageToPdf} from "@/processors/image/to-pdf";
import {pdfToImage} from "@/processors/pdf/to-image";
import {rotatePdf} from "@/processors/pdf/rotate";
import {extractPdfPages} from "@/processors/pdf/extract";
import {deletePdfPages} from "@/processors/pdf/delete";
import {numberPdfDocument, numberPdfPages} from "@/processors/pdf/number";
import {centeredRotatedOrigin, watermarkDocument, watermarkPdf} from "@/processors/pdf/watermark";
import {protectPdf, unlockPdf} from "@/processors/pdf/security";
import {PDFDocument, degrees} from "pdf-lib";
import JSZip from "jszip";
import {ErrorCode, isAppError} from "@/lib/validation/errors";
import {fixturePath, isPdfEncrypted, isQpdfAvailable} from "./helpers";

let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "foliant-proc-"));
});

afterAll(async () => {
  await rm(tmp, {recursive: true, force: true});
});

function out(name: string) {
  return path.join(tmp, name);
}

function pageContent(doc: PDFDocument, index: number): string {
  const contents = (doc.getPage(index) as any).node.Contents();
  const items = contents && typeof contents.asArray === "function" ? contents.asArray() : contents;
  const streams = Array.isArray(items) ? items : [items];

  return streams
    .map((ref: any) => (doc as any).context.lookup(ref))
    .filter(Boolean)
    .map((stream: any) => Buffer.from(stream.getContentsString()).toString("latin1"))
    .join("\n");
}

function pageDrawnText(doc: PDFDocument, index: number): string {
  const content = pageContent(doc, index);
  const matches = [...content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)];
  return matches.map((match) => Buffer.from(match[1], "hex").toString("latin1")).join("");
}

describe("compressPdf", () => {
  it("produces a valid PDF from light.pdf", async () => {
    const output = out("light-compressed.pdf");
    await compressPdf(fixturePath("light.pdf"), output, "ebook");

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("shrinks the heavy scanned-like PDF significantly at screen level", async () => {
    const input = fixturePath("heavy.pdf");
    const output = out("heavy-compressed.pdf");

    await compressPdf(input, output, "screen");

    const inputSize = (await stat(input)).size;
    const outputSize = (await stat(output)).size;
    expect(outputSize).toBeLessThan(inputSize * 0.5);
  });

  it("rejects invalid PDF content", async () => {
    await expect(
      compressPdf(fixturePath("invalid.pdf"), out("invalid-out.pdf"), "ebook")
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("compressImage", () => {
  it("produces a smaller valid JPEG from image.jpg", async () => {
    const input = fixturePath("image.jpg");
    const output = out("image-compressed.jpg");

    const result = await compressImage(input, output, "best_size");
    const bytes = await readFile(result.path);

    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
    expect((await stat(result.path)).size).toBeLessThan((await stat(input)).size);
  });

  it("produces a valid PNG from image.png", async () => {
    const output = out("image-compressed.png");

    const result = await compressImage(fixturePath("image.png"), output, "standard");
    const bytes = await readFile(result.path);

    expect(
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe(true);
    expect(result.extension).toBe(".png");
  });

  it("rejects invalid image content", async () => {
    await expect(
      compressImage(fixturePath("invalid.jpg"), out("invalid-out.jpg"), "standard")
    ).rejects.toBeTruthy();
  });
});

describe("mergePdfs", () => {
  it("merges two PDFs into a single multi-page document", async () => {
    const output = out("merged.pdf");

    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], output);

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it("rejects an invalid PDF input", async () => {
    await expect(
      mergePdfs([fixturePath("light.pdf"), fixturePath("invalid.pdf")], out("merged-invalid.pdf"))
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("splitPdf", () => {
  it("parses page ranges with de-duplication", () => {
    expect(parsePageRange("1-3, 2, 5", 5)).toEqual([1, 2, 3, 5]);
  });

  it("rejects page ranges outside the document", () => {
    expect(() => parsePageRange("1-6", 5)).toThrow();
  });

  it("splits a PDF into one PDF per page inside a ZIP", async () => {
    const input = out("split-source.pdf");
    const output = out("split-pages.zip");

    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], input);
    await splitPdf(input, output, {mode: "every_page"});

    const zip = await JSZip.loadAsync(await readFile(output));
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

    expect(names).toEqual(["page-001.pdf", "page-002.pdf"]);

    const firstPageBytes = await zip.file("page-001.pdf")?.async("uint8array");
    expect(firstPageBytes).toBeTruthy();

    const doc = await PDFDocument.load(firstPageBytes!);
    expect(doc.getPageCount()).toBe(1);
  });

  it("extracts a typed page range into a ZIP", async () => {
    const input = out("range-source.pdf");
    const output = out("range-pages.zip");

    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], input);
    await splitPdf(input, output, {mode: "range", pageRange: "2"});

    const zip = await JSZip.loadAsync(await readFile(output));
    const selectedBytes = await zip.file("selected-pages.pdf")?.async("uint8array");
    expect(selectedBytes).toBeTruthy();

    const doc = await PDFDocument.load(selectedBytes!);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("imageToPdf", () => {
  it("creates a multi-page PDF from multiple images", async () => {
    const output = out("images-to-pdf.pdf");

    await imageToPdf([fixturePath("image.jpg"), fixturePath("image.png")], output);

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it("rejects an invalid image input", async () => {
    await expect(
      imageToPdf([fixturePath("invalid.jpg")], out("invalid-image.pdf"))
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("pdfToImage", () => {
  it("renders each PDF page to a JPG inside a ZIP", async () => {
    const output = out("pdf-images.zip");

    await pdfToImage(fixturePath("light.pdf"), output, {format: "jpg"});

    const zip = await JSZip.loadAsync(await readFile(output));
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    expect(names).toEqual(["page-001.jpg"]);

    const jpgBytes = await zip.file("page-001.jpg")?.async("uint8array");
    expect(jpgBytes).toBeTruthy();
    expect(jpgBytes![0]).toBe(0xff);
    expect(jpgBytes![1]).toBe(0xd8);
  });

  it("renders each page of a multi-page PDF", async () => {
    const source = out("two-pages.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("light.pdf")], source);

    const output = out("two-images.zip");
    await pdfToImage(source, output, {format: "png"});

    const zip = await JSZip.loadAsync(await readFile(output));
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();
    expect(names).toEqual(["page-001.png", "page-002.png"]);
  });

  it("rejects an invalid PDF input", async () => {
    await expect(
      pdfToImage(fixturePath("invalid.pdf"), out("invalid-images.zip"))
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("rotatePdf", () => {
  it("rotates every page by the requested angle", async () => {
    const source = out("rotate-source.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("light.pdf")], source);

    const output = out("rotated-90.pdf");
    await rotatePdf(source, output, 90);

    const doc = await PDFDocument.load(await readFile(output));
    expect(doc.getPageCount()).toBe(2);

    for (const page of doc.getPages()) {
      expect(page.getRotation().angle).toBe(90);
    }
  });

  it("applies 180 and 270 rotations", async () => {
    const source = out("rotate-angles-source.pdf");
    await mergePdfs([fixturePath("light.pdf")], source);

    const half = out("rotated-180.pdf");
    await rotatePdf(source, half, 180);
    const halfDoc = await PDFDocument.load(await readFile(half));
    expect(halfDoc.getPage(0).getRotation().angle).toBe(180);

    const left = out("rotated-270.pdf");
    await rotatePdf(source, left, 270);
    const leftDoc = await PDFDocument.load(await readFile(left));
    expect(leftDoc.getPage(0).getRotation().angle).toBe(270);
  });

  it("adds the rotation on top of an existing page rotation", async () => {
    const source = out("rotate-existing.pdf");
    await mergePdfs([fixturePath("light.pdf")], source);

    const pre = await PDFDocument.load(await readFile(source));
    pre.getPage(0).setRotation(degrees(90));
    await writeFile(source, await pre.save());

    const output = out("rotated-existing.pdf");
    await rotatePdf(source, output, 180);

    const doc = await PDFDocument.load(await readFile(output));
    expect(doc.getPage(0).getRotation().angle).toBe(270);
  });

  it("rejects an invalid PDF input", async () => {
    await expect(
      rotatePdf(fixturePath("invalid.pdf"), out("rotated-invalid.pdf"), 90)
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("extractPdfPages", () => {
  it("extracts the requested pages into a new PDF", async () => {
    const source = out("extract-source.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], source);

    const output = out("extracted.pdf");
    await extractPdfPages(source, output, "2");

    const doc = await PDFDocument.load(await readFile(output));
    expect(doc.getPageCount()).toBe(1);
  });

  it("preserves the typed page order when extracting", async () => {
    const source = out("extract-order-source.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], source);

    const output = out("extracted-order.pdf");
    await extractPdfPages(source, output, "2,1");

    const doc = await PDFDocument.load(await readFile(output));
    expect(doc.getPageCount()).toBe(2);
  });

  it("rejects a page range outside the document", async () => {
    const source = out("extract-invalid-range.pdf");
    await mergePdfs([fixturePath("light.pdf")], source);

    await expect(
      extractPdfPages(source, out("extracted-oob.pdf"), "2")
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("deletePdfPages", () => {
  it("removes the requested pages and keeps the rest", async () => {
    const source = out("delete-source.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], source);

    const output = out("deleted.pdf");
    await deletePdfPages(source, output, "1");

    const doc = await PDFDocument.load(await readFile(output));
    expect(doc.getPageCount()).toBe(1);
  });

  it("rejects deleting every page", async () => {
    const source = out("delete-all-source.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], source);

    await expect(
      deletePdfPages(source, out("deleted-all.pdf"), "1-2")
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("numberPdfPages", () => {
  async function blankDocument(pageCount: number) {
    const doc = await PDFDocument.create();
    for (let index = 0; index < pageCount; index += 1) doc.addPage();
    return doc;
  }

  it("draws a page number on every page", async () => {
    const doc = await blankDocument(2);
    await numberPdfDocument(doc, {position: "bottom_center"});

    expect(doc.getPageCount()).toBe(2);
    expect(pageContent(doc, 0)).toContain("<31>");
    expect(pageContent(doc, 1)).toContain("<32>");
  });

  it("skips pages before startPage and honours startNumber", async () => {
    const doc = await blankDocument(3);
    await numberPdfDocument(doc, {position: "top_right", startPage: 2, startNumber: 5});

    expect(doc.getPageCount()).toBe(3);
    expect(pageContent(doc, 0)).not.toContain("Tj");
    expect(pageContent(doc, 1)).toContain("<35>");
    expect(pageContent(doc, 2)).toContain("<36>");
  });

  it("produces a valid PDF from a file input", async () => {
    const output = out("numbered.pdf");
    await numberPdfPages(fixturePath("light.pdf"), output, {position: "bottom_center"});

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("rejects an invalid PDF input", async () => {
    await expect(
      numberPdfPages(fixturePath("invalid.pdf"), out("numbered-invalid.pdf"))
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("watermarkPdf", () => {
  async function blankDocument(pageCount: number) {
    const doc = await PDFDocument.create();
    for (let index = 0; index < pageCount; index += 1) doc.addPage();
    return doc;
  }

  it("draws the watermark text on every page", async () => {
    const doc = await blankDocument(2);
    await watermarkDocument(doc, {text: "CONFIDENTIEL", position: "center"});

    expect(doc.getPageCount()).toBe(2);
    expect(pageDrawnText(doc, 0)).toBe("CONFIDENTIEL");
    expect(pageDrawnText(doc, 1)).toBe("CONFIDENTIEL");
  });

  it("supports the diagonal position and opacity", async () => {
    const doc = await blankDocument(1);
    await watermarkDocument(doc, {text: "DRAFT", position: "diagonal", opacity: 0.35});

    expect(pageDrawnText(doc, 0)).toBe("DRAFT");
    expect(pageContent(doc, 0)).toContain("gs");
  });

  it("centers rotated text around the requested page point", () => {
    const textWidth = 120;
    const textHeight = 32;
    const angle = 45;
    const origin = centeredRotatedOrigin(300, 420, textWidth, textHeight, angle);
    const radians = (angle * Math.PI) / 180;

    const resolvedCenterX = origin.x + (textWidth / 2) * Math.cos(radians) - (textHeight / 2) * Math.sin(radians);
    const resolvedCenterY = origin.y + (textWidth / 2) * Math.sin(radians) + (textHeight / 2) * Math.cos(radians);

    expect(resolvedCenterX).toBeCloseTo(300);
    expect(resolvedCenterY).toBeCloseTo(420);
  });

  it("supports repeated small watermarks across the page", async () => {
    const doc = await blankDocument(1);
    await watermarkDocument(doc, {text: "DRAFT", position: "repeated", opacity: 0.18});

    const matches = pageDrawnText(doc, 0).match(/DRAFT/g) ?? [];
    expect(matches.length).toBeGreaterThan(10);
    expect(matches.length).toBeLessThan(60);
  });

  it("produces a valid PDF from a file input", async () => {
    const output = out("watermarked.pdf");
    await watermarkPdf(fixturePath("light.pdf"), output, {text: "DRAFT"});

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("rejects an invalid PDF input", async () => {
    await expect(
      watermarkPdf(fixturePath("invalid.pdf"), out("watermarked-invalid.pdf"), {text: "DRAFT"})
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("protectPdf / unlockPdf", () => {
  const qpdfAvailable = isQpdfAvailable();

  it("rejects protect without a password", async () => {
    await expect(
      protectPdf(fixturePath("light.pdf"), out("protected-nopass.pdf"))
    ).rejects.toSatisfy((e) => isAppError(e) && e.code === ErrorCode.invalidRequest);
  });

  it("rejects unlock without a password", async () => {
    await expect(
      unlockPdf(fixturePath("light.pdf"), out("unlocked-nopass.pdf"))
    ).rejects.toSatisfy((e) => isAppError(e) && e.code === ErrorCode.invalidRequest);
  });

  it.skipIf(qpdfAvailable)("reports qpdf missing when qpdf is not installed", async () => {
    await expect(
      protectPdf(fixturePath("light.pdf"), out("protected.pdf"), {password: "secret"})
    ).rejects.toSatisfy((e) => isAppError(e) && e.code === ErrorCode.qpdfMissing);
  });

  it.skipIf(!qpdfAvailable)("protects and unlocks a PDF round-trip", async () => {
    const protectedPath = out("protected.pdf");
    const unlockedPath = out("unlocked.pdf");

    await protectPdf(fixturePath("light.pdf"), protectedPath, {password: "secret"});
    expect(isPdfEncrypted(protectedPath)).toBe(true);

    await unlockPdf(protectedPath, unlockedPath, {password: "secret"});
    expect(isPdfEncrypted(unlockedPath)).toBe(false);

    const bytes = await readFile(unlockedPath);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it.skipIf(!qpdfAvailable)("rejects unlock with a wrong password", async () => {
    const protectedPath = out("wrong-password-protected.pdf");
    await protectPdf(fixturePath("light.pdf"), protectedPath, {password: "secret"});

    await expect(
      unlockPdf(protectedPath, out("wrong-password-unlocked.pdf"), {password: "wrong"})
    ).rejects.toSatisfy((e) => isAppError(e) && e.code === ErrorCode.invalidRequest);
  });
});
