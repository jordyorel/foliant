"use client";

import {useEffect, useMemo, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";

type SplitMode = "every_page" | "interval" | "range";

export type SplitFlowLabels = {
  close: string;
  title: string;
  uploading: string;
  splitting: string;
  done: string;
  successSubtitle: string;
  fileName: string;
  currentSize: string;
  selectMethod: string;
  everyPage: string;
  everyPageText: string;
  interval: string;
  intervalText: string;
  range: string;
  rangeText: string;
  intervalLabel: string;
  rangeLabel: string;
  rangePlaceholder: string;
  split: string;
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

type SplitFlowModalProps = {
  file: File;
  tool: ToolAction;
  labels: SplitFlowLabels;
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "splitting" | "completed" | "failed";

type UploadState = {
  fileId: string;
  uploadUrl: string;
};

type JobResponse = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  step: string;
  resultUrl?: string;
  error?: string;
  errorCode?: string;
};

function formatSize(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return `${mb < 1 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
}

function uploadFile(uploadUrl: string, file: File, labels: ErrorLabels, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      let code = "";
      let serverMessage = "";
      try {
        const body = JSON.parse(request.responseText);
        code = typeof body.code === "string" ? body.code : "";
        serverMessage = typeof body.error === "string" ? body.error : "";
      } catch {
        // Ignore non-JSON error bodies.
      }

      reject(new Error((messageFromCode(code, labels) ?? serverMessage) || labels.error));
    };

    request.onerror = () => reject(new Error(labels.error));
    request.open("PUT", uploadUrl);
    request.send(file);
  });
}

export function SplitFlowModal({file, tool, labels, onClose}: SplitFlowModalProps) {
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [mode, setMode] = useState<SplitMode>("every_page");
  const [interval, setInterval] = useState(1);
  const [pageRange, setPageRange] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const errorLabels: ErrorLabels = {
    error: labels.error,
    errorTooLarge: labels.errorTooLarge,
    errorUnsupportedType: labels.errorUnsupportedType,
    errorInvalidFile: labels.errorInvalidFile
  };
  const canSplit = Boolean(upload) && (mode !== "range" || pageRange.trim().length > 0);
  const progress = flowState === "uploading" ? uploadProgress : jobProgress;

  const splitOptions = useMemo(() => [
    {
      id: "every_page" as const,
      title: labels.everyPage,
      text: labels.everyPageText
    },
    {
      id: "interval" as const,
      title: labels.interval,
      text: labels.intervalText
    },
    {
      id: "range" as const,
      title: labels.range,
      text: labels.rangeText
    }
  ], [
    labels.everyPage,
    labels.everyPageText,
    labels.interval,
    labels.intervalText,
    labels.range,
    labels.rangeText
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
        await uploadFile(nextUpload.uploadUrl, file, errorLabels, (nextProgress) => {
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

  async function startSplit() {
    if (!upload || !canSplit) return;

    try {
      setError("");
      setFlowState("splitting");
      setJobProgress(8);

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: [upload.fileId],
          options: {
            splitMode: mode,
            splitInterval: interval,
            pageRange
          }
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, errorLabels));

      const createdJob = await jobResponse.json() as JobResponse;
      setJobProgress(createdJob.progress);
      await pollJob(createdJob.id);
    } catch (splitError) {
      setError(splitError instanceof Error ? splitError.message : labels.error);
      setFlowState("failed");
    }
  }

  return (
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="split-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="split-flow-title">{labels.uploading}</h2>
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
            <h2 id="split-flow-title">{labels.title}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <p className="choice-label">{labels.selectMethod}</p>
            <div className="split-choices">
              {splitOptions.map((option) => (
                <button
                  className={`compression-choice split-choice${mode === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  type="button"
                  aria-pressed={mode === option.id}
                  onClick={() => setMode(option.id)}
                >
                  <span className="radio-dot" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.text}</small>
                  </span>
                </button>
              ))}
            </div>
            {mode === "interval" ? (
              <label className="split-field">
                <span>{labels.intervalLabel}</span>
                <input
                  className="split-input"
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={interval}
                  onChange={(event) => setInterval(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                />
              </label>
            ) : null}
            {mode === "range" ? (
              <label className="split-field">
                <span>{labels.rangeLabel}</span>
                <input
                  className="split-input"
                  type="text"
                  value={pageRange}
                  placeholder={labels.rangePlaceholder}
                  onChange={(event) => setPageRange(event.target.value)}
                />
              </label>
            ) : null}
            <button className="modal-primary" type="button" onClick={startSplit} disabled={!canSplit}>
              {labels.split}
            </button>
          </div>
        ) : null}

        {flowState === "splitting" ? (
          <div className="flow-panel compact">
            <h2 id="split-flow-title">{labels.splitting}</h2>
            <div className="large-progress" aria-label={labels.splitting}>
              <span style={{width: `${progress}%`}} />
            </div>
            <p className="progress-percent">{progress}%</p>
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="split-flow-title">{labels.done}</h2>
            <p className="modal-subtitle">{labels.successSubtitle}</p>
            <div className="email-capture">
              <label htmlFor="split-result-email">{labels.emailTitle}</label>
              <input id="split-result-email" type="email" placeholder={labels.emailPlaceholder} />
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
            <h2 id="split-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
