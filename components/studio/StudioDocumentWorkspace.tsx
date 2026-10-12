"use client";

import Link from "next/link";
import {StudioAccountButton, useStudioAccount} from "@/components/studio/StudioAccount";
import {StudioSignaturePad} from "@/components/studio/StudioSignaturePad";
import {StudioActivity} from "@/components/studio/StudioActivity";
import {StudioApprovalRequest} from "@/components/studio/StudioApprovals";
import {approvalCopy} from "@/content/approvals";
import {activityCopy} from "@/content/activity";
import {getAuthCopy} from "@/content/auth";
import {navigateWithinStudio, useGuestSessionLifecycle} from "@/lib/studio/guest-navigation";
import {useTranslations} from "next-intl";
import {type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState} from "react";
import {
  getStudioCopy,
  type StudioDocument
} from "@/content/studio";
import {studioToolCategories, studioToolItems, type ContinueAction, type StudioToolCategory, type StudioToolInput, type StudioToolItem} from "@/content/studio-tools";
export {studioToolCategories, studioToolItems} from "@/content/studio-tools";
export type {StudioToolCategory, StudioToolItem} from "@/content/studio-tools";
import type {ToolAction} from "@/content/tools/actions";
import {StudioPdfViewer, type StudioEditorTool, type StudioPageAction, type StudioPdfAnnotation, type StudioPdfFormField, type StudioPageNumberPreview, type StudioWatermarkPreview} from "@/components/studio/StudioPdfViewer";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "@/components/uploader/clientError";
import {uploadFileWithProgress} from "@/components/uploader/upload";
import {fetchStudioDocument} from "@/lib/studio/client";
import {studioResultDisposition, type StudioResultDisposition} from "@/lib/studio/result-disposition";
import {ProcessingStatus} from "@/components/uploader/ProcessingStatus";
import {pollJobUntilSettled} from "@/lib/jobs/client-poll";
import {dateAnnotationCopy, dateFormats, formatAnnotationDate, localToday, type DateAnnotationFormat} from "@/lib/studio/date-annotation";

type StudioDocumentWorkspaceProps = {
  documentId: string;
  initialDocument: StudioDocument | null;
  locale: string;
  initialTool?: "fill_pdf" | "sign_pdf";
};

type StudioDocumentVersion = {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  size: number;
  pageCount?: number;
  createdAt: string;
  isCurrent: boolean;
  previewUrl?: string;
  downloadUrl: string;
};

type StudioDocumentVersionsResponse = {
  versions?: StudioDocumentVersion[];
};

type StudioPasswordMode = "protect" | "unlock";

type StudioPasswordLabels = {
  close: string;
  title: string;
  processing: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmLabel: string;
  confirmPlaceholder: string;
  mismatch: string;
  passwordNote: string;
  passwordStrength: {good: string; strong: string; weak: string};
  hidePassword: string;
  showPassword: string;
  submit: string;
  error: string;
};

type JobResponse = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  errorCode?: string;
};

type UploadState = {
  fileId: string;
  uploadUrl: string;
};

type StudioJobSourcePayload =
  | {source: "input" | "result"; sourceJobId: string}
  | {workspaceDocumentId: string};

type EditorPlan = {
  annotations: StudioPdfAnnotation[];
  order: number[];
  rotations: Record<number, number>;
};

type EditorHistory = {
  future: EditorPlan[];
  past: EditorPlan[];
  present: EditorPlan;
};

const textColors = ["#141412", "#334155", "#1d4ed8", "#047857", "#b45309", "#b91c1c", "#7e22ce"] as const;

const textStyleLabels = {
  en: {alignment: "Alignment", bold: "Bold", color: "Text color", duplicate: "Duplicate text", font: "Font", size: "Size", style: "Text style"},
  es: {alignment: "Alineación", bold: "Negrita", color: "Color del texto", duplicate: "Duplicar texto", font: "Fuente", size: "Tamaño", style: "Estilo de texto"},
  fr: {alignment: "Alignement", bold: "Gras", color: "Couleur du texte", duplicate: "Dupliquer le texte", font: "Police", size: "Taille", style: "Style du texte"},
  pt: {alignment: "Alinhamento", bold: "Negrito", color: "Cor do texto", duplicate: "Duplicar texto", font: "Fonte", size: "Tamanho", style: "Estilo do texto"}
} as const;

const formLabels = {
  en: {checkbox: "Checkbox", empty: "This PDF has no supported form fields.", error: "Unable to read the PDF form.", fields: "form fields ready", hint: "Fill the fields directly on the document, then save the completed PDF.", loading: "Reading form fields...", radio: "Choice", select: "List", submit: "Save completed PDF", text: "Text"},
  es: {checkbox: "Casilla", empty: "Este PDF no contiene campos de formulario compatibles.", error: "No se pudo leer el formulario PDF.", fields: "campos listos", hint: "Complete los campos directamente en el documento y guarde el PDF completado.", loading: "Leyendo campos del formulario...", radio: "Opción", select: "Lista", submit: "Guardar PDF completado", text: "Texto"},
  fr: {checkbox: "Case", empty: "Ce PDF ne contient aucun champ de formulaire compatible.", error: "Impossible de lire les champs du formulaire PDF.", fields: "champs prêts à remplir", hint: "Remplissez les champs directement dans le document, puis enregistrez le PDF rempli.", loading: "Lecture des champs du formulaire...", radio: "Choix", select: "Liste", submit: "Enregistrer le PDF rempli", text: "Texte"},
  pt: {checkbox: "Caixa", empty: "Este PDF não possui campos de formulário compatíveis.", error: "Não foi possível ler o formulário PDF.", fields: "campos prontos", hint: "Preencha os campos diretamente no documento e salve o PDF preenchido.", loading: "Lendo os campos do formulário...", radio: "Opção", select: "Lista", submit: "Salvar PDF preenchido", text: "Texto"}
} as const;

function jobSourcePayloadFor(document: StudioDocument, displayedPdfSource: "input" | "result"): StudioJobSourcePayload {
  if (document.isGuest) {
    return {
      source: displayedPdfSource,
      sourceJobId: document.id
    };
  }

  return {workspaceDocumentId: document.id};
}

function formatBytes(bytes?: number) {
  if (!bytes) return "—";

  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) return `${value} ${units[unitIndex]}`;
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function expirationLabel(expiresAt: string | undefined, locale: string, fallback: string) {
  if (!expiresAt) return fallback;

  const remainingMs = Date.parse(expiresAt) - Date.now();

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return fallback;

  const formatter = new Intl.RelativeTimeFormat(locale, {numeric: "auto"});
  const remainingMinutes = Math.ceil(remainingMs / 60_000);

  if (remainingMinutes < 90) {
    return formatter.format(remainingMinutes, "minute");
  }

  return formatter.format(Math.ceil(remainingMinutes / 60), "hour");
}

function versionDateLabel(createdAt: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(createdAt));
}

async function waitForCompletedJob(jobId: string, _onProgress?: (progress: number) => void, errorLabels?: ErrorLabels, signal?: AbortSignal) {
  const job = await pollJobUntilSettled<JobResponse>(jobId, errorLabels?.error ?? "Unable to load job status.", signal);
  if (job.status === "failed") throw new Error((errorLabels ? messageFromCode(job.errorCode, errorLabels) : null) ?? job.error ?? "Processing failed.");
  return job;
}

function itemsForCategory(category: StudioToolCategory) {
  return studioToolItems.filter((item) => item.category === category);
}

function resultMatchesInput(mimeType: string | undefined, input: StudioToolInput) {
  if (!mimeType) return false;

  switch (input) {
    case "heic":
      return mimeType === "image/heic" || mimeType === "image/heif";
    case "image":
      return mimeType.startsWith("image/");
    case "markdown":
      return mimeType === "text/markdown" || mimeType === "text/plain";
    case "multiplePdf":
      return mimeType === "application/pdf";
    case "officeExcel":
      return mimeType === "application/vnd.ms-excel" ||
        mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "officePowerPoint":
      return mimeType === "application/vnd.ms-powerpoint" ||
        mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "officeWord":
      return mimeType === "application/msword" ||
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pdf":
      return mimeType === "application/pdf";
  }
}

function canUseCurrentDocument(document: StudioDocument | null, item: StudioToolItem) {
  return (
    document?.status === "completed" &&
    (resultMatchesInput(document.resultMimeType, item.input) ||
      (item.tool === "insert_pdf_pages" && document.resultMimeType === "application/pdf"))
  );
}

function canUploadInStudio(item: StudioToolItem) {
  return item.mode === "auto" || item.mode === "password";
}

function passwordModeForTool(tool: ToolAction): StudioPasswordMode | null {
  if (tool === "protect_pdf") return "protect";
  if (tool === "unlock_pdf") return "unlock";
  return null;
}

function isMultipleInput(item: StudioToolItem) {
  return item.input === "multiplePdf" || item.tool === "image_to_pdf";
}

function minimumFileCount(item: StudioToolItem) {
  return item.input === "multiplePdf" ? 2 : 1;
}

function handleStudioDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>, onClose: () => void, isBusy: boolean) {
  if (event.key === "Escape" && !isBusy) onClose();

  if (event.key !== "Tab") return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)"));
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && window.document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && window.document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function acceptForInput(input: StudioToolInput) {
  switch (input) {
    case "heic":
      return ".heic,.heif,image/heic,image/heif";
    case "image":
      return ".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif";
    case "markdown":
      return ".md,.markdown,text/markdown,text/plain";
    case "multiplePdf":
    case "pdf":
      return ".pdf,application/pdf";
    case "officeExcel":
      return ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "officePowerPoint":
      return ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "officeWord":
      return ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
}

function fallbackMimeForInput(input: StudioToolInput) {
  switch (input) {
    case "heic":
      return "image/heic";
    case "image":
      return "image/jpeg";
    case "markdown":
      return "text/markdown";
    case "officeExcel":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "officePowerPoint":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "officeWord":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "multiplePdf":
    case "pdf":
      return "application/pdf";
  }
}

function initialEditorPlan(pageCount: number): EditorPlan {
  return {
    annotations: [],
    order: Array.from({length: Math.max(1, pageCount)}, (_, index) => index + 1),
    rotations: {}
  };
}

function planHasChanges(plan: EditorPlan, pageCount: number) {
  const initialOrder = initialEditorPlan(pageCount).order;
  const hasOrderChanges = plan.order.length !== initialOrder.length ||
    plan.order.some((page, index) => page !== initialOrder[index]);

  return hasOrderChanges || Object.keys(plan.rotations).length > 0 || plan.annotations.length > 0;
}

function normalizeRotation(rotation: number) {
  const nextRotation = ((rotation % 360) + 360) % 360;
  return nextRotation === 90 || nextRotation === 180 || nextRotation === 270 ? nextRotation : 0;
}

function cleanRotations(rotations: Record<number, number>) {
  return Object.fromEntries(
    Object.entries(rotations)
      .map(([page, rotation]) => [page, normalizeRotation(rotation)] as const)
      .filter(([, rotation]) => rotation !== 0)
  ) as Record<number, number>;
}

function selectedPageNumbers(value: string, pageCount: number) {
  const selected = new Set<number>();

  for (const part of value.split(",")) {
    const [startText, endText] = part.trim().split("-");
    const start = Number(startText);
    const end = endText === undefined ? start : Number(endText);
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;

    const first = Math.max(1, Math.min(start, end));
    const last = Math.min(pageCount, Math.max(start, end));
    for (let page = first; page <= last; page += 1) selected.add(page);
  }

  return selected;
}

function cleanAnnotations(annotations: StudioPdfAnnotation[], visiblePages: number[]) {
  const visiblePageSet = new Set(visiblePages);

  return annotations
    .map((annotation) => ({
      ...annotation,
      height: Math.min(0.35, Math.max(0.02, annotation.height)),
      text: annotation.text,
      width: Math.min(0.9, Math.max(0.04, annotation.width)),
      x: Math.min(0.98, Math.max(0, annotation.x)),
      y: Math.min(0.98, Math.max(0, annotation.y))
    }))
    .filter((annotation) => visiblePageSet.has(annotation.page));
}

function savedAnnotations(annotations: StudioPdfAnnotation[], visiblePages: number[]) {
  return cleanAnnotations(annotations, visiblePages)
    .map((annotation) => ({
      ...annotation,
      text: annotation.text.trim()
    }))
    .filter((annotation) => annotation.text.length > 0 || Boolean(annotation.signatureImage) || Boolean(annotation.signatureStrokes?.some((stroke) => stroke.length > 1)));
}

function rasterizeDrawnSignature(strokes: Array<Array<{x: number; y: number}>>, color: string, size: {width: number; height: number}) {
  if (strokes.every((stroke) => stroke.length < 2)) return undefined;

  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.width * 2));
  canvas.height = Math.max(1, Math.round(size.height * 2));
  const context = canvas.getContext("2d");
  if (!context) return undefined;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 4;

  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    context.beginPath();
    context.moveTo(stroke[0].x * canvas.width, stroke[0].y * canvas.height);
    for (let index = 1; index < stroke.length; index += 1) {
      context.lineTo(stroke[index].x * canvas.width, stroke[index].y * canvas.height);
    }
    context.stroke();
  }

  return canvas.toDataURL("image/png");
}

function modeLabel(input: {
  canUseCurrent: boolean;
  canUpload: boolean;
  copy: ReturnType<typeof getStudioCopy>;
  item: StudioToolItem;
}) {
  if (input.item.mode === "signature") {
    return input.canUseCurrent ? input.copy.workspace.launcher.openSignature : input.copy.workspace.launcher.incompatible;
  }
  if (input.item.mode === "options" || input.item.mode === "editor") {
    return input.canUseCurrent ? input.copy.workspace.launcher.currentFile : input.copy.workspace.launcher.incompatible;
  }
  if (input.item.mode === "premium") return input.copy.workspace.launcher.premiumLater;
  if (input.item.mode === "comingSoon") return input.copy.workspace.launcher.comingSoon;
  if (input.canUseCurrent) return input.copy.workspace.launcher.currentFile;
  if (input.canUpload) return input.copy.workspace.launcher.uploadRequired;

  return input.copy.workspace.launcher.incompatible;
}

export function StudioToolUploadDialog({
  errorLabels,
  item,
  labels,
  locale,
  onClose,
  passwordLabels,
  sourcePayload,
  sourceName,
  toolName
}: {
  errorLabels: ErrorLabels;
  item: StudioToolItem;
  labels: ReturnType<typeof getStudioCopy>["workspace"]["launcher"];
  locale: string;
  onClose: () => void;
  passwordLabels?: StudioPasswordLabels;
  sourcePayload?: StudioJobSourcePayload;
  sourceName?: string;
  toolName: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"select" | "uploading" | "processing" | "failed">("select");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const minFiles = sourcePayload ? 1 : minimumFileCount(item);
  const isMerge = item.tool === "merge_pdf";
  const passwordMode = passwordModeForTool(item.tool);
  const isBusy = state === "uploading" || state === "processing";
  const hasPasswordMismatch = passwordMode === "protect" && confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmitPassword = !passwordMode ||
    (
      password.trim().length > 0 &&
      (passwordMode !== "protect" || (confirmPassword.trim().length > 0 && password === confirmPassword))
    );
  const canStart = files.length >= minFiles && !isBusy && canSubmitPassword;
  const selectedText = files.length === 1
    ? `${labels.selected}: ${files[0].name}`
    : `${files.length} ${labels.selectedMany}`;

  function updateFiles(nextFiles: File[]) {
    const incoming = isMultipleInput(item) ? nextFiles : nextFiles.slice(0, 1);
    setFiles((current) => {
      if (!isMultipleInput(item)) return incoming;

      const known = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...incoming.filter((file) => !known.has(`${file.name}-${file.size}-${file.lastModified}`))];
    });
    setState("select");
    setError("");
    setUploadProgress(0);
  }

  function removeFile(index: number) {
    if (isBusy) return;
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function moveFile(fromIndex: number, toIndex: number) {
    if (isBusy || fromIndex === toIndex) return;
    setFiles((current) => {
      const next = [...current];
      const [file] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, file);
      return next;
    });
  }

  async function start() {
    if (!canStart) {
      setError(labels.needMoreFiles);
      return;
    }

    try {
      setError("");
      setState("uploading");
      setUploadProgress(0);

      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      let uploadedBytes = 0;
      const fileIds: string[] = [];

      for (const file of files) {
        const initResponse = await fetch("/api/upload/init", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            tool: item.tool,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || fallbackMimeForInput(item.input)
          })
        });

        if (!initResponse.ok) throw new Error(await messageFromResponse(initResponse, errorLabels));
        const upload = await initResponse.json() as UploadState;

        await uploadFileWithProgress(upload.uploadUrl, file, errorLabels, (percent) => {
          const overall = totalBytes > 0
            ? Math.round(((uploadedBytes + (percent / 100) * file.size) / totalBytes) * 100)
            : percent;
          setUploadProgress(Math.min(100, overall));
        });

        uploadedBytes += file.size;
        fileIds.push(upload.fileId);
      }

      setState("processing");

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            tool: item.tool,
            fileIds,
            ...sourcePayload,
            options: {
              ...item.options,
              ...(passwordMode ? {pdfPassword: password} : {})
            }
          })
        });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, errorLabels));
      const createdJob = await jobResponse.json() as JobResponse;

      await waitForCompletedJob(createdJob.id);
      navigateWithinStudio(`/${locale}/studio/documents/${createdJob.id}?entry=guest`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : labels.error);
      setState("failed");
    }
  }

  return (
    <div className="studio-editor-modal-backdrop" role="presentation">
      <section className="studio-tool-upload" role="dialog" aria-modal="true" aria-labelledby="studio-upload-title" onKeyDown={(event) => handleStudioDialogKeyDown(event, onClose, isBusy)}>
        <button autoFocus className="studio-editor-modal-close" type="button" aria-label={labels.close} disabled={isBusy} onClick={onClose}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>
        <span className="studio-guest-badge">
          <i className={`ti ${item.icon}`} aria-hidden="true" />
          {toolName}
        </span>
        <h2 id="studio-upload-title">{passwordLabels?.title ?? toolName}</h2>
        {sourceName && !isMerge ? <p title={sourceName} style={{overflowWrap: "anywhere"}}>{sourceName}</p> : null}
        <p>{labels.uploadText}</p>
        <label
          className={`studio-tool-upload-drop ${isDragging ? "is-dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isBusy) setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isBusy) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!isBusy) updateFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <input
            type="file"
            accept={acceptForInput(item.input)}
            multiple={isMultipleInput(item)}
            disabled={isBusy}
            onChange={(event) => updateFiles(Array.from(event.currentTarget.files ?? []))}
          />
          <i className="ti ti-file-upload" aria-hidden="true" />
          <strong>{labels.chooseFile}</strong>
          <span>{files.length > 0 ? selectedText : labels.dropText}</span>
        </label>
        {isMerge && sourceName ? (
          <div className="studio-merge-source" title={sourceName}>
            <i className="ti ti-file-description" aria-hidden="true" />
            <span>{sourceName}</span>
            <em>{labels.sourceFirst}</em>
          </div>
        ) : null}
        {files.length > 0 ? (
          <ul className={`studio-tool-upload-list${isMerge ? " is-sortable" : ""}`}>
            {files.map((file, index) => (
              <li
                className={draggedFileIndex === index ? "is-dragging" : ""}
                draggable={isMerge && !isBusy}
                key={`${file.name}-${file.size}-${file.lastModified}`}
                onDragEnd={() => setDraggedFileIndex(null)}
                onDragOver={(event) => {
                  if (!isMerge || isBusy) return;
                  event.preventDefault();
                }}
                onDragStart={() => setDraggedFileIndex(index)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedFileIndex !== null) moveFile(draggedFileIndex, index);
                  setDraggedFileIndex(null);
                }}
              >
                <span className="studio-tool-upload-file" title={file.name}>
                  {isMerge ? <i className="ti ti-grip-vertical" aria-hidden="true" /> : null}
                  <b>{isMerge ? index + 1 : null}</b>
                  <strong>{file.name}</strong>
                </span>
                <em>{formatBytes(file.size)}</em>
                {isMerge ? (
                  <button type="button" aria-label={`${labels.removeFile}: ${file.name}`} title={labels.removeFile} disabled={isBusy} onClick={() => removeFile(index)}>
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {passwordMode && passwordLabels ? (
          <div className="studio-tool-password-fields">
            <label className="split-field">
              <span>{passwordLabels.passwordLabel}</span>
              <input
                className="split-input"
                type="password"
                autoComplete={passwordMode === "protect" ? "new-password" : "current-password"}
                value={password}
                placeholder={passwordLabels.passwordPlaceholder}
                disabled={isBusy}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {passwordMode === "protect" ? (
              <label className="split-field">
                <span>{passwordLabels.confirmLabel}</span>
                <input
                  className="split-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  placeholder={passwordLabels.confirmPlaceholder}
                  disabled={isBusy}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
            ) : null}
            {hasPasswordMismatch ? <p className="field-hint error">{passwordLabels.mismatch}</p> : null}
          </div>
        ) : null}
        {state === "uploading" || state === "processing" ? (
          <div className="studio-tool-upload-progress" aria-live="polite">
            <span>{state === "uploading" ? labels.uploading : passwordLabels?.processing ?? labels.processing}</span>
            {state === "uploading" ? <><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}><i style={{width: `${uploadProgress}%`}} /></div><strong>{uploadProgress}%</strong></> : <ProcessingStatus label={passwordLabels?.processing ?? labels.processing} />}
          </div>
        ) : null}
        {error ? <p className="studio-guest-error" role="alert">{error}</p> : null}
        <button className="studio-guest-download" type="button" disabled={!canStart} onClick={start}>
          <i className="ti ti-player-play" aria-hidden="true" />
          <span>{passwordLabels?.submit ?? labels.start}</span>
        </button>
      </section>
    </div>
  );
}

function StudioPasswordOptionsDialog({
  errorLabels,
  fileName,
  item,
  labels,
  onClose,
  onCompletedJob,
  sourcePayload,
  toolName
}: {
  errorLabels: ErrorLabels;
  fileName: string;
  item: StudioToolItem;
  labels: StudioPasswordLabels;
  onClose: () => void;
  onCompletedJob: (jobId: string) => Promise<void>;
  sourcePayload: StudioJobSourcePayload;
  toolName: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<"ready" | "processing" | "failed">("ready");
  const requestControllerRef = useRef<AbortController | null>(null);
  const submissionPendingRef = useRef(false);
  useEffect(() => () => requestControllerRef.current?.abort(), []);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordMode = passwordModeForTool(item.tool);
  const isBusy = state === "processing";
  const hasPasswordMismatch = passwordMode === "protect" && confirmPassword.length > 0 && password !== confirmPassword;
  const passwordStrength = password.length < 8 ? "weak" : /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^\w\s]/.test(password) ? "strong" : "good";
  const canSubmit = Boolean(passwordMode) &&
    !isBusy &&
    password.trim().length > 0 &&
    (passwordMode !== "protect" || (confirmPassword.trim().length > 0 && password === confirmPassword));

  async function startProcessing() {
    if (!canSubmit || submissionPendingRef.current) return;
    submissionPendingRef.current = true;
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      setError("");
      setState("processing");

      const response = await fetch("/api/jobs", {
        method: "POST",
        signal: controller.signal,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool: item.tool,
          ...sourcePayload,
          options: {
            ...item.options,
            pdfPassword: password
          }
        })
      });

      if (!response.ok) throw new Error(await messageFromResponse(response, errorLabels));
      const createdJob = await response.json() as JobResponse;

      setPassword("");
      setConfirmPassword("");
      await waitForCompletedJob(createdJob.id, undefined, errorLabels, controller.signal);
      if (controller.signal.aborted) return;
      await onCompletedJob(createdJob.id);
    } catch (nextError) {
      if (controller.signal.aborted) return;
      setError(nextError instanceof Error ? nextError.message : labels.error);
      setState("failed");
    } finally {
      submissionPendingRef.current = false;
    }
  }

  return (
    <div className="studio-editor-modal-backdrop" role="presentation">
      <section className="studio-tool-upload studio-password-options" role="dialog" aria-modal="true" aria-labelledby="studio-password-title" onKeyDown={(event) => handleStudioDialogKeyDown(event, onClose, isBusy)}>
        <button autoFocus className="studio-editor-modal-close" type="button" aria-label={labels.close} disabled={isBusy} onClick={onClose}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>
        <span className="studio-guest-badge">
          <i className={`ti ${item.icon}`} aria-hidden="true" />
          {toolName}
        </span>
        <h2 id="studio-password-title">{labels.title}</h2>
        <p title={fileName}>{fileName}</p>
        <div className="studio-tool-password-fields">
          <label className="split-field">
            <span>{labels.passwordLabel}</span>
            <span className="studio-password-input">
              <input
                className="split-input"
                type={showPassword ? "text" : "password"}
                autoComplete={passwordMode === "protect" ? "new-password" : "current-password"}
                value={password}
                placeholder={labels.passwordPlaceholder}
                disabled={isBusy}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" disabled={isBusy} title={showPassword ? labels.hidePassword : labels.showPassword} aria-label={showPassword ? labels.hidePassword : labels.showPassword} onClick={() => setShowPassword((current) => !current)}>
                <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} aria-hidden="true" />
              </button>
            </span>
          </label>
          {passwordMode === "protect" && password ? (
            <div className={`studio-password-strength is-${passwordStrength}`}>
              <i /><i /><i />
              <span>{labels.passwordStrength[passwordStrength]}</span>
            </div>
          ) : null}
          {passwordMode === "protect" ? (
            <label className="split-field">
              <span>{labels.confirmLabel}</span>
              <span className="studio-password-input">
                <input
                  className="split-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  placeholder={labels.confirmPlaceholder}
                  disabled={isBusy}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </span>
            </label>
          ) : null}
          {hasPasswordMismatch ? <p className="field-hint error">{labels.mismatch}</p> : null}
          <p className="studio-password-note"><i className="ti ti-lock" aria-hidden="true" />{labels.passwordNote}</p>
        </div>
        {state === "processing" ? (
          <div className="studio-tool-upload-progress" aria-live="polite">
            <ProcessingStatus label={labels.processing} />
          </div>
        ) : null}
        {error ? <p className="studio-guest-error" role="alert">{error}</p> : null}
        <button className="studio-guest-download" type="button" disabled={!canSubmit} onClick={startProcessing}>
          <i className={`ti ${isBusy ? "ti-loader-2" : "ti-player-play"}`} aria-hidden="true" />
          <span>{labels.submit}</span>
        </button>
      </section>
    </div>
  );
}

export function StudioDocumentWorkspace({documentId, initialDocument, locale, initialTool}: StudioDocumentWorkspaceProps) {
  const account = useStudioAccount();
  const authCopy = getAuthCopy(locale);
  const copy = getStudioCopy(locale);
  const catalog = useTranslations("catalog");
  const home = useTranslations("home");
  const [liveDocuments, setLiveDocuments] = useState<StudioDocument[]>(initialDocument ? [initialDocument] : []);
  const [hasLoaded, setHasLoaded] = useState(initialDocument !== null);
  const [documentLoadError, setDocumentLoadError] = useState(false);
  const [activeMode, setActiveMode] = useState<StudioEditorTool>("select");
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalSending, setApprovalSending] = useState(false);
  const approvalLabels = approvalCopy[locale] ?? approvalCopy.en;
  const activityLabels = activityCopy[locale as keyof typeof activityCopy] ?? activityCopy.en;
  const [dateValue, setDateValue] = useState(localToday);
  const [dateFormat, setDateFormat] = useState<DateAnnotationFormat>("numeric");
  const [pendingDateText, setPendingDateText] = useState<string | null>(null);
  const dateCopy = dateAnnotationCopy[locale as keyof typeof dateAnnotationCopy] ?? dateAnnotationCopy.en;
  const formattedDate = formatAnnotationDate(dateValue, dateFormat, locale);
  const [signDialog, setSignDialog] = useState<"none" | "signer" | "seal">("none");
  const [signatureText, setSignatureText] = useState("");
  const [signatureStrokes, setSignatureStrokes] = useState<Array<Array<{x: number; y: number}>>>([]);
  const [signatureUndoneStrokes, setSignatureUndoneStrokes] = useState<Array<Array<{x: number; y: number}>>>([]);
  const [signatureColor, setSignatureColor] = useState("#141412");
  const [signatureStyle, setSignatureStyle] = useState<"elegant" | "plain" | "script">("script");
  const [signatureMode, setSignatureMode] = useState<"draw" | "type" | "upload">("draw");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureImageError, setSignatureImageError] = useState("");
  const hasSignatureDraft = Boolean(signatureText.trim() || signatureStrokes.length || signatureImage);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [continuingTool, setContinuingTool] = useState<ToolAction | null>(null);
  const [continueError, setContinueError] = useState("");
  const [launcherCategory, setLauncherCategory] = useState<StudioToolCategory | null>(null);
  const [pageActionError, setPageActionError] = useState("");
  const [pageActionState, setPageActionState] = useState<{action: StudioPageAction; page: number} | null>(null);
  const [editorHistory, setEditorHistory] = useState<EditorHistory | null>(null);
  const [previewPageCount, setPreviewPageCount] = useState<number | null>(null);
  const [savingEditorEdits, setSavingEditorEdits] = useState(false);
  const [savingWorkspaceDocument, setSavingWorkspaceDocument] = useState(false);
  const [studioPasswordTool, setStudioPasswordTool] = useState<StudioToolItem | null>(null);
  const [studioOptionsTool, setStudioOptionsTool] = useState<StudioToolItem | null>(null);
  const [toolOptionValue, setToolOptionValue] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("diagonal");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.25);
  const [watermarkColor, setWatermarkColor] = useState("#334155");
  const [watermarkFontSize, setWatermarkFontSize] = useState(48);
  const [pageNumberPosition, setPageNumberPosition] = useState<StudioPageNumberPreview["position"]>("bottom_center");
  const [pageNumberStartPage, setPageNumberStartPage] = useState(1);
  const [pageNumberStartNumber, setPageNumberStartNumber] = useState(1);
  const [pageNumberFormat, setPageNumberFormat] = useState<StudioPageNumberPreview["format"]>("number");
  const [pageNumberColor, setPageNumberColor] = useState("#334155");
  const [pageNumberFontSize, setPageNumberFontSize] = useState(11);
  const [pageNumberMargin, setPageNumberMargin] = useState(36);
  const [rotateDegrees, setRotateDegrees] = useState<90 | 180 | 270>(90);
  const [splitMode, setSplitMode] = useState<"every_page" | "interval" | "range">("every_page");
  const [splitInterval, setSplitInterval] = useState(2);
  const [compressionLevel, setCompressionLevel] = useState<"best_size" | "standard" | "best_quality">("standard");
  const [pdfToImageFormat, setPdfToImageFormat] = useState<"jpg" | "png">("jpg");
  const [pdfToImageDpi, setPdfToImageDpi] = useState<72 | 150 | 300>(150);
  const [formFields, setFormFields] = useState<StudioPdfFormField[]>([]);
  const [formFieldsState, setFormFieldsState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [formFieldsSource, setFormFieldsSource] = useState<"input" | "result" | null>(null);
  const [hasPendingFormEdits, setHasPendingFormEdits] = useState(false);
  const [studioUploadTool, setStudioUploadTool] = useState<StudioToolItem | null>(null);
  const [documentVersions, setDocumentVersions] = useState<StudioDocumentVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionHistoryState, setVersionHistoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [deleteDocumentError, setDeleteDocumentError] = useState("");
  const annotationEditSnapshotRef = useRef<EditorPlan | null>(null);
  const insertAfterPageRef = useRef<number | null>(null);
  const insertFileInputRef = useRef<HTMLInputElement | null>(null);
  const documentLoadControllerRef = useRef<AbortController | null>(null);
  const exportPendingRef = useRef(false);
  const signaturePadSizeRef = useRef({width: 600, height: 300});
  const formLoadControllerRef = useRef<AbortController | null>(null);
  const initialToolOpenedRef = useRef<string | null>(null);
  const operationControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    operationControllerRef.current = controller;
    return () => controller.abort();
  }, [documentId]);

  useEffect(() => {
    let ignore = false;
    documentLoadControllerRef.current?.abort();
    const controller = new AbortController();
    documentLoadControllerRef.current = controller;

    if (initialDocument) {
      setLiveDocuments([initialDocument]);
      setDocumentLoadError(false);
      setHasLoaded(true);
      return () => {
        ignore = true;
        documentLoadControllerRef.current?.abort();
      };
    }

    async function loadDocuments() {
      try {
        const nextDocument = await fetchStudioDocument(documentId, locale, controller.signal);

        if (!ignore) {
          setLiveDocuments(nextDocument ? [nextDocument] : []);
          setDocumentLoadError(false);
          setHasLoaded(true);
        }
      } catch {
        if (!ignore) {
          setDocumentLoadError(initialDocument === null);
          setHasLoaded(true);
        }
      }
    }

    void loadDocuments();

    return () => {
      ignore = true;
      documentLoadControllerRef.current?.abort();
    };
  }, [documentId, initialDocument, locale]);

  async function retryDocumentLoad() {
    documentLoadControllerRef.current?.abort();
    const controller = new AbortController();
    documentLoadControllerRef.current = controller;
    try {
      setDocumentLoadError(false);
      setHasLoaded(false);
      const nextDocument = await fetchStudioDocument(documentId, locale, controller.signal);
      if (controller.signal.aborted) return;
      setLiveDocuments(nextDocument ? [nextDocument] : []);
      setHasLoaded(true);
    } catch {
      if (controller.signal.aborted) return;
      setDocumentLoadError(true);
      setHasLoaded(true);
    }
  }

  useEffect(() => {
    setPreviewPageCount(null);
    setEditorHistory(null);
    setPageActionError("");
    setSelectedAnnotationId(null);
    setActiveMode("select");
    setFormFields([]);
    setFormFieldsState("idle");
    setFormFieldsSource(null);
    setHasPendingFormEdits(false);
    return () => formLoadControllerRef.current?.abort();
  }, [documentId]);

  const documents = useMemo(() => liveDocuments, [liveDocuments]);
  const document = documents.find((item) => item.id === documentId) ?? null;
  const guestLeaveDialog = useGuestSessionLifecycle(documentId, Boolean(document?.isGuest), locale);
  const selectedVersion = documentVersions.find((version) => version.id === selectedVersionId) ?? null;
  const isPreviewingHistoricalVersion = Boolean(selectedVersion && !selectedVersion.isCurrent);
  const activePreviewUrl = studioOptionsTool?.tool === "fill_pdf" && formFieldsSource === "input" && document?.isGuest && !isPreviewingHistoricalVersion
    ? document.sourcePreviewUrl ?? document.previewUrl
    : selectedVersion?.previewUrl ?? document?.previewUrl;
  const watermarkPreview: StudioWatermarkPreview | null = studioOptionsTool?.tool === "watermark_pdf" && toolOptionValue.trim()
    ? {color: watermarkColor, fontSize: watermarkFontSize, opacity: watermarkOpacity, position: watermarkPosition as StudioWatermarkPreview["position"], text: toolOptionValue.trim()}
    : null;
  const pageNumberPreview: StudioPageNumberPreview | null = studioOptionsTool?.tool === "number_pdf_pages"
    ? {color: pageNumberColor, fontSize: pageNumberFontSize, format: pageNumberFormat, margin: pageNumberMargin, position: pageNumberPosition, startNumber: pageNumberStartNumber, startPage: pageNumberStartPage}
    : null;
  const actionLabel = document?.toolLabel ? catalog(`tools.${document.toolLabel}`) : document ? copy.kinds[document.kind] : "";
  const pageCount = Math.max(1, document?.pages ?? 1);
  const editablePageCount = Math.max(1, previewPageCount ?? pageCount);
  const canSaveToWorkspace = Boolean(document?.isGuest && document.status === "completed" && document.resultUrl);
  const canEditDisplayedPdf = !isPreviewingHistoricalVersion && document?.status === "completed" &&
    document.tool !== "protect_pdf" && !document.isProtected &&
    (
      document.resultMimeType === "application/pdf" ||
      document.sourceMimeType === "application/pdf"
    );
  const displayedPdfSource = document?.resultMimeType === "application/pdf" ? "result" : "input";
  const isPreviewingSourcePdf = Boolean(document?.name && /\.(docx|pptx|xlsx|zip)$/i.test(document.name));
  const currentEditorPlan = editorHistory?.present ?? initialEditorPlan(editablePageCount);
  const visiblePageRotations = useMemo(() => {
    if (studioOptionsTool?.tool !== "rotate_pdf") return currentEditorPlan.rotations;

    const selectedPages = selectedPageNumbers(toolOptionValue, currentEditorPlan.order.length);
    const rotations = {...currentEditorPlan.rotations};
    for (const displayPage of selectedPages) {
      const sourcePage = currentEditorPlan.order[displayPage - 1];
      if (!sourcePage) continue;
      const nextRotation = normalizeRotation((rotations[sourcePage] ?? 0) + rotateDegrees);
      if (nextRotation === 0) delete rotations[sourcePage];
      else rotations[sourcePage] = nextRotation;
    }
    return rotations;
  }, [currentEditorPlan, rotateDegrees, studioOptionsTool?.tool, toolOptionValue]);
  const selectedTextAnnotation = currentEditorPlan.annotations.find((annotation) => annotation.id === selectedAnnotationId && annotation.type === "text") ?? null;
  const textStyleCopy = textStyleLabels[locale as keyof typeof textStyleLabels] ?? textStyleLabels.en;
    const formCopy = formLabels[locale as keyof typeof formLabels] ?? formLabels.en;
    const isFillingPdf = studioOptionsTool?.tool === "fill_pdf" && formFieldsState === "ready" && formFields.length > 0;
  const hasUnsavedEditorEdits = Boolean(canEditDisplayedPdf && editorHistory && planHasChanges(editorHistory.present, editablePageCount));
  const editorSaveTool: ToolAction = currentEditorPlan.annotations.some((annotation) => annotation.type === "signature") ? "sign_pdf" : "reorder_pdf";
  const canUndoEditorEdit = Boolean(editorHistory?.past.length);
  const canRedoEditorEdit = Boolean(editorHistory?.future.length);
  const uploadErrorLabels: ErrorLabels = {
    error: home("upload.error"),
    errorTooLarge: home("upload.errorTooLarge"),
    errorUnsupportedType: home("upload.errorUnsupportedType"),
    errorInvalidFile: home("upload.errorInvalidFile"),
    errorQpdfMissing: home("upload.errorQpdfMissing"),
    errorHeicDecoderMissing: home("upload.errorHeicDecoderMissing"),
    errorLibreOfficeMissing: home("upload.errorLibreOfficeMissing"),
    errorPdfTextMissing: home("upload.errorPdfTextMissing")
  };

  useEffect(() => {
    let ignore = false;

    setDocumentVersions([]);
    setSelectedVersionId(null);

    if (!document || document.isGuest) {
      setVersionHistoryState("idle");
      return () => {
        ignore = true;
      };
    }

    setVersionHistoryState("loading");
    const controller = new AbortController();
    fetch(`/api/studio/documents/${document.id}/versions`, {cache: "no-store", signal: controller.signal})
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load versions");
        return response.json() as Promise<StudioDocumentVersionsResponse>;
      })
      .then((body) => {
        if (ignore) return;
        setDocumentVersions(Array.isArray(body.versions) ? body.versions : []);
        setVersionHistoryState("ready");
      })
      .catch(() => {
        if (!ignore) setVersionHistoryState("error");
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [document?.id, document?.isGuest]);

  useEffect(() => {
    if (!isDeleteDialogOpen) return;

    function handleDeleteDialogKeydown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isDeletingDocument) return;
      setIsDeleteDialogOpen(false);
      setDeleteDocumentError("");
    }

    window.addEventListener("keydown", handleDeleteDialogKeydown);
    return () => window.removeEventListener("keydown", handleDeleteDialogKeydown);
  }, [isDeleteDialogOpen, isDeletingDocument]);

  useEffect(() => {
    if (
      selectedAnnotationId &&
      !currentEditorPlan.annotations.some((annotation) => annotation.id === selectedAnnotationId)
    ) {
      setSelectedAnnotationId(null);
    }
  }, [currentEditorPlan.annotations, selectedAnnotationId]);

  useEffect(() => {
    if (activeMode !== "text") setPendingDateText(null);
  }, [activeMode]);

  useEffect(() => {
    setDateDialogOpen(false);
    setActivityDialogOpen(false);
    setApprovalDialogOpen(false);
    setPendingDateText(null);
  }, [documentId]);

  useEffect(() => {
    if (!canEditDisplayedPdf) {
      setEditorHistory(null);
      return;
    }

    setEditorHistory({
      future: [],
      past: [],
      present: initialEditorPlan(editablePageCount)
    });
  }, [canEditDisplayedPdf, document?.id, editablePageCount]);

  function commitEditorPlan(nextPlan: EditorPlan) {
    setEditorHistory((current) => {
      const baseHistory = current ?? {
        future: [],
        past: [],
        present: initialEditorPlan(editablePageCount)
      };

      return {
        future: [],
        past: [...baseHistory.past, baseHistory.present],
        present: {
          annotations: cleanAnnotations(nextPlan.annotations, nextPlan.order),
          order: nextPlan.order,
          rotations: cleanRotations(nextPlan.rotations)
        }
      };
    });
  }

  function undoEditorEdit() {
    setEditorHistory((current) => {
      if (!current || current.past.length === 0) return current;

      const previous = current.past[current.past.length - 1];

      return {
        future: [current.present, ...current.future],
        past: current.past.slice(0, -1),
        present: previous
      };
    });
  }

  function redoEditorEdit() {
    setEditorHistory((current) => {
      if (!current || current.future.length === 0) return current;

      const next = current.future[0];

      return {
        future: current.future.slice(1),
        past: [...current.past, current.present],
        present: next
      };
    });
  }

  function cloneEditorPlan(plan: EditorPlan): EditorPlan {
    return {
      annotations: plan.annotations.map((annotation) => ({...annotation})),
      order: [...plan.order],
      rotations: {...plan.rotations}
    };
  }

  function editorPlansEqual(left: EditorPlan, right: EditorPlan) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function beginAnnotationEdit(annotationId: string) {
    if (annotationEditSnapshotRef.current || !editorHistory) return;
    if (!editorHistory.present.annotations.some((annotation) => annotation.id === annotationId)) return;

    annotationEditSnapshotRef.current = cloneEditorPlan(editorHistory.present);
  }

  function endAnnotationEdit() {
    const snapshot = annotationEditSnapshotRef.current;
    annotationEditSnapshotRef.current = null;

    if (!snapshot) return;

    setEditorHistory((current) => {
      if (!current || editorPlansEqual(snapshot, current.present)) return current;

      return {
        future: [],
        past: [...current.past, snapshot],
        present: current.present
      };
    });
  }

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const isUndoShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z";

      if (!isUndoShortcut || savingEditorEdits) return;

      if (event.shiftKey) {
        if (!canRedoEditorEdit) return;
        event.preventDefault();
        redoEditorEdit();
        return;
      }

      if (!canUndoEditorEdit) return;
      event.preventDefault();
      undoEditorEdit();
    }

    window.addEventListener("keydown", handleKeydown);

    return () => window.removeEventListener("keydown", handleKeydown);
  }, [canRedoEditorEdit, canUndoEditorEdit, savingEditorEdits]);

  async function openCompletedJobResult(jobId: string, disposition: StudioResultDisposition) {
    const signal = operationControllerRef.current?.signal;
    signal?.throwIfAborted();
    if (!document || document.isGuest || disposition === "derived-result") {
      const source = document ? `&from=${encodeURIComponent(document.id)}` : "";
      navigateWithinStudio(`/${locale}/studio/documents/${jobId}?entry=guest${source}`);
      return;
    }

    const saveResponse = await fetch("/api/studio/documents", {
      method: "POST",
      signal,
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        documentId: document.id,
        jobId
      })
    });

    if (!saveResponse.ok) throw new Error(await messageFromResponse(saveResponse, uploadErrorLabels));
    // The document URL stays the same after a new version is created. A version
    // token makes the PDF viewer reload the newly saved bytes instead of keeping
    // the previous preview in memory.
    const saved = await saveResponse.json() as {version?: number};
    signal?.throwIfAborted();
    const versionToken = typeof saved.version === "number" ? `?version=${saved.version}` : `?version=${Date.now()}`;
    navigateWithinStudio(`/${locale}/studio/documents/${document.id}${versionToken}`);
  }

  async function createEditedPdfJob() {
    if (!document) throw new Error(copy.workspace.pageActions.error);
    const signal = operationControllerRef.current?.signal;
    signal?.throwIfAborted();

    let source: StudioJobSourcePayload = jobSourcePayloadFor(document, displayedPdfSource);
    if (hasPendingFormEdits) {
      const filledResponse = await fetch("/api/jobs", {
        method: "POST",
        signal,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool: "fill_pdf",
          ...jobSourcePayloadFor(document, formFieldsSource ?? displayedPdfSource),
          options: {formValues: Object.fromEntries(formFields.map((field) => [field.name, field.value]))}
        })
      });
      if (!filledResponse.ok) throw new Error(await messageFromResponse(filledResponse, uploadErrorLabels));
      const filledJob = await filledResponse.json() as JobResponse;
      await waitForCompletedJob(filledJob.id, undefined, uploadErrorLabels, signal);
      if (!hasUnsavedEditorEdits) return filledJob;
      source = {source: "result", sourceJobId: filledJob.id};
    }

    const response = await fetch("/api/jobs", {
      method: "POST",
      signal,
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        tool: editorSaveTool,
        ...source,
        options: {
          pageAnnotations: savedAnnotations(currentEditorPlan.annotations, currentEditorPlan.order),
          pageOrder: currentEditorPlan.order,
          pageRotations: currentEditorPlan.rotations
        }
      })
    });

    if (!response.ok) throw new Error(await messageFromResponse(response, uploadErrorLabels));
    const createdJob = await response.json() as JobResponse;
    await waitForCompletedJob(createdJob.id, undefined, uploadErrorLabels, signal);
    return createdJob;
  }

  async function downloadEditedPdf() {
    if (!document || (!hasUnsavedEditorEdits && !hasPendingFormEdits) || exportPendingRef.current) return;
    const signal = operationControllerRef.current?.signal;
    exportPendingRef.current = true;

    try {
      setPageActionError("");
      setSavingEditorEdits(true);
      const job = await createEditedPdfJob();
      signal?.throwIfAborted();
      const link = window.document.createElement("a");
      link.href = `/api/jobs/${job.id}/download`;
      link.download = document.name.replace(/\.pdf$/i, "") + "-edited.pdf";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setPageActionError(error instanceof Error ? error.message : copy.workspace.pageActions.error);
    } finally {
      exportPendingRef.current = false;
      setSavingEditorEdits(false);
    }
  }

  async function applyEditorEdits() {
    if (!document || (!hasUnsavedEditorEdits && !hasPendingFormEdits) || exportPendingRef.current) return;
    exportPendingRef.current = true;

    try {
      setPageActionError("");
      setSavingEditorEdits(true);

      const createdJob = await createEditedPdfJob();
      await openCompletedJobResult(createdJob.id, "document-version");
    } catch (error) {
      setPageActionError(error instanceof Error ? error.message : copy.workspace.pageActions.error);
    } finally {
      exportPendingRef.current = false;
      setSavingEditorEdits(false);
    }
  }

  async function saveToWorkspace() {
    if (!document || !canSaveToWorkspace || savingWorkspaceDocument || exportPendingRef.current) return;
    exportPendingRef.current = true;

    try {
      setContinueError("");
      setSavingWorkspaceDocument(true);

      if (!(await account.requestSignIn())) return;
      let jobId = document.id;
      if (hasUnsavedEditorEdits || hasPendingFormEdits) {
        jobId = (await createEditedPdfJob()).id;
      }

      const response = await fetch("/api/studio/documents", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({jobId})
      });

      if (!response.ok) throw new Error(await messageFromResponse(response, uploadErrorLabels));
      const saved = await response.json() as {id: string};
      navigateWithinStudio(`/${locale}/studio/documents/${saved.id}`);
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : copy.workspace.unavailableText);
    } finally {
      exportPendingRef.current = false;
      setSavingWorkspaceDocument(false);
    }
  }

  async function restoreDocumentVersion(version: StudioDocumentVersion) {
    if (!document || document.isGuest || version.isCurrent || restoringVersionId || exportPendingRef.current) return;
    exportPendingRef.current = true;

    try {
      setContinueError("");
      setRestoringVersionId(version.id);

      const response = await fetch(`/api/studio/documents/${document.id}/versions`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({versionId: version.id})
      });

      if (!response.ok) throw new Error(await messageFromResponse(response, uploadErrorLabels));
      const restored = await response.json() as {version?: number};
      navigateWithinStudio(`/${locale}/studio/documents/${document.id}?version=${restored.version ?? Date.now()}`);
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : copy.workspace.versions.error);
      setRestoringVersionId(null);
    } finally {
      exportPendingRef.current = false;
    }
  }

  async function deleteCurrentDocument() {
    if (!document || document.isGuest || isDeletingDocument) return;

    try {
      setDeleteDocumentError("");
      setIsDeletingDocument(true);

      const response = await fetch(`/api/studio/documents/${document.id}`, {
        method: "DELETE"
      });

      if (!response.ok) throw new Error(copy.workspace.deleteDialog.error);
      navigateWithinStudio(`/${locale}/studio`);
    } catch {
      setDeleteDocumentError(copy.workspace.deleteDialog.error);
      setIsDeletingDocument(false);
    }
  }

  function passwordLabelsForTool(tool: ToolAction): StudioPasswordLabels {
    if (tool === "unlock_pdf") {
      return {
        close: home("upload.close"),
        title: home("upload.unlock.title"),
        processing: home("upload.unlock.processing"),
        passwordLabel: home("upload.unlock.passwordLabel"),
        passwordPlaceholder: home("upload.unlock.passwordPlaceholder"),
        confirmLabel: home("upload.protect.confirmLabel"),
        confirmPlaceholder: home("upload.protect.confirmPlaceholder"),
        mismatch: home("upload.protect.mismatch"),
        passwordNote: home("upload.unlock.passwordNote"),
        passwordStrength: {good: home("upload.protect.passwordStrength.good"), strong: home("upload.protect.passwordStrength.strong"), weak: home("upload.protect.passwordStrength.weak")},
        hidePassword: home("upload.protect.hidePassword"),
        showPassword: home("upload.protect.showPassword"),
        submit: home("upload.unlock.submit"),
        error: home("upload.error")
      };
    }

    return {
      close: home("upload.close"),
      title: home("upload.protect.title"),
      processing: home("upload.protect.processing"),
      passwordLabel: home("upload.protect.passwordLabel"),
      passwordPlaceholder: home("upload.protect.passwordPlaceholder"),
      confirmLabel: home("upload.protect.confirmLabel"),
      confirmPlaceholder: home("upload.protect.confirmPlaceholder"),
      mismatch: home("upload.protect.mismatch"),
      passwordNote: home("upload.protect.passwordNote"),
      passwordStrength: {good: home("upload.protect.passwordStrength.good"), strong: home("upload.protect.passwordStrength.strong"), weak: home("upload.protect.passwordStrength.weak")},
      hidePassword: home("upload.protect.hidePassword"),
      showPassword: home("upload.protect.showPassword"),
      submit: home("upload.protect.submit"),
      error: home("upload.error")
    };
  }

    async function continueWith(action: ContinueAction) {
    if (!document || continuingTool) return;

    try {
      setContinueError("");
      setContinuingTool(action.tool);

      let source = jobSourcePayloadFor(document, action.tool === "fill_pdf" && formFieldsSource ? formFieldsSource : "result");
      if (hasUnsavedEditorEdits || hasPendingFormEdits) {
        const draft = await createEditedPdfJob();
        if (action.tool === "fill_pdf") {
          await openCompletedJobResult(draft.id, "document-version");
          return;
        }
        source = {source: "result", sourceJobId: draft.id};
      }

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool: action.tool,
          ...source,
          options: action.options
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as {error?: string} | null;
        throw new Error(body?.error || copy.workspace.unavailableText);
      }

      const createdJob = await response.json() as JobResponse;
      await waitForCompletedJob(createdJob.id);
      await openCompletedJobResult(createdJob.id, studioResultDisposition(action.tool));
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : copy.workspace.unavailableText);
    } finally {
      setContinuingTool(null);
    }
  }

  function updateFormField(name: string, value: boolean | string) {
    setHasPendingFormEdits(true);
    setFormFields((current) => current.map((field) => field.name === name ? {...field, value} : field));
  }

  async function saveFilledPdf() {
    if (!isFillingPdf || continuingTool) return;
    await continueWith({
      icon: "ti-forms",
      labelKey: "fillPdf",
      options: {formValues: Object.fromEntries(formFields.map((field) => [field.name, field.value]))},
      tool: "fill_pdf"
    });
  }

  async function runPageAction(action: StudioPageAction, page: number) {
    if (!document || !canEditDisplayedPdf || pageActionState) return;

    if (action === "reorder") return;

    if (action === "rotate") {
      const currentRotation = currentEditorPlan.rotations[page] ?? 0;
      const nextRotation = normalizeRotation(currentRotation + 90);
      const rotations = {...currentEditorPlan.rotations};

      if (nextRotation === 0) {
        delete rotations[page];
      } else {
        rotations[page] = nextRotation;
      }

      commitEditorPlan({
        annotations: currentEditorPlan.annotations,
        order: currentEditorPlan.order,
        rotations
      });
      return;
    }

    if (action === "delete") {
      if (currentEditorPlan.order.length <= 1) return;

      const rotations = {...currentEditorPlan.rotations};
      delete rotations[page];
      commitEditorPlan({
        annotations: currentEditorPlan.annotations.filter((annotation) => annotation.page !== page),
        order: currentEditorPlan.order.filter((sourcePage) => sourcePage !== page),
        rotations
      });
      return;
    }

    const pageRange = String(page);

    try {
      setPageActionError("");
      setPageActionState({action, page});

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool: "extract_pdf_pages",
          ...jobSourcePayloadFor(document, displayedPdfSource),
          options: {pageRange}
        })
      });

      if (!response.ok) throw new Error(await messageFromResponse(response, uploadErrorLabels));

      const createdJob = await response.json() as JobResponse;
      await waitForCompletedJob(createdJob.id, undefined, uploadErrorLabels);
      await openCompletedJobResult(createdJob.id, "derived-result");
    } catch (error) {
      setPageActionError(error instanceof Error ? error.message : copy.workspace.pageActions.error);
    } finally {
      setPageActionState(null);
    }
  }

  async function runBulkPageAction(action: "delete" | "extract", pages: number[]) {
    if (!document || !canEditDisplayedPdf || pages.length === 0 || pageActionState) return;

    const selectedPages = new Set(pages);
    if (action === "delete") {
      if (currentEditorPlan.order.length - selectedPages.size < 1) return;

      const rotations = {...currentEditorPlan.rotations};
      for (const page of selectedPages) delete rotations[page];
      commitEditorPlan({
        annotations: currentEditorPlan.annotations.filter((annotation) => !selectedPages.has(annotation.page)),
        order: currentEditorPlan.order.filter((page) => !selectedPages.has(page)),
        rotations
      });
      return;
    }

    const pageRange = currentEditorPlan.order
      .map((sourcePage, index) => selectedPages.has(sourcePage) ? index + 1 : null)
      .filter((page): page is number => page !== null)
      .join(",");
    if (!pageRange) return;

    await continueWith({
      icon: "ti-file-export",
      labelKey: "extractPages",
      options: {pageRange},
      tool: "extract_pdf_pages"
    });
  }

  function runPageReorder(pageOrder: number[]) {
    if (!document || !canEditDisplayedPdf || pageActionState) return;

    setPageActionError("");
    commitEditorPlan({
      annotations: currentEditorPlan.annotations,
      order: pageOrder,
      rotations: currentEditorPlan.rotations
    });
  }

  function requestInsertPages(afterPage: number) {
    if (!document || !canEditDisplayedPdf || pageActionState || savingEditorEdits) return;

    insertAfterPageRef.current = afterPage;
    insertFileInputRef.current?.click();
  }

  async function handleInsertFiles(files: FileList | null) {
    if (!document || !canEditDisplayedPdf || !files || files.length === 0) return;

    const insertAfterPage = insertAfterPageRef.current ?? pageCount;
    insertAfterPageRef.current = null;

    try {
      setPageActionError("");
      setPageActionState({action: "reorder", page: insertAfterPage});

      const fileIds: string[] = [];

      for (const file of Array.from(files)) {
        const initResponse = await fetch("/api/upload/init", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            tool: "insert_pdf_pages",
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf"
          })
        });

        if (!initResponse.ok) throw new Error(await messageFromResponse(initResponse, uploadErrorLabels));
        const upload = await initResponse.json() as UploadState;
        await uploadFileWithProgress(upload.uploadUrl, file, uploadErrorLabels, () => {});
        fileIds.push(upload.fileId);
      }

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool: "insert_pdf_pages",
          ...jobSourcePayloadFor(document, displayedPdfSource),
          fileIds,
          options: {
            insertAfterPage,
            pageAnnotations: savedAnnotations(currentEditorPlan.annotations, currentEditorPlan.order),
            pageOrder: currentEditorPlan.order,
            pageRotations: currentEditorPlan.rotations
          }
        })
      });

      if (!response.ok) throw new Error(await messageFromResponse(response, uploadErrorLabels));

      const createdJob = await response.json() as JobResponse;
      await waitForCompletedJob(createdJob.id, undefined, uploadErrorLabels);
      await openCompletedJobResult(createdJob.id, "document-version");
    } catch (error) {
      setPageActionError(error instanceof Error ? error.message : copy.workspace.pageActions.error);
    } finally {
      setPageActionState(null);

      if (insertFileInputRef.current) {
        insertFileInputRef.current.value = "";
      }
    }
  }

  function placeAnnotation(input: {page: number; x: number; y: number}) {
    if (!canEditDisplayedPdf || (activeMode !== "text" && activeMode !== "signature")) return;

    const drawnSignatureImage = activeMode === "signature"
      ? rasterizeDrawnSignature(signatureStrokes, signatureColor, signaturePadSizeRef.current)
      : undefined;

    const annotation: StudioPdfAnnotation = {
      height: activeMode === "signature" ? 0.07 : 0.06,
      id: `annotation_${crypto.randomUUID()}`,
      page: input.page,
      text: activeMode === "signature" ? signatureText.trim() : pendingDateText ?? copy.workspace.toolbar.text,
      ...(activeMode === "signature" && signatureStrokes.length ? {signatureStrokes} : {}),
      ...(activeMode === "signature" && (drawnSignatureImage || signatureImage) ? {signatureImage: drawnSignatureImage ?? signatureImage ?? undefined} : {}),
      ...(activeMode === "signature" ? {signatureColor, signatureStyle} : {}),
      type: activeMode,
      width: activeMode === "signature" ? 0.26 : 0.24,
      x: activeMode === "signature" ? Math.max(0, Math.min(0.74, input.x - 0.13)) : input.x,
      y: activeMode === "signature" ? Math.max(0, Math.min(0.93, input.y - 0.035)) : input.y
    };

    commitEditorPlan({
      annotations: [...currentEditorPlan.annotations, annotation],
      order: currentEditorPlan.order,
      rotations: currentEditorPlan.rotations
    });
    setSelectedAnnotationId(annotation.id);
    setPendingDateText(null);
    setActiveMode("select");
  }

  async function loadSignatureImage(file: File | undefined) {
    if (!file) return;
    setSignatureImageError("");
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setSignatureImageError("Choisissez une image PNG ou JPEG.");
      return;
    }
    if (file.size > 150_000) {
      setSignatureImageError("L'image doit faire moins de 150 Ko.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid image."));
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.readAsDataURL(file);
    }).catch(() => "");
    if (!dataUrl) {
      setSignatureImageError("Impossible de lire cette image.");
      return;
    }
    setSignatureImage(dataUrl);
  }

  function updateAnnotation(annotationId: string, patch: Partial<Pick<StudioPdfAnnotation, "height" | "rotation" | "text" | "width" | "x" | "y">>) {
    setEditorHistory((current) => {
      if (!current) return current;

      return {
        ...current,
        present: {
          ...current.present,
          annotations: cleanAnnotations(
            current.present.annotations.map((annotation) => (
              annotation.id === annotationId ? {...annotation, ...patch} : annotation
            )),
            current.present.order
          )
        }
      };
    });
  }

  function deleteAnnotation(annotationId: string) {
    commitEditorPlan({
      annotations: currentEditorPlan.annotations.filter((annotation) => annotation.id !== annotationId),
      order: currentEditorPlan.order,
      rotations: currentEditorPlan.rotations
    });
    setSelectedAnnotationId((current) => current === annotationId ? null : current);
  }

  function updateSelectedTextStyle(patch: Partial<Pick<StudioPdfAnnotation, "bold" | "fontFamily" | "fontSize" | "textAlign" | "textColor">>) {
    if (!selectedTextAnnotation) return;

    commitEditorPlan({
      annotations: currentEditorPlan.annotations.map((annotation) => annotation.id === selectedTextAnnotation.id ? {...annotation, ...patch} : annotation),
      order: currentEditorPlan.order,
      rotations: currentEditorPlan.rotations
    });
  }

  function duplicateSelectedTextAnnotation() {
    if (!selectedTextAnnotation) return;

    const duplicate: StudioPdfAnnotation = {
      ...selectedTextAnnotation,
      id: `annotation_${crypto.randomUUID()}`,
      x: Math.min(0.98 - selectedTextAnnotation.width, selectedTextAnnotation.x + 0.025),
      y: Math.min(0.98 - selectedTextAnnotation.height, selectedTextAnnotation.y + 0.025)
    };

    commitEditorPlan({
      annotations: [...currentEditorPlan.annotations, duplicate],
      order: currentEditorPlan.order,
      rotations: currentEditorPlan.rotations
    });
    setSelectedAnnotationId(duplicate.id);
  }

  useEffect(() => {
    if (!initialTool || !document || initialToolOpenedRef.current === document.id) return;
    const item = studioToolItems.find((candidate) => candidate.tool === initialTool);
    if (!item || !canUseCurrentDocument(document, item)) return;
    initialToolOpenedRef.current = document.id;
    void launchStudioTool(item);
  }, [initialTool, document]);

  async function launchStudioTool(item: StudioToolItem) {
    if (continuingTool) return;

    if (item.tool === "merge_pdf") {
      setStudioUploadTool(item);
      setLauncherCategory(null);
      return;
    }

    if (item.mode === "options" && canUseCurrentDocument(document, item)) {
      setContinueError("");
      if (item.tool === "fill_pdf") {
        if (formFieldsState === "ready") {
          setStudioOptionsTool(item);
          setLauncherCategory(null);
          return;
        }
        const currentDocument = document;
          if (!currentDocument) return;
          setFormFields([]);
          setFormFieldsSource(null);
          setFormFieldsState("loading");
          setActiveMode("select");
          setStudioOptionsTool(item);
          setLauncherCategory(null);
        formLoadControllerRef.current?.abort();
        const controller = new AbortController();
        formLoadControllerRef.current = controller;
        try {
          const response = await fetch(`/api/studio/documents/${encodeURIComponent(currentDocument.id)}/form-fields`, {cache: "no-store", signal: controller.signal});
          if (!response.ok) throw new Error("Unable to read PDF form");
          const body = await response.json() as {fields?: StudioPdfFormField[]; source?: "input" | "result"};
          if (controller.signal.aborted) return;
          setFormFields(Array.isArray(body.fields) ? body.fields : []);
          setFormFieldsSource(body.source === "input" || body.source === "result" ? body.source : null);
          setFormFieldsState("ready");
        } catch {
          if (controller.signal.aborted) return;
          setActiveMode("select");
          setFormFieldsState("error");
        }
        return;
      }
      setToolOptionValue(item.tool === "rotate_pdf" ? `1-${currentEditorPlan.order.length}` : "");
      if (item.tool === "split_pdf") setSplitMode("every_page");
      if (item.tool === "compress_pdf" || item.tool === "compress_image") setCompressionLevel("standard");
      if (item.tool === "pdf_to_image") {
        setPdfToImageFormat(item.options.pdfToImageFormat === "png" ? "png" : "jpg");
        setPdfToImageDpi(150);
      }
      setStudioOptionsTool(item);
      setLauncherCategory(null);
      return;
    }

    if (item.mode === "editor" && canEditDisplayedPdf) {
      setLauncherCategory(null);
      if (item.tool === "insert_pdf_pages") requestInsertPages(currentEditorPlan.order.length);
      if (item.tool === "add_text_pdf") setActiveMode("text");
      if (item.tool === "reorder_pdf") {
        setActiveMode("select");
        window.document.querySelector<HTMLButtonElement>(".studio-editor-pages-open")?.click();
        window.requestAnimationFrame(() => window.document.querySelector<HTMLElement>(".studio-editor-thumb-item button")?.focus());
      }
      return;
    }

    if (item.mode === "signature") {
      if (!canUseCurrentDocument(document, item)) {
        return;
      }

      setLauncherCategory(null);
      setSignatureText("");
      setSignatureStrokes([]);
      setSignatureUndoneStrokes([]);
      setSignatureMode("draw");
      setSignatureImage(null);
      setSignatureImageError("");
      setSignatureColor("#141412");
      setSignatureStyle("script");
      setSignDialog("signer");
      return;
    }

    if (item.mode === "password") {
      if (canUseCurrentDocument(document, item)) {
        setLauncherCategory(null);
        setStudioPasswordTool(item);
        return;
      }

      if (canUploadInStudio(item)) {
        setStudioUploadTool(item);
      }

      return;
    }

    if (item.mode !== "auto") {
      return;
    }

    if (canUseCurrentDocument(document, item)) {
      await continueWith(item);
      return;
    }

    if (canUploadInStudio(item)) {
      setStudioUploadTool(item);
      return;
    }
  }

  if (!hasLoaded) {
    return (
      <main className="studio-document-loading">
        <Link href={`/${locale}/studio`}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          <span>{copy.workspace.back}</span>
        </Link>
        <section>
          <i className="ti ti-loader-2" aria-hidden="true" />
          <strong>{copy.workspace.loadingDocument}</strong>
        </section>
      </main>
    );
  }

  if (!document) {
    return (
      <main className="studio-document-workbench">
        <Link className="studio-workbench-back" href={`/${locale}/studio`}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          <span>{copy.workspace.back}</span>
        </Link>
        <section className="studio-workbench-empty">
          <i className="ti ti-file-off" aria-hidden="true" />
          <strong>{documentLoadError ? copy.empty.loadError : copy.workspace.unavailableTitle}</strong>
          <p>{documentLoadError ? copy.workspace.loadRetryText : copy.workspace.unavailableText}</p>
          {documentLoadError ? (
            <button className="studio-button primary" type="button" onClick={() => void retryDocumentLoad()}>
              <i className="ti ti-refresh" aria-hidden="true" />
              <span>{copy.empty.retry}</span>
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  const activeLauncherCategory = launcherCategory
    ? studioToolCategories.find((category) => category.id === launcherCategory) ?? null
    : null;
  const activeLauncherTitle = activeLauncherCategory ? copy.workspace.toolNav[activeLauncherCategory.label] : "";
  const launcherItems = launcherCategory ? itemsForCategory(launcherCategory) : [];

  return (
    <main className="studio-editor">
      {guestLeaveDialog}
      <aside
        className="studio-editor-rail"
        aria-label={copy.workspace.actions}
        onMouseLeave={() => {
          setLauncherCategory(null);
        }}
      >
        <Link className="studio-editor-logo" href={`/${locale}/studio`} aria-label={copy.workspace.back}>
          <i className="ti ti-arrow-back-up" aria-hidden="true" />
        </Link>
        <nav>
          {studioToolCategories.map((category) => (
            <div
              className="studio-editor-tool-item"
              key={category.id}
              onMouseEnter={() => {
                setLauncherCategory(category.id);
              }}
            >
              <button
                className={launcherCategory === category.id ? "active" : ""}
                type="button"
                onClick={() => {
                  setLauncherCategory(category.id);
                }}
                onFocus={() => {
                  setLauncherCategory(category.id);
                }}
              >
                <i className={`ti ${category.icon}`} aria-hidden="true" />
                <span>{copy.workspace.toolNav[category.label]}</span>
              </button>

              {launcherCategory === category.id ? (
                <section className="studio-tool-flyout" aria-label={copy.workspace.toolNav[category.label]}>
                  {launcherItems.map((item) => {
                    const canUseCurrent = canUseCurrentDocument(document, item);
                    const canUseCurrentForLabel = canUseCurrent;
                    const canUpload = canUploadInStudio(item);
                    const editorSupported = ["reorder_pdf", "insert_pdf_pages", "add_text_pdf"].includes(item.tool);
                    const isUnavailable = item.mode === "comingSoon" || item.mode === "premium";
                    const isActionable = item.mode === "auto" || item.mode === "password" ||
                      ((item.mode === "signature" || item.mode === "options") && canUseCurrent) ||
                      (item.mode === "editor" && editorSupported && canUseCurrent && canEditDisplayedPdf);
                    const isBusy = continuingTool === item.tool;
                    const needsSavedEdits = hasUnsavedEditorEdits && (item.mode === "password" || item.tool === "merge_pdf" || document.resultMimeType !== "application/pdf");
                    const toolName = catalog(`tools.${item.labelKey}`);
                    const availability = item.mode === "premium" ? copy.workspace.launcher.premiumLater : copy.workspace.launcher.comingSoon;

                    return (
                      <button
                        className={`${canUseCurrentForLabel ? "can-use-current" : ""}${isUnavailable ? " is-unavailable" : ""}`}
                        disabled={continuingTool !== null || savingEditorEdits || Boolean(pageActionState) || isPreviewingHistoricalVersion || needsSavedEdits || isUnavailable || !isActionable}
                        key={`${item.tool}-${item.labelKey}`}
                        title={needsSavedEdits ? copy.workspace.finish : modeLabel({canUpload, canUseCurrent: canUseCurrentForLabel, copy, item})}
                        type="button"
                        onClick={() => launchStudioTool(item)}
                      >
                        <i className={`ti ${isBusy ? "ti-loader-2" : item.icon}`} aria-hidden="true" />
                        <span>{toolName}{isUnavailable ? <small>{availability}</small> : null}</span>
                      </button>
                    );
                  })}
                </section>
              ) : null}
            </div>
          ))}
        </nav>
        <Link className="studio-editor-account" href={`/${locale}/studio`}>
          <i className="ti ti-folder" aria-hidden="true" />
          <span>{copy.workspace.toolNav.documents}</span>
        </Link>
      </aside>

      <section className="studio-editor-surface">
        <header className="studio-editor-header">
          <div className="studio-editor-title">
            <Link href={`/${locale}/studio`} aria-label={copy.workspace.back}>
              <i className="ti ti-arrow-left" aria-hidden="true" />
            </Link>
            <div>
              <strong>{activeLauncherTitle || actionLabel || copy.workspace.details}</strong>
              <span title={document.name}>{document.name}</span>
              <small className={`studio-document-status ${document.isGuest ? "is-temporary" : "is-saved"}`}>
                <i className={`ti ${document.isGuest ? "ti-clock" : "ti-check"}`} aria-hidden="true" />
                {document.isGuest ? account.user ? authCopy.temporary : copy.workspace.documentStatus.temporary : authCopy.saved}
                {document.isGuest && document.resultExpiresAt ? (
                  <time dateTime={document.resultExpiresAt}>
                    {Date.parse(document.resultExpiresAt) > Date.now()
                      ? `${copy.workspace.guest.expires} ${expirationLabel(document.resultExpiresAt, locale, copy.workspace.guest.temporary)}`
                      : copy.workspace.unavailableTitle}
                  </time>
                ) : null}
              </small>
              {document.isGuest && continueError ? <p className="studio-guest-error" role="alert">{continueError}</p> : null}
            </div>
          </div>

          <div className="studio-editor-primary-actions">
            <StudioAccountButton locale={locale} />
              <button
                className="studio-editor-soft"
                disabled={savingEditorEdits || savingWorkspaceDocument || Boolean(continuingTool) || (!isFillingPdf && !hasUnsavedEditorEdits && !hasPendingFormEdits && !canSaveToWorkspace)}
                type="button"
                onClick={() => {
                  if (isFillingPdf) {
                    void saveFilledPdf();
                    return;
                  }
                  if (document.isGuest) {
                  void saveToWorkspace();
                  return;
                }
                if (hasUnsavedEditorEdits || hasPendingFormEdits) {
                  void applyEditorEdits();
                  return;
                }

                void saveToWorkspace();
              }}
              >
                <i className={`ti ${savingEditorEdits || savingWorkspaceDocument || continuingTool ? "ti-loader-2" : isFillingPdf ? "ti-forms" : "ti-cloud-upload"}`} aria-hidden="true" />
                <span>{isFillingPdf ? formCopy.submit : document.isGuest && !account.user ? authCopy.save : !document.isGuest && !hasUnsavedEditorEdits && !hasPendingFormEdits ? copy.workspace.documentStatus.saved : copy.workspace.save}</span>
            </button>
            {document.resultUrl && (hasUnsavedEditorEdits || hasPendingFormEdits) ? (
              <button
                className="studio-editor-blue"
                disabled={savingEditorEdits || savingWorkspaceDocument || Boolean(continuingTool) || Boolean(pageActionState)}
                type="button"
                onClick={() => void downloadEditedPdf()}
              >
                <i className={`ti ${savingEditorEdits ? "ti-loader-2" : "ti-download"}`} aria-hidden="true" />
                <span>{copy.workspace.download}</span>
              </button>
            ) : document.resultUrl ? (
              <a className="studio-editor-blue" href={document.resultUrl} download>
                <i className="ti ti-download" aria-hidden="true" />
                <span>{copy.workspace.download}</span>
              </a>
            ) : (
              <button className="studio-editor-blue" type="button" disabled>
                <i className="ti ti-loader-2" aria-hidden="true" />
                <span>{copy.selected.inProgress}</span>
              </button>
            )}
            {!document.isGuest ? (
              <button
                aria-label={copy.workspace.delete}
                className="studio-editor-danger"
                disabled={isDeletingDocument || savingEditorEdits || savingWorkspaceDocument}
                title={copy.workspace.delete}
                type="button"
                onClick={() => {
                  setDeleteDocumentError("");
                  setIsDeleteDialogOpen(true);
                }}
              >
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            ) : null}
              <button
                className="studio-editor-outline"
                disabled={(!hasUnsavedEditorEdits && !hasPendingFormEdits && !isFillingPdf) || savingEditorEdits || Boolean(continuingTool)}
                type="button"
                onClick={() => {
                  if (isFillingPdf) {
                    void saveFilledPdf();
                    return;
                  }
                  void applyEditorEdits();
                }}
              >
                <span>{isFillingPdf ? formCopy.submit : copy.workspace.finish}</span>
                <i className={`ti ${savingEditorEdits || continuingTool ? "ti-loader-2" : isFillingPdf ? "ti-forms" : "ti-arrow-right"}`} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="studio-editor-toolbar" aria-label={copy.workspace.actions}>
          <button
            className={activeMode === "hand" ? "active" : ""}
            type="button"
            title={copy.workspace.toolbar.hand}
            onClick={() => setActiveMode("hand")}
          >
            <i className="ti ti-hand-stop" aria-hidden="true" />
          </button>
          <button
            className={activeMode === "select" ? "active" : ""}
            type="button"
            title={copy.workspace.toolbar.select}
            onClick={() => setActiveMode("select")}
          >
            <i className="ti ti-pointer" aria-hidden="true" />
          </button>
          <button
            className={activeMode === "text" && !pendingDateText ? "active" : ""}
            type="button"
            title={copy.workspace.toolbar.text}
            onClick={() => {
              setPendingDateText(null);
              setActiveMode("text");
              setLauncherCategory(null);
            }}
          >
            <i className="ti ti-letter-t" aria-hidden="true" />
          </button>
          <button
            className={activeMode === "text" && pendingDateText ? "active" : ""}
            type="button"
            title={dateCopy.title}
            aria-label={dateCopy.title}
            disabled={!canEditDisplayedPdf || savingEditorEdits}
            onClick={() => { setDateDialogOpen(true); setLauncherCategory(null); }}
          >
            <i className="ti ti-calendar" aria-hidden="true" />
          </button>
          <button type="button" title={activityLabels.title} aria-label={activityLabels.title} onClick={() => setActivityDialogOpen(true)}><i className="ti ti-history" aria-hidden="true" /></button>
          <button type="button" title={document.isGuest ? approvalLabels.savedOnly : hasUnsavedEditorEdits || hasPendingFormEdits ? approvalLabels.unsaved : approvalLabels.request} aria-label={approvalLabels.request}
            disabled={document.isGuest || !account.user || hasUnsavedEditorEdits || hasPendingFormEdits || savingEditorEdits || Boolean(continuingTool)}
            onClick={() => {setApprovalDialogOpen(true); setLauncherCategory(null);}}><i className="ti ti-checkup-list" aria-hidden="true" /></button>
          <button
            disabled={!canUndoEditorEdit || savingEditorEdits}
            title={copy.workspace.toolbar.undo}
            type="button"
            onClick={undoEditorEdit}
          >
            <i className="ti ti-arrow-back-up" aria-hidden="true" />
          </button>
          <button
            disabled={!canRedoEditorEdit || savingEditorEdits}
            title={copy.workspace.toolbar.redo}
            type="button"
            onClick={redoEditorEdit}
          >
            <i className="ti ti-arrow-forward-up" aria-hidden="true" />
          </button>
          {selectedTextAnnotation ? (
            <section className="studio-text-inspector" aria-label={textStyleCopy.style}>
              <select
                aria-label={textStyleCopy.font}
                onChange={(event) => updateSelectedTextStyle({fontFamily: event.currentTarget.value as "mono" | "sans" | "serif"})}
                value={selectedTextAnnotation.fontFamily ?? "sans"}
              >
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Mono</option>
              </select>
              <label className="studio-text-size">
                <span className="sr-only">{textStyleCopy.size}</span>
                <input
                  aria-label={textStyleCopy.size}
                  max={48}
                  min={8}
                  onChange={(event) => updateSelectedTextStyle({fontSize: Math.max(8, Math.min(48, Number(event.currentTarget.value) || 14))})}
                  type="number"
                  value={selectedTextAnnotation.fontSize ?? 14}
                />
              </label>
              <button
                aria-pressed={selectedTextAnnotation.bold === true}
                className={selectedTextAnnotation.bold ? "active" : ""}
                title={textStyleCopy.bold}
                type="button"
                onClick={() => updateSelectedTextStyle({bold: !selectedTextAnnotation.bold})}
              ><i className="ti ti-bold" aria-hidden="true" /></button>
              <div className="studio-text-colors" aria-label={textStyleCopy.color}>
                {textColors.map((color) => (
                  <button
                    aria-label={color}
                    className={(selectedTextAnnotation.textColor ?? "#141412") === color ? "active" : ""}
                    key={color}
                    style={{"--text-swatch": color} as CSSProperties}
                    title={color}
                    type="button"
                    onClick={() => updateSelectedTextStyle({textColor: color})}
                  />
                ))}
              </div>
              <div className="studio-text-alignment" aria-label={textStyleCopy.alignment}>
                {(["left", "center", "right"] as const).map((alignment) => (
                  <button
                    aria-label={alignment}
                    className={(selectedTextAnnotation.textAlign ?? "left") === alignment ? "active" : ""}
                    key={alignment}
                    type="button"
                    onClick={() => updateSelectedTextStyle({textAlign: alignment})}
                  ><i className={`ti ti-align-${alignment}`} aria-hidden="true" /></button>
                ))}
              </div>
              <button title={textStyleCopy.duplicate} type="button" onClick={duplicateSelectedTextAnnotation}>
                <i className="ti ti-copy" aria-hidden="true" />
              </button>
              <button className="danger" title={copy.workspace.pageActions.delete} type="button" onClick={() => deleteAnnotation(selectedTextAnnotation.id)}>
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </section>
          ) : null}
        </div>

        {isPreviewingSourcePdf ? (
          <p className="studio-source-preview-note"><i className="ti ti-file-description" aria-hidden="true" />{copy.workspace.sourcePreview}</p>
        ) : null}
        {studioOptionsTool?.tool === "fill_pdf" ? (
          <p className={`studio-form-canvas-status${formFieldsState === "error" ? " is-error" : ""}`} role={formFieldsState === "error" ? "alert" : undefined}>
            <i className={`ti ${formFieldsState === "loading" ? "ti-loader-2" : formFieldsState === "ready" && formFields.length > 0 ? "ti-forms" : "ti-file-alert"}`} aria-hidden="true" />
            {formFieldsState === "loading" ? formCopy.loading : formFieldsState === "error" ? formCopy.error : formFields.length === 0 ? formCopy.empty : formCopy.hint}
          </p>
        ) : null}

        <StudioPdfViewer
          actionLabel={actionLabel}
          defaultSidePanelOpen={!document.isGuest || studioOptionsTool?.tool === "fill_pdf"}
          fallbackPageCount={Math.max(1, selectedVersion?.pageCount ?? pageCount)}
          labels={{
            removeAnnotation: copy.workspace.signModal.removeAnnotation,
            addFile: copy.workspace.addFile,
            comingSoon: copy.workspace.comingSoon,
            hideThumbnails: copy.workspace.hideThumbnails,
            hideResultPanel: document.isGuest ? copy.workspace.hideResultPanel : copy.workspace.versions.hide,
            loading: copy.selected.inProgress,
            pageActions: copy.workspace.pageActions,
            preview: copy.workspace.preview,
            resultPanel: document.isGuest ? copy.workspace.resultPanel : copy.workspace.versions.title,
            showThumbnails: copy.workspace.showThumbnails,
            showResultPanel: document.isGuest ? copy.workspace.showResultPanel : copy.workspace.versions.show,
            thumbnails: copy.workspace.thumbnails,
            unavailableText: copy.workspace.unavailableText,
            unavailableTitle: copy.workspace.unavailableTitle
          }}
          name={selectedVersion?.fileName ?? document.name}
            activeTool={activeMode}
            annotations={canEditDisplayedPdf ? currentEditorPlan.annotations : []}
          onAnnotationChange={updateAnnotation}
          onAnnotationDelete={deleteAnnotation}
          onAnnotationEditEnd={endAnnotationEdit}
          onAnnotationEditStart={beginAnnotationEdit}
          onAnnotationSelect={setSelectedAnnotationId}
            onInsertPages={canEditDisplayedPdf ? requestInsertPages : undefined}
          onPlaceAnnotation={canEditDisplayedPdf ? placeAnnotation : undefined}
          onPageAction={canEditDisplayedPdf ? runPageAction : undefined}
          onBulkPageAction={canEditDisplayedPdf ? runBulkPageAction : undefined}
          onPageCountChange={setPreviewPageCount}
          onReorderPages={canEditDisplayedPdf ? runPageReorder : undefined}
          pageOrder={canEditDisplayedPdf ? currentEditorPlan.order : undefined}
          pageRotations={canEditDisplayedPdf ? visiblePageRotations : undefined}
          pendingSignature={activeMode === "signature" ? {
            height: 0.07,
            signatureColor,
            signatureImage: signatureImage ?? undefined,
            signatureStrokes,
            signatureStyle,
            text: signatureText.trim(),
            type: "signature",
            width: 0.26
          } : null}
          selectedAnnotationId={selectedAnnotationId}
          pageActionError={pageActionError}
          pageActionState={pageActionState}
          previewUrl={activePreviewUrl}
          watermarkPreview={watermarkPreview}
          pageNumberPreview={pageNumberPreview}
            sidePanel={studioOptionsTool?.tool === "fill_pdf" ? (
              <section className="studio-form-side-panel" aria-label={catalog("tools.fillPdf")}>
                <header><span className="studio-form-panel-label"><i className="ti ti-forms" aria-hidden="true" />{catalog("tools.fillPdf")}</span><button type="button" aria-label={copy.workspace.launcher.close} onClick={() => setStudioOptionsTool(null)}><i className="ti ti-x" aria-hidden="true" /></button></header>
                <p className={`studio-form-document-state ${document.isGuest ? "is-temporary" : "is-saved"}`}><i className={`ti ${document.isGuest ? "ti-clock" : "ti-check"}`} aria-hidden="true" />{document.isGuest ? copy.workspace.documentStatus.temporary : authCopy.saved}</p>
                <p>{formCopy.hint}</p>
                {formFieldsState === "loading" ? <p className="field-hint">{formCopy.loading}</p> : formFieldsState === "error" ? <p className="studio-guest-error">{formCopy.error}</p> : formFields.length === 0 ? <p className="field-hint">{formCopy.empty}</p> : <div className="studio-form-fields">
                  {formFields.map((field) => <label className="split-field" key={field.name}><span>{field.name}<small>{formCopy[field.type]}</small></span>{field.type === "checkbox" ? <input type="checkbox" checked={Boolean(field.value)} onChange={(event) => updateFormField(field.name, event.currentTarget.checked)} /> : field.type === "text" ? <input className="split-input" maxLength={field.maxLength} value={String(field.value)} onChange={(event) => updateFormField(field.name, event.currentTarget.value)} /> : <select className="split-input" value={String(field.value)} onChange={(event) => updateFormField(field.name, event.currentTarget.value)}><option value="" />{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>}</label>)}
                </div>}
                <button className="studio-guest-download" type="button" disabled={!isFillingPdf || Boolean(continuingTool)} onClick={() => void saveFilledPdf()}><i className="ti ti-forms" aria-hidden="true" /><span>{formCopy.submit}</span></button>
              </section>
            ) : document.isGuest ? null : (
            <section className="studio-version-history" aria-label={copy.workspace.versions.title}>
              <div className="studio-version-history-header">
                <span className="studio-guest-badge">
                  <i className="ti ti-history" aria-hidden="true" />
                  {copy.workspace.versions.title}
                </span>
              </div>

              {versionHistoryState === "loading" ? (
                <div className="studio-version-state">
                  <i className="ti ti-loader-2" aria-hidden="true" />
                  <span>{copy.selected.inProgress}</span>
                </div>
              ) : null}

              {versionHistoryState === "error" ? (
                <p className="studio-guest-error">{copy.workspace.versions.error}</p>
              ) : null}

              {versionHistoryState === "ready" && documentVersions.length === 0 ? (
                <p className="studio-version-empty">{copy.workspace.versions.empty}</p>
              ) : null}

              {documentVersions.length > 0 ? (
                <ol className="studio-version-list">
                  {documentVersions.map((version) => {
                    const isSelected = selectedVersionId
                      ? selectedVersionId === version.id
                      : version.isCurrent;

                    return (
                      <li className={isSelected ? "is-selected" : ""} key={version.id}>
                        <button
                          className="studio-version-preview"
                          disabled={!version.previewUrl}
                          type="button"
                          onClick={() => {
                            setSelectedVersionId(version.id);
                            setPreviewPageCount(null);
                          }}
                        >
                          <span>
                            <strong>{`${copy.workspace.versions.version} ${version.versionNumber}`}</strong>
                            {version.isCurrent ? <em>{copy.workspace.versions.current}</em> : null}
                          </span>
                          <small>{versionDateLabel(version.createdAt, locale)}</small>
                          <small>{formatBytes(version.size)}</small>
                        </button>
                        <div className="studio-version-actions">
                          <a href={version.downloadUrl} title={copy.workspace.versions.download}>
                            <i className="ti ti-download" aria-hidden="true" />
                          </a>
                          {!version.isCurrent ? (
                            <button
                              disabled={restoringVersionId !== null}
                              type="button"
                              onClick={() => void restoreDocumentVersion(version)}
                            >
                              <i className={`ti ${restoringVersionId === version.id ? "ti-loader-2" : "ti-history"}`} aria-hidden="true" />
                              <span>{restoringVersionId === version.id ? copy.workspace.versions.restoring : copy.workspace.versions.restore}</span>
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {continueError ? <p className="studio-guest-error">{continueError}</p> : null}
            </section>
          )}
        />
        <input
          ref={insertFileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          hidden
          onChange={(event) => void handleInsertFiles(event.currentTarget.files)}
        />
      </section>

      {studioUploadTool ? (
        <StudioToolUploadDialog
          errorLabels={uploadErrorLabels}
          item={studioUploadTool}
          labels={copy.workspace.launcher}
          locale={locale}
          onClose={() => setStudioUploadTool(null)}
          passwordLabels={passwordModeForTool(studioUploadTool.tool) ? passwordLabelsForTool(studioUploadTool.tool) : undefined}
          sourcePayload={studioUploadTool.tool === "merge_pdf" && canUseCurrentDocument(document, studioUploadTool) ? jobSourcePayloadFor(document, "result") : undefined}
          sourceName={studioUploadTool.tool === "merge_pdf" && canUseCurrentDocument(document, studioUploadTool) ? document.name : undefined}
          toolName={catalog(`tools.${studioUploadTool.labelKey}`)}
        />
      ) : null}

      {studioOptionsTool && (studioOptionsTool.tool as string) !== "fill_pdf" ? (
        <div className="studio-editor-modal-backdrop">
          <form
            className="studio-tool-upload studio-password-options"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-options-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !continuingTool) setStudioOptionsTool(null);
              if (event.key === "Tab") {
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)"));
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && window.document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && window.document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
            onSubmit={(event) => {
              event.preventDefault();
              const isPageNumbering = studioOptionsTool.tool === "number_pdf_pages";
              const isSplit = studioOptionsTool.tool === "split_pdf";
              const isCompression = studioOptionsTool.tool === "compress_pdf" || studioOptionsTool.tool === "compress_image";
              const isPdfToImage = studioOptionsTool.tool === "pdf_to_image";
              const isPdfToOffice = studioOptionsTool.tool === "pdf_to_word" || studioOptionsTool.tool === "pdf_to_excel" || studioOptionsTool.tool === "pdf_to_powerpoint";
              const isFillPdf = studioOptionsTool.tool === "fill_pdf";
              if ((!isPageNumbering && !isCompression && !isPdfToImage && !isPdfToOffice && !isFillPdf && (!isSplit || splitMode === "range") && !toolOptionValue.trim()) || continuingTool) return;
              void continueWith({
                ...studioOptionsTool,
                options: studioOptionsTool.tool === "watermark_pdf"
                  ? {watermarkText: toolOptionValue.trim(), watermarkPosition, watermarkOpacity, watermarkColor, watermarkFontSize}
                  : isPageNumbering
                    ? {pageNumberColor, pageNumberFontSize, pageNumberFormat, pageNumberMargin, pageNumberPosition, pageNumberStartNumber, pageNumberStartPage}
                    : isCompression
                      ? {compressionLevel}
                    : isPdfToImage
                      ? {pdfToImageDpi, pdfToImageFormat}
                    : isFillPdf
                      ? {formValues: Object.fromEntries(formFields.map((field) => [field.name, field.value]))}
                    : isSplit
                      ? {splitMode, splitInterval: splitMode === "interval" ? splitInterval : undefined, pageRange: splitMode === "range" ? toolOptionValue.trim() : undefined}
                    : studioOptionsTool.tool === "rotate_pdf"
                      ? {pageRange: toolOptionValue.trim(), rotateDegrees}
                    : {pageRange: toolOptionValue.trim()}
              });
            }}
          >
            <button className="studio-editor-modal-close" type="button" aria-label={copy.workspace.launcher.close}
              disabled={Boolean(continuingTool)} onClick={() => setStudioOptionsTool(null)}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
            <h2 id="studio-options-title">{catalog(`tools.${studioOptionsTool.labelKey}`)}</h2>
            <div className="studio-tool-password-fields">
              {studioOptionsTool.tool !== "number_pdf_pages" && studioOptionsTool.tool !== "split_pdf" && studioOptionsTool.tool !== "compress_pdf" && studioOptionsTool.tool !== "compress_image" && studioOptionsTool.tool !== "pdf_to_image" && studioOptionsTool.tool !== "pdf_to_word" && studioOptionsTool.tool !== "pdf_to_excel" && studioOptionsTool.tool !== "pdf_to_powerpoint" && studioOptionsTool.tool !== "fill_pdf" ? (
                <label className="split-field">
                  <span>{home(studioOptionsTool.tool === "watermark_pdf" ? "upload.watermark.textLabel" : studioOptionsTool.tool === "delete_pdf_pages" ? "upload.delete.rangeLabel" : studioOptionsTool.tool === "rotate_pdf" ? "upload.rotate.rangeLabel" : "upload.extract.rangeLabel")}</span>
                  <input autoFocus required className="split-input" value={toolOptionValue}
                    disabled={Boolean(continuingTool)} onChange={(event) => setToolOptionValue(event.target.value)}
                    placeholder={home(studioOptionsTool.tool === "watermark_pdf" ? "upload.watermark.textPlaceholder" : studioOptionsTool.tool === "rotate_pdf" ? "upload.rotate.rangePlaceholder" : "upload.extract.rangePlaceholder")} />
                </label>
              ) : null}
              {studioOptionsTool.tool === "fill_pdf" ? (
                formFieldsState === "loading" ? <p className="field-hint">{formCopy.loading}</p>
                  : formFieldsState === "error" ? <p className="studio-guest-error" role="alert">{formCopy.error}</p>
                    : formFields.length === 0 ? <p className="field-hint">{formCopy.empty}</p>
                      : <div className="studio-form-fields">
                        <p className="studio-form-summary"><i className="ti ti-forms" aria-hidden="true" />{formFields.length} {formCopy.fields}</p>
                        {formFields.map((field) => (
                          <label className="split-field" key={field.name}>
                            <span>{field.name}<small>{formCopy[field.type]}</small></span>
                            {field.type === "checkbox" ? (
                                <input type="checkbox" checked={Boolean(field.value)} disabled={Boolean(continuingTool)} onChange={(event) => {
                                  const value = event.currentTarget.checked;
                                  setFormFields((current) => current.map((item) => item.name === field.name ? {...item, value} : item));
                                }} />
                              ) : field.type === "text" ? (
                                <input className="split-input" maxLength={field.maxLength} value={String(field.value)} disabled={Boolean(continuingTool)} onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  setFormFields((current) => current.map((item) => item.name === field.name ? {...item, value} : item));
                                }} />
                              ) : (
                                <select className="split-input" value={String(field.value)} disabled={Boolean(continuingTool)} onChange={(event) => {
                                  const value = event.currentTarget.value;
                                  setFormFields((current) => current.map((item) => item.name === field.name ? {...item, value} : item));
                                }}>
                                <option value="" />
                                {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            )}
                          </label>
                        ))}
                      </div>
              ) : studioOptionsTool.tool === "watermark_pdf" ? (
                <>
                  <label className="split-field">
                    <span>{home("upload.watermark.selectPosition")}</span>
                    <select className="split-input" value={watermarkPosition} disabled={Boolean(continuingTool)} onChange={(event) => setWatermarkPosition(event.target.value)}>
                      {(["center", "diagonal", "repeated"] as const).map((position) => <option key={position} value={position}>{home(`upload.watermark.${position}`)}</option>)}
                    </select>
                  </label>
                  <label className="split-field">
                    <span>{home("upload.watermark.opacityLabel")}</span>
                    <input type="number" className="split-input" required min={0.05} max={1} step={0.05}
                      value={watermarkOpacity} disabled={Boolean(continuingTool)} onChange={(event) => setWatermarkOpacity(Number(event.target.value))} />
                  </label>
                  <label className="split-field">
                    <span>Taille</span>
                    <input type="number" className="split-input" required min={8} max={120} step={1}
                      value={watermarkFontSize} disabled={Boolean(continuingTool)} onChange={(event) => setWatermarkFontSize(Math.max(8, Math.min(120, Number(event.target.value) || 48)))} />
                  </label>
                  <div className="studio-watermark-colors" aria-label="Couleur du filigrane">
                    {textColors.map((color) => <button key={color} type="button" title={color} aria-label={color}
                      className={watermarkColor === color ? "active" : ""} style={{"--text-swatch": color} as CSSProperties}
                      disabled={Boolean(continuingTool)} onClick={() => setWatermarkColor(color)} />)}
                  </div>
                </>
              ) : studioOptionsTool.tool === "number_pdf_pages" ? (
                <>
                  <label className="split-field">
                    <span>{home("upload.pageNumbers.selectPosition")}</span>
                    <select className="split-input" value={pageNumberPosition} disabled={Boolean(continuingTool)} onChange={(event) => setPageNumberPosition(event.target.value as StudioPageNumberPreview["position"])}>
                      {(["bottom_left", "bottom_center", "bottom_right", "top_left", "top_center", "top_right"] as const).map((position) => <option key={position} value={position}>{home(`upload.pageNumbers.${position.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}`)}</option>)}
                    </select>
                  </label>
                  <label className="split-field">
                    <span>{home("upload.pageNumbers.formatLabel")}</span>
                    <select className="split-input" value={pageNumberFormat} disabled={Boolean(continuingTool)} onChange={(event) => setPageNumberFormat(event.target.value as StudioPageNumberPreview["format"])}>
                      <option value="number">{home("upload.pageNumbers.formatNumber")}</option>
                      <option value="page">{home("upload.pageNumbers.formatPage")}</option>
                      <option value="page_of_total">{home("upload.pageNumbers.formatPageOfTotal")}</option>
                    </select>
                  </label>
                  <label className="split-field">
                    <span>{home("upload.pageNumbers.startPageLabel")}</span>
                    <input autoFocus type="number" className="split-input" required min={1} step={1} value={pageNumberStartPage}
                      disabled={Boolean(continuingTool)} onChange={(event) => setPageNumberStartPage(Math.max(1, Math.floor(Number(event.target.value) || 1)))} />
                  </label>
                  <label className="split-field">
                    <span>{home("upload.pageNumbers.startNumberLabel")}</span>
                    <input type="number" className="split-input" required min={0} step={1} value={pageNumberStartNumber}
                      disabled={Boolean(continuingTool)} onChange={(event) => setPageNumberStartNumber(Math.max(0, Math.floor(Number(event.target.value) || 0)))} />
                  </label>
                  <label className="split-field">
                    <span>{home("upload.pageNumbers.fontSizeLabel")}</span>
                    <input type="number" className="split-input" required min={8} max={48} step={1} value={pageNumberFontSize}
                      disabled={Boolean(continuingTool)} onChange={(event) => setPageNumberFontSize(Math.max(8, Math.min(48, Math.floor(Number(event.target.value) || 11))))} />
                  </label>
                  <label className="split-field">
                    <span>{home("upload.pageNumbers.marginLabel")}</span>
                    <input type="number" className="split-input" required min={12} max={96} step={1} value={pageNumberMargin}
                      disabled={Boolean(continuingTool)} onChange={(event) => setPageNumberMargin(Math.max(12, Math.min(96, Math.floor(Number(event.target.value) || 36))))} />
                  </label>
                  <div className="studio-watermark-colors" aria-label={home("upload.pageNumbers.colorLabel")}>
                    {textColors.map((color) => <button key={color} type="button" title={color} aria-label={color}
                      className={pageNumberColor === color ? "active" : ""} style={{"--text-swatch": color} as CSSProperties}
                      disabled={Boolean(continuingTool)} onClick={() => setPageNumberColor(color)} />)}
                  </div>
                </>
              ) : studioOptionsTool.tool === "compress_pdf" || studioOptionsTool.tool === "compress_image" ? (
                <div className="studio-compression-levels" role="radiogroup" aria-label={home("upload.compression.selectLevel")}>
                  {(["best_size", "standard", "best_quality"] as const).map((level) => {
                    const label = level === "best_size" ? "bestSize" : level === "best_quality" ? "bestQuality" : "standard";
                    const description = level === "best_size" ? "bestSizeText" : level === "best_quality" ? "bestQualityText" : "standardText";
                    return (
                      <button key={level} type="button" role="radio" aria-checked={compressionLevel === level}
                        className={compressionLevel === level ? "active" : ""} disabled={Boolean(continuingTool)} onClick={() => setCompressionLevel(level)}>
                        <i className={`ti ${level === "best_size" ? "ti-arrows-minimize" : level === "best_quality" ? "ti-photo" : "ti-adjustments-horizontal"}`} aria-hidden="true" />
                        <strong>{home(`upload.compression.${label}`)}</strong>
                        <span>{home(`upload.compression.${description}`)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : studioOptionsTool.tool === "pdf_to_image" ? (
                <>
                  <div className="studio-compression-levels" role="radiogroup" aria-label={home("upload.pdfToImage.selectFormat")}>
                    {(["jpg", "png"] as const).map((format) => (
                      <button key={format} type="button" role="radio" aria-checked={pdfToImageFormat === format}
                        className={pdfToImageFormat === format ? "active" : ""} disabled={Boolean(continuingTool)} onClick={() => setPdfToImageFormat(format)}>
                        <i className={`ti ${format === "jpg" ? "ti-file-type-jpg" : "ti-file-type-png"}`} aria-hidden="true" />
                        <strong>{home(`upload.pdfToImage.${format}`)}</strong>
                        <span>{home(`upload.pdfToImage.${format}Text`)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="studio-compression-levels" role="radiogroup" aria-label={home("upload.pdfToImage.selectResolution")}>
                    {([72, 150, 300] as const).map((dpi) => {
                      const resolution = dpi === 72 ? "web" : dpi === 150 ? "standard" : "highDefinition";
                      return (
                        <button key={dpi} type="button" role="radio" aria-checked={pdfToImageDpi === dpi}
                          className={pdfToImageDpi === dpi ? "active" : ""} disabled={Boolean(continuingTool)} onClick={() => setPdfToImageDpi(dpi)}>
                          <i className="ti ti-focus-2" aria-hidden="true" />
                          <strong>{home(`upload.pdfToImage.${resolution}`)}</strong>
                          <span>{home(`upload.pdfToImage.${resolution}Text`)}</span>
                        </button>
                      );
	                    })}
	                  </div>
                </>
              ) : studioOptionsTool.tool === "pdf_to_word" || studioOptionsTool.tool === "pdf_to_excel" || studioOptionsTool.tool === "pdf_to_powerpoint" ? (
                <p className="field-hint studio-tool-option-summary">{home("upload.officeConversion")}</p>
              ) : studioOptionsTool.tool === "split_pdf" ? (
                <>
                  <label className="split-field">
                    <span>{home("upload.split.selectMethod")}</span>
                    <select className="split-input" value={splitMode} disabled={Boolean(continuingTool)} onChange={(event) => setSplitMode(event.target.value as "every_page" | "interval" | "range")}>
                      <option value="every_page">{home("upload.split.everyPage")}</option>
                      <option value="interval">{home("upload.split.interval")}</option>
                      <option value="range">{home("upload.split.range")}</option>
                    </select>
                  </label>
                  <p className="field-hint">{home(`upload.split.${splitMode === "every_page" ? "everyPageText" : splitMode === "interval" ? "intervalText" : "rangeText"}`)}</p>
                  {splitMode === "interval" ? (
                    <label className="split-field">
                      <span>{home("upload.split.intervalLabel")}</span>
                      <input autoFocus type="number" className="split-input" required min={1} max={500} step={1} value={splitInterval}
                        disabled={Boolean(continuingTool)} onChange={(event) => setSplitInterval(Math.max(1, Math.min(500, Math.floor(Number(event.target.value) || 1))))} />
                    </label>
                  ) : null}
                  {splitMode === "range" ? (
                    <label className="split-field">
                      <span>{home("upload.split.rangeLabel")}</span>
                      <input autoFocus required className="split-input" value={toolOptionValue} disabled={Boolean(continuingTool)}
                        placeholder={home("upload.split.rangePlaceholder")} onChange={(event) => setToolOptionValue(event.target.value)} />
                    </label>
                  ) : null}
                  <p className="studio-tool-option-summary">
                    {splitMode === "every_page"
                      ? home("upload.split.previewEveryPage", {count: editablePageCount})
                      : splitMode === "interval"
                        ? home("upload.split.previewInterval", {count: Math.ceil(editablePageCount / splitInterval)})
                        : home("upload.split.previewRange")}
                  </p>
                </>
              ) : studioOptionsTool.tool === "rotate_pdf" ? (
                <label className="split-field">
                  <span>{home("upload.rotate.selectAngle")}</span>
                  <select className="split-input" value={rotateDegrees} disabled={Boolean(continuingTool)} onChange={(event) => setRotateDegrees(Number(event.target.value) as 90 | 180 | 270)}>
                    <option value={90}>{home("upload.rotate.right")}</option>
                    <option value={180}>{home("upload.rotate.half")}</option>
                    <option value={270}>{home("upload.rotate.left")}</option>
                  </select>
                </label>
              ) : null}
            </div>
            {continueError ? <p className="studio-guest-error" role="alert">{continueError}</p> : null}
            <button className="studio-guest-download" type="submit" disabled={(studioOptionsTool.tool === "fill_pdf" ? formFieldsState !== "ready" || formFields.length === 0 : studioOptionsTool.tool !== "number_pdf_pages" && studioOptionsTool.tool !== "compress_pdf" && studioOptionsTool.tool !== "compress_image" && studioOptionsTool.tool !== "pdf_to_image" && studioOptionsTool.tool !== "pdf_to_word" && studioOptionsTool.tool !== "pdf_to_excel" && studioOptionsTool.tool !== "pdf_to_powerpoint" && !(studioOptionsTool.tool === "split_pdf" && splitMode !== "range") && !toolOptionValue.trim()) || Boolean(continuingTool)}>
              <i className={`ti ${continuingTool ? "ti-loader-2" : studioOptionsTool.icon}`} aria-hidden="true" />
              <span>{continuingTool ? copy.selected.inProgress : studioOptionsTool.tool === "fill_pdf" ? formCopy.submit : home(studioOptionsTool.tool === "watermark_pdf" ? "upload.watermark.submit" : studioOptionsTool.tool === "number_pdf_pages" ? "upload.pageNumbers.submit" : studioOptionsTool.tool === "compress_pdf" || studioOptionsTool.tool === "compress_image" ? "upload.compression.compress" : studioOptionsTool.tool === "pdf_to_image" ? "upload.pdfToImage.convert" : studioOptionsTool.tool === "pdf_to_word" || studioOptionsTool.tool === "pdf_to_excel" || studioOptionsTool.tool === "pdf_to_powerpoint" ? "upload.start" : studioOptionsTool.tool === "split_pdf" ? "upload.split.split" : studioOptionsTool.tool === "rotate_pdf" ? "upload.rotate.rotate" : studioOptionsTool.tool === "delete_pdf_pages" ? "upload.delete.submit" : "upload.extract.submit")}</span>
            </button>
          </form>
        </div>
      ) : null}

      {studioPasswordTool ? (
        <StudioPasswordOptionsDialog
          errorLabels={uploadErrorLabels}
          fileName={document.name}
          item={studioPasswordTool}
          labels={passwordLabelsForTool(studioPasswordTool.tool)}
          onClose={() => setStudioPasswordTool(null)}
          onCompletedJob={(jobId) => openCompletedJobResult(jobId, "document-version")}
          sourcePayload={jobSourcePayloadFor(document, displayedPdfSource)}
          toolName={catalog(`tools.${studioPasswordTool.labelKey}`)}
        />
      ) : null}

      {isDeleteDialogOpen ? (
        <div className="studio-editor-modal-backdrop" role="presentation">
          <section
            aria-labelledby="studio-delete-dialog-title"
            aria-modal="true"
            className="studio-delete-dialog"
            role="dialog"
          >
            <button
              aria-label={copy.workspace.deleteDialog.cancel}
              className="studio-editor-modal-close"
              disabled={isDeletingDocument}
              title={copy.workspace.deleteDialog.cancel}
              type="button"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteDocumentError("");
              }}
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
            <i className="ti ti-trash" aria-hidden="true" />
            <h2 id="studio-delete-dialog-title">{copy.workspace.deleteDialog.title}</h2>
            <p>{copy.workspace.deleteDialog.text}</p>
            <strong title={document.name}>{document.name}</strong>
            <small>{copy.workspace.deleteDialog.warning}</small>
            {deleteDocumentError ? <p className="studio-guest-error">{deleteDocumentError}</p> : null}
            <div className="studio-delete-dialog-actions">
              <button
                disabled={isDeletingDocument}
                type="button"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeleteDocumentError("");
                }}
              >
                {copy.workspace.deleteDialog.cancel}
              </button>
              <button disabled={isDeletingDocument} type="button" onClick={() => void deleteCurrentDocument()}>
                <i className={`ti ${isDeletingDocument ? "ti-loader-2" : "ti-trash"}`} aria-hidden="true" />
                <span>{isDeletingDocument ? copy.workspace.deleteDialog.deleting : copy.workspace.deleteDialog.confirm}</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activityDialogOpen ? <div className="studio-editor-modal-backdrop" role="presentation" onClick={(event) => {
        if (event.target === event.currentTarget) setActivityDialogOpen(false);
      }}>
        <section className="studio-editor-modal studio-activity-modal" role="dialog" aria-modal="true" aria-label={activityLabels.title}
          onKeyDown={(event) => handleStudioDialogKeyDown(event, () => setActivityDialogOpen(false), false)}>
          <button autoFocus className="studio-editor-modal-close" type="button" aria-label={activityLabels.close} onClick={() => setActivityDialogOpen(false)}><i className="ti ti-x" aria-hidden="true" /></button>
          <StudioActivity documentId={document.id} locale={locale} />
        </section>
      </div> : null}

      {approvalDialogOpen && !document.isGuest && account.user ? <div className="studio-editor-modal-backdrop" role="presentation" onClick={event => {
        if (event.target === event.currentTarget && !approvalSending) setApprovalDialogOpen(false);
      }}>
        <section className="studio-editor-modal studio-approval-modal" role="dialog" aria-modal="true" aria-label={approvalLabels.request}
          onKeyDown={event => handleStudioDialogKeyDown(event, () => setApprovalDialogOpen(false), approvalSending)}>
          <button autoFocus className="studio-editor-modal-close" type="button" aria-label={approvalLabels.close} disabled={approvalSending} onClick={() => setApprovalDialogOpen(false)}><i className="ti ti-x" aria-hidden="true" /></button>
          <StudioApprovalRequest key={`${account.user.id}:${document.id}`} locale={locale} documentId={document.id} initialVersionId={selectedVersionId} onBusyChange={setApprovalSending} />
        </section>
      </div> : null}

      {dateDialogOpen ? (
        <div className="studio-editor-modal-backdrop" role="presentation" onClick={(event) => {
          if (event.target === event.currentTarget) setDateDialogOpen(false);
        }}>
          <section className="studio-editor-modal studio-date-modal" role="dialog" aria-modal="true" aria-labelledby="studio-date-title"
            onKeyDown={(event) => handleStudioDialogKeyDown(event, () => setDateDialogOpen(false), false)}>
            <button className="studio-editor-modal-close" type="button" aria-label={dateCopy.close} onClick={() => setDateDialogOpen(false)}><i className="ti ti-x" aria-hidden="true" /></button>
            <form className="studio-signature-form" onSubmit={(event) => {
              event.preventDefault();
              if (!formattedDate || !canEditDisplayedPdf) return;
              setPendingDateText(formattedDate);
              setActiveMode("text");
              setSelectedAnnotationId(null);
              setDateDialogOpen(false);
            }}>
              <h2 id="studio-date-title">{dateCopy.title}</h2>
              <label>{dateCopy.date}<input autoFocus required type="date" value={dateValue} onChange={(event) => setDateValue(event.currentTarget.value)} /></label>
              <label>{dateCopy.format}<select className="split-input" value={dateFormat} onChange={(event) => setDateFormat(event.currentTarget.value as DateAnnotationFormat)}>
                {dateFormats.map((format) => <option key={format} value={format}>{formatAnnotationDate(dateValue || localToday(), format, locale) || formatAnnotationDate(localToday(), format, locale)}</option>)}
              </select></label>
              <output className="studio-date-preview" aria-label={dateCopy.preview}>{formattedDate || "\u2014"}</output>
              <div className="studio-signature-actions">
                <button type="button" onClick={() => setDateDialogOpen(false)}>{dateCopy.cancel}</button>
                <button type="submit" disabled={!formattedDate || !canEditDisplayedPdf}><i className="ti ti-calendar" aria-hidden="true" />{dateCopy.place}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {signDialog !== "none" ? (
        <div className="studio-editor-modal-backdrop" role="presentation">
          <section
            className="studio-editor-modal studio-signature-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-sign-modal-title"
          >
            <button
              className="studio-editor-modal-close"
              type="button"
              aria-label={copy.workspace.signModal.close}
              onClick={() => setSignDialog("none")}
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>

            <form
              className="studio-signature-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!hasSignatureDraft) return;
                setSignDialog("none");
                setActiveMode("signature");
              }}
            >
              <div>
                <h2 id="studio-sign-modal-title">{copy.workspace.signModal.title}</h2>
                <p>{copy.workspace.signModal.description}</p>
              </div>
              <div className="studio-signature-tabs" role="tablist" aria-label={copy.workspace.signModal.modes}>
                {(["draw", "type", "upload"] as const).map((mode) => <button aria-selected={signatureMode === mode} className={signatureMode === mode ? "is-selected" : ""} key={mode} role="tab" type="button" onClick={() => {
                  setSignatureMode(mode);
                  if (mode !== "draw") setSignatureStrokes([]);
                  if (mode !== "type") setSignatureText("");
                  if (mode !== "upload") setSignatureImage(null);
                }}><i className={`ti ${mode === "draw" ? "ti-pencil" : mode === "type" ? "ti-typography" : "ti-upload"}`} aria-hidden="true" />{copy.workspace.signModal[mode]}</button>)}
              </div>
              <div className="studio-signature-options">
                <div>
                  <span>{copy.workspace.signModal.styleLabel}</span>
                  <div className="studio-signature-style-options" role="group" aria-label={copy.workspace.signModal.styleLabel}>
                    {(["script", "elegant", "plain"] as const).map((style) => <button className={signatureStyle === style ? "is-selected" : ""} key={style} type="button" onClick={() => setSignatureStyle(style)}>{copy.workspace.signModal[`style${style[0].toUpperCase()}${style.slice(1)}` as "styleScript" | "styleElegant" | "stylePlain"]}</button>)}
                  </div>
                </div>
                <div>
                  <span>{copy.workspace.signModal.colorLabel}</span>
                  <div className="studio-signature-color-options" role="group" aria-label={copy.workspace.signModal.colorLabel}>
                    {["#141412", "#1d4ed8", "#047857"].map((color) => <button aria-label={color} className={signatureColor === color ? "is-selected" : ""} key={color} style={{"--signature-color": color} as CSSProperties} type="button" onClick={() => setSignatureColor(color)} />)}
                  </div>
                </div>
              </div>
              <div className="studio-signature-workspace">
              {signatureMode === "type" ? <>
                <label>
                  <span>{copy.workspace.signModal.nameLabel}</span>
                  <input autoFocus maxLength={100} placeholder={copy.workspace.signModal.namePlaceholder} value={signatureText} onChange={(event) => setSignatureText(event.currentTarget.value)} />
                </label>
                <div className={`studio-signature-preview is-${signatureStyle}`} aria-label={copy.workspace.signModal.previewLabel} style={{color: signatureColor}}><span>{signatureText.trim() || copy.workspace.signModal.previewPlaceholder}</span></div>
              </> : null}
              {signatureMode === "draw" ? <>
              <StudioSignaturePad strokes={signatureStrokes} color={signatureColor} onSizeChange={(size) => { signaturePadSizeRef.current = size; }} onChange={(strokes) => {
                setSignatureStrokes(strokes);
                setSignatureUndoneStrokes([]);
              }} />
              <div className="studio-signature-drawing-actions">
                <button aria-label="Annuler le dernier trait" disabled={signatureStrokes.length === 0} type="button" onClick={() => setSignatureStrokes((current) => {
                  const stroke = current.at(-1);
                  if (stroke) setSignatureUndoneStrokes((undone) => [...undone, stroke]);
                  return current.slice(0, -1);
                })}><i className="ti ti-arrow-back-up" aria-hidden="true" /></button>
                <button aria-label="Rétablir le dernier trait" disabled={signatureUndoneStrokes.length === 0} type="button" onClick={() => setSignatureUndoneStrokes((undone) => {
                  const stroke = undone.at(-1);
                  if (stroke) setSignatureStrokes((current) => [...current, stroke]);
                  return undone.slice(0, -1);
                })}><i className="ti ti-arrow-forward-up" aria-hidden="true" /></button>
                <button className="studio-signature-clear" type="button" onClick={() => { setSignatureStrokes([]); setSignatureUndoneStrokes([]); }} disabled={signatureStrokes.length === 0}>{copy.workspace.signModal.clearDrawing}</button>
              </div>
              </> : null}
              {signatureMode === "upload" ? <div className="studio-signature-upload">
                <label><i className="ti ti-upload" aria-hidden="true" /><span>Choisir une image PNG ou JPEG</span><input accept="image/png,image/jpeg" type="file" onChange={(event) => void loadSignatureImage(event.currentTarget.files?.[0])} /></label>
                {signatureImage ? <img alt="Aperçu de la signature importée" src={signatureImage} /> : null}
                {signatureImageError ? <p className="studio-guest-error">{signatureImageError}</p> : null}
              </div> : null}
              </div>
              <p className="studio-signature-note">{copy.workspace.signModal.note}</p>
              <div className="studio-signature-actions">
                <button type="button" onClick={() => setSignDialog("none")}>{copy.workspace.signModal.cancel}</button>
                <button type="submit" disabled={!hasSignatureDraft}>
                  <i className="ti ti-signature" aria-hidden="true" />
                  <span>{copy.workspace.signModal.place}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
