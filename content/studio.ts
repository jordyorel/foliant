import type {Locale} from "@/lib/i18n/routing";
import type {CatalogToolLabel} from "@/content/catalog";
import type {ToolAction} from "@/content/tools/actions";

export type StudioDocumentKind =
  | "archive"
  | "compressed"
  | "contract"
  | "converted"
  | "document"
  | "image"
  | "invoice"
  | "organized"
  | "payment"
  | "secured";

export type StudioDocumentStatus =
  | "approved"
  | "completed"
  | "failed"
  | "processed"
  | "processing"
  | "queued"
  | "review";

export type StudioOwner =
  | "compliance"
  | "finance"
  | "legal"
  | "operations"
  | "tools";

export type StudioTone = "amber" | "blue" | "green" | "muted" | "red";

export type StudioDocument = {
  id: string;
  name: string;
  kind: StudioDocumentKind;
  owner: StudioOwner;
  amount: string;
  status: StudioDocumentStatus;
  date: string;
  pages: number;
  confidence: string;
  tone: StudioTone;
  progress?: number;
  step?: string;
  sourceName?: string;
  tool?: ToolAction;
  toolLabel?: CatalogToolLabel;
  resultUrl?: string;
  previewUrl?: string;
  sourcePreviewUrl?: string;
  resultMimeType?: string;
  sourceMimeType?: string;
  resultExpiresAt?: string;
  inputSize?: number;
  resultSize?: number;
  error?: string;
  isGuest?: boolean;
  isProtected?: boolean;
  isLive?: boolean;
};

export const studioViewKeys = [
  "documents",
  "inbox",
  "workflows",
  "approvals",
  "ai",
  "team",
  "settings"
] as const;

export type StudioViewKey = (typeof studioViewKeys)[number];

export function isStudioViewKey(value: string): value is StudioViewKey {
  return (studioViewKeys as readonly string[]).includes(value);
}

export const studioDocuments: StudioDocument[] = [];

export const studioActivity = [
  {time: "10:31", event: "uploaded", actor: "Jordy"},
  {time: "10:32", event: "extracted", actor: "Foliant AI"},
  {time: "10:34", event: "routed", actor: "Workflow"},
  {time: "11:52", event: "approved", actor: "CFO"}
] as const;

export const studioWorkflows = [
  {name: "invoiceApproval", state: "active", volume: "128/mo"},
  {name: "contractReview", state: "draft", volume: "24/mo"},
  {name: "financeExport", state: "active", volume: "Weekly"}
] as const;

export const studioCopy = {
  fr: {
    metaTitle: "Studio Foliant - Espace documents",
    metaDescription: "Un espace de travail pour traiter, suivre et valider les documents avec Foliant.",
    nav: {
      home: "Accueil",
      documents: "Documents",
      inbox: "Inbox",
      workflows: "Workflows",
      approvals: "Approbations",
      ai: "AI",
      team: "Equipe",
      settings: "Reglages"
    },
    plan: {
      label: "Plan actuel",
      name: "Studio preview",
      usage: "18 sur 100 traitements",
      usageSuffix: "sur 100 traitements",
      cta: "Voir l'offre"
    },
    header: {
      eyebrow: "Studio",
      title: "Documents",
      subtitle: "Retrouvez vos documents et reprenez vos modifications.",
      search: "Rechercher un document",
      upload: "Importer",
      automate: "Automatiser"
    },
    kpis: {
      inbox: ["Inbox", "14", "6 en attente"],
      approvals: ["Approbations", "7", "2 urgentes"],
      automation: ["Automatisation", "82%", "routage sans action"],
      storage: ["Stockage", "2.4 GB", "suppression auto active"]
    },
    metrics: {
      pending: "en attente",
      review: "à revoir",
      completed: "terminés",
      comingSoon: "Bientôt disponible",
      comingSoonDetail: "Module en préparation",
      temporaryStorage: "stockage temporaire",
      recentJobs: "jobs récents"
    },
    filters: {
      all: "Tous",
      active: "En cours",
      completed: "Terminés",
      failed: "Échecs",
      next: "Filtrer",
      byAction: "Type d'action",
      sort: "Trier les documents",
      sortName: "Nom",
      sortSize: "Taille",
      sortStatus: "Statut"
    },
    empty: {
      title: "Aucun document",
      text: "Les fichiers traités depuis les outils publics apparaîtront ici pendant leur conservation temporaire.",
      selected: "Sélectionnez un document pour afficher son aperçu et ses détails.",
      loading: "Chargement des documents",
      loadError: "Impossible de charger les documents",
      retry: "Réessayer"
    },
    workspace: {
      back: "Retour au Studio",
      eyebrow: "Workspace document",
      subtitle: "Prévisualisez le résultat, vérifiez les détails et choisissez la prochaine action.",
      preview: "Aperçu",
      sourcePreview: "Aperçu du PDF source. Le résultat est disponible au téléchargement.",
      details: "Détails",
      actions: "Actions document",
      temporaryResult: "Résultat temporaire",
      download: "Télécharger le résultat",
      unavailableTitle: "Document introuvable",
      unavailableText: "Le fichier a peut-être expiré ou appartient à une autre session locale.",
      loadingDocument: "Chargement du document",
      loadRetryText: "La connexion au stockage a échoué temporairement. Réessayez dans un instant.",
      openTool: "Ouvrir l'outil",
      save: "Enregistrer dans Studio",
      share: "Partager",
      delete: "Supprimer le document",
      finish: "Terminer",
      thumbnails: "Pages",
      hideThumbnails: "Masquer les pages",
      showThumbnails: "Afficher les pages",
      resultPanel: "Guest",
      hideResultPanel: "Masquer Guest Studio",
      showResultPanel: "Afficher Guest Studio",
      addFile: "Ajouter PDF, image, Word, Excel ou PowerPoint",
      currentPage: "1 / 1",
      zoom: "165%",
      comingSoon: "À brancher",
      premium: "Premium",
      pageActions: {
        cannotDeleteLastPage: "Impossible de supprimer la dernière page",
        clearSelection: "Annuler la sélection",
        delete: "Supprimer la page",
        deleteSelection: "Supprimer les pages sélectionnées",
        error: "Impossible de modifier cette page.",
        extract: "Extraire la page",
        extractSelection: "Extraire les pages sélectionnées",
        rotate: "Pivoter la page",
        select: "Sélectionner la page",
        selected: "{count} page(s) sélectionnée(s)"
      },
      documentStatus: {temporary: "Invité · Document temporaire", saved: "Enregistré dans Studio"},
      guest: {
        badge: "Studio invité",
        title: "Votre fichier est prêt",
        text: "Téléchargez immédiatement, ou continuez avec ce document dans Foliant.",
        result: "Résultat",
        originalSize: "Taille initiale",
        finalSize: "Taille finale",
        saved: "Gain",
        fileSize: "Taille du fichier",
        expires: "Expire",
        temporary: "Conservation temporaire",
        download: "Télécharger maintenant",
        continueTitle: "Continuer avec ce fichier",
        continueText: "Lancez une autre action sans importer le document à nouveau.",
        accountTitle: "Gardez ce document",
        accountText: "Créez un compte gratuit pour conserver l'historique et retrouver vos fichiers plus tard.",
        accountCta: "Créer un compte gratuit",
        noGate: "Aucun compte requis pour télécharger."
      },
      versions: {
        title: "Historique des versions",
        current: "Version actuelle",
        version: "Version",
        preview: "Prévisualiser",
        restore: "Restaurer",
        restoring: "Restauration",
        download: "Télécharger",
        empty: "Aucune version disponible.",
        error: "Impossible de charger l'historique.",
        hide: "Masquer les versions",
        show: "Afficher les versions"
      },
      deleteDialog: {
        title: "Supprimer ce document ?",
        text: "Le document et toutes ses versions seront supprimés définitivement.",
        warning: "Cette action est irréversible.",
        cancel: "Annuler",
        confirm: "Supprimer définitivement",
        deleting: "Suppression",
        error: "Impossible de supprimer le document. Aucun changement n'a été masqué."
      },
      launcher: {
        title: "Choisir une action",
        subtitle: "Survolez une catégorie, choisissez un outil, puis utilisez le fichier actif ou importez directement dans Studio.",
        currentFile: "Utiliser le fichier actif",
        uploadRequired: "Importer dans Studio",
        incompatible: "Format incompatible",
        optionsLater: "Options à brancher",
        editorLater: "Éditeur visuel à brancher",
        comingSoon: "À venir",
        premiumLater: "Premium plus tard",
        openSignature: "Ouvrir la signature",
        openDocument: "Ouvrez un document pour utiliser cet outil.",
        uploadTitle: "Importer dans Studio",
        uploadText: "",
        chooseFile: "Choisir un fichier",
        dropText: "Déposez ou sélectionnez un fichier",
        selected: "Fichier sélectionné",
        selectedMany: "fichiers sélectionnés",
        start: "Lancer le traitement",
        uploading: "Upload",
        processing: "Traitement",
        close: "Fermer",
        error: "Impossible de lancer cet outil.",
        needMoreFiles: "Sélectionnez au moins deux fichiers.",
        removeFile: "Retirer le fichier",
        sourceFirst: "Document actif · premier"
      },
      toolNav: {
        compress: "Compresser",
        convert: "Convertir",
        organize: "Organiser",
        edit: "Éditer",
        sign: "Sécuriser",
        ai: "AI PDF",
        more: "Plus",
        documents: "Documents"
      },
      toolbar: {
        hand: "Main",
        select: "Sélection",
        signatures: "Signatures",
        addSigners: "Ajouter signataires",
        date: "Date",
        text: "Texte",
        approve: "Valider",
        undo: "Annuler",
        redo: "Rétablir",
        search: "Rechercher"
      },
      signModal: {
        title: "Ajouter votre signature",
        description: "Saisissez le nom à afficher, puis placez la signature sur le document.",
        nameLabel: "Nom de la signature",
        namePlaceholder: "Votre nom complet",
        styleLabel: "Style",
        styleScript: "Manuscrit",
        styleElegant: "Classique",
        stylePlain: "Simple",
        colorLabel: "Couleur",
        clearDrawing: "Effacer le dessin",
        draw: "Dessiner", type: "Taper", upload: "Importer",
        modes: "Mode de signature", removeAnnotation: "Supprimer l'annotation",
        previewLabel: "Aperçu de la signature",
        previewPlaceholder: "Votre signature",
        note: "Cette signature est visuelle. Elle ne constitue pas une signature électronique certifiée.",
        cancel: "Annuler",
        place: "Placer la signature",
        chooseSigner: "Choisir qui signe",
        chooseSeal: "Choisir le type de signature",
        signMyself: "Signer moi-même",
        requestSignatures: "Demander des signatures",
        signWithoutSeal: "Signer sans certificat",
        signWithSeal: "Signer avec certificat",
        selfText: "Créer une signature et signer le document.",
        requestText: "Envoyer le document à d'autres personnes pour signature.",
        noSealText: "Signer rapidement sans certificat numérique.",
        sealText: "Ajouter un certificat vérifiable avec piste d'audit.",
        trialText: "Disponible dans l'offre premium.",
        close: "Fermer"
      }
    },
    views: {
      documents: {
        title: "Documents",
        subtitle: "Retrouvez vos documents et reprenez vos modifications."
      },
      inbox: {
        title: "Inbox",
        subtitle: "Centraliser les documents reçus par email, upload direct ou API.",
        state: "Connexion email/API à brancher"
      },
      workflows: {
        title: "Workflows",
        subtitle: "Créer les règles qui classent, routent, valident et exportent les documents.",
        state: "Builder workflow à construire"
      },
      approvals: {
        title: "Approbations",
        subtitle: "Suivre les documents qui attendent une décision ou une validation.",
        state: "Approbations basées sur les documents en revue"
      },
      ai: {
        title: "AI",
        subtitle: "Extraire, résumer, classer et interroger les documents avec l'IA.",
        state: "OCR et extraction à brancher"
      },
      team: {
        title: "Équipe",
        subtitle: "Gérer les rôles, accès et responsabilités autour des documents.",
        state: "Comptes et rôles à connecter"
      },
      settings: {
        title: "Réglages",
        subtitle: "Configurer stockage, API, quotas, suppression automatique et facturation.",
        state: "Paramètres workspace à créer"
      }
    },
    actions: {
      email: ["Email inbox", "Recevoir les PDF entrants"],
      api: ["API upload", "Connecter vos systèmes"],
      rules: ["Règles", "Router par montant/type"]
    },
    sections: {
      recent: "Documents récents",
      recentText: "",
      selected: "Document sélectionné",
      preview: "Aperçu PDF",
      extracted: "Données extraites",
      activity: "Activité",
      workflows: "Workflows actifs"
    },
    table: {
      document: "Document",
      type: "Type",
      owner: "Equipe",
      value: "Valeur",
      status: "Statut"
    },
    kinds: {
      invoice: "Facture",
      contract: "Contrat",
      payment: "Preuve de paiement",
      archive: "Archive",
      converted: "Conversion",
      compressed: "Compression",
      organized: "Organisation",
      secured: "Sécurité",
      image: "Image",
      document: "Document"
    },
    owners: {
      finance: "Finance",
      legal: "Juridique",
      operations: "Opérations",
      compliance: "Conformité",
      tools: "Outils"
    },
    statuses: {
      approved: "Approuvé",
      review: "A revoir",
      processed: "Traité",
      queued: "En attente",
      processing: "En cours",
      completed: "Terminé",
      failed: "Échec"
    },
    selected: {
      vendor: "Fournisseur",
      vendorValue: "Airtel",
      amount: "Montant",
      amountValue: "$42,300",
      due: "Echéance",
      dueValue: "12 Sep 2026",
      rule: "Règle",
      ruleValue: "Montant supérieur à $10,000",
      approve: "Approuver",
      send: "Envoyer à Finance",
      source: "Source",
      action: "Action",
      result: "Résultat",
      ready: "Prêt au téléchargement",
      inProgress: "Traitement en cours",
      retention: "Conservation",
      retentionValue: "Temporaire, suppression automatique",
      download: "Télécharger",
      save: "Sauver dans le workspace"
    },
    activity: {
      uploaded: "Document importé",
      extracted: "Données extraites",
      routed: "Envoyé à Finance",
      approved: "Approuvé par CFO"
    },
    workflows: {
      invoiceApproval: "Factures fournisseurs",
      contractReview: "Revue contrats",
      financeExport: "Export finance",
      active: "Actif",
      draft: "Brouillon"
    }
  },
  en: {
    metaTitle: "Foliant Studio - Document workspace",
    metaDescription: "A workspace to process, track, and approve documents with Foliant.",
    nav: {
      home: "Home",
      documents: "Documents",
      inbox: "Inbox",
      workflows: "Workflows",
      approvals: "Approvals",
      ai: "AI",
      team: "Team",
      settings: "Settings"
    },
    plan: {
      label: "Current plan",
      name: "Studio preview",
      usage: "18 of 100 runs",
      usageSuffix: "of 100 runs",
      cta: "View plan"
    },
    header: {
      eyebrow: "Studio",
      title: "Documents",
      subtitle: "Find your documents and pick up where you left off.",
      search: "Search documents",
      upload: "Upload",
      automate: "Automate"
    },
    kpis: {
      inbox: ["Inbox", "14", "6 pending"],
      approvals: ["Approvals", "7", "2 urgent"],
      automation: ["Automation", "82%", "routed without action"],
      storage: ["Storage", "2.4 GB", "auto deletion active"]
    },
    metrics: {
      pending: "pending",
      review: "to review",
      completed: "completed",
      comingSoon: "Coming soon",
      comingSoonDetail: "Module in development",
      temporaryStorage: "temporary storage",
      recentJobs: "recent jobs"
    },
    filters: {
      all: "All",
      active: "Active",
      completed: "Completed",
      failed: "Failed",
      next: "Filter",
      byAction: "Action type",
      sort: "Sort documents",
      sortName: "Name",
      sortSize: "Size",
      sortStatus: "Status"
    },
    empty: {
      title: "No documents",
      text: "Files processed from public tools will appear here during their temporary retention window.",
      selected: "Select a document to show its preview and details.",
      loading: "Loading documents",
      loadError: "Unable to load documents",
      retry: "Try again"
    },
    workspace: {
      back: "Back to Studio",
      eyebrow: "Document workspace",
      subtitle: "Preview the result, review details, and choose the next action.",
      preview: "Preview",
      sourcePreview: "Source PDF preview. Your result is available for download.",
      details: "Details",
      actions: "Document actions",
      temporaryResult: "Temporary result",
      download: "Download result",
      unavailableTitle: "Document not found",
      unavailableText: "The file may have expired or belong to another local session.",
      loadingDocument: "Loading document",
      loadRetryText: "The storage connection failed temporarily. Please try again in a moment.",
      openTool: "Open tool",
      save: "Save to Studio",
      share: "Share",
      delete: "Delete document",
      finish: "Finish",
      thumbnails: "Pages",
      hideThumbnails: "Hide pages",
      showThumbnails: "Show pages",
      resultPanel: "Guest",
      hideResultPanel: "Hide Guest Studio",
      showResultPanel: "Show Guest Studio",
      addFile: "Add PDF, image, Word, Excel, or PowerPoint",
      currentPage: "1 / 1",
      zoom: "165%",
      comingSoon: "To connect",
      premium: "Premium",
      pageActions: {
        cannotDeleteLastPage: "Cannot delete the last page",
        clearSelection: "Clear selection",
        delete: "Delete page",
        deleteSelection: "Delete selected pages",
        error: "Unable to edit this page.",
        extract: "Extract page",
        extractSelection: "Extract selected pages",
        rotate: "Rotate page",
        select: "Select page",
        selected: "{count} selected"
      },
      documentStatus: {temporary: "Guest · Temporary document", saved: "Saved in Studio"},
      guest: {
        badge: "Guest Studio",
        title: "Your file is ready",
        text: "Download immediately, or keep working with this document in Foliant.",
        result: "Result",
        originalSize: "Original size",
        finalSize: "Final size",
        saved: "Saved",
        fileSize: "File size",
        expires: "Expires",
        temporary: "Temporary retention",
        download: "Download now",
        continueTitle: "Continue with this file",
        continueText: "Start another action without uploading the document again.",
        accountTitle: "Keep this document",
        accountText: "Create a free account to keep history and find your files later.",
        accountCta: "Create free account",
        noGate: "No account required to download."
      },
      versions: {
        title: "Version history",
        current: "Current version",
        version: "Version",
        preview: "Preview",
        restore: "Restore",
        restoring: "Restoring",
        download: "Download",
        empty: "No versions available.",
        error: "Unable to load version history.",
        hide: "Hide versions",
        show: "Show versions"
      },
      deleteDialog: {
        title: "Delete this document?",
        text: "The document and all its versions will be permanently deleted.",
        warning: "This action cannot be undone.",
        cancel: "Cancel",
        confirm: "Delete permanently",
        deleting: "Deleting",
        error: "Unable to delete the document. Nothing has been hidden."
      },
      launcher: {
        title: "Choose an action",
        subtitle: "Hover a category, choose a tool, then use the active file or upload directly inside Studio.",
        currentFile: "Use active file",
        uploadRequired: "Upload in Studio",
        incompatible: "Incompatible format",
        optionsLater: "Options to connect",
        editorLater: "Visual editor to connect",
        comingSoon: "Coming soon",
        premiumLater: "Premium later",
        openSignature: "Open signing",
        openDocument: "Open a document to use this tool.",
        uploadTitle: "Upload in Studio",
        uploadText: "",
        chooseFile: "Choose a file",
        dropText: "Drop or select a file",
        selected: "Selected file",
        selectedMany: "files selected",
        start: "Start processing",
        uploading: "Upload",
        processing: "Processing",
        close: "Close",
        error: "Unable to launch this tool.",
        needMoreFiles: "Select at least two files.",
        removeFile: "Remove file",
        sourceFirst: "Active document · first"
      },
      toolNav: {
        compress: "Compress",
        convert: "Convert",
        organize: "Organize",
        edit: "Edit",
        sign: "Secure",
        ai: "AI PDF",
        more: "More",
        documents: "Documents"
      },
      toolbar: {
        hand: "Hand",
        select: "Select",
        signatures: "Signatures",
        addSigners: "Add signers",
        date: "Date",
        text: "Text",
        approve: "Approve",
        undo: "Undo",
        redo: "Redo",
        search: "Search"
      },
      signModal: {
        title: "Add your signature",
        description: "Enter the name to display, then place the signature on the document.",
        nameLabel: "Signature name",
        namePlaceholder: "Your full name",
        styleLabel: "Style",
        styleScript: "Handwritten",
        styleElegant: "Classic",
        stylePlain: "Simple",
        colorLabel: "Color",
        clearDrawing: "Clear drawing",
        draw: "Draw", type: "Type", upload: "Upload",
        modes: "Signature mode", removeAnnotation: "Delete annotation",
        previewLabel: "Signature preview",
        previewPlaceholder: "Your signature",
        note: "This is a visual signature. It is not a certified electronic signature.",
        cancel: "Cancel",
        place: "Place signature",
        chooseSigner: "Choose who's signing",
        chooseSeal: "Choose sealing type",
        signMyself: "Sign myself",
        requestSignatures: "Request signatures",
        signWithoutSeal: "Sign without a seal",
        signWithSeal: "Sign with digital seal",
        selfText: "Create a signature and sign the document.",
        requestText: "Send the document to others for signature.",
        noSealText: "Sign quickly without a digital certificate.",
        sealText: "Add a verifiable certificate with an audit trail.",
        trialText: "Available in the premium plan.",
        close: "Close"
      }
    },
    views: {
      documents: {
        title: "Documents",
        subtitle: "Find your documents and pick up where you left off."
      },
      inbox: {
        title: "Inbox",
        subtitle: "Centralize documents received by email, direct upload, or API.",
        state: "Email/API ingestion to connect"
      },
      workflows: {
        title: "Workflows",
        subtitle: "Create rules that classify, route, approve, and export documents.",
        state: "Workflow builder to build"
      },
      approvals: {
        title: "Approvals",
        subtitle: "Track documents waiting for a decision or validation.",
        state: "Approvals based on documents in review"
      },
      ai: {
        title: "AI",
        subtitle: "Extract, summarize, classify, and query documents with AI.",
        state: "OCR and extraction to connect"
      },
      team: {
        title: "Team",
        subtitle: "Manage roles, access, and responsibilities around documents.",
        state: "Accounts and roles to connect"
      },
      settings: {
        title: "Settings",
        subtitle: "Configure storage, API, quotas, automatic deletion, and billing.",
        state: "Workspace settings to create"
      }
    },
    actions: {
      email: ["Email inbox", "Receive incoming PDFs"],
      api: ["API upload", "Connect your systems"],
      rules: ["Rules", "Route by amount/type"]
    },
    sections: {
      recent: "Recent documents",
      recentText: "",
      selected: "Selected document",
      preview: "PDF preview",
      extracted: "Extracted data",
      activity: "Activity",
      workflows: "Active workflows"
    },
    table: {
      document: "Document",
      type: "Type",
      owner: "Team",
      value: "Value",
      status: "Status"
    },
    kinds: {
      invoice: "Invoice",
      contract: "Contract",
      payment: "Payment proof",
      archive: "Archive",
      converted: "Conversion",
      compressed: "Compression",
      organized: "Organization",
      secured: "Security",
      image: "Image",
      document: "Document"
    },
    owners: {
      finance: "Finance",
      legal: "Legal",
      operations: "Operations",
      compliance: "Compliance",
      tools: "Tools"
    },
    statuses: {
      approved: "Approved",
      review: "Review",
      processed: "Processed",
      queued: "Queued",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed"
    },
    selected: {
      vendor: "Vendor",
      vendorValue: "Airtel",
      amount: "Amount",
      amountValue: "$42,300",
      due: "Due date",
      dueValue: "Sep 12, 2026",
      rule: "Rule",
      ruleValue: "Amount above $10,000",
      approve: "Approve",
      send: "Send to Finance",
      source: "Source",
      action: "Action",
      result: "Result",
      ready: "Ready to download",
      inProgress: "Processing",
      retention: "Retention",
      retentionValue: "Temporary, automatic deletion",
      download: "Download",
      save: "Save to workspace"
    },
    activity: {
      uploaded: "Document uploaded",
      extracted: "Data extracted",
      routed: "Sent to Finance",
      approved: "Approved by CFO"
    },
    workflows: {
      invoiceApproval: "Supplier invoices",
      contractReview: "Contract review",
      financeExport: "Finance export",
      active: "Active",
      draft: "Draft"
    }
  },
  es: {
    metaTitle: "Foliant Studio - Espacio de documentos",
    metaDescription: "Un espacio para procesar, seguir y aprobar documentos con Foliant.",
    nav: {
      home: "Inicio",
      documents: "Documentos",
      inbox: "Inbox",
      workflows: "Workflows",
      approvals: "Aprobaciones",
      ai: "IA",
      team: "Equipo",
      settings: "Ajustes"
    },
    plan: {
      label: "Plan actual",
      name: "Studio preview",
      usage: "18 de 100 procesos",
      usageSuffix: "de 100 procesos",
      cta: "Ver plan"
    },
    header: {
      eyebrow: "Studio",
      title: "Documentos",
      subtitle: "Encuentra tus documentos y retoma tus modificaciones.",
      search: "Buscar documentos",
      upload: "Subir",
      automate: "Automatizar"
    },
    kpis: {
      inbox: ["Inbox", "14", "6 pendientes"],
      approvals: ["Aprobaciones", "7", "2 urgentes"],
      automation: ["Automatización", "82%", "ruteados sin acción"],
      storage: ["Almacenamiento", "2.4 GB", "borrado automático activo"]
    },
    metrics: {
      pending: "pendientes",
      review: "por revisar",
      completed: "terminados",
      comingSoon: "Próximamente",
      comingSoonDetail: "Módulo en preparación",
      temporaryStorage: "almacenamiento temporal",
      recentJobs: "jobs recientes"
    },
    filters: {
      all: "Todos",
      active: "En curso",
      completed: "Terminados",
      failed: "Errores",
      next: "Filtrar",
      byAction: "Tipo de acción",
      sort: "Ordenar documentos",
      sortName: "Nombre",
      sortSize: "Tamaño",
      sortStatus: "Estado"
    },
    empty: {
      title: "Sin documentos",
      text: "Los archivos procesados desde las herramientas públicas aparecerán aquí durante su retención temporal.",
      selected: "Selecciona un documento para mostrar su vista previa y detalles.",
      loading: "Cargando documentos",
      loadError: "No se pudieron cargar los documentos",
      retry: "Reintentar"
    },
    workspace: {
      back: "Volver al Studio",
      eyebrow: "Workspace de documento",
      subtitle: "Previsualiza el resultado, revisa detalles y elige la siguiente acción.",
      preview: "Vista previa",
      sourcePreview: "Vista previa del PDF de origen. El resultado está disponible para descargar.",
      details: "Detalles",
      actions: "Acciones del documento",
      temporaryResult: "Resultado temporal",
      download: "Descargar resultado",
      unavailableTitle: "Documento no encontrado",
      unavailableText: "El archivo puede haber expirado o pertenecer a otra sesión local.",
      loadingDocument: "Cargando documento",
      loadRetryText: "La conexión con el almacenamiento falló temporalmente. Inténtalo de nuevo.",
      openTool: "Abrir herramienta",
      save: "Guardar en Studio",
      share: "Compartir",
      delete: "Eliminar documento",
      finish: "Terminar",
      thumbnails: "Páginas",
      hideThumbnails: "Ocultar páginas",
      showThumbnails: "Mostrar páginas",
      resultPanel: "Invitado",
      hideResultPanel: "Ocultar Studio invitado",
      showResultPanel: "Mostrar Studio invitado",
      addFile: "Agregar PDF, imagen, Word, Excel o PowerPoint",
      currentPage: "1 / 1",
      zoom: "165%",
      comingSoon: "Por conectar",
      premium: "Premium",
      pageActions: {
        cannotDeleteLastPage: "No se puede eliminar la última página",
        clearSelection: "Borrar la selección",
        delete: "Eliminar página",
        deleteSelection: "Eliminar las páginas seleccionadas",
        error: "No se puede editar esta página.",
        extract: "Extraer página",
        extractSelection: "Extraer las páginas seleccionadas",
        rotate: "Girar página",
        select: "Seleccionar página",
        selected: "{count} seleccionadas"
      },
      documentStatus: {temporary: "Invitado · Documento temporal", saved: "Guardado en Studio"},
      guest: {
        badge: "Studio invitado",
        title: "Tu archivo está listo",
        text: "Descarga de inmediato o sigue trabajando con este documento en Foliant.",
        result: "Resultado",
        originalSize: "Tamaño inicial",
        finalSize: "Tamaño final",
        saved: "Ahorro",
        fileSize: "Tamaño del archivo",
        expires: "Expira",
        temporary: "Retención temporal",
        download: "Descargar ahora",
        continueTitle: "Continuar con este archivo",
        continueText: "Inicia otra acción sin volver a subir el documento.",
        accountTitle: "Conservar este documento",
        accountText: "Crea una cuenta gratis para mantener el historial y encontrar tus archivos después.",
        accountCta: "Crear cuenta gratis",
        noGate: "No se requiere cuenta para descargar."
      },
      versions: {
        title: "Historial de versiones",
        current: "Versión actual",
        version: "Versión",
        preview: "Previsualizar",
        restore: "Restaurar",
        restoring: "Restaurando",
        download: "Descargar",
        empty: "No hay versiones disponibles.",
        error: "No se pudo cargar el historial.",
        hide: "Ocultar versiones",
        show: "Mostrar versiones"
      },
      deleteDialog: {
        title: "¿Eliminar este documento?",
        text: "El documento y todas sus versiones se eliminarán permanentemente.",
        warning: "Esta acción no se puede deshacer.",
        cancel: "Cancelar",
        confirm: "Eliminar definitivamente",
        deleting: "Eliminando",
        error: "No se pudo eliminar el documento. No se ocultó ningún cambio."
      },
      launcher: {
        title: "Elegir una acción",
        subtitle: "Pasa por una categoría, elige una herramienta y usa el archivo activo o sube uno dentro del Studio.",
        currentFile: "Usar archivo activo",
        uploadRequired: "Subir en Studio",
        incompatible: "Formato incompatible",
        optionsLater: "Opciones por conectar",
        editorLater: "Editor visual por conectar",
        comingSoon: "Próximamente",
        premiumLater: "Premium más adelante",
        openSignature: "Abrir firma",
        openDocument: "Abre un documento para usar esta herramienta.",
        uploadTitle: "Subir en Studio",
        uploadText: "",
        chooseFile: "Elegir archivo",
        dropText: "Suelta o selecciona un archivo",
        selected: "Archivo seleccionado",
        selectedMany: "archivos seleccionados",
        start: "Iniciar proceso",
        uploading: "Subida",
        processing: "Procesando",
        close: "Cerrar",
        error: "No se puede iniciar esta herramienta.",
        needMoreFiles: "Selecciona al menos dos archivos.",
        removeFile: "Quitar archivo",
        sourceFirst: "Documento activo · primero"
      },
      toolNav: {
        compress: "Comprimir",
        convert: "Convertir",
        organize: "Organizar",
        edit: "Editar",
        sign: "Proteger",
        ai: "IA PDF",
        more: "Más",
        documents: "Documentos"
      },
      toolbar: {
        hand: "Mano",
        select: "Selección",
        signatures: "Firmas",
        addSigners: "Añadir firmantes",
        date: "Fecha",
        text: "Texto",
        approve: "Validar",
        undo: "Deshacer",
        redo: "Rehacer",
        search: "Buscar"
      },
      signModal: {
        title: "Añade tu firma",
        description: "Introduce el nombre que se mostrará y coloca la firma en el documento.",
        nameLabel: "Nombre de la firma",
        namePlaceholder: "Tu nombre completo",
        styleLabel: "Estilo",
        styleScript: "Manuscrito",
        styleElegant: "Clásico",
        stylePlain: "Simple",
        colorLabel: "Color",
        clearDrawing: "Borrar dibujo",
        draw: "Dibujar", type: "Escribir", upload: "Subir",
        modes: "Modo de firma", removeAnnotation: "Eliminar anotación",
        previewLabel: "Vista previa de la firma",
        previewPlaceholder: "Tu firma",
        note: "Esta firma es visual. No es una firma electrónica certificada.",
        cancel: "Cancelar",
        place: "Colocar firma",
        chooseSigner: "Elegir quién firma",
        chooseSeal: "Elegir tipo de firma",
        signMyself: "Firmar yo mismo",
        requestSignatures: "Solicitar firmas",
        signWithoutSeal: "Firmar sin certificado",
        signWithSeal: "Firmar con certificado",
        selfText: "Crear una firma y firmar el documento.",
        requestText: "Enviar el documento a otras personas para firma.",
        noSealText: "Firmar rápidamente sin certificado digital.",
        sealText: "Agregar un certificado verificable con pista de auditoría.",
        trialText: "Disponible en el plan premium.",
        close: "Cerrar"
      }
    },
    views: {
      documents: {
        title: "Documentos",
        subtitle: "Encuentra tus documentos y retoma tus modificaciones."
      },
      inbox: {
        title: "Inbox",
        subtitle: "Centralizar documentos recibidos por email, carga directa o API.",
        state: "Ingesta email/API por conectar"
      },
      workflows: {
        title: "Workflows",
        subtitle: "Crear reglas que clasifican, enrutan, aprueban y exportan documentos.",
        state: "Builder de workflows por construir"
      },
      approvals: {
        title: "Aprobaciones",
        subtitle: "Seguir documentos que esperan una decisión o validación.",
        state: "Aprobaciones basadas en documentos en revisión"
      },
      ai: {
        title: "IA",
        subtitle: "Extraer, resumir, clasificar y consultar documentos con IA.",
        state: "OCR y extracción por conectar"
      },
      team: {
        title: "Equipo",
        subtitle: "Gestionar roles, accesos y responsabilidades sobre documentos.",
        state: "Cuentas y roles por conectar"
      },
      settings: {
        title: "Ajustes",
        subtitle: "Configurar almacenamiento, API, cuotas, borrado automático y facturación.",
        state: "Ajustes de workspace por crear"
      }
    },
    actions: {
      email: ["Email inbox", "Recibir PDF entrantes"],
      api: ["API upload", "Conectar sistemas"],
      rules: ["Reglas", "Rutear por monto/tipo"]
    },
    sections: {
      recent: "Documentos recientes",
      recentText: "",
      selected: "Documento seleccionado",
      preview: "Vista PDF",
      extracted: "Datos extraídos",
      activity: "Actividad",
      workflows: "Workflows activos"
    },
    table: {
      document: "Documento",
      type: "Tipo",
      owner: "Equipo",
      value: "Valor",
      status: "Estado"
    },
    kinds: {
      invoice: "Factura",
      contract: "Contrato",
      payment: "Comprobante de pago",
      archive: "Archivo",
      converted: "Conversión",
      compressed: "Compresión",
      organized: "Organización",
      secured: "Seguridad",
      image: "Imagen",
      document: "Documento"
    },
    owners: {
      finance: "Finanzas",
      legal: "Legal",
      operations: "Operaciones",
      compliance: "Cumplimiento",
      tools: "Herramientas"
    },
    statuses: {
      approved: "Aprobado",
      review: "Revisión",
      processed: "Procesado",
      queued: "En espera",
      processing: "En curso",
      completed: "Terminado",
      failed: "Error"
    },
    selected: {
      vendor: "Proveedor",
      vendorValue: "Airtel",
      amount: "Monto",
      amountValue: "$42,300",
      due: "Vencimiento",
      dueValue: "12 Sep 2026",
      rule: "Regla",
      ruleValue: "Monto superior a $10,000",
      approve: "Aprobar",
      send: "Enviar a Finanzas",
      source: "Fuente",
      action: "Acción",
      result: "Resultado",
      ready: "Listo para descargar",
      inProgress: "Procesando",
      retention: "Retención",
      retentionValue: "Temporal, borrado automático",
      download: "Descargar",
      save: "Guardar en workspace"
    },
    activity: {
      uploaded: "Documento subido",
      extracted: "Datos extraídos",
      routed: "Enviado a Finanzas",
      approved: "Aprobado por CFO"
    },
    workflows: {
      invoiceApproval: "Facturas de proveedores",
      contractReview: "Revisión de contratos",
      financeExport: "Exportación financiera",
      active: "Activo",
      draft: "Borrador"
    }
  },
  pt: {
    metaTitle: "Foliant Studio - Espaço de documentos",
    metaDescription: "Um espaço para processar, acompanhar e aprovar documentos com Foliant.",
    nav: {
      home: "Início",
      documents: "Documentos",
      inbox: "Inbox",
      workflows: "Workflows",
      approvals: "Aprovações",
      ai: "IA",
      team: "Equipe",
      settings: "Ajustes"
    },
    plan: {
      label: "Plano atual",
      name: "Studio preview",
      usage: "18 de 100 processos",
      usageSuffix: "de 100 processos",
      cta: "Ver plano"
    },
    header: {
      eyebrow: "Studio",
      title: "Documentos",
      subtitle: "Encontre seus documentos e retome suas alterações.",
      search: "Buscar documentos",
      upload: "Enviar",
      automate: "Automatizar"
    },
    kpis: {
      inbox: ["Inbox", "14", "6 pendentes"],
      approvals: ["Aprovações", "7", "2 urgentes"],
      automation: ["Automação", "82%", "roteados sem ação"],
      storage: ["Armazenamento", "2.4 GB", "exclusão automática ativa"]
    },
    metrics: {
      pending: "pendentes",
      review: "para revisar",
      completed: "concluídos",
      comingSoon: "Em breve",
      comingSoonDetail: "Módulo em preparação",
      temporaryStorage: "armazenamento temporário",
      recentJobs: "jobs recentes"
    },
    filters: {
      all: "Todos",
      active: "Em curso",
      completed: "Concluídos",
      failed: "Falhas",
      next: "Filtrar",
      byAction: "Tipo de ação",
      sort: "Ordenar documentos",
      sortName: "Nome",
      sortSize: "Tamanho",
      sortStatus: "Status"
    },
    empty: {
      title: "Sem documentos",
      text: "Os arquivos processados pelas ferramentas públicas aparecerão aqui durante a retenção temporária.",
      selected: "Selecione um documento para exibir sua prévia e detalhes.",
      loading: "Carregando documentos",
      loadError: "Não foi possível carregar os documentos",
      retry: "Tentar novamente"
    },
    workspace: {
      back: "Voltar ao Studio",
      eyebrow: "Workspace do documento",
      subtitle: "Pré-visualize o resultado, revise detalhes e escolha a próxima ação.",
      preview: "Prévia",
      sourcePreview: "Prévia do PDF de origem. O resultado está disponível para download.",
      details: "Detalhes",
      actions: "Ações do documento",
      temporaryResult: "Resultado temporário",
      download: "Baixar resultado",
      unavailableTitle: "Documento não encontrado",
      unavailableText: "O arquivo pode ter expirado ou pertencer a outra sessão local.",
      loadingDocument: "Carregando documento",
      loadRetryText: "A conexão com o armazenamento falhou temporariamente. Tente novamente.",
      openTool: "Abrir ferramenta",
      save: "Salvar no Studio",
      share: "Compartilhar",
      delete: "Excluir documento",
      finish: "Finalizar",
      thumbnails: "Páginas",
      hideThumbnails: "Ocultar páginas",
      showThumbnails: "Mostrar páginas",
      resultPanel: "Convidado",
      hideResultPanel: "Ocultar Studio convidado",
      showResultPanel: "Mostrar Studio convidado",
      addFile: "Adicionar PDF, imagem, Word, Excel ou PowerPoint",
      currentPage: "1 / 1",
      zoom: "165%",
      comingSoon: "A conectar",
      premium: "Premium",
      pageActions: {
        cannotDeleteLastPage: "Não é possível excluir a última página",
        clearSelection: "Limpar seleção",
        delete: "Excluir página",
        deleteSelection: "Excluir páginas selecionadas",
        error: "Não foi possível editar esta página.",
        extract: "Extrair página",
        extractSelection: "Extrair páginas selecionadas",
        rotate: "Girar página",
        select: "Selecionar página",
        selected: "{count} selecionadas"
      },
      documentStatus: {temporary: "Convidado · Documento temporário", saved: "Salvo no Studio"},
      guest: {
        badge: "Studio convidado",
        title: "Seu arquivo está pronto",
        text: "Baixe imediatamente ou continue trabalhando com este documento no Foliant.",
        result: "Resultado",
        originalSize: "Tamanho inicial",
        finalSize: "Tamanho final",
        saved: "Economia",
        fileSize: "Tamanho do arquivo",
        expires: "Expira",
        temporary: "Retenção temporária",
        download: "Baixar agora",
        continueTitle: "Continuar com este arquivo",
        continueText: "Inicie outra ação sem enviar o documento novamente.",
        accountTitle: "Guardar este documento",
        accountText: "Crie uma conta grátis para manter o histórico e encontrar seus arquivos depois.",
        accountCta: "Criar conta grátis",
        noGate: "Nenhuma conta é necessária para baixar."
      },
      versions: {
        title: "Histórico de versões",
        current: "Versão atual",
        version: "Versão",
        preview: "Pré-visualizar",
        restore: "Restaurar",
        restoring: "Restaurando",
        download: "Baixar",
        empty: "Nenhuma versão disponível.",
        error: "Não foi possível carregar o histórico.",
        hide: "Ocultar versões",
        show: "Mostrar versões"
      },
      deleteDialog: {
        title: "Excluir este documento?",
        text: "O documento e todas as suas versões serão excluídos permanentemente.",
        warning: "Esta ação não pode ser desfeita.",
        cancel: "Cancelar",
        confirm: "Excluir definitivamente",
        deleting: "Excluindo",
        error: "Não foi possível excluir o documento. Nenhuma alteração foi ocultada."
      },
      launcher: {
        title: "Escolher uma ação",
        subtitle: "Passe por uma categoria, escolha uma ferramenta e use o arquivo ativo ou envie outro dentro do Studio.",
        currentFile: "Usar arquivo ativo",
        uploadRequired: "Enviar no Studio",
        incompatible: "Formato incompatível",
        optionsLater: "Opções a conectar",
        editorLater: "Editor visual a conectar",
        comingSoon: "Em breve",
        premiumLater: "Premium depois",
        openSignature: "Abrir assinatura",
        openDocument: "Abra um documento para usar esta ferramenta.",
        uploadTitle: "Enviar no Studio",
        uploadText: "",
        chooseFile: "Escolher arquivo",
        dropText: "Solte ou selecione um arquivo",
        selected: "Arquivo selecionado",
        selectedMany: "arquivos selecionados",
        start: "Iniciar processamento",
        uploading: "Upload",
        processing: "Processando",
        close: "Fechar",
        error: "Não foi possível iniciar esta ferramenta.",
        needMoreFiles: "Selecione pelo menos dois arquivos.",
        removeFile: "Remover arquivo",
        sourceFirst: "Documento ativo · primeiro"
      },
      toolNav: {
        compress: "Comprimir",
        convert: "Converter",
        organize: "Organizar",
        edit: "Editar",
        sign: "Proteger",
        ai: "IA PDF",
        more: "Mais",
        documents: "Documentos"
      },
      toolbar: {
        hand: "Mão",
        select: "Seleção",
        signatures: "Assinaturas",
        addSigners: "Adicionar signatários",
        date: "Data",
        text: "Texto",
        approve: "Validar",
        undo: "Desfazer",
        redo: "Refazer",
        search: "Buscar"
      },
      signModal: {
        title: "Adicione sua assinatura",
        description: "Informe o nome a exibir e posicione a assinatura no documento.",
        nameLabel: "Nome da assinatura",
        namePlaceholder: "Seu nome completo",
        styleLabel: "Estilo",
        styleScript: "Manuscrito",
        styleElegant: "Clássico",
        stylePlain: "Simples",
        colorLabel: "Cor",
        clearDrawing: "Apagar desenho",
        draw: "Desenhar", type: "Digitar", upload: "Importar",
        modes: "Modo de assinatura", removeAnnotation: "Excluir anotação",
        previewLabel: "Prévia da assinatura",
        previewPlaceholder: "Sua assinatura",
        note: "Esta assinatura é visual. Ela não é uma assinatura eletrônica certificada.",
        cancel: "Cancelar",
        place: "Posicionar assinatura",
        chooseSigner: "Escolher quem assina",
        chooseSeal: "Escolher tipo de assinatura",
        signMyself: "Assinar eu mesmo",
        requestSignatures: "Solicitar assinaturas",
        signWithoutSeal: "Assinar sem certificado",
        signWithSeal: "Assinar com certificado",
        selfText: "Criar uma assinatura e assinar o documento.",
        requestText: "Enviar o documento para outras pessoas assinarem.",
        noSealText: "Assinar rapidamente sem certificado digital.",
        sealText: "Adicionar um certificado verificável com trilha de auditoria.",
        trialText: "Disponível no plano premium.",
        close: "Fechar"
      }
    },
    views: {
      documents: {
        title: "Documentos",
        subtitle: "Encontre seus documentos e retome suas alterações."
      },
      inbox: {
        title: "Inbox",
        subtitle: "Centralizar documentos recebidos por email, upload direto ou API.",
        state: "Ingestão email/API a conectar"
      },
      workflows: {
        title: "Workflows",
        subtitle: "Criar regras que classificam, roteiam, aprovam e exportam documentos.",
        state: "Builder de workflows a construir"
      },
      approvals: {
        title: "Aprovações",
        subtitle: "Acompanhar documentos aguardando decisão ou validação.",
        state: "Aprovações baseadas em documentos em revisão"
      },
      ai: {
        title: "IA",
        subtitle: "Extrair, resumir, classificar e consultar documentos com IA.",
        state: "OCR e extração a conectar"
      },
      team: {
        title: "Equipe",
        subtitle: "Gerenciar funções, acessos e responsabilidades sobre documentos.",
        state: "Contas e funções a conectar"
      },
      settings: {
        title: "Ajustes",
        subtitle: "Configurar armazenamento, API, cotas, exclusão automática e cobrança.",
        state: "Ajustes do workspace a criar"
      }
    },
    actions: {
      email: ["Email inbox", "Receber PDFs de entrada"],
      api: ["API upload", "Conectar seus sistemas"],
      rules: ["Regras", "Rotear por valor/tipo"]
    },
    sections: {
      recent: "Documentos recentes",
      recentText: "",
      selected: "Documento selecionado",
      preview: "Prévia PDF",
      extracted: "Dados extraídos",
      activity: "Atividade",
      workflows: "Workflows ativos"
    },
    table: {
      document: "Documento",
      type: "Tipo",
      owner: "Equipe",
      value: "Valor",
      status: "Status"
    },
    kinds: {
      invoice: "Fatura",
      contract: "Contrato",
      payment: "Comprovante de pagamento",
      archive: "Arquivo",
      converted: "Conversão",
      compressed: "Compressão",
      organized: "Organização",
      secured: "Segurança",
      image: "Imagem",
      document: "Documento"
    },
    owners: {
      finance: "Financeiro",
      legal: "Jurídico",
      operations: "Operações",
      compliance: "Compliance",
      tools: "Ferramentas"
    },
    statuses: {
      approved: "Aprovado",
      review: "Revisão",
      processed: "Processado",
      queued: "Pendente",
      processing: "Em curso",
      completed: "Concluído",
      failed: "Falha"
    },
    selected: {
      vendor: "Fornecedor",
      vendorValue: "Airtel",
      amount: "Valor",
      amountValue: "$42,300",
      due: "Vencimento",
      dueValue: "12 Set 2026",
      rule: "Regra",
      ruleValue: "Valor acima de $10,000",
      approve: "Aprovar",
      send: "Enviar para Financeiro",
      source: "Origem",
      action: "Ação",
      result: "Resultado",
      ready: "Pronto para download",
      inProgress: "Processando",
      retention: "Retenção",
      retentionValue: "Temporário, exclusão automática",
      download: "Baixar",
      save: "Salvar no workspace"
    },
    activity: {
      uploaded: "Documento enviado",
      extracted: "Dados extraídos",
      routed: "Enviado ao Financeiro",
      approved: "Aprovado pelo CFO"
    },
    workflows: {
      invoiceApproval: "Faturas de fornecedores",
      contractReview: "Revisão de contratos",
      financeExport: "Exportação financeira",
      active: "Ativo",
      draft: "Rascunho"
    }
  }
} as const;

export function getStudioCopy(locale: string) {
  return studioCopy[locale as Locale] ?? studioCopy.fr;
}
