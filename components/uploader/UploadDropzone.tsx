"use client";

import {useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import dynamic from "next/dynamic";
import {UploadFlowLoading} from "./UploadFlowLoading";

const CompressionFlowModal = dynamic(() => import("./CompressionFlowModal").then((module) => module.CompressionFlowModal), {loading: UploadFlowLoading});
const SimpleFileFlowModal = dynamic(() => import("./SimpleFileFlowModal").then((module) => module.SimpleFileFlowModal), {loading: UploadFlowLoading});

type UploadDropzoneProps = {
  title: string;
  button: string;
  note: string;
  accept?: string;
  tool: ToolAction;
  labels: {
    selected: string;
    start: string;
    ready: string;
    uploading: string;
    queued: string;
    processing: string;
    completed: string;
    completedText: string;
    download: string;
    error: string;
    errorTooLarge: string;
    errorUnsupportedType: string;
    errorInvalidFile: string;
    errorLibreOfficeMissing: string;
    errorPdfTextMissing: string;
    another: string;
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

export function UploadDropzone({title, button, note, accept, tool, labels}: UploadDropzoneProps) {
  const [active, setActive] = useState(false);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const isCompressionTool = tool === "compress_pdf" || tool === "compress_image";

  function selectFile(list: FileList | null) {
    const nextFile = list?.[0];
    if (!nextFile) return;
    setModalFile(nextFile);
  }

  return (
    <div className="upload-panel" aria-label="Zone d'upload">
      <label
        className={`dropzone${active ? " is-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setActive(false);
          selectFile(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept={accept}
          onChange={(event) => {
            selectFile(event.target.files);
            event.currentTarget.value = "";
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
      {modalFile ? (
        isCompressionTool ? (
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
        ) : (
          <SimpleFileFlowModal
            file={modalFile}
            tool={tool}
            onClose={() => setModalFile(null)}
            labels={{
              close: labels.close,
              ready: labels.ready,
              uploading: labels.uploading,
              processing: labels.processing,
              completed: labels.completed,
              completedText: labels.completedText,
              fileName: labels.compressionFileName,
              currentSize: labels.compressionCurrentSize,
              start: labels.start,
              download: labels.download,
              emailTitle: labels.compressionEmailTitle,
              emailPlaceholder: labels.compressionEmailPlaceholder,
              terms: labels.compressionTerms,
              continue: labels.compressionContinue,
              loginText: labels.compressionLoginText,
              login: labels.compressionLogin,
              another: labels.another,
              error: labels.error,
              errorTooLarge: labels.errorTooLarge,
              errorUnsupportedType: labels.errorUnsupportedType,
              errorInvalidFile: labels.errorInvalidFile,
              errorLibreOfficeMissing: labels.errorLibreOfficeMissing,
              errorPdfTextMissing: labels.errorPdfTextMissing
            }}
          />
        )
      ) : null}
    </div>
  );
}
