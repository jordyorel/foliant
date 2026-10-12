"use client";
import {useTransferLifecycle} from "./useTransferLifecycle";
import {pollJobUntilSettled} from "@/lib/jobs/client-poll";
import {ProcessingStatus} from "./ProcessingStatus";

import {useEffect, useMemo, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";
import {redirectToGuestStudio} from "./guestStudio";
import {formatSize, uploadFileWithProgress, type JobResponse} from "./upload";

type PdfFormat = "jpg" | "png";

export type PdfToImageFlowLabels = {
  close: string;
  uploading: string;
  readyTitle: string;
  selectFormat: string;
  selectResolution: string;
  jpg: string;
  jpgText: string;
  png: string;
  pngText: string;
  web: string;
  webText: string;
  standard: string;
  standardText: string;
  highDefinition: string;
  highDefinitionText: string;
  convert: string;
  converting: string;
  done: string;
  successSubtitle: string;
  fileName: string;
  currentSize: string;
  download: string;
  emailTitle: string;
  emailPlaceholder: string;
  terms: string;
  continue: string;
  loginText: string;
  login: string;
  another: string;
  error: string;
  errorTooLarge: string;
  errorUnsupportedType: string;
  errorInvalidFile: string;
};

type PdfToImageFlowModalProps = {
  file: File;
  tool: ToolAction;
  defaultFormat?: PdfFormat;
  labels: PdfToImageFlowLabels;
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "converting" | "completed" | "failed";

type UploadState = {
  fileId: string;
  uploadUrl: string;
};

export function PdfToImageFlowModal({file, tool, defaultFormat = "jpg", labels, onClose}: PdfToImageFlowModalProps) {
  const {getSignal, runSubmission, retryCount, retry, retryLabel, errorExpired} = useTransferLifecycle(file, tool);
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [format, setFormat] = useState<PdfFormat>(defaultFormat);
  const [dpi, setDpi] = useState<72 | 150 | 300>(150);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const errorLabels: ErrorLabels = {
    error: labels.error,
    errorTooLarge: labels.errorTooLarge,
    errorUnsupportedType: labels.errorUnsupportedType,
    errorInvalidFile: labels.errorInvalidFile
  };

  const canConvert = Boolean(upload);
  const progress = uploadProgress;

  const formatOptions = useMemo(() => [
    {id: "jpg" as const, title: labels.jpg, text: labels.jpgText},
    {id: "png" as const, title: labels.png, text: labels.pngText}
  ], [labels.jpg, labels.jpgText, labels.png, labels.pngText]);
  const resolutionOptions = useMemo(() => [
    {id: 72 as const, title: labels.web, text: labels.webText},
    {id: 150 as const, title: labels.standard, text: labels.standardText},
    {id: 300 as const, title: labels.highDefinition, text: labels.highDefinitionText}
  ], [labels.highDefinition, labels.highDefinitionText, labels.standard, labels.standardText, labels.web, labels.webText]);

  useEffect(() => {
    setError("");
    let cancelled = false;
    const signal = getSignal();

    async function startUpload() {
      try {
        setFlowState("uploading");
        setUploadProgress(0);

        const initResponse = await fetch("/api/upload/init", {
          signal,
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            tool,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf"
          })
        });

        if (!initResponse.ok) throw new Error(await messageFromResponse(initResponse, {...errorLabels, errorExpired}));

        const nextUpload = await initResponse.json() as UploadState;
        if (cancelled) return;

        setUpload(nextUpload);
        await uploadFileWithProgress(nextUpload.uploadUrl, file, errorLabels, (nextProgress) => {
          if (!cancelled) setUploadProgress(nextProgress);
        }, signal);

        if (cancelled) return;

        if (!cancelled) setFlowState("ready");
      } catch (uploadError) {
        if (cancelled) return;
        setError(uploadError instanceof Error ? uploadError.message : labels.error);
        setFlowState("failed");
      }
    }

    void startUpload();

    return () => {
      cancelled = true;
    };
  }, [file, labels.error, tool, retryCount]);

  async function pollJob(jobId: string) {
    const signal = getSignal();
    const nextJob = await pollJobUntilSettled<JobResponse>(jobId, labels.error, signal);
    if (signal.aborted) return;

    if (nextJob.status === "completed") {
      setDownloadUrl(nextJob.resultUrl ?? `/api/jobs/${jobId}/download`);
      redirectToGuestStudio(jobId);
      return;
    }

    if (nextJob.status === "failed") {
      setError((messageFromCode(nextJob.errorCode, errorLabels) ?? nextJob.error) || labels.error);
      setFlowState("failed");
      return;
    }

  }

  async function startConvert() {
    return runSubmission(async () => {
      const signal = getSignal();
    if (!upload || !canConvert) return;

    try {
      setError("");
      setFlowState("converting");

      const jobResponse = await fetch("/api/jobs", {
        signal,
          method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: [upload.fileId],
          options: {pdfToImageDpi: dpi, pdfToImageFormat: format}
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, {...errorLabels, errorExpired}));

      const createdJob = await jobResponse.json() as JobResponse;
      await pollJob(createdJob.id);
    } catch (convertError) {
      if (signal.aborted) return;
      setError(convertError instanceof Error ? convertError.message : labels.error);
      setFlowState("failed");
    }
    });
  }

  return (
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="pdf-image-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="pdf-image-flow-title">{labels.uploading}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <div className="large-progress" aria-label={labels.uploading}>
              <span style={{width: `${progress}%`}} />
            </div>
            <p className="progress-percent">{progress}%</p>
          </div>
        ) : null}

        {flowState === "ready" ? (
          <div className="flow-panel">
            <h2 id="pdf-image-flow-title">{labels.readyTitle}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <p className="choice-label">{labels.selectFormat}</p>
            <div className="compression-choices">
              {formatOptions.map((option) => (
                <button
                  className={`compression-choice${format === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  type="button"
                  aria-pressed={format === option.id}
                  onClick={() => setFormat(option.id)}
                >
                  <span className="radio-dot" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.text}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="choice-label">{labels.selectResolution}</p>
            <div className="compression-choices">
              {resolutionOptions.map((option) => (
                <button
                  className={`compression-choice${dpi === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  type="button"
                  aria-pressed={dpi === option.id}
                  onClick={() => setDpi(option.id)}
                >
                  <span className="radio-dot" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.text}</small>
                  </span>
                </button>
              ))}
            </div>
            <button className="modal-primary" type="button" onClick={startConvert} disabled={!canConvert}>
              {labels.convert}
            </button>
          </div>
        ) : null}

        {flowState === "converting" ? (
          <div className="flow-panel compact">
            <h2 id="pdf-image-flow-title">{labels.converting}</h2>
            <ProcessingStatus label={labels.converting} />
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="pdf-image-flow-title">{labels.done}</h2>
            <p className="modal-subtitle">{labels.successSubtitle}</p>
            <div className="email-capture">
              <label htmlFor="pdf-image-result-email">{labels.emailTitle}</label>
              <input id="pdf-image-result-email" type="email" placeholder={labels.emailPlaceholder} />
              <label className="terms-row">
                <input type="checkbox" />
                <span>{labels.terms}</span>
              </label>
              <button className="modal-secondary" type="button">{labels.continue}</button>
              <p>{labels.loginText} <a href="#">{labels.login}</a></p>
            </div>
            {downloadUrl ? (
              <a className="modal-primary" href={downloadUrl}>{labels.download}</a>
            ) : null}
            <button className="text-button" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}

        {flowState === "failed" ? (
          <div className="flow-panel compact">
            <h2 id="pdf-image-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={retry}><i className="ti ti-refresh" aria-hidden="true" />{retryLabel}</button>
            <button className="text-button" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
