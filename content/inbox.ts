const en = {
  title: "Inbox", subtitle: "Received PDFs", deposit: "Receive a PDF", choose: "Choose PDF", upload: "Receive", uploading: "Receiving PDF…",
  received: "To process", accepted: "Added", archived: "Archived", restored: "Restored",
  search: "Search received files", newest: "Newest first", oldest: "Oldest first", sort: "Sort by date",
  loading: "Loading…", unavailable: "Inbox is unavailable. Please try again.", retry: "Try again", refresh: "Refresh",
  empty: "No received PDFs", noMatch: "No matching PDFs", emptyAccepted: "No PDFs added to Documents", emptyArchived: "No archived PDFs",
  signIn: "Sign in to access Inbox", select: "Select a PDF", detail: "Received PDF", name: "File", size: "Size", date: "Received", origin: "Origin", manual: "Manual upload",
  download: "Download original", preview: "PDF preview", protected: "Password-protected PDF", protectedText: "Preview requires a password. The original remains available for download.",
  add: "Add to Documents", open: "Open document", archive: "Archive", restore: "Restore", busy: "Saving…", history: "Activity",
  deleted: "The saved document was deleted.", receivedSuccess: "PDF received", archivedSuccess: "Receipt archived", restoredSuccess: "Receipt restored",
  previous: "Previous page", next: "Next page", pages: "Pages", unknown: "Unknown", close: "Close", pending: "To process",
  fileTooLarge: "The PDF must be no larger than 25 MB.", invalidPdf: "This file is not a valid PDF.", invalidName: "Choose a PDF with a filename of no more than 180 characters.",
  quota: "Inbox storage limit reached.", conflict: "This receipt has changed. Refresh Inbox before trying again.", notFound: "This receipt is no longer available.",
  rate: "Too many requests. Wait a minute and try again.", total: "files", drop: "Drop a PDF here", limit: "PDF · 25 MB maximum"
};
type InboxCopy = typeof en;
export const inboxCopy: Record<string, InboxCopy> = {
  en,
  fr: {
    title: "Inbox", subtitle: "PDF reçus", deposit: "Recevoir un PDF", choose: "Choisir un PDF", upload: "Recevoir", uploading: "Réception du PDF…",
    received: "À traiter", accepted: "Ajoutés", archived: "Archivés", restored: "Restauré",
    search: "Rechercher un fichier reçu", newest: "Plus récents", oldest: "Plus anciens", sort: "Trier par date",
    loading: "Chargement…", unavailable: "Inbox est indisponible. Réessayez.", retry: "Réessayer", refresh: "Actualiser",
    empty: "Aucun PDF reçu", noMatch: "Aucun PDF correspondant", emptyAccepted: "Aucun PDF ajouté à Documents", emptyArchived: "Aucun PDF archivé",
    signIn: "Se connecter pour accéder à Inbox", select: "Sélectionner un PDF", detail: "PDF reçu", name: "Fichier", size: "Taille", date: "Reçu le", origin: "Origine", manual: "Dépôt manuel",
    download: "Télécharger l’original", preview: "Aperçu PDF", protected: "PDF protégé par mot de passe", protectedText: "L’aperçu nécessite un mot de passe. L’original reste téléchargeable.",
    add: "Ajouter à Documents", open: "Ouvrir le document", archive: "Archiver", restore: "Restaurer", busy: "Enregistrement…", history: "Activité",
    deleted: "Le document sauvegardé a été supprimé.", receivedSuccess: "PDF reçu", archivedSuccess: "Réception archivée", restoredSuccess: "Réception restaurée",
    previous: "Page précédente", next: "Page suivante", pages: "Pages", unknown: "Inconnu", close: "Fermer", pending: "À traiter",
    fileTooLarge: "Le PDF ne doit pas dépasser 25 Mo.", invalidPdf: "Ce fichier n’est pas un PDF valide.", invalidName: "Choisissez un PDF dont le nom ne dépasse pas 180 caractères.",
    quota: "La limite de stockage Inbox est atteinte.", conflict: "Cette réception a changé. Actualisez Inbox avant de réessayer.", notFound: "Cette réception n’est plus disponible.",
    rate: "Trop de demandes. Attendez une minute puis réessayez.", total: "fichiers", drop: "Déposer un PDF ici", limit: "PDF · 25 Mo maximum"
  },
  es: {
    title: "Inbox", subtitle: "PDF recibidos", deposit: "Recibir un PDF", choose: "Elegir PDF", upload: "Recibir", uploading: "Recibiendo PDF…",
    received: "Por procesar", accepted: "Añadidos", archived: "Archivados", restored: "Restaurado",
    search: "Buscar archivos recibidos", newest: "Más recientes", oldest: "Más antiguos", sort: "Ordenar por fecha",
    loading: "Cargando…", unavailable: "Inbox no está disponible. Inténtalo de nuevo.", retry: "Reintentar", refresh: "Actualizar",
    empty: "No hay PDF recibidos", noMatch: "No hay PDF coincidentes", emptyAccepted: "No hay PDF añadidos a Documentos", emptyArchived: "No hay PDF archivados",
    signIn: "Iniciar sesión para acceder a Inbox", select: "Seleccionar un PDF", detail: "PDF recibido", name: "Archivo", size: "Tamaño", date: "Recibido", origin: "Origen", manual: "Carga manual",
    download: "Descargar original", preview: "Vista previa PDF", protected: "PDF protegido con contraseña", protectedText: "La vista previa requiere una contraseña. El original se puede descargar.",
    add: "Añadir a Documentos", open: "Abrir documento", archive: "Archivar", restore: "Restaurar", busy: "Guardando…", history: "Actividad",
    deleted: "El documento guardado fue eliminado.", receivedSuccess: "PDF recibido", archivedSuccess: "Recepción archivada", restoredSuccess: "Recepción restaurada",
    previous: "Página anterior", next: "Página siguiente", pages: "Páginas", unknown: "Desconocido", close: "Cerrar", pending: "Por procesar",
    fileTooLarge: "El PDF no debe superar los 25 MB.", invalidPdf: "Este archivo no es un PDF válido.", invalidName: "Elige un PDF con un nombre de hasta 180 caracteres.",
    quota: "Se alcanzó el límite de almacenamiento de Inbox.", conflict: "Esta recepción ha cambiado. Actualiza Inbox antes de reintentar.", notFound: "Esta recepción ya no está disponible.",
    rate: "Demasiadas solicitudes. Espera un minuto y reintenta.", total: "archivos", drop: "Suelta un PDF aquí", limit: "PDF · 25 MB máximo"
  },
  pt: {
    title: "Inbox", subtitle: "PDF recebidos", deposit: "Receber um PDF", choose: "Escolher PDF", upload: "Receber", uploading: "Recebendo PDF…",
    received: "Por processar", accepted: "Adicionados", archived: "Arquivados", restored: "Restaurado",
    search: "Pesquisar arquivos recebidos", newest: "Mais recentes", oldest: "Mais antigos", sort: "Ordenar por data",
    loading: "Carregando…", unavailable: "Inbox indisponível. Tente novamente.", retry: "Tentar novamente", refresh: "Atualizar",
    empty: "Nenhum PDF recebido", noMatch: "Nenhum PDF correspondente", emptyAccepted: "Nenhum PDF adicionado a Documentos", emptyArchived: "Nenhum PDF arquivado",
    signIn: "Entrar para acessar Inbox", select: "Selecionar um PDF", detail: "PDF recebido", name: "Arquivo", size: "Tamanho", date: "Recebido em", origin: "Origem", manual: "Envio manual",
    download: "Baixar original", preview: "Prévia PDF", protected: "PDF protegido por senha", protectedText: "A prévia requer uma senha. O original continua disponível para download.",
    add: "Adicionar a Documentos", open: "Abrir documento", archive: "Arquivar", restore: "Restaurar", busy: "Salvando…", history: "Atividade",
    deleted: "O documento salvo foi excluído.", receivedSuccess: "PDF recebido", archivedSuccess: "Recepção arquivada", restoredSuccess: "Recepção restaurada",
    previous: "Página anterior", next: "Próxima página", pages: "Páginas", unknown: "Desconhecido", close: "Fechar", pending: "Por processar",
    fileTooLarge: "O PDF não deve ultrapassar 25 MB.", invalidPdf: "Este arquivo não é um PDF válido.", invalidName: "Escolha um PDF com um nome de até 180 caracteres.",
    quota: "O limite de armazenamento de Inbox foi atingido.", conflict: "Esta recepção mudou. Atualize Inbox antes de tentar novamente.", notFound: "Esta recepção não está mais disponível.",
    rate: "Muitas solicitações. Aguarde um minuto e tente novamente.", total: "arquivos", drop: "Solte um PDF aqui", limit: "PDF · máximo 25 MB"
  }
};
