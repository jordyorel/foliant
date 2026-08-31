"use client";

import {useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {CompressionFlowModal} from "./CompressionFlowModal";
import {messageFromCode, messageFromResponse} from "./clientError";

type UploadDropzoneProps = {
  title: string;
  button: string;
  note: string;
  accept?: string;
  tool: ToolAction;
  labels: {
    selected: string;
    start: string;
    uploading: string;
    queued: string;
    processing: string;
    completed: string;
    download: string;
    error: string;
    errorTooLarge: string;
    errorUnsupportedType: string;
    errorInvalidFile: string;
    alreadyOptimizedBadge: string;
    original: string;
    final: string;
    saved: string;
    close: string;
    compressionUploadingTitle: string;
    compressionPreparing: string;
    compressionFileName: string;
    compressionCurrentSize: string;
    compressionSelectLevel: string;
    compressionBestSize: string;
    compressionBestSizeText: string;
    compressionBestQuality: string;
    compressionBestQualityText: string;
    compressionCompress: string;
    compressionCompressingTitle: string;
    compressionCompletedTitle: string;
    compressionCompletedText: string;
    compressionAlreadyOptimizedText: string;
    compressionEmailTitle: string;
    compressionEmailPlaceholder: string;
    compressionTerms: string;
    compressionContinue: string;
    compressionLoginText: string;
    compressionLogin: string;
    compressionAnother: string;
  };
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

function formatSize(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return `${mb < 1 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
}

export function UploadDropzone({title, button, note, accept, tool, labels}: UploadDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [active, setActive] = useState(false);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [modalFile, setModalFile] = useState<File | null>(null);
  const isWorking = job?.status === "queued" || job?.status === "processing" || statusText === labels.uploading;
  const isCompressionTool = tool === "compress_pdf" || tool === "compress_image";

  async function pollJob(jobId: string) {
    const response = await fetch(`/api/jobs/${jobId}`);
    if (!response.ok) throw new Error(labels.error);
    const nextJob = await response.json() as JobResponse;
    setJob(nextJob);
    setStatusText(nextJob.step);

    if (nextJob.status === "completed") {
      setDownloadUrl(nextJob.resultUrl ?? `/api/jobs/${jobId}/download`);
      setStatusText(labels.completed);
      return;
    }

    if (nextJob.status === "failed") {
      setError((messageFromCode(nextJob.errorCode, labels) ?? nextJob.error) || labels.error);
      setStatusText("");
      return;
    }

    window.setTimeout(() => {
      void pollJob(jobId).catch(() => {
        setError(labels.error);
      });
    }, 700);
  }

  async function startJob() {
    if (!file || isWorking) return;

    setError("");
    setDownloadUrl(null);
    setJob(null);

    try {
      setStatusText(labels.uploading);
      const initResponse = await fetch("/api/upload/init", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream"
        })
      });

      if (!initResponse.ok) throw new Error(await messageFromResponse(initResponse, labels));

      const upload = await initResponse.json() as {fileId: string; uploadUrl: string};

      const uploadResponse = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: file
      });

      if (!uploadResponse.ok) throw new Error(await messageFromResponse(uploadResponse, labels));

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          tool,
          fileIds: [upload.fileId],
          options: {}
        })
      });

      if (!jobResponse.ok) throw new Error(await messageFromResponse(jobResponse, labels));

      const createdJob = await jobResponse.json() as JobResponse;
      setJob(createdJob);
      setStatusText(createdJob.step || labels.queued);
      await pollJob(createdJob.id);
    } catch (err) {
      setStatusText("");
      setError(err instanceof Error && err.message ? err.message : labels.error);
    }
  }

  return (
    <div className="upload-panel" aria-label="Zone d'upload">
      <label
        className={`dropzone${active ? " is-active" : ""}`}
        onDragEnter={() => setActive(true)}
        onDragOver={() => setActive(true)}
        onDragLeave={() => setActive(false)}
        onDrop={() => setActive(false)}
      >
        <input
          type="file"
          accept={accept}
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            if (isCompressionTool && nextFile) {
              setModalFile(nextFile);
              event.currentTarget.value = "";
              return;
            }
            setFile(nextFile);
          }}
          className="hidden-file-input"
        />
        <span className="drop-content">
          <span className="drop-icon"><i className="ti ti-file-upload" aria-hidden="true" /></span>
          <span className="drop-title">{title}</span>
          <span className="primary-button"><i className="ti ti-upload" aria-hidden="true" />{button}</span>
          <span className="drop-note">{note}</span>
        </span>
      </label>
      {file ? (
        <div className="upload-job" aria-live="polite">
          <div className="mini-card">
            <span><strong>{file.name}</strong>{labels.selected}</span>
            <span className="badge">{formatSize(file.size)}</span>
          </div>
          <button className="primary-button upload-action" type="button" onClick={startJob} disabled={isWorking}>
            {isWorking ? statusText : labels.start}
          </button>
          {job ? (
            <div className="job-progress">
              <span style={{width: `${job.progress}%`}} />
            </div>
          ) : null}
          {job?.result ? (
            <div className="result-stats">
              <span><strong>{formatSize(job.result.originalSize)}</strong>{labels.original}</span>
              <span><strong>{formatSize(job.result.outputSize)}</strong>{labels.final}</span>
              {job.result.alreadyOptimized ? (
                <span><strong>{labels.alreadyOptimizedBadge}</strong></span>
              ) : (
                <span><strong>{job.result.savedPercent}%</strong>{labels.saved}</span>
              )}
            </div>
          ) : null}
          {downloadUrl ? (
            <a className="download-link" href={downloadUrl}>{labels.download}</a>
          ) : null}
          {error ? <p className="upload-error">{error}</p> : null}
        </div>
      ) : null}
      {modalFile ? (
        <CompressionFlowModal
          file={modalFile}
          tool={tool}
          onClose={() => setModalFile(null)}
          labels={{
            close: labels.close,
            uploadingTitle: labels.compressionUploadingTitle,
            preparing: labels.compressionPreparing,
            fileName: labels.compressionFileName,
            currentSize: labels.compressionCurrentSize,
            selectLevel: labels.compressionSelectLevel,
            bestSize: labels.compressionBestSize,
            bestSizeText: labels.compressionBestSizeText,
            bestQuality: labels.compressionBestQuality,
            bestQualityText: labels.compressionBestQualityText,
            compress: labels.compressionCompress,
            compressingTitle: labels.compressionCompressingTitle,
            completedTitle: labels.compressionCompletedTitle,
            completedText: labels.compressionCompletedText,
            alreadyOptimizedText: labels.compressionAlreadyOptimizedText,
            emailTitle: labels.compressionEmailTitle,
            emailPlaceholder: labels.compressionEmailPlaceholder,
            terms: labels.compressionTerms,
            continue: labels.compressionContinue,
            loginText: labels.compressionLoginText,
            login: labels.compressionLogin,
            download: labels.download,
            another: labels.compressionAnother,
            error: labels.error,
            errorTooLarge: labels.errorTooLarge,
            errorUnsupportedType: labels.errorUnsupportedType,
            errorInvalidFile: labels.errorInvalidFile,
            alreadyOptimizedBadge: labels.alreadyOptimizedBadge,
            original: labels.original,
            final: labels.final,
            saved: labels.saved
          }}
        />
      ) : null}
    </div>
  );
}
