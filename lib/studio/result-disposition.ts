import type {ToolAction} from "@/content/tools/actions";

export type StudioResultDisposition = "document-version" | "derived-result";

const documentVersionTools = new Set<ToolAction>([
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
]);

export function studioResultDisposition(tool: ToolAction): StudioResultDisposition {
  return documentVersionTools.has(tool) ? "document-version" : "derived-result";
}
