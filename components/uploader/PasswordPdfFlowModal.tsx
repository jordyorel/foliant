"use client";
import {useTransferLifecycle} from "./useTransferLifecycle";
import {pollJobUntilSettled} from "@/lib/jobs/client-poll";
import {ProcessingStatus} from "./ProcessingStatus";

import {useEffect, useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {messageFromCode, messageFromResponse, type ErrorLabels} from "./clientError";
import {redirectToGuestStudio} from "./guestStudio";
import {formatSize, uploadFileWithProgress, type JobResponse} from "./upload";

export type PasswordPdfMode = "protect" | "unlock";

export type PasswordPdfFlowLabels = {
  add: string;
  close: string;
  title: string;
  uploading: string;
  processing: string;
  done: string;
  successSubtitle: string;
  fileName: string;
  currentSize: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmLabel: string;
  confirmPlaceholder: string;
  mismatch: string;
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
  errorQpdfMissing: string;
};

type PasswordPdfFlowModalProps = {
  file: File;
  mode: PasswordPdfMode;
  tool: ToolAction;
  labels: PasswordPdfFlowLabels;
  onClose: () => void;
};

type FlowState = "uploading" | "ready" | "processing" | "completed" | "failed";

type UploadState = {
  fileId: string;
  uploadUrl: string;
};

export function PasswordPdfFlowModal({file, mode, tool, labels, onClose}: PasswordPdfFlowModalProps) {
  const {getSignal, runSubmission, retryCount, retry, retryLabel, errorExpired} = useTransferLifecycle(file, tool);
  const [flowState, setFlowState] = useState<FlowState>("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const errorLabels: ErrorLabels = {
    error: labels.error,
    errorTooLarge: labels.errorTooLarge,
    errorUnsupportedType: labels.errorUnsupportedType,
    errorInvalidFile: labels.errorInvalidFile,
    errorQpdfMissing: labels.errorQpdfMissing
  };
  const isProtect = mode === "protect";
  const hasMismatch = isProtect && confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = Boolean(upload) &&
    password.trim().length > 0 &&
    (!isProtect || (confirmPassword.trim().length > 0 && password === confirmPassword));
  const progress = uploadProgress;

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

  async function startProcessing() {
    return runSubmission(async () => {
      const signal = getSignal();
    if (!upload || !canSubmit) return;

    try {
      setError("");
      setFlowState("processing");

      const jobResponse = await fetch("/api/jobs", {
        signal,
          method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: [upload.fileId],
          options: {pdfPassword: password}
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, {...errorLabels, errorExpired}));

      const createdJob = await jobResponse.json() as JobResponse;
      setPassword("");
      setConfirmPassword("");
      await pollJob(createdJob.id);
    } catch (processingError) {
      setPassword("");
      setConfirmPassword("");
      setError(processingError instanceof Error ? processingError.message : labels.error);
      setFlowState("failed");
    }
    });
  }

  return (
    <div className="processing-overlay" role="dialog" aria-modal="true" aria-labelledby="password-pdf-flow-title">
      <div className="processing-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label={labels.close}>
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        {flowState === "uploading" ? (
          <div className="flow-panel compact">
            <h2 id="password-pdf-flow-title">{labels.uploading}</h2>
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
            <h2 id="password-pdf-flow-title">{labels.title}</h2>
            <div className="file-summary">
              <span><strong>{labels.fileName}</strong> {file.name}</span>
              <span><strong>{labels.currentSize}</strong> {formatSize(file.size)}</span>
            </div>
            <label className="split-field">
              <span>{labels.passwordLabel}</span>
              <input
                className="split-input"
                type="password"
                autoComplete={isProtect ? "new-password" : "current-password"}
                value={password}
                placeholder={labels.passwordPlaceholder}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {isProtect ? (
              <label className="split-field">
                <span>{labels.confirmLabel}</span>
                <input
                  className="split-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  placeholder={labels.confirmPlaceholder}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
            ) : null}
            {hasMismatch ? <p className="field-hint error">{labels.mismatch}</p> : null}
            <button className="modal-primary" type="button" onClick={startProcessing} disabled={!canSubmit}>
              {labels.submit}
            </button>
          </div>
        ) : null}

        {flowState === "processing" ? (
          <div className="flow-panel compact">
            <h2 id="password-pdf-flow-title">{labels.processing}</h2>
            <ProcessingStatus label={labels.processing} />
          </div>
        ) : null}

        {flowState === "completed" ? (
          <div className="flow-panel">
            <div className="success-icon"><i className="ti ti-check" aria-hidden="true" /></div>
            <h2 id="password-pdf-flow-title">{labels.done}</h2>
            <p className="modal-subtitle">{labels.successSubtitle}</p>
            <div className="email-capture">
              <label htmlFor="password-pdf-result-email">{labels.emailTitle}</label>
              <input id="password-pdf-result-email" type="email" placeholder={labels.emailPlaceholder} />
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
            <h2 id="password-pdf-flow-title">{labels.error}</h2>
            <p className="upload-error">{error || labels.error}</p>
            <button className="modal-primary" type="button" onClick={retry}><i className="ti ti-refresh" aria-hidden="true" />{retryLabel}</button>
            <button className="text-button" type="button" onClick={onClose}>{labels.another}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
