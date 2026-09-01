"use client";

import {useEffect, useMemo, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import type {PageNumberPosition} from "@/processors/pdf/number";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";
import {formatSize, uploadFileWithProgress, type JobResponse} from "./upload";

export type NumberPagesFlowLabels = {
  add: string;
  close: string;
  title: string;
  uploading: string;
  processing: string;
  done: string;
  successSubtitle: string;
  fileName: string;
  currentSize: string;
  selectPosition: string;
  bottomLeft: string;
  bottomCenter: string;
  bottomRight: string;
  topLeft: string;
  topCenter: string;
  topRight: string;
  startPageLabel: string;
  startNumberLabel: string;
  submit: string;
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

type NumberPagesFlowModalProps = {
  file: File;
  tool: ToolAction;
  labels: NumberPagesFlowLabels;
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "processing" | "completed" | "failed";

type UploadState = {
  fileId: string;
  uploadUrl: string;
};

export function NumberPagesFlowModal({file, tool, labels, onClose}: NumberPagesFlowModalProps) {
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [position, setPosition] = useState<PageNumberPosition>("bottom_center");
  const [startPage, setStartPage] = useState(1);
  const [startNumber, setStartNumber] = useState(1);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const errorLabels: ErrorLabels = {
    error: labels.error,
    errorTooLarge: labels.errorTooLarge,
    errorUnsupportedType: labels.errorUnsupportedType,
    errorInvalidFile: labels.errorInvalidFile
  };
  const progress = flowState === "uploading" ? uploadProgress : jobProgress;

  const positions = useMemo(() => [
    {id: "bottom_left" as const, label: labels.bottomLeft},
    {id: "bottom_center" as const, label: labels.bottomCenter},
    {id: "bottom_right" as const, label: labels.bottomRight},
    {id: "top_left" as const, label: labels.topLeft},
    {id: "top_center" as const, label: labels.topCenter},
    {id: "top_right" as const, label: labels.topRight}
  ], [
    labels.bottomLeft,
    labels.bottomCenter,
    labels.bottomRight,
    labels.topLeft,
    labels.topCenter,
    labels.topRight
  ]);

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

  async function startNumbering() {
    if (!upload) return;

    try {
      setError("");
      setFlowState("processing");
      setJobProgress(8);

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: [upload.fileId],
          options: {
            pageNumberPosition: position,
            pageNumberStartPage: startPage,
            pageNumberStartNumber: startNumber
          }
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, errorLabels));

      const createdJob = await jobResponse.json() as JobResponse;
      setJobProgress(createdJob.progress);
      await pollJob(createdJob.id);
    } catch (numberingError) {
      setError(numberingError instanceof Error ? numberingError.message : labels.error);
      setFlowState("failed");
    }
  }

  return (
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="number-pages-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="number-pages-flow-title">{labels.uploading}</h2>
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
            <h2 id="number-pages-flow-title">{labels.title}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <p className="choice-label">{labels.selectPosition}</p>
            <div className="position-choices">
              {positions.map((option) => (
                <button
                  className={`position-choice${position === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  type="button"
                  aria-pressed={position === option.id}
                  onClick={() => setPosition(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="number-fields">
              <label className="split-field">
                <span>{labels.startPageLabel}</span>
                <input
                  className="split-input"
                  type="number"
                  min={1}
                  step={1}
                  value={startPage}
                  onChange={(event) => setStartPage(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                />
              </label>
              <label className="split-field">
                <span>{labels.startNumberLabel}</span>
                <input
                  className="split-input"
                  type="number"
                  min={0}
                  step={1}
                  value={startNumber}
                  onChange={(event) => setStartNumber(Math.max(0, Math.floor(Number(event.target.value) || 1)))}
                />
              </label>
            </div>
            <button className="modal-primary" type="button" onClick={startNumbering} disabled={!upload}>
              {labels.submit}
            </button>
          </div>
        ) : null}

        {flowState === "processing" ? (
          <div className="flow-panel compact">
            <h2 id="number-pages-flow-title">{labels.processing}</h2>
            <div className="large-progress" aria-label={labels.processing}>
              <span style={{width: `${progress}%`}} />
            </div>
            <p className="progress-percent">{progress}%</p>
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="number-pages-flow-title">{labels.done}</h2>
            <p className="modal-subtitle">{labels.successSubtitle}</p>
            <div className="email-capture">
              <label htmlFor="number-pages-result-email">{labels.emailTitle}</label>
              <input id="number-pages-result-email" type="email" placeholder={labels.emailPlaceholder} />
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
            <h2 id="number-pages-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
