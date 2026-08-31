import {describe, it, expect} from "vitest";
import {validateUploadInit} from "@/lib/validation/uploads";
import {ErrorCode} from "@/lib/validation/errors";

const MB = 1024 * 1024;

describe("validateUploadInit", () => {
  it("accepts a valid compress_pdf upload with a 25 MB limit", () => {
    const result = validateUploadInit({
      tool: "compress_pdf",
      fileName: "a.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(25 * MB);
  });

  it("accepts a valid compress_image upload with a 15 MB limit", () => {
    const result = validateUploadInit({
      tool: "compress_image",
      fileName: "a.jpg",
      fileSize: MB,
      mimeType: "image/jpeg"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(15 * MB);
  });

  it("rejects a PDF over 25 MB", () => {
    const result = validateUploadInit({
      tool: "compress_pdf",
      fileName: "a.pdf",
      fileSize: 26 * MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.fileTooLarge);
      expect(result.status).toBe(413);
    }
  });

  it("rejects an image over 15 MB", () => {
    const result = validateUploadInit({
      tool: "compress_image",
      fileName: "a.jpg",
      fileSize: 16 * MB,
      mimeType: "image/jpeg"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ErrorCode.fileTooLarge);
  });

  it("rejects a non-PDF type for compress_pdf", () => {
    const result = validateUploadInit({
      tool: "compress_pdf",
      fileName: "a.txt",
      fileSize: MB,
      mimeType: "text/plain"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.unsupportedType);
      expect(result.status).toBe(415);
    }
  });

  it("rejects an unsupported tool", () => {
    const result = validateUploadInit({
      tool: "does_not_exist",
      fileName: "a.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ErrorCode.unsupportedTool);
  });

  it("rejects a malformed payload", () => {
    const result = validateUploadInit({tool: "compress_pdf"});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ErrorCode.invalidRequest);
  });

  it("accepts merge_pdf with a 50 MB limit", () => {
    const result = validateUploadInit({
      tool: "merge_pdf",
      fileName: "a.pdf",
      fileSize: 40 * MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(50 * MB);
  });

  it("accepts split_pdf with a 25 MB limit", () => {
    const result = validateUploadInit({
      tool: "split_pdf",
      fileName: "a.pdf",
      fileSize: 24 * MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(25 * MB);
  });

  it("accepts image_to_pdf with a 15 MB limit", () => {
    const result = validateUploadInit({
      tool: "image_to_pdf",
      fileName: "a.png",
      fileSize: MB,
      mimeType: "image/png"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(15 * MB);
  });

  it("accepts pdf_to_image with a 25 MB limit", () => {
    const result = validateUploadInit({
      tool: "pdf_to_image",
      fileName: "a.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(25 * MB);
  });
});
