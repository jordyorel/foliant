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

  it.each(["fill_pdf", "sign_pdf"])("accepts public PDF imports for %s", (tool) => {
    const input = {
      tool,
      fileName: "application.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    };

    expect(validateUploadInit(input).ok).toBe(true);
    expect(validateUploadInit(input, {allowStudioOnly: true}).ok).toBe(true);
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

  it("accepts pdf_to_word with a 25 MB limit", () => {
    const result = validateUploadInit({
      tool: "pdf_to_word",
      fileName: "document.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(25 * MB);
  });

  it("accepts pdf_to_excel with a 25 MB limit", () => {
    const result = validateUploadInit({
      tool: "pdf_to_excel",
      fileName: "document.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(25 * MB);
  });

  it("accepts pdf_to_powerpoint with a 25 MB limit", () => {
    const result = validateUploadInit({
      tool: "pdf_to_powerpoint",
      fileName: "document.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(25 * MB);
  });

  it("accepts markdown_to_pdf with a 2 MB limit", () => {
    const result = validateUploadInit({
      tool: "markdown_to_pdf",
      fileName: "notes.md",
      fileSize: MB,
      mimeType: "text/markdown"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(2 * MB);
  });

  it("rejects a non-Markdown type for markdown_to_pdf", () => {
    const result = validateUploadInit({
      tool: "markdown_to_pdf",
      fileName: "notes.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ErrorCode.unsupportedType);
  });

  it("accepts word_to_pdf DOCX uploads", () => {
    const result = validateUploadInit({
      tool: "word_to_pdf",
      fileName: "document.docx",
      fileSize: MB,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.maxSize).toBe(25 * MB);
  });

  it("accepts excel_to_pdf XLSX uploads", () => {
    const result = validateUploadInit({
      tool: "excel_to_pdf",
      fileName: "sheet.xlsx",
      fileSize: MB,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    expect(result.ok).toBe(true);
  });

  it("accepts powerpoint_to_pdf PPTX uploads", () => {
    const result = validateUploadInit({
      tool: "powerpoint_to_pdf",
      fileName: "slides.pptx",
      fileSize: MB,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a non-Word type for word_to_pdf", () => {
    const result = validateUploadInit({
      tool: "word_to_pdf",
      fileName: "document.pdf",
      fileSize: MB,
      mimeType: "application/pdf"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ErrorCode.unsupportedType);
  });
});
