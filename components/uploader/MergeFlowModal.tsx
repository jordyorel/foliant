"use client";

import {useEffect, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";

export type MergeFlowLabels = {
  close: string;
  uploadingTitle: string;
  readyTitle: string;
  mergingTitle: string;
  successTitle: string;
  successSubtitle: string;
  filesCount: string;
  totalSize: string;
  onePdf: string;
  download: string;
  emailTitle: string;
  emailPlaceholder: string;
  terms: string;
  continue: string;
  loginText: string;
  login: string;
  another: string;
  merge: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  empty: string;
  error: string;
  errorTooLarge: string;
  errorUnsupportedType: string;
  errorInvalidFile: string;
};

type MergeFlowModalProps = {
  files: File[];
  tool: ToolAction;
  labels: MergeFlowLabels;
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "merging" | "completed" | "failed";

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
        // Non-JSON error body.
      }

      reject(new Error((messageFromCode(code, labels) ?? serverMessage) || labels.error));
    };

    request.onerror = () => reject(new Error(labels.error));
    request.open("PUT", uploadUrl);
    request.send(file);
  });
}

export function MergeFlowModal({files, tool, labels, onClose}: MergeFlowModalProps) {
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
              mimeType: file.type || "application/pdf"
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
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error && err.message ? err.message : labels.error);
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
      setError(nextJob.error || labels.error);
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

  async function startMerge() {
    if (entries.length < 2) return;

    try {
      setError("");
      setFlowState("merging");
      setJobProgress(8);

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({tool, fileIds: entries.map((entry) => entry.fileId), options: {}})
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, errorLabels));
      const created = await jobResponse.json() as JobResponse;
      setJobProgress(created.progress);
      await poll(created.id);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : labels.error);
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
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="merge-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="merge-flow-title">{labels.uploadingTitle}</h2>
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
            <h2 id="merge-flow-title">{labels.readyTitle}</h2>
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
            {entries.length < 2 ? <p className="drop-note">{labels.empty}</p> : null}
            <button
              className="modal-primary"
              type="button"
              onClick={startMerge}
              disabled={entries.length < 2}
            >
              {labels.merge}
            </button>
          </div>
        ) : null}

        {flowState === "merging" ? (
          <div className="flow-panel compact">
            <h2 id="merge-flow-title">{labels.mergingTitle}</h2>
            <div className="large-progress" aria-label={labels.mergingTitle}>
              <span style={{width: `${jobProgress}%`}} />
            </div>
            <p className="progress-percent">{jobProgress}%</p>
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="merge-flow-title">{labels.successTitle}</h2>
            <p className="modal-subtitle">{labels.successSubtitle}</p>
            <div className="file-summary">
              <span><strong>{labels.filesCount}</strong> {files.length}</span>
              <span><strong>{labels.onePdf}</strong></span>
            </div>
            <div className="email-capture">
              <label htmlFor="merge-result-email">{labels.emailTitle}</label>
              <input id="merge-result-email" type="email" placeholder={labels.emailPlaceholder} />
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
            <h2 id="merge-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
