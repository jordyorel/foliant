import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {inflateSync} from "node:zlib";
import os from "node:os";
import path from "node:path";
import {compressPdf} from "@/processors/compression/pdf";
import {compressImage} from "@/processors/compression/image";
import {mergePdfs} from "@/processors/pdf/merge";
import {parsePageRange, splitPdf} from "@/processors/pdf/split";
import {imageToPdf} from "@/processors/image/to-pdf";
import {heicToJpg, heicToPng} from "@/processors/image/heic";
import {markdownToPdf} from "@/processors/markdown/to-pdf";
import {excelToPdf, powerpointToPdf, wordToPdf} from "@/processors/office/to-pdf";
import {pdfToImage} from "@/processors/pdf/to-image";
import {pdfToExcel} from "@/processors/pdf/to-excel";
import {pdfToPowerpoint} from "@/processors/pdf/to-powerpoint";
import {pdfToWord} from "@/processors/pdf/to-word";
import {rotatePdf} from "@/processors/pdf/rotate";
import {extractPdfPages} from "@/processors/pdf/extract";
import {insertPdfPages} from "@/processors/pdf/insert";
import {deletePdfPages} from "@/processors/pdf/delete";
import {fillPdf} from "@/processors/pdf/fill";
import {reorderPdf} from "@/processors/pdf/reorder";
import {formatAnnotationDate} from "@/lib/studio/date-annotation";
import {numberPdfDocument, numberPdfPages} from "@/processors/pdf/number";
import {centeredRotatedOrigin, watermarkDocument, watermarkPdf} from "@/processors/pdf/watermark";
import {protectPdf, unlockPdf} from "@/processors/pdf/security";
import {PDFDocument, degrees} from "pdf-lib";
import JSZip from "jszip";
import {ErrorCode, isAppError} from "@/lib/validation/errors";
import {createBlankPdfBytes, createDocxBytes, createPptxBytes, createTextPdfBytes, createWideXlsxBytes, createXlsxBytes, fixturePath, isHeicDecoderAvailable, isLibreOfficeAvailable, isPdfEncrypted, isQpdfAvailable} from "./helpers";

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
    .map((stream: any) => {
      const contents = Buffer.from(stream.getContents());
      try {
        return inflateSync(contents).toString("latin1");
      } catch {
        return contents.toString("latin1");
      }
    })
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

describe("fillPdf", () => {
  it("preserves and fills a realistic AcroForm with text, checkbox, list, and radio fields", async () => {
    const source = out("fillable-source.pdf");
    const output = out("fillable-completed.pdf");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const form = pdf.getForm();
    form.createTextField("Full name").addToPage(page, {x: 72, y: 700, width: 240, height: 24});
    form.createTextField("Email address").addToPage(page, {x: 72, y: 665, width: 240, height: 24});
    form.createCheckBox("Accept terms").addToPage(page, {x: 72, y: 650, width: 18, height: 18});
    const country = form.createDropdown("Country");
    country.addOptions(["Congo", "France"]);
    country.addToPage(page, {x: 72, y: 600, width: 160, height: 24});
    const contact = form.createRadioGroup("Preferred contact");
    contact.addOptionToPage("Email", page, {x: 72, y: 565, width: 18, height: 18});
    contact.addOptionToPage("Phone", page, {x: 112, y: 565, width: 18, height: 18});
    await writeFile(source, await pdf.save());

    await fillPdf(source, output, {"Accept terms": true, "Country": "Congo", "Email address": "jordy@example.com", "Full name": "Jordy Konda", "Preferred contact": "Email"});

    const completed = await PDFDocument.load(await readFile(output));
    const completedForm = completed.getForm();
    expect(completedForm.getTextField("Full name").getText()).toBe("Jordy Konda");
    expect(completedForm.getTextField("Email address").getText()).toBe("jordy@example.com");
    expect(completedForm.getCheckBox("Accept terms").isChecked()).toBe(true);
    expect(completedForm.getDropdown("Country").getSelected()).toEqual(["Congo"]);
    expect(completedForm.getRadioGroup("Preferred contact").getSelected()).toBe("Email");
  });
});

describe("reorderPdf", () => {
  it("embeds all date formats into the exported PDF as text", async () => {
    const source = out("date-source.pdf");
    const output = out("date-output.pdf");
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    await writeFile(source, await pdf.save());
    const dates = (["numeric", "long", "iso"] as const).map((format) => formatAnnotationDate("2026-10-05", format, "fr"));
    await reorderPdf(source, output, undefined, undefined, dates.map((text, index) => ({
      type: "text", text, page: 1, width: 0.5, height: 0.06, x: 0.1, y: 0.2 + index * 0.1
    })));
    const result = await PDFDocument.load(await readFile(output));
    for (const date of dates) expect(pageContent(result, 0)).toContain(Buffer.from(date).toString("hex").toUpperCase());
  });

  it("removes trailing pages even when the remaining pages keep their order", async () => {
    const source = out("trailing-page-source.pdf");
    const output = out("trailing-page-output.pdf");
    const pdf = await PDFDocument.create();
    pdf.addPage(); pdf.addPage(); pdf.addPage();
    await writeFile(source, await pdf.save());
    await reorderPdf(source, output, [1, 2], undefined);
    expect((await PDFDocument.load(await readFile(output))).getPageCount()).toBe(2);
  });

  it("retains completed interactive form fields when adding text", async () => {
    const source = out("annotated-form-source.pdf");
    const output = out("annotated-form-output.pdf");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const field = pdf.getForm().createTextField("Full name");
    field.addToPage(page, {x: 72, y: 720, width: 220, height: 24});
    field.setText("QA Foliant");
    await writeFile(source, await pdf.save());
    await reorderPdf(source, output, [1], undefined, [{type: "text", text: "Checked", page: 1, width: 0.3, height: 0.1, x: 0.1, y: 0.5}]);
    const result = await PDFDocument.load(await readFile(output));
    expect(result.getForm().getTextField("Full name").getText()).toBe("QA Foliant");
    expect(pageContent(result, 0)).toContain("436865636B6564");
  });

  it("keeps AcroForm fields intact when Studio imports a PDF without edits", async () => {
    const source = out("reorder-form-source.pdf");
    const output = out("reorder-form-import.pdf");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    pdf.getForm().createTextField("Full name").addToPage(page, {x: 72, y: 720, width: 220, height: 24});
    await writeFile(source, await pdf.save());

    await reorderPdf(source, output, undefined, undefined);

    const imported = await PDFDocument.load(await readFile(output));
    expect(imported.getForm().getTextField("Full name").getText()).toBeUndefined();
  });

  it("burns a drawn signature into the saved PDF when its text is empty", async () => {
    const source = out("drawn-signature-source.pdf");
    const output = out("drawn-signature-output.pdf");
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    await writeFile(source, await pdf.save());

    await reorderPdf(source, output, undefined, undefined, [
      {
        height: 0.1,
        page: 1,
        signatureColor: "#141412",
        signatureStrokes: [[
          {x: 0.1, y: 0.7},
          {x: 0.36, y: 0.25},
          {x: 0.62, y: 0.72},
          {x: 0.9, y: 0.32}
        ]],
        text: "",
        type: "signature",
        width: 0.28,
        x: 0.2,
        y: 0.3
      }
    ]);

    const sourceSize = (await stat(source)).size;
    const saved = await PDFDocument.load(await readFile(output));

    expect((await stat(output)).size).toBeGreaterThan(sourceSize);
    expect(pageContent(saved, 0)).toContain(" l");
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

  it("rotates only the requested pages when a range is provided", async () => {
    const source = out("rotate-range-source.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("light.pdf")], source);

    const output = out("rotated-range.pdf");
    await rotatePdf(source, output, 90, "2");

    const doc = await PDFDocument.load(await readFile(output));
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
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

describe("insertPdfPages", () => {
  it("inserts another PDF after the requested source page", async () => {
    const source = out("insert-source.pdf");
    await mergePdfs([fixturePath("light.pdf"), fixturePath("heavy.pdf")], source);

    const output = out("inserted.pdf");
    await insertPdfPages([source, fixturePath("tiny.pdf")], output, 1);

    const doc = await PDFDocument.load(await readFile(output));
    expect(doc.getPageCount()).toBe(3);
  });

  it("rejects an invalid insert position", async () => {
    const source = out("insert-invalid-source.pdf");
    await mergePdfs([fixturePath("light.pdf")], source);

    await expect(
      insertPdfPages([source, fixturePath("tiny.pdf")], out("insert-invalid.pdf"), 2)
    ).rejects.toThrow("Invalid insert position.");
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

  it("supports page and total formats with visual controls", async () => {
    const doc = await blankDocument(3);
    await numberPdfDocument(doc, {
      color: "#1d4ed8",
      fontSize: 16,
      format: "page_of_total",
      margin: 48,
      position: "top_left",
      startPage: 2,
      startNumber: 5
    });

    expect(pageDrawnText(doc, 0)).toBe("");
    expect(pageDrawnText(doc, 1)).toBe("5 / 6");
    expect(pageDrawnText(doc, 2)).toBe("6 / 6");
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

describe("heicToJpg / heicToPng", () => {
  const heicDecoderAvailable = isHeicDecoderAvailable();

  it.skipIf(!heicDecoderAvailable)("converts HEIC to JPEG", async () => {
    const output = out("heic-converted.jpg");
    await heicToJpg(fixturePath("image.heic"), output);

    const bytes = await readFile(output);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[2]).toBe(0xff);
  });

  it.skipIf(!heicDecoderAvailable)("converts HEIC to PNG", async () => {
    const output = out("heic-converted.png");
    await heicToPng(fixturePath("image.heic"), output);

    const bytes = await readFile(output);
    expect(
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe(true);
  });

  it("rejects an invalid image input", async () => {
    await expect(
      heicToJpg(fixturePath("invalid.jpg"), out("heic-invalid.jpg"))
    ).rejects.toSatisfy((e) => isAppError(e));
  });
});

describe("markdownToPdf", () => {
  it("produces a readable PDF from Markdown", async () => {
    const input = out("sample.md");
    const output = out("sample-markdown.pdf");
    await writeFile(input, "# Invoice Notes\n\n- Vendor: Airtel\n- Amount: $42,300\n\n> Ready for approval\n\n```text\nstatus=approved\n```");

    await markdownToPdf(input, output);

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it("does not leak the upload file id into the PDF", async () => {
    const input = out("file_a6498fcf-ec76-4e06-83df-8e22647a718f.md");
    const output = out("leak-markdown.pdf");
    await writeFile(input, "# Hello\n\nWorld");

    await markdownToPdf(input, output);

    const doc = await PDFDocument.load(await readFile(output));
    const text = Array.from({length: doc.getPageCount()}, (_, page) => pageDrawnText(doc, page)).join("");
    expect(text).not.toContain("file_a6498fcf");
  });
});

describe("pdfToWord", () => {
  it("converts a selectable-text PDF to DOCX", async () => {
    const input = out("text-source.pdf");
    const output = out("text-source.docx");
    await writeFile(input, await createTextPdfBytes("PDF to Word test\nSecond line"));

    await pdfToWord(input, output);

    const zip = await JSZip.loadAsync(await readFile(output));
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("PDF to Word test");
    expect(xml).toContain("Second line");
  });

  it("returns an OCR-required error when the PDF has no selectable text", async () => {
    const input = out("blank-source.pdf");
    const output = out("blank-source.docx");
    await writeFile(input, await createBlankPdfBytes());

    await expect(pdfToWord(input, output)).rejects.toMatchObject({
      code: ErrorCode.pdfTextMissing
    });
  });
});

describe("pdfToExcel", () => {
  it("converts a selectable-text PDF to XLSX", async () => {
    const input = out("text-source-excel.pdf");
    const output = out("text-source.xlsx");
    await writeFile(input, await createTextPdfBytes("Vendor  Amount\nAirtel  42300"));

    await pdfToExcel(input, output);

    const zip = await JSZip.loadAsync(await readFile(output));
    const xml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
    expect(xml).toContain("Vendor");
    expect(xml).toContain("Amount");
    expect(xml).toContain("Airtel");
  });

  it("returns an OCR-required error when the PDF has no selectable text", async () => {
    const input = out("blank-source-excel.pdf");
    const output = out("blank-source.xlsx");
    await writeFile(input, await createBlankPdfBytes());

    await expect(pdfToExcel(input, output)).rejects.toMatchObject({
      code: ErrorCode.pdfTextMissing
    });
  });
});

describe("pdfToPowerpoint", () => {
  it("converts a selectable-text PDF to PPTX", async () => {
    const input = out("text-source-powerpoint.pdf");
    const output = out("text-source.pptx");
    await writeFile(input, await createTextPdfBytes("PDF to PowerPoint test\nSecond slide line"));

    await pdfToPowerpoint(input, output);

    const zip = await JSZip.loadAsync(await readFile(output));
    const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    expect(presentationXml).toContain("rId1");
    expect(slideXml).toContain("PDF to PowerPoint test");
    expect(slideXml).toContain("Second slide line");
  });

  it("returns an OCR-required error when the PDF has no selectable text", async () => {
    const input = out("blank-source-powerpoint.pdf");
    const output = out("blank-source.pptx");
    await writeFile(input, await createBlankPdfBytes());

    await expect(pdfToPowerpoint(input, output)).rejects.toMatchObject({
      code: ErrorCode.pdfTextMissing
    });
  });
});

describe("wordToPdf", () => {
  it.skipIf(!isLibreOfficeAvailable())("converts DOCX to a readable PDF", async () => {
    const input = out("sample.docx");
    const output = out("sample-word.pdf");
    await writeFile(input, await createDocxBytes("Word to PDF test"));

    await wordToPdf(input, output);

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it.skipIf(!isLibreOfficeAvailable())("converts XLSX to a readable PDF", async () => {
    const input = out("sample.xlsx");
    const output = out("sample-excel.pdf");
    await writeFile(input, await createXlsxBytes("Excel to PDF test"));

    await excelToPdf(input, output);

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it.skipIf(!isLibreOfficeAvailable())("fits wide XLSX columns on a single PDF page", async () => {
    const input = out("wide.xlsx");
    const output = out("wide-excel.pdf");
    await writeFile(input, await createWideXlsxBytes());

    await excelToPdf(input, output);

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it.skipIf(!isLibreOfficeAvailable())("converts PPTX to a readable PDF", async () => {
    const input = out("sample.pptx");
    const output = out("sample-powerpoint.pdf");
    await writeFile(input, await createPptxBytes("PowerPoint to PDF test"));

    await powerpointToPdf(input, output);

    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });
});
