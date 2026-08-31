import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {mkdtemp, readFile, rm, stat} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {compressPdf} from "@/processors/compression/pdf";
import {compressImage} from "@/processors/compression/image";
import {mergePdfs} from "@/processors/pdf/merge";
import {parsePageRange, splitPdf} from "@/processors/pdf/split";
import {PDFDocument} from "pdf-lib";
import JSZip from "jszip";
import {isAppError} from "@/lib/validation/errors";
import {fixturePath} from "./helpers";

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
