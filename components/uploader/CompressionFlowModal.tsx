"use client";

import {useEffect, useMemo, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";
import {formatSize, uploadFileWithProgress as uploadFile} from "./upload";

type CompressionLevel = "best_size" | "best_quality";

type CompressionFlowModalProps = {
  file: File;
  tool: ToolAction;
  labels: {
    close: string;
    uploadingTitle: string;
    preparing: string;
    fileName: string;
    currentSize: string;
    selectLevel: string;
    bestSize: string;
    bestSizeText: string;
    bestQuality: string;
    bestQualityText: string;
    compress: string;
    compressingTitle: string;
    completedTitle: string;
    completedText: string;
    alreadyOptimizedText: string;
    emailTitle: string;
    emailPlaceholder: string;
    terms: string;
    continue: string;
    loginText: string;
    login: string;
    download: string;
    another: string;
    error: string;
    errorTooLarge: string;
    errorUnsupportedType: string;
    errorInvalidFile: string;
    alreadyOptimizedBadge: string;
    original: string;
    final: string;
    saved: string;
  };
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "compressing" | "completed" | "failed";

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
  result?: {
    originalSize: number;
    outputSize: number;
    savedBytes: number;
    savedPercent: number;
    alreadyOptimized?: boolean;
  };
  error?: string;
  errorCode?: string;
};

export function CompressionFlowModal({file, tool, labels, onClose}: CompressionFlowModalProps) {
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [level, setLevel] = useState<CompressionLevel>("best_size");
  const [job, setJob] = useState<JobResponse | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const progress = flowState === "uploading" ? uploadProgress : jobProgress;
  const canCompress = flowState === "ready" && upload;

  const compressionOptions = useMemo(() => [
    {
      id: "best_size" as const,
      title: labels.bestSize,
      text: labels.bestSizeText
    },
    {
      id: "best_quality" as const,
      title: labels.bestQuality,
      text: labels.bestQualityText
    }
  ], [labels.bestQuality, labels.bestQualityText, labels.bestSize, labels.bestSizeText]);

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

        if (!initResponse.ok) throw new Error(await messageFromResponse(initResponse, labels));

        const nextUpload = await initResponse.json() as UploadState;
        if (cancelled) return;

        setUpload(nextUpload);
        await uploadFile(nextUpload.uploadUrl, file, labels, (nextProgress) => {
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
    setJob(nextJob);
    setJobProgress(nextJob.progress);

    if (nextJob.status === "completed") {
      setDownloadUrl(nextJob.resultUrl ?? `/api/jobs/${jobId}/download`);
      setFlowState("completed");
      return;
    }

    if (nextJob.status === "failed") {
      setError((messageFromCode(nextJob.errorCode, labels) ?? nextJob.error) || labels.error);
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

  async function startCompression() {
    if (!canCompress) return;

    try {
      setError("");
      setFlowState("compressing");
      setJobProgress(8);

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: [upload.fileId],
          options: {compressionLevel: level}
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, labels));

      const createdJob = await jobResponse.json() as JobResponse;
      setJob(createdJob);
      setJobProgress(createdJob.progress);
      await pollJob(createdJob.id);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : labels.error);
      setFlowState("failed");
    }
  }

  return (
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="compression-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="compression-flow-title">{labels.uploadingTitle}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <div className="large-progress" aria-label={labels.uploadingTitle}>
              <span style={{width: `${progress}%`}} />
            </div>
            <p className="progress-percent">{progress}%</p>
          </div>
        ) : null}

        {flowState === "ready" ? (
          <div className="flow-panel">
            <h2 id="compression-flow-title">{labels.preparing}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <p className="choice-label">{labels.selectLevel}</p>
            <div className="compression-choices">
              {compressionOptions.map((option) => (
                <button
                  className={`compression-choice${level === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  type="button"
                  onClick={() => setLevel(option.id)}
                >
                  <span className="radio-dot" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.text}</small>
                  </span>
                </button>
              ))}
            </div>
            <button className="modal-primary" type="button" onClick={startCompression}>
              {labels.compress}
            </button>
          </div>
        ) : null}

        {flowState === "compressing" ? (
          <div className="flow-panel compact">
            <h2 id="compression-flow-title">{labels.compressingTitle}</h2>
            <div className="large-progress" aria-label={labels.compressingTitle}>
              <span style={{width: `${progress}%`}} />
            </div>
            <p className="progress-percent">{progress}%</p>
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="compression-flow-title">{labels.completedTitle}</h2>
            <p className="modal-subtitle">
              {job?.result?.alreadyOptimized ? labels.alreadyOptimizedText : labels.completedText}
            </p>
            {job?.result ? (
              <div className="result-stats modal-stats">
                <span><strong>{formatSize(job.result.originalSize)}</strong>{labels.original}</span>
                <span><strong>{formatSize(job.result.outputSize)}</strong>{labels.final}</span>
                {job.result.alreadyOptimized ? (
                  <span><strong>{labels.alreadyOptimizedBadge}</strong></span>
                ) : (
                  <span><strong>{job.result.savedPercent}%</strong>{labels.saved}</span>
                )}
              </div>
            ) : null}
            <div className="email-capture">
              <label htmlFor="result-email">{labels.emailTitle}</label>
              <input id="result-email" type="email" placeholder={labels.emailPlaceholder} />
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
            <h2 id="compression-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
