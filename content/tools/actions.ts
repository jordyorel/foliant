export const toolActions = {
  "pdf-en-word": "pdf_to_word",
  "pdf-en-excel": "pdf_to_excel",
  "pdf-en-powerpoint": "pdf_to_powerpoint",
  "pdf-en-image": "pdf_to_image",
  "pdf-en-jpg": "pdf_to_image",
  "pdf-en-png": "pdf_to_image",
  "compresser-pdf": "compress_pdf",
  "compresser-image": "compress_image",
  "fusionner-pdf": "merge_pdf",
  "diviser-pdf": "split_pdf",
  "word-en-pdf": "word_to_pdf",
  "excel-en-pdf": "excel_to_pdf",
  "powerpoint-en-pdf": "powerpoint_to_pdf",
  "image-en-pdf": "image_to_pdf",
  "jpg-en-pdf": "image_to_pdf",
  "png-en-pdf": "image_to_pdf",
  "markdown-en-pdf": "markdown_to_pdf",
  "heic-en-jpg": "heic_to_jpg",
  "heic-en-png": "heic_to_png",
  "reorganiser-pdf": "reorder_pdf",
  "supprimer-pages-pdf": "delete_pdf_pages",
  "extraire-pages-pdf": "extract_pdf_pages",
  "pivoter-pdf": "rotate_pdf",
  "inserer-pages-pdf": "insert_pdf_pages",
  "filigrane-pdf": "watermark_pdf",
  "numeroter-pages-pdf": "number_pdf_pages",
  "ajouter-texte-pdf": "add_text_pdf",
  "remplir-pdf": "fill_pdf",
  "signer-pdf": "sign_pdf",
  "proteger-pdf": "protect_pdf",
  "deverrouiller-pdf": "unlock_pdf",
  "image-en-texte": "image_to_text",
  "ocr-pdf": "ocr_pdf",
  "resumer-document": "document_summarizer",
  "traduire-pdf": "pdf_translator"
} as const;

export type ToolAction = (typeof toolActions)[keyof typeof toolActions] | "auto";

export function getToolAction(slug?: string): ToolAction {
  if (!slug) return "auto";
  return toolActions[slug as keyof typeof toolActions] ?? "auto";
}
