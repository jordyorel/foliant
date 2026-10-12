import type {CatalogToolLabel} from "@/content/catalog";
import type {ToolAction} from "@/content/tools/actions";
import type {getStudioCopy} from "@/content/studio";

export type ContinueAction = {
  icon: string;
  labelKey: CatalogToolLabel;
  options: Record<string, unknown>;
  tool: ToolAction;
};

export type StudioToolCategory = "compress" | "convert" | "organize" | "edit" | "sign" | "ai" | "more";
type StudioToolPanelGroup = "fromPdf" | "toPdf" | "compress" | "edit" | "secure" | "image" | "ai";
export type StudioToolInput = "heic" | "image" | "markdown" | "multiplePdf" | "officeExcel" | "officePowerPoint" | "officeWord" | "pdf";
type StudioToolMode = "auto" | "comingSoon" | "editor" | "options" | "password" | "premium" | "signature";

export type StudioToolItem = ContinueAction & {
  category: StudioToolCategory;
  group: StudioToolPanelGroup;
  input: StudioToolInput;
  mode: StudioToolMode;
};

export const studioToolCategories: Array<{id: StudioToolCategory; icon: string; label: keyof ReturnType<typeof getStudioCopy>["workspace"]["toolNav"]}> = [
  {id: "compress", icon: "ti-arrows-diagonal-minimize-2", label: "compress"},
  {id: "convert", icon: "ti-transform", label: "convert"},
  {id: "organize", icon: "ti-layout-grid", label: "organize"},
  {id: "edit", icon: "ti-text-plus", label: "edit"},
  {id: "sign", icon: "ti-shield-lock", label: "sign"},
  {id: "ai", icon: "ti-sparkles", label: "ai"},
  {id: "more", icon: "ti-dots", label: "more"}
];

export const studioToolItems: StudioToolItem[] = [
  {
    category: "compress",
    group: "compress",
    icon: "ti-arrows-diagonal-minimize-2",
    input: "pdf",
    labelKey: "compressPdf",
    mode: "options",
    options: {},
    tool: "compress_pdf"
  },
  {
    category: "compress",
    group: "compress",
    icon: "ti-photo-down",
    input: "image",
    labelKey: "compressImage",
    mode: "options",
    options: {},
    tool: "compress_image"
  },
  {
    category: "convert",
    group: "fromPdf",
    icon: "ti-file-type-doc",
    input: "pdf",
    labelKey: "pdfToWord",
    mode: "options",
    options: {},
    tool: "pdf_to_word"
  },
  {
    category: "convert",
    group: "fromPdf",
    icon: "ti-file-spreadsheet",
    input: "pdf",
    labelKey: "pdfToExcel",
    mode: "options",
    options: {},
    tool: "pdf_to_excel"
  },
  {
    category: "convert",
    group: "fromPdf",
    icon: "ti-presentation",
    input: "pdf",
    labelKey: "pdfToPowerpoint",
    mode: "options",
    options: {},
    tool: "pdf_to_powerpoint"
  },
  {
    category: "convert",
    group: "fromPdf",
    icon: "ti-photo",
    input: "pdf",
    labelKey: "pdfToImage",
    mode: "options",
    options: {pdfToImageFormat: "jpg"},
    tool: "pdf_to_image"
  },
  {
    category: "convert",
    group: "fromPdf",
    icon: "ti-file-type-jpg",
    input: "pdf",
    labelKey: "pdfToJpg",
    mode: "options",
    options: {pdfToImageFormat: "jpg"},
    tool: "pdf_to_image"
  },
  {
    category: "convert",
    group: "fromPdf",
    icon: "ti-file-type-png",
    input: "pdf",
    labelKey: "pdfToPng",
    mode: "options",
    options: {pdfToImageFormat: "png"},
    tool: "pdf_to_image"
  },
  {
    category: "convert",
    group: "toPdf",
    icon: "ti-file-type-doc",
    input: "officeWord",
    labelKey: "wordToPdf",
    mode: "auto",
    options: {},
    tool: "word_to_pdf"
  },
  {
    category: "convert",
    group: "toPdf",
    icon: "ti-file-spreadsheet",
    input: "officeExcel",
    labelKey: "excelToPdf",
    mode: "auto",
    options: {},
    tool: "excel_to_pdf"
  },
  {
    category: "convert",
    group: "toPdf",
    icon: "ti-presentation",
    input: "officePowerPoint",
    labelKey: "powerpointToPdf",
    mode: "auto",
    options: {},
    tool: "powerpoint_to_pdf"
  },
  {
    category: "convert",
    group: "toPdf",
    icon: "ti-photo",
    input: "image",
    labelKey: "imageToPdf",
    mode: "auto",
    options: {},
    tool: "image_to_pdf"
  },
  {
    category: "convert",
    group: "toPdf",
    icon: "ti-file-type-jpg",
    input: "image",
    labelKey: "jpgToPdf",
    mode: "auto",
    options: {},
    tool: "image_to_pdf"
  },
  {
    category: "convert",
    group: "toPdf",
    icon: "ti-file-type-png",
    input: "image",
    labelKey: "pngToPdf",
    mode: "auto",
    options: {},
    tool: "image_to_pdf"
  },
  {
    category: "convert",
    group: "toPdf",
    icon: "ti-markdown",
    input: "markdown",
    labelKey: "markdownToPdf",
    mode: "auto",
    options: {},
    tool: "markdown_to_pdf"
  },
  {
    category: "organize",
    group: "edit",
    icon: "ti-stack-2",
    input: "multiplePdf",
    labelKey: "mergePdf",
    mode: "auto",
    options: {},
    tool: "merge_pdf"
  },
  {
    category: "organize",
    group: "edit",
    icon: "ti-cut",
    input: "pdf",
    labelKey: "splitPdf",
    mode: "options",
    options: {},
    tool: "split_pdf"
  },
  {
    category: "organize",
    group: "edit",
    icon: "ti-rotate-clockwise",
    input: "pdf",
    labelKey: "rotatePdf",
    mode: "options",
    options: {},
    tool: "rotate_pdf"
  },
  {
    category: "organize",
    group: "edit",
    icon: "ti-arrows-sort",
    input: "pdf",
    labelKey: "reorderPdf",
    mode: "editor",
    options: {},
    tool: "reorder_pdf"
  },
  {
    category: "organize",
    group: "edit",
    icon: "ti-trash",
    input: "pdf",
    labelKey: "deletePages",
    mode: "options",
    options: {},
    tool: "delete_pdf_pages"
  },
  {
    category: "organize",
    group: "edit",
    icon: "ti-file-export",
    input: "pdf",
    labelKey: "extractPages",
    mode: "options",
    options: {},
    tool: "extract_pdf_pages"
  },
  {
    category: "organize",
    group: "edit",
    icon: "ti-file-plus",
    input: "multiplePdf",
    labelKey: "insertPages",
    mode: "editor",
    options: {},
    tool: "insert_pdf_pages"
  },
  {
    category: "edit",
    group: "edit",
    icon: "ti-droplet",
    input: "pdf",
    labelKey: "watermark",
    mode: "options",
    options: {},
    tool: "watermark_pdf"
  },
  {
    category: "edit",
    group: "edit",
    icon: "ti-list-numbers",
    input: "pdf",
    labelKey: "pageNumbers",
    mode: "options",
    options: {},
    tool: "number_pdf_pages"
  },
  {
    category: "edit",
    group: "edit",
    icon: "ti-letter-t",
    input: "pdf",
    labelKey: "addText",
    mode: "editor",
    options: {},
    tool: "add_text_pdf"
  },
  {
    category: "edit",
    group: "edit",
    icon: "ti-forms",
    input: "pdf",
    labelKey: "fillPdf",
    mode: "options",
    options: {},
    tool: "fill_pdf"
  },
  {
    category: "sign",
    group: "secure",
    icon: "ti-signature",
    input: "pdf",
    labelKey: "signPdf",
    mode: "signature",
    options: {},
    tool: "sign_pdf"
  },
  {
    category: "sign",
    group: "secure",
    icon: "ti-shield-lock",
    input: "pdf",
    labelKey: "protectPdf",
    mode: "password",
    options: {},
    tool: "protect_pdf"
  },
  {
    category: "sign",
    group: "secure",
    icon: "ti-lock-open",
    input: "pdf",
    labelKey: "unlockPdf",
    mode: "password",
    options: {},
    tool: "unlock_pdf"
  },
  {
    category: "ai",
    group: "ai",
    icon: "ti-photo-scan",
    input: "image",
    labelKey: "imageToText",
    mode: "comingSoon",
    options: {},
    tool: "image_to_text"
  },
  {
    category: "ai",
    group: "ai",
    icon: "ti-text-recognition",
    input: "pdf",
    labelKey: "ocrPdf",
    mode: "comingSoon",
    options: {},
    tool: "ocr_pdf"
  },
  {
    category: "ai",
    group: "ai",
    icon: "ti-sparkles",
    input: "pdf",
    labelKey: "summarizeDocument",
    mode: "premium",
    options: {},
    tool: "document_summarizer"
  },
  {
    category: "ai",
    group: "ai",
    icon: "ti-language",
    input: "pdf",
    labelKey: "translatePdf",
    mode: "premium",
    options: {},
    tool: "pdf_translator"
  },
  {
    category: "more",
    group: "image",
    icon: "ti-file-type-jpg",
    input: "heic",
    labelKey: "heicToJpg",
    mode: "auto",
    options: {},
    tool: "heic_to_jpg"
  },
  {
    category: "more",
    group: "image",
    icon: "ti-file-type-png",
    input: "heic",
    labelKey: "heicToPng",
    mode: "auto",
    options: {},
    tool: "heic_to_png"
  }
];


