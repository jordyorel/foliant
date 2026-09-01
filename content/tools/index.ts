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
  "pdf-en-jpg": defineTool({
    slug: "pdf-en-jpg",
    labelKey: "pdfToJpg",
    category: "convert",
    archetype: "file",
    title: "Convertir PDF en JPG",
    description: "Exportez les pages d'un PDF en images JPG prêtes à partager.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Les images JPG seront fournies dans un ZIP.",
    accept: ".pdf,application/pdf",
    processor: {id: "pdf_to_image", inputTypes: ["pdf"], outputType: "zip"},
    options: ["JPG"]
  }),
  "pdf-en-png": defineTool({
    slug: "pdf-en-png",
    labelKey: "pdfToPng",
    category: "convert",
    archetype: "file",
    title: "Convertir PDF en PNG",
    description: "Exportez les pages d'un PDF en images PNG de haute qualité.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "PDF uniquement. Les images PNG seront fournies dans un ZIP.",
    accept: ".pdf,application/pdf",
    processor: {id: "pdf_to_image", inputTypes: ["pdf"], outputType: "zip"},
    options: ["PNG"]
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
    accept: ".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif",
    processor: {id: "image_to_pdf", inputTypes: ["jpg", "png", "heic"], outputType: "pdf"}
  }),
  "jpg-en-pdf": defineTool({
    slug: "jpg-en-pdf",
    labelKey: "jpgToPdf",
    category: "convert",
    archetype: "file",
    title: "Convertir JPG en PDF",
    description: "Transformez une ou plusieurs images JPG en document PDF.",
    uploadTitle: "Déposez vos JPG ici",
    uploadNote: "Images JPG uniquement. Plusieurs fichiers peuvent créer un seul PDF.",
    accept: ".jpg,.jpeg,image/jpeg",
    processor: {id: "image_to_pdf", inputTypes: ["jpg"], outputType: "pdf"}
  }),
  "png-en-pdf": defineTool({
    slug: "png-en-pdf",
    labelKey: "pngToPdf",
    category: "convert",
    archetype: "file",
    title: "Convertir PNG en PDF",
    description: "Transformez une ou plusieurs images PNG en document PDF.",
    uploadTitle: "Déposez vos PNG ici",
    uploadNote: "Images PNG uniquement. Les transparences sont placées sur fond blanc.",
    accept: ".png,image/png",
    processor: {id: "image_to_pdf", inputTypes: ["png"], outputType: "pdf"}
  }),
  "markdown-en-pdf": defineTool({
    slug: "markdown-en-pdf",
    labelKey: "markdownToPdf",
    category: "convert",
    archetype: "file",
    title: "Convertir Markdown en PDF",
    description: "Transformez un fichier Markdown en PDF lisible et partageable.",
    uploadTitle: "Déposez votre fichier Markdown ici",
    uploadNote: "Format MD accepté. Le moteur sera branché dans une prochaine brique.",
    accept: ".md,.markdown,text/markdown,text/plain",
    processor: {id: "markdown_to_pdf", inputTypes: ["md"], outputType: "pdf"}
  }),
  "heic-en-jpg": defineTool({
    slug: "heic-en-jpg",
    labelKey: "heicToJpg",
    category: "convert",
    archetype: "file",
    title: "Convertir HEIC en JPG",
    description: "Convertissez une image HEIC en JPG compatible avec tous les services.",
    uploadTitle: "Déposez votre image HEIC ici",
    uploadNote: "Images HEIC et HEIF acceptées.",
    accept: ".heic,.heif,image/heic,image/heif",
    processor: {id: "heic_to_jpg", inputTypes: ["heic"], outputType: "jpg"}
  }),
  "heic-en-png": defineTool({
    slug: "heic-en-png",
    labelKey: "heicToPng",
    category: "convert",
    archetype: "file",
    title: "Convertir HEIC en PNG",
    description: "Convertissez une image HEIC en PNG de haute qualité.",
    uploadTitle: "Déposez votre image HEIC ici",
    uploadNote: "Images HEIC et HEIF acceptées.",
    accept: ".heic,.heif,image/heic,image/heif",
    processor: {id: "heic_to_png", inputTypes: ["heic"], outputType: "png"}
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
  "extraire-pages-pdf": defineTool({
    slug: "extraire-pages-pdf",
    labelKey: "extractPages",
    category: "edit",
    archetype: "file",
    title: "Extraire des pages PDF",
    description: "Créez un nouveau PDF à partir des pages que vous indiquez.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Version simple prévue avec une plage de pages à saisir.",
    accept: ".pdf,application/pdf",
    processor: {id: "extract_pdf_pages", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Diviser PDF", "Supprimer des pages", "Réorganiser PDF", "Fusionner PDF"]
  }),
  "pivoter-pdf": defineTool({
    slug: "pivoter-pdf",
    labelKey: "rotatePdf",
    category: "edit",
    archetype: "file",
    title: "Pivoter un PDF",
    description: "Tournez toutes les pages d'un PDF dans le bon sens.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Version simple prévue pour pivoter tout le document.",
    accept: ".pdf,application/pdf",
    processor: {id: "rotate_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Réorganiser PDF", "Supprimer des pages", "Compresser PDF", "Fusionner PDF"]
  }),
  "inserer-pages-pdf": defineTool({
    slug: "inserer-pages-pdf",
    labelKey: "insertPages",
    category: "edit",
    archetype: "file",
    title: "Insérer des pages PDF",
    description: "Ajoutez des pages d'un PDF dans un autre document.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Cette fonction demandera plusieurs fichiers dans une prochaine brique.",
    accept: ".pdf,application/pdf",
    processor: {id: "insert_pdf_pages", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Fusionner PDF", "Réorganiser PDF", "Diviser PDF", "Extraire des pages"]
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
    options: ["Texte", "Centre", "Diagonal", "Répété"],
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
  "ajouter-texte-pdf": defineTool({
    slug: "ajouter-texte-pdf",
    labelKey: "addText",
    category: "edit",
    archetype: "file",
    title: "Ajouter du texte à un PDF",
    description: "Ajoutez du texte sur un PDF avant de le télécharger.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "La version avancée utilisera un éditeur visuel dans le navigateur.",
    accept: ".pdf,application/pdf",
    processor: {id: "add_text_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Signer PDF", "Ajouter un filigrane", "Numéroter les pages", "Réorganiser PDF"]
  }),
  "remplir-pdf": defineTool({
    slug: "remplir-pdf",
    labelKey: "fillPdf",
    category: "edit",
    archetype: "file",
    title: "Remplir un PDF",
    description: "Complétez un formulaire PDF directement en ligne.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Cette fonction sera liée à l'éditeur navigateur.",
    accept: ".pdf,application/pdf",
    processor: {id: "fill_pdf", inputTypes: ["pdf"], outputType: "pdf"},
    related: ["Ajouter du texte", "Signer PDF", "Protéger PDF", "Déverrouiller PDF"]
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
    options: ["Mot de passe", "Chiffrement 256-bit"],
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
    options: ["Mot de passe connu", "Déchiffrement"],
    related: ["Protéger PDF", "Compresser PDF", "Réorganiser PDF", "Fusionner PDF"]
  }),
  "image-en-texte": defineTool({
    slug: "image-en-texte",
    labelKey: "imageToText",
    category: "ocr",
    archetype: "ai",
    title: "Image en texte",
    description: "Extrayez le texte d'une image ou d'un scan.",
    uploadTitle: "Déposez votre image ici",
    uploadNote: "OCR prévu après les moteurs V1 de conversion.",
    accept: ".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif",
    processor: {id: "image_to_text", inputTypes: ["jpg", "png", "heic"], outputType: "txt"}
  }),
  "ocr-pdf": defineTool({
    slug: "ocr-pdf",
    labelKey: "ocrPdf",
    category: "ocr",
    archetype: "ai",
    title: "OCR PDF",
    description: "Rendez un PDF scanné recherchable et exploitable.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Moteur OCR prévu après les outils V1 principaux.",
    accept: ".pdf,application/pdf",
    processor: {id: "ocr_pdf", inputTypes: ["pdf"], outputType: "pdf"}
  }),
  "resumer-document": defineTool({
    slug: "resumer-document",
    labelKey: "summarizeDocument",
    category: "ocr",
    archetype: "ai",
    title: "Résumer un document",
    description: "Obtenez un résumé clair d'un PDF ou document long.",
    uploadTitle: "Déposez votre document ici",
    uploadNote: "Fonction IA prévue dans la phase avancée.",
    accept: ".pdf,.doc,.docx,.txt,.md,application/pdf,text/plain,text/markdown",
    processor: {id: "document_summarizer", inputTypes: ["pdf", "docx", "txt", "md"], outputType: "txt"}
  }),
  "traduire-pdf": defineTool({
    slug: "traduire-pdf",
    labelKey: "translatePdf",
    category: "ocr",
    archetype: "ai",
    title: "Traduire un PDF",
    description: "Traduisez le contenu d'un PDF vers une autre langue.",
    uploadTitle: "Déposez votre PDF ici",
    uploadNote: "Fonction IA prévue dans la phase avancée.",
    accept: ".pdf,application/pdf",
    processor: {id: "pdf_translator", inputTypes: ["pdf"], outputType: "pdf"}
  })
};
