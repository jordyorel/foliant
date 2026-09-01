export const catalogSections = [
  {
    group: "fromPdf",
    links: [
      ["pdf-en-word", "pdfToWord"],
      ["pdf-en-excel", "pdfToExcel"],
      ["pdf-en-powerpoint", "pdfToPowerpoint"],
      ["pdf-en-image", "pdfToImage"],
      ["pdf-en-jpg", "pdfToJpg"],
      ["pdf-en-png", "pdfToPng"]
    ]
  },
  {
    group: "toPdf",
    links: [
      ["word-en-pdf", "wordToPdf"],
      ["excel-en-pdf", "excelToPdf"],
      ["powerpoint-en-pdf", "powerpointToPdf"],
      ["image-en-pdf", "imageToPdf"],
      ["jpg-en-pdf", "jpgToPdf"],
      ["png-en-pdf", "pngToPdf"],
      ["markdown-en-pdf", "markdownToPdf"]
    ]
  },
  {
    group: "compress",
    links: [
      ["compresser-pdf", "compressPdf"],
      ["compresser-image", "compressImage"]
    ]
  },
  {
    group: "edit",
    links: [
      ["fusionner-pdf", "mergePdf"],
      ["diviser-pdf", "splitPdf"],
      ["reorganiser-pdf", "reorderPdf"],
      ["pivoter-pdf", "rotatePdf"],
      ["supprimer-pages-pdf", "deletePages"],
      ["extraire-pages-pdf", "extractPages"],
      ["inserer-pages-pdf", "insertPages"],
      ["filigrane-pdf", "watermark"],
      ["numeroter-pages-pdf", "pageNumbers"],
      ["ajouter-texte-pdf", "addText"],
      ["remplir-pdf", "fillPdf"]
    ]
  },
  {
    group: "secure",
    links: [
      ["proteger-pdf", "protectPdf"],
      ["deverrouiller-pdf", "unlockPdf"],
      ["signer-pdf", "signPdf"]
    ]
  },
  {
    group: "image",
    links: [
      ["heic-en-jpg", "heicToJpg"],
      ["heic-en-png", "heicToPng"]
    ]
  },
  {
    group: "ai",
    links: [
      ["image-en-texte", "imageToText"],
      ["ocr-pdf", "ocrPdf"],
      ["resumer-document", "summarizeDocument"],
      ["traduire-pdf", "translatePdf"]
    ]
  }
] as const;

export const homePopularTools = [
  {slug: "compresser-pdf", label: "compressPdf", description: "compressPdf", icon: "ti-arrows-diagonal-minimize-2", tone: "green"},
  {slug: "fusionner-pdf", label: "mergePdf", description: "mergePdf", icon: "ti-stack-2", tone: "violet"},
  {slug: "pdf-en-word", label: "pdfToWord", description: "pdfToWord", icon: "ti-file-type-doc", tone: "blue"},
  {slug: "image-en-pdf", label: "imageToPdf", description: "imageToPdf", icon: "ti-photo", tone: "amber"},
  {slug: "proteger-pdf", label: "protectPdf", description: "protectPdf", icon: "ti-lock", tone: "rose"},
  {slug: "filigrane-pdf", label: "watermark", description: "watermark", icon: "ti-stamp", tone: "teal"}
] as const;

export const homeCategoryHighlights = [
  {group: "fromPdf", description: "fromPdf", icon: "ti-file-export", links: ["pdf-en-word", "pdf-en-excel", "pdf-en-image"]},
  {group: "toPdf", description: "toPdf", icon: "ti-file-import", links: ["word-en-pdf", "image-en-pdf", "markdown-en-pdf"]},
  {group: "compress", description: "compress", icon: "ti-arrows-diagonal-minimize-2", links: ["compresser-pdf", "compresser-image"]},
  {group: "edit", description: "edit", icon: "ti-layout-grid", links: ["fusionner-pdf", "diviser-pdf", "filigrane-pdf"]},
  {group: "secure", description: "secure", icon: "ti-shield-lock", links: ["proteger-pdf", "deverrouiller-pdf", "signer-pdf"]},
  {group: "ai", description: "ai", icon: "ti-sparkles", links: ["ocr-pdf", "resumer-document", "traduire-pdf"]}
] as const;

export type CatalogToolLabel = (typeof catalogSections)[number]["links"][number][1];
