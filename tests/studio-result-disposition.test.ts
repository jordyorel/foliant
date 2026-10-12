import {describe, expect, it} from "vitest";
import {studioResultDisposition} from "@/lib/studio/result-disposition";

describe("Studio result disposition", () => {
  it.each([
    "add_text_pdf",
    "compress_pdf",
    "delete_pdf_pages",
    "fill_pdf",
    "insert_pdf_pages",
    "number_pdf_pages",
    "protect_pdf",
    "reorder_pdf",
    "rotate_pdf",
    "sign_pdf",
    "unlock_pdf",
    "watermark_pdf"
  ] as const)("keeps %s attached to the durable document", (tool) => {
    expect(studioResultDisposition(tool)).toBe("document-version");
  });

  it.each([
    "extract_pdf_pages",
    "pdf_to_word",
    "split_pdf"
  ] as const)("treats %s as a separate derived result", (tool) => {
    expect(studioResultDisposition(tool)).toBe("derived-result");
  });
});
