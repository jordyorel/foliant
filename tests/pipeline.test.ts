import {describe, it, expect, beforeAll, afterAll} from "vitest";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  cleanupExpiredFiles,
  createTemporaryFile,
  readResultFile,
  saveTemporaryFile
} from "@/lib/storage/local";
import {createJob, shouldKeepOriginal} from "@/lib/jobs";
import {protectPdf} from "@/processors/pdf/security";
import {PDFDocument} from "pdf-lib";
import JSZip from "jszip";
import {fixtureBytes, fixturePath, isHeicDecoderAvailable, isQpdfAvailable, pollJob, toArrayBuffer} from "./helpers";

const MB = 1024 * 1024;
let tmp: string;

describe("shouldKeepOriginal", () => {
  it("keeps the compressed output only when it is actually smaller", () => {
    expect(shouldKeepOriginal(100, 50)).toBe(false);
    expect(shouldKeepOriginal(100, 100)).toBe(true);
    expect(shouldKeepOriginal(100, 150)).toBe(true);
  });
});

describe("compression job pipeline", () => {
  beforeAll(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "foliant-pipeline-"));
  });

  afterAll(async () => {
    await cleanupExpiredFiles(Date.now() + 1_000_000_000);
    await rm(tmp, {recursive: true, force: true});
  });

  async function uploadPdf(
    name: string,
    tool: "compress_pdf" | "merge_pdf" | "split_pdf" | "pdf_to_image" | "rotate_pdf" | "extract_pdf_pages" | "delete_pdf_pages" | "number_pdf_pages" | "watermark_pdf" | "protect_pdf" | "unlock_pdf" = "compress_pdf"
  ) {
    const bytes = fixtureBytes(name);
    const file = createTemporaryFile({
      fileName: name,
      fileSize: bytes.length,
      mimeType: "application/pdf",
      tool,
      maxSize: tool === "merge_pdf" ? 50 * MB : 25 * MB
    });
    await saveTemporaryFile(file.id, toArrayBuffer(bytes));
    return file;
  }

  async function uploadTwoPagePdf() {
    const source = await PDFDocument.load(fixtureBytes("light.pdf"));
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, [0, 0]);
    pages.forEach((page) => output.addPage(page));
    const bytes = await output.save();

    const file = createTemporaryFile({
      fileName: "two.pdf",
      fileSize: bytes.length,
      mimeType: "application/pdf",
      tool: "delete_pdf_pages",
      maxSize: 25 * MB
    });
    await saveTemporaryFile(file.id, toArrayBuffer(Buffer.from(bytes)));
    return file;
  }

  async function uploadMarkdown() {
    const inputPath = path.join(tmp, "notes.md");
    await writeFile(inputPath, "# Launch Notes\n\n- Convert\n- Compress\n");
    const bytes = await readFile(inputPath);

    const file = createTemporaryFile({
      fileName: "notes.md",
      fileSize: bytes.length,
      mimeType: "text/markdown",
      tool: "markdown_to_pdf",
      maxSize: 2 * MB
    });
    await saveTemporaryFile(file.id, toArrayBuffer(Buffer.from(bytes)));
    return file;
  }

  it("runs compress_pdf end to end and produces a downloadable PDF", async () => {
    const bytes = fixtureBytes("light.pdf");
    const file = await uploadPdf("light.pdf");

    const job = createJob({tool: "compress_pdf", fileIds: [file.id]});
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result?.originalSize).toBe(bytes.length);
    expect(finished.result?.outputSize).toBeGreaterThan(0);

    const result = await readResultFile(job.id);
    expect(result).not.toBeNull();
    expect(result?.result.mimeType).toBe("application/pdf");
    expect(result?.bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("reports alreadyOptimized and keeps the original for an already-optimized PDF", async () => {
    const file = await uploadPdf("tiny.pdf");
    const job = createJob({tool: "compress_pdf", fileIds: [file.id]});
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result?.alreadyOptimized).toBe(true);
    expect(finished.result?.outputSize).toBe(finished.result?.originalSize);
  });

  it("runs compress_image end to end and produces a JPEG", async () => {
    const bytes = fixtureBytes("image.jpg");
    const file = createTemporaryFile({
      fileName: "image.jpg",
      fileSize: bytes.length,
      mimeType: "image/jpeg",
      tool: "compress_image",
      maxSize: 15 * MB
    });
    await saveTemporaryFile(file.id, toArrayBuffer(bytes));

    const job = createJob({tool: "compress_image", fileIds: [file.id]});
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("image/jpeg");
    expect(result?.bytes[0]).toBe(0xff);
    expect(result?.bytes[1]).toBe(0xd8);
  });

  it("runs merge_pdf end to end and produces a two-page PDF", async () => {
    const first = await uploadPdf("light.pdf", "merge_pdf");
    const second = await uploadPdf("heavy.pdf", "merge_pdf");

    const job = createJob({tool: "merge_pdf", fileIds: [first.id, second.id]});
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it("runs split_pdf end to end and produces a downloadable ZIP", async () => {
    const file = await uploadPdf("light.pdf", "split_pdf");

    const job = createJob({
      tool: "split_pdf",
      fileIds: [file.id],
      options: {splitMode: "every_page"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/zip");

    const zip = await JSZip.loadAsync(result!.bytes);
    expect(zip.file("page-001.pdf")).toBeTruthy();
  });

  it("runs image_to_pdf end to end and produces a two-page PDF", async () => {
    const jpgBytes = fixtureBytes("image.jpg");
    const pngBytes = fixtureBytes("image.png");

    const jpg = createTemporaryFile({
      fileName: "image.jpg",
      fileSize: jpgBytes.length,
      mimeType: "image/jpeg",
      tool: "image_to_pdf",
      maxSize: 15 * MB
    });
    await saveTemporaryFile(jpg.id, toArrayBuffer(jpgBytes));

    const png = createTemporaryFile({
      fileName: "image.png",
      fileSize: pngBytes.length,
      mimeType: "image/png",
      tool: "image_to_pdf",
      maxSize: 15 * MB
    });
    await saveTemporaryFile(png.id, toArrayBuffer(pngBytes));

    const job = createJob({tool: "image_to_pdf", fileIds: [jpg.id, png.id]});
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it("runs pdf_to_image end to end and produces a ZIP of JPGs", async () => {
    const file = await uploadPdf("light.pdf", "pdf_to_image");

    const job = createJob({
      tool: "pdf_to_image",
      fileIds: [file.id],
      options: {pdfToImageFormat: "jpg"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/zip");

    const zip = await JSZip.loadAsync(result!.bytes);
    expect(zip.file("page-001.jpg")).toBeTruthy();
  });

  it("runs rotate_pdf end to end and produces a rotated PDF", async () => {
    const file = await uploadPdf("light.pdf", "rotate_pdf");

    const job = createJob({
      tool: "rotate_pdf",
      fileIds: [file.id],
      options: {rotateDegrees: 90}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  it("runs extract_pdf_pages end to end and produces a PDF", async () => {
    const file = await uploadPdf("light.pdf", "extract_pdf_pages");

    const job = createJob({
      tool: "extract_pdf_pages",
      fileIds: [file.id],
      options: {pageRange: "1"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("runs delete_pdf_pages end to end and produces a PDF", async () => {
    const file = await uploadTwoPagePdf();

    const job = createJob({
      tool: "delete_pdf_pages",
      fileIds: [file.id],
      options: {pageRange: "1"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("runs number_pdf_pages end to end and produces a numbered PDF", async () => {
    const file = await uploadPdf("light.pdf", "number_pdf_pages");

    const job = createJob({
      tool: "number_pdf_pages",
      fileIds: [file.id],
      options: {pageNumberPosition: "bottom_center"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("runs watermark_pdf end to end and produces a watermarked PDF", async () => {
    const file = await uploadPdf("light.pdf", "watermark_pdf");

    const job = createJob({
      tool: "watermark_pdf",
      fileIds: [file.id],
      options: {watermarkText: "DRAFT", watermarkPosition: "center"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it.skipIf(!isQpdfAvailable())("runs protect_pdf end to end and produces a protected PDF", async () => {
    const file = await uploadPdf("light.pdf", "protect_pdf");

    const job = createJob({
      tool: "protect_pdf",
      fileIds: [file.id],
      options: {pdfPassword: "secret"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");
    expect(result?.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    await expect(PDFDocument.load(result!.bytes)).rejects.toThrow();
  });

  it.skipIf(!isQpdfAvailable())("runs unlock_pdf end to end and produces a readable PDF", async () => {
    const protectedPath = path.join(tmp, "pipeline-protected.pdf");
    await protectPdf(fixturePath("light.pdf"), protectedPath, {password: "secret"});

    const bytes = await readFile(protectedPath);
    const file = createTemporaryFile({
      fileName: "protected.pdf",
      fileSize: bytes.length,
      mimeType: "application/pdf",
      tool: "unlock_pdf",
      maxSize: 25 * MB
    });
    await saveTemporaryFile(file.id, toArrayBuffer(Buffer.from(bytes)));

    const job = createJob({
      tool: "unlock_pdf",
      fileIds: [file.id],
      options: {pdfPassword: "secret"}
    });
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it.skipIf(!isHeicDecoderAvailable())("runs heic_to_jpg end to end and produces a JPEG", async () => {
    const bytes = fixtureBytes("image.heic");
    const file = createTemporaryFile({
      fileName: "image.heic",
      fileSize: bytes.length,
      mimeType: "image/heic",
      tool: "heic_to_jpg",
      maxSize: 25 * MB
    });
    await saveTemporaryFile(file.id, toArrayBuffer(bytes));

    const job = createJob({tool: "heic_to_jpg", fileIds: [file.id]});
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("image/jpeg");
    expect(result?.bytes[0]).toBe(0xff);
    expect(result?.bytes[1]).toBe(0xd8);
  });

  it("runs markdown_to_pdf end to end and produces a PDF", async () => {
    const file = await uploadMarkdown();

    const job = createJob({tool: "markdown_to_pdf", fileIds: [file.id]});
    const finished = await pollJob(job.id);

    expect(finished.status).toBe("completed");
    expect(finished.result).toBeUndefined();

    const result = await readResultFile(job.id);
    expect(result?.result.mimeType).toBe("application/pdf");
    expect(result?.bytes.subarray(0, 5).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(result!.bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });
});
