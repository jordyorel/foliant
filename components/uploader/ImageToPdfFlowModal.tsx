"use client";

import {useEffect, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";
import {formatSize, uploadFileWithProgress as uploadFile} from "./upload";

export type ImageToPdfFlowLabels = {
  close: string;
  uploadingTitle: string;
  readyTitle: string;
  creatingTitle: string;
  successTitle: string;
  successSubtitle: string;
  filesCount: string;
  totalSize: string;
  onePdf: string;
  create: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  empty: string;
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

type ImageToPdfFlowModalProps = {
  files: File[];
  tool: ToolAction;
  labels: ImageToPdfFlowLabels;
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "creating" | "completed" | "failed";

type Entry = {
  name: string;
  size: number;
  fileId: string;
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

export function ImageToPdfFlowModal({files, tool, labels, onClose}: ImageToPdfFlowModalProps) {
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const errorLabels: ErrorLabels = {
    error: labels.error,
    errorTooLarge: labels.errorTooLarge,
    errorUnsupportedType: labels.errorUnsupportedType,
    errorInvalidFile: labels.errorInvalidFile
  };
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  useEffect(() => {
    let cancelled = false;

    async function uploadAll() {
      try {
        setFlowState("uploading");
        let uploadedBytes = 0;
        const nextEntries: Entry[] = [];

        for (const file of files) {
          const initResponse = await fetch("/api/upload/init", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              tool,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || "image/jpeg"
            })
          });

          if (!initResponse.ok) throw new Error(await messageFromResponse(initResponse, errorLabels));
          const init = await initResponse.json() as {fileId: string; uploadUrl: string};
          if (cancelled) return;

          await uploadFile(init.uploadUrl, file, errorLabels, (percent) => {
            if (cancelled) return;
            const overall = totalBytes > 0
              ? Math.round(((uploadedBytes + (percent / 100) * file.size) / totalBytes) * 100)
              : 0;
            setUploadProgress(Math.min(100, overall));
          });

          uploadedBytes += file.size;
          nextEntries.push({name: file.name, size: file.size, fileId: init.fileId});
        }

        if (cancelled) return;
        setEntries(nextEntries);
        setUploadProgress(100);
        setFlowState("ready");
      } catch (uploadError) {
        if (cancelled) return;
        setError(uploadError instanceof Error && uploadError.message ? uploadError.message : labels.error);
        setFlowState("failed");
      }
    }

    void uploadAll();

    return () => {
      cancelled = true;
    };
  }, [files, tool]);

  async function poll(jobId: string) {
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
      void poll(jobId).catch(() => {
        setError(labels.error);
        setFlowState("failed");
      });
    }, 700);
  }

  async function startCreate() {
    if (entries.length === 0) return;

    try {
      setError("");
      setFlowState("creating");
      setJobProgress(8);

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: entries.map((entry) => entry.fileId),
          options: {}
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, errorLabels));
      const created = await jobResponse.json() as JobResponse;
      setJobProgress(created.progress);
      await poll(created.id);
    } catch (createError) {
      setError(createError instanceof Error && createError.message ? createError.message : labels.error);
      setFlowState("failed");
    }
  }

  function move(index: number, delta: number) {
    setEntries((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeAt(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="image-pdf-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="image-pdf-flow-title">{labels.uploadingTitle}</h2>
            <div className="file-summary">
              <span><strong>{labels.filesCount}</strong> {files.length}</span>
              <span><strong>{labels.totalSize}</strong> {formatSize(totalBytes)}</span>
            </div>
            <div className="large-progress" aria-label={labels.uploadingTitle}>
              <span style={{width: `${uploadProgress}%`}} />
            </div>
            <p className="progress-percent">{uploadProgress}%</p>
          </div>
        ) : null}

        {flowState === "ready" ? (
          <div className="flow-panel">
            <h2 id="image-pdf-flow-title">{labels.readyTitle}</h2>
            <div className="merge-list">
              {entries.map((entry, index) => (
                <div className="mini-card merge-row" key={entry.fileId}>
                  <span className="merge-name">{entry.name}</span>
                  <span className="badge">{formatSize(entry.size)}</span>
                  <button
                    className="merge-icon-button"
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={labels.moveUp}
                  >
                    <i className="ti ti-arrow-up" aria-hidden="true" />
                  </button>
                  <button
                    className="merge-icon-button"
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === entries.length - 1}
                    aria-label={labels.moveDown}
                  >
                    <i className="ti ti-arrow-down" aria-hidden="true" />
                  </button>
                  <button
                    className="merge-icon-button danger"
                    type="button"
                    onClick={() => removeAt(index)}
                    aria-label={labels.remove}
                  >
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {entries.length === 0 ? <p className="drop-note">{labels.empty}</p> : null}
            <button
              className="modal-primary"
              type="button"
              onClick={startCreate}
              disabled={entries.length === 0}
            >
              {labels.create}
            </button>
          </div>
        ) : null}

        {flowState === "creating" ? (
          <div className="flow-panel compact">
            <h2 id="image-pdf-flow-title">{labels.creatingTitle}</h2>
            <div className="large-progress" aria-label={labels.creatingTitle}>
              <span style={{width: `${jobProgress}%`}} />
            </div>
            <p className="progress-percent">{jobProgress}%</p>
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="image-pdf-flow-title">{labels.successTitle}</h2>
            <p className="modal-subtitle">{labels.successSubtitle}</p>
            <div className="file-summary">
              <span><strong>{labels.filesCount}</strong> {entries.length}</span>
              <span><strong>{labels.onePdf}</strong></span>
            </div>
            <div className="email-capture">
              <label htmlFor="image-pdf-result-email">{labels.emailTitle}</label>
              <input id="image-pdf-result-email" type="email" placeholder={labels.emailPlaceholder} />
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
            <h2 id="image-pdf-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
