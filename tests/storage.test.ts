import {describe, it, expect, afterAll, vi} from "vitest";
import {
  cleanupExpiredFiles,
  createTemporaryFile,
  saveTemporaryFile,
  sniffKind
} from "@/lib/storage/local";
import {ErrorCode, isAppError} from "@/lib/validation/errors";
import {fixtureBytes, toArrayBuffer} from "./helpers";

const MB = 1024 * 1024;

describe("sniffKind", () => {
  it("detects pdf", () => {
    expect(sniffKind(fixtureBytes("light.pdf"))).toBe("pdf");
  });

  it("detects jpeg", () => {
    expect(sniffKind(fixtureBytes("image.jpg"))).toBe("jpeg");
  });

  it("detects png", () => {
    expect(sniffKind(fixtureBytes("image.png"))).toBe("png");
  });

  it("detects heif from the ftyp marker", () => {
    const buffer = Buffer.alloc(12);
    buffer.write("ftyp", 4, "latin1");
    expect(sniffKind(buffer)).toBe("heif");
  });

  it("returns null for garbage", () => {
    expect(sniffKind(Buffer.from("hello world"))).toBeNull();
  });
});

describe("saveTemporaryFile", () => {
  afterAll(async () => {
    await cleanupExpiredFiles(Date.now() + 1_000_000_000);
  });

  function pdfUpload(name: string, maxSize = 25 * MB) {
    return createTemporaryFile({
      fileName: name,
      fileSize: 1000,
      mimeType: "application/pdf",
      tool: "compress_pdf",
      maxSize
    });
  }

  it("saves a valid PDF and records its real byte size", async () => {
    const file = pdfUpload("light.pdf");
    const bytes = fixtureBytes("light.pdf");
    const saved = await saveTemporaryFile(file.id, toArrayBuffer(bytes));

    expect(saved).not.toBeNull();
    expect(saved?.fileSize).toBe(bytes.length);
  });

  it("restores upload metadata after a module reload", async () => {
    const file = pdfUpload("light.pdf");
    const bytes = fixtureBytes("light.pdf");
    await saveTemporaryFile(file.id, toArrayBuffer(bytes));

    vi.resetModules();
    const storage = await import("@/lib/storage/local");

    expect(storage.hasTemporaryFile(file.id)).toBe(true);
    expect(storage.getTemporaryFile(file.id)?.fileSize).toBe(bytes.length);
  });

  it("rejects invalid PDF content regardless of extension", async () => {
    const file = pdfUpload("invalid.pdf");
    const bytes = fixtureBytes("invalid.pdf");

    await expect(
      saveTemporaryFile(file.id, toArrayBuffer(bytes))
    ).rejects.toSatisfy((e) => isAppError(e) && e.code === ErrorCode.invalidFile);
  });

  it("rejects bytes larger than the tool limit", async () => {
    const file = pdfUpload("big.pdf", 5);
    const bytes = Buffer.from("1234567890");

    await expect(
      saveTemporaryFile(file.id, toArrayBuffer(bytes))
    ).rejects.toSatisfy((e) => isAppError(e) && e.code === ErrorCode.fileTooLarge);
  });
});
