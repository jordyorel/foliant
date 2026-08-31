"use client";

import {useEffect, useMemo, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";
import {formatSize, uploadFileWithProgress, type JobResponse} from "./upload";

type PdfFormat = "jpg" | "png";

export type PdfToImageFlowLabels = {
  close: string;
  uploading: string;
  readyTitle: string;
  selectFormat: string;
  jpg: string;
  jpgText: string;
  png: string;
  pngText: string;
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
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [format, setFormat] = useState<PdfFormat>(defaultFormat);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const errorLabels: ErrorLabels = {
    error: labels.error,
    errorTooLarge: labels.errorTooLarge,
    errorUnsupportedType: labels.errorUnsupportedType,
    errorInvalidFile: labels.errorInvalidFile
  };

  const canConvert = Boolean(upload);
  const progress = flowState === "uploading" ? uploadProgress : jobProgress;

  const formatOptions = useMemo(() => [
    {id: "jpg" as const, title: labels.jpg, text: labels.jpgText},
    {id: "png" as const, title: labels.png, text: labels.pngText}
  ], [labels.jpg, labels.jpgText, labels.png, labels.pngText]);

  useEffect(() => {
    let cancelled = false;

    async function startUpload() {
      try {
        setFlowState("uploading");
        setUploadProgress(4);

        const initResponse = await fetch("/api/upload/init", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            tool,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/pdf"
          })
        });

        if (!initResponse.ok) throw new Error(await messageFromResponse(initResponse, errorLabels));

        const nextUpload = await initResponse.json() as UploadState;
        if (cancelled) return;

        setUpload(nextUpload);
        await uploadFileWithProgress(nextUpload.uploadUrl, file, errorLabels, (nextProgress) => {
          if (!cancelled) setUploadProgress(nextProgress);
        });

        if (cancelled) return;

        window.setTimeout(() => {
          if (!cancelled) setFlowState("ready");
        }, 260);
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
  }, [file, labels.error, tool]);

  async function pollJob(jobId: string) {
    const response = await fetch(`/api/jobs/${jobId}`);
    if (!response.ok) throw new Error(labels.error);

    const nextJob = await response.json() as JobResponse;
    setJobProgress(nextJob.progress);

    if (nextJob.status === "completed") {
      setDownloadUrl(nextJob.resultUrl ?? `/api/jobs/${jobId}/download`);
      setFlowState("completed");
      return;
    }

    if (nextJob.status === "failed") {
      setError((messageFromCode(nextJob.errorCode, errorLabels) ?? nextJob.error) || labels.error);
      setFlowState("failed");
      return;
    }

    window.setTimeout(() => {
      void pollJob(jobId).catch(() => {
        setError(labels.error);
        setFlowState("failed");
      });
    }, 700);
  }

  async function startConvert() {
    if (!upload || !canConvert) return;

    try {
      setError("");
      setFlowState("converting");
      setJobProgress(8);

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: [upload.fileId],
          options: {pdfToImageFormat: format}
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, errorLabels));

      const createdJob = await jobResponse.json() as JobResponse;
      setJobProgress(createdJob.progress);
      await pollJob(createdJob.id);
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : labels.error);
      setFlowState("failed");
    }
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
            <button className="modal-primary" type="button" onClick={startConvert} disabled={!canConvert}>
              {labels.convert}
            </button>
          </div>
        ) : null}

        {flowState === "converting" ? (
          <div className="flow-panel compact">
            <h2 id="pdf-image-flow-title">{labels.converting}</h2>
            <div className="large-progress" aria-label={labels.converting}>
              <span style={{width: `${progress}%`}} />
            </div>
            <p className="progress-percent">{progress}%</p>
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
            <button className="modal-primary" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
