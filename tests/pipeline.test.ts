import {describe, it, expect, afterAll} from "vitest";
import {
  cleanupExpiredFiles,
  createTemporaryFile,
  readResultFile,
  saveTemporaryFile
} from "@/lib/storage/local";
import {createJob, shouldKeepOriginal} from "@/lib/jobs";
import {PDFDocument} from "pdf-lib";
import JSZip from "jszip";
import {fixtureBytes, pollJob, toArrayBuffer} from "./helpers";

const MB = 1024 * 1024;

describe("shouldKeepOriginal", () => {
  it("keeps the compressed output only when it is actually smaller", () => {
    expect(shouldKeepOriginal(100, 50)).toBe(false);
    expect(shouldKeepOriginal(100, 100)).toBe(true);
    expect(shouldKeepOriginal(100, 150)).toBe(true);
  });
});

describe("compression job pipeline", () => {
  afterAll(async () => {
    await cleanupExpiredFiles(Date.now() + 1_000_000_000);
  });

  async function uploadPdf(name: string, tool: "compress_pdf" | "merge_pdf" | "split_pdf" = "compress_pdf") {
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
});
