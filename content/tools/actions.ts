export const toolActions = {
  "pdf-en-word": "pdf_to_word",
  "pdf-en-excel": "pdf_to_excel",
  "pdf-en-powerpoint": "pdf_to_powerpoint",
  "pdf-en-image": "pdf_to_image",
  "compresser-pdf": "compress_pdf",
  "compresser-image": "compress_image",
  "fusionner-pdf": "merge_pdf",
  "diviser-pdf": "split_pdf",
  "word-en-pdf": "word_to_pdf",
  "excel-en-pdf": "excel_to_pdf",
  "powerpoint-en-pdf": "powerpoint_to_pdf",
  "image-en-pdf": "image_to_pdf",
  "reorganiser-pdf": "reorder_pdf",
  "supprimer-pages-pdf": "delete_pdf_pages",
  "filigrane-pdf": "watermark_pdf",
  "numeroter-pages-pdf": "number_pdf_pages",
  "signer-pdf": "sign_pdf",
  "proteger-pdf": "protect_pdf",
  "deverrouiller-pdf": "unlock_pdf"
} as const;

export type ToolAction = (typeof toolActions)[keyof typeof toolActions] | "auto";

export function getToolAction(slug?: string): ToolAction {
  if (!slug) return "auto";
  return toolActions[slug as keyof typeof toolActions] ?? "auto";
}
