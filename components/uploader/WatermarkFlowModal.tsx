"use client";

import {useEffect, useMemo, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import type {WatermarkPosition} from "@/processors/pdf/watermark";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";
import {formatSize, uploadFileWithProgress, type JobResponse} from "./upload";

export type WatermarkFlowLabels = {
  add: string;
  close: string;
  title: string;
  uploading: string;
  processing: string;
  done: string;
  successSubtitle: string;
  fileName: string;
  currentSize: string;
  textLabel: string;
  textPlaceholder: string;
  selectPosition: string;
  center: string;
  centerText: string;
  diagonal: string;
  diagonalText: string;
  repeated: string;
  repeatedText: string;
  opacityLabel: string;
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

type WatermarkFlowModalProps = {
  file: File;
  tool: ToolAction;
  labels: WatermarkFlowLabels;
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "processing" | "completed" | "failed";

type UploadState = {
  fileId: string;
  uploadUrl: string;
};

export function WatermarkFlowModal({file, tool, labels, onClose}: WatermarkFlowModalProps) {
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [text, setText] = useState("");
  const [position, setPosition] = useState<WatermarkPosition>("center");
  const [opacity, setOpacity] = useState(0.2);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const errorLabels: ErrorLabels = {
    error: labels.error,
    errorTooLarge: labels.errorTooLarge,
    errorUnsupportedType: labels.errorUnsupportedType,
    errorInvalidFile: labels.errorInvalidFile
  };
  const canSubmit = Boolean(upload) && text.trim().length > 0;
  const progress = flowState === "uploading" ? uploadProgress : jobProgress;

  const positions = useMemo(() => [
    {id: "center" as const, title: labels.center, text: labels.centerText},
    {id: "diagonal" as const, title: labels.diagonal, text: labels.diagonalText},
    {id: "repeated" as const, title: labels.repeated, text: labels.repeatedText}
  ], [
    labels.center,
    labels.centerText,
    labels.diagonal,
    labels.diagonalText,
    labels.repeated,
    labels.repeatedText
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

  async function startWatermark() {
    if (!upload || !canSubmit) return;

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
            watermarkText: text,
            watermarkPosition: position,
            watermarkOpacity: opacity
          }
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, errorLabels));

      const createdJob = await jobResponse.json() as JobResponse;
      setJobProgress(createdJob.progress);
      await pollJob(createdJob.id);
    } catch (watermarkError) {
      setError(watermarkError instanceof Error ? watermarkError.message : labels.error);
      setFlowState("failed");
    }
  }

  return (
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="watermark-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="watermark-flow-title">{labels.uploading}</h2>
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
            <h2 id="watermark-flow-title">{labels.title}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <label className="split-field">
              <span>{labels.textLabel}</span>
              <input
                className="split-input"
                type="text"
                value={text}
                placeholder={labels.textPlaceholder}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
            <p className="choice-label">{labels.selectPosition}</p>
            <div className="split-choices">
              {positions.map((option) => (
                <button
                  className={`compression-choice split-choice${position === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  type="button"
                  aria-pressed={position === option.id}
                  onClick={() => setPosition(option.id)}
                >
                  <span className="radio-dot" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.text}</small>
                  </span>
                </button>
              ))}
            </div>
            <label className="split-field">
              <span>{labels.opacityLabel}</span>
              <input
                className="split-input"
                type="number"
                min={0.05}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(event) => setOpacity(Math.min(1, Math.max(0.05, Number(event.target.value) || 0.2)))}
              />
            </label>
            <button className="modal-primary" type="button" onClick={startWatermark} disabled={!canSubmit}>
              {labels.submit}
            </button>
          </div>
        ) : null}

        {flowState === "processing" ? (
          <div className="flow-panel compact">
            <h2 id="watermark-flow-title">{labels.processing}</h2>
            <div className="large-progress" aria-label={labels.processing}>
              <span style={{width: `${progress}%`}} />
            </div>
            <p className="progress-percent">{progress}%</p>
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="watermark-flow-title">{labels.done}</h2>
            <p className="modal-subtitle">{labels.successSubtitle}</p>
            <div className="email-capture">
              <label htmlFor="watermark-result-email">{labels.emailTitle}</label>
              <input id="watermark-result-email" type="email" placeholder={labels.emailPlaceholder} />
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
            <h2 id="watermark-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
