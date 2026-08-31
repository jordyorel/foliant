export type ToolConfig = {
  slug: string;
  labelKey: string;
  category: "convert" | "compress" | "edit" | "security" | "ocr";
  archetype: "file" | "ai" | "template";
  title: string;
  description: string;
  uploadTitle: string;
  uploadNote: string;
  accept: string;
  seo: {
    title: string;
    description: string;
  };
  ui: {
    acceptedTypes: string[];
    maxFileSizeMB: number;
  };
  processor: {
    id: string;
    inputTypes: string[];
    outputType: string;
  };
  content: {
    benefits: string[];
    useCases: string[];
  };
  options?: string[];
  related?: string[];
};

function defineTool(config: Omit<ToolConfig, "seo" | "ui" | "content"> & {
  seo?: ToolConfig["seo"];
  ui?: Partial<ToolConfig["ui"]>;
  content?: Partial<ToolConfig["content"]>;
}): ToolConfig {
  return {
    ...config,
    seo: config.seo ?? {
      title: `${config.title} - Foliant`,
      description: config.description
    },
    ui: {
      acceptedTypes: config.accept.split(","),
      maxFileSizeMB: 25,
      ...config.ui
    },
    content: {
      benefits: [],
      useCases: [],
      ...config.content
    }
  };
}

export const tools: Record<string, ToolConfig> = {
  "pdf-en-word": defineTool({
    slug: "pdf-en-word",
    labelKey: "pdfToWord",
    category: "convert",
    archetype: "file",
    title: "Convertir PDF en Word",
    description: "Transformez un PDF en document Word modifiable directement en ligne.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Le document Word sera généré après traitement.",
    accept: ".pdf,application/pdf",
    processor: {id: "pdf_to_word", inputTypes: ["pdf"], outputType: "docx"}
  }),
  "pdf-en-excel": defineTool({
    slug: "pdf-en-excel",
    labelKey: "pdfToExcel",
    category: "convert",
    archetype: "file",
    title: "Convertir PDF en Excel",
    description: "Extrayez les tableaux d'un PDF vers un fichier Excel exploitable.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Idéal pour tableaux, factures et rapports.",
    accept: ".pdf,application/pdf",
    processor: {id: "pdf_to_excel", inputTypes: ["pdf"], outputType: "xlsx"}
  }),
  "pdf-en-powerpoint": defineTool({
    slug: "pdf-en-powerpoint",
    labelKey: "pdfToPowerpoint",
    category: "convert",
    archetype: "file",
    title: "Convertir PDF en PowerPoint",
    description: "Transformez les pages d'un PDF en présentation PowerPoint.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Chaque page peut devenir une diapositive.",
    accept: ".pdf,application/pdf",
    processor: {id: "pdf_to_powerpoint", inputTypes: ["pdf"], outputType: "pptx"}
  }),
  "pdf-en-image": defineTool({
    slug: "pdf-en-image",
    labelKey: "pdfToImage",
    category: "convert",
    archetype: "file",
    title: "Convertir PDF en image",
    description: "Exportez une ou plusieurs pages PDF en images JPG ou PNG.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Vous pourrez choisir le format de sortie.",
    accept: ".pdf,application/pdf",
    processor: {id: "pdf_to_image", inputTypes: ["pdf"], outputType: "zip"},
    options: ["JPG", "PNG"]
  }),
  "compresser-pdf": defineTool({
    slug: "compresser-pdf",
    labelKey: "compressPdf",
    category: "compress",
    archetype: "file",
    title: "Compresser un PDF",
    description: "Réduisez la taille d'un fichier PDF pour l'envoyer plus vite, sans installer de logiciel.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Taille maximale MVP : 25 MB sans compte.",
    accept: ".pdf,application/pdf",
    processor: {id: "compress_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    content: {
      benefits: ["Fichier plus léger", "Envoi plus rapide", "Résultat téléchargeable immédiatement"],
      useCases: ["Email", "WhatsApp", "Formulaire administratif"]
    },
    options: ["Compression recommandée", "Compression forte"],
    related: ["Fusionner PDF", "Signer PDF", "Protéger PDF", "Réorganiser PDF"]
  }),
  "compresser-image": defineTool({
    slug: "compresser-image",
    labelKey: "compressImage",
    category: "compress",
    archetype: "file",
    title: "Compresser une image",
    description: "Réduisez la taille d'une image JPG ou PNG avant de l'envoyer ou de la convertir.",
    uploadTitle: "Déposez votre image ici",
    uploadNote: "JPG, PNG et HEIC acceptés. La compression garde une qualité lisible.",
    accept: ".jpg,.jpeg,.png,.heic,image/jpeg,image/png",
    processor: {id: "compress_image", inputTypes: ["jpg", "png", "heic"], outputType: "image"}
  }),
  "fusionner-pdf": defineTool({
    slug: "fusionner-pdf",
    labelKey: "mergePdf",
    category: "edit",
    archetype: "file",
    title: "Fusionner des PDF",
    description: "Assemblez plusieurs PDF dans le bon ordre et récupérez un seul fichier.",
    uploadTitle: "Déposez vos PDF ici",
    uploadNote: "Ajoutez plusieurs fichiers PDF, puis choisissez leur ordre.",
    accept: ".pdf,application/pdf",
    processor: {id: "merge_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    ui: {maxFileSizeMB: 50},
    related: ["Compresser PDF", "Réorganiser PDF", "Supprimer des pages", "Signer PDF"]
  }),
  "diviser-pdf": defineTool({
    slug: "diviser-pdf",
    labelKey: "splitPdf",
    category: "edit",
    archetype: "file",
    title: "Diviser un PDF",
    description: "Séparez un PDF en plusieurs fichiers avec une règle simple.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Divisez chaque page, toutes les X pages ou une plage précise.",
    accept: ".pdf,application/pdf",
    processor: {id: "split_pdf", inputTypes: ["pdf"], outputType: "zip"},
    options: ["Chaque page", "Toutes les X pages", "Plage de pages"],
    related: ["Fusionner PDF", "Supprimer des pages", "Réorganiser PDF", "Compresser PDF"]
  }),
  "word-en-pdf": defineTool({
    slug: "word-en-pdf",
    labelKey: "wordToPdf",
    category: "convert",
    archetype: "file",
    title: "Convertir Word en PDF",
    description: "Convertissez un document Word en PDF prêt à partager.",
    uploadTitle: "Déposez votre fichier Word ici",
    uploadNote: "Formats DOC et DOCX acceptés.",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    processor: {id: "word_to_pdf", inputTypes: ["doc", "docx"], outputType: "pdf"}
  }),
  "excel-en-pdf": defineTool({
    slug: "excel-en-pdf",
    labelKey: "excelToPdf",
    category: "convert",
    archetype: "file",
    title: "Convertir Excel en PDF",
    description: "Transformez une feuille Excel en PDF lisible et partageable.",
    uploadTitle: "Déposez votre fichier Excel ici",
    uploadNote: "Formats XLS et XLSX acceptés.",
    accept: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    processor: {id: "excel_to_pdf", inputTypes: ["xls", "xlsx"], outputType: "pdf"}
  }),
  "powerpoint-en-pdf": defineTool({
    slug: "powerpoint-en-pdf",
    labelKey: "powerpointToPdf",
    category: "convert",
    archetype: "file",
    title: "Convertir PowerPoint en PDF",
    description: "Exportez une présentation PowerPoint en PDF.",
    uploadTitle: "Déposez votre présentation ici",
    uploadNote: "Formats PPT et PPTX acceptés.",
    accept: ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
    processor: {id: "powerpoint_to_pdf", inputTypes: ["ppt", "pptx"], outputType: "pdf"}
  }),
  "image-en-pdf": defineTool({
    slug: "image-en-pdf",
    labelKey: "imageToPdf",
    category: "convert",
    archetype: "file",
    title: "Convertir une image en PDF",
    description: "Transformez vos images JPG ou PNG en document PDF.",
    uploadTitle: "Déposez vos images ici",
    uploadNote: "JPG, PNG et HEIC acceptés.",
    accept: ".jpg,.jpeg,.png,.heic,image/jpeg,image/png",
    processor: {id: "image_to_pdf", inputTypes: ["jpg", "png", "heic"], outputType: "pdf"}
  }),
  "reorganiser-pdf": defineTool({
    slug: "reorganiser-pdf",
    labelKey: "reorderPdf",
    category: "edit",
    archetype: "file",
    title: "Réorganiser un PDF",
    description: "Changez l'ordre des pages de votre document puis exportez un nouveau PDF.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Les pages seront affichées en aperçu avant export.",
    accept: ".pdf,application/pdf",
    processor: {id: "reorder_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Supprimer des pages", "Fusionner PDF", "Numéroter les pages", "Filigrane PDF"]
  }),
  "supprimer-pages-pdf": defineTool({
    slug: "supprimer-pages-pdf",
    labelKey: "deletePages",
    category: "edit",
    archetype: "file",
    title: "Supprimer des pages PDF",
    description: "Sélectionnez les pages inutiles et téléchargez un PDF propre.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Vous pourrez choisir les pages à retirer après l'upload.",
    accept: ".pdf,application/pdf",
    processor: {id: "delete_pdf_pages", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Réorganiser PDF", "Fusionner PDF", "Compresser PDF", "Signer PDF"]
  }),
  "filigrane-pdf": defineTool({
    slug: "filigrane-pdf",
    labelKey: "watermark",
    category: "edit",
    archetype: "file",
    title: "Ajouter un filigrane PDF",
    description: "Ajoutez un texte discret sur les pages d'un PDF avant de le partager.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Texte, position et opacité seront configurables.",
    accept: ".pdf,application/pdf",
    processor: {id: "watermark_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    options: ["Texte", "Centre", "Diagonal"],
    related: ["Numéroter les pages", "Protéger PDF", "Signer PDF", "Compresser PDF"]
  }),
  "numeroter-pages-pdf": defineTool({
    slug: "numeroter-pages-pdf",
    labelKey: "pageNumbers",
    category: "edit",
    archetype: "file",
    title: "Numéroter les pages PDF",
    description: "Ajoutez automatiquement des numéros de page à un document PDF.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Choisissez la position et la page de départ.",
    accept: ".pdf,application/pdf",
    processor: {id: "number_pdf_pages", inputTypes: ["pdf"], outputType: "pdf"},
    options: ["Bas centre", "Bas droite", "Page 1"],
    related: ["Filigrane PDF", "Réorganiser PDF", "Fusionner PDF", "Protéger PDF"]
  }),
  "signer-pdf": defineTool({
    slug: "signer-pdf",
    labelKey: "signPdf",
    category: "security",
    archetype: "file",
    title: "Signer un PDF",
    description: "Dessinez ou importez une signature et placez-la visuellement sur votre document.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Signature visuelle simple, non certifiée électroniquement.",
    accept: ".pdf,application/pdf",
    processor: {id: "sign_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Protéger PDF", "Compresser PDF", "Fusionner PDF", "Filigrane PDF"]
  }),
  "proteger-pdf": defineTool({
    slug: "proteger-pdf",
    labelKey: "protectPdf",
    category: "security",
    archetype: "file",
    title: "Protéger un PDF",
    description: "Ajoutez un mot de passe pour limiter l'ouverture d'un document PDF.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Le mot de passe sera demandé avant l'export.",
    accept: ".pdf,application/pdf",
    processor: {id: "protect_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Déverrouiller PDF", "Signer PDF", "Compresser PDF", "Filigrane PDF"]
  }),
  "deverrouiller-pdf": defineTool({
    slug: "deverrouiller-pdf",
    labelKey: "unlockPdf",
    category: "security",
    archetype: "file",
    title: "Déverrouiller un PDF",
    description: "Retirez la protection d'un PDF si vous connaissez son mot de passe.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Aucun contournement sans mot de passe ne sera proposé.",
    accept: ".pdf,application/pdf",
    processor: {id: "unlock_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Protéger PDF", "Compresser PDF", "Réorganiser PDF", "Fusionner PDF"]
  })
};
