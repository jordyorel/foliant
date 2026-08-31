"use client";

import {useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {ImageToPdfFlowModal, type ImageToPdfFlowLabels} from "./ImageToPdfFlowModal";

type ImageToPdfUploaderLabels = ImageToPdfFlowLabels & {
  add: string;
};

const supportedImageExtensions = [".jpg", ".jpeg", ".png", ".heic", ".heif"];
const supportedImageMimeTypes = ["image/jpeg", "image/png", "image/heic", "image/heif"];

function isSupportedImage(file: File) {
  const normalizedName = file.name.toLowerCase();
  return supportedImageMimeTypes.includes(file.type) ||
    supportedImageExtensions.some((extension) => normalizedName.endsWith(extension));
}

export function ImageToPdfUploader({tool, accept, note, labels}: {
  tool: ToolAction;
  accept: string;
  note: string;
  labels: ImageToPdfUploaderLabels;
}) {
  const [active, setActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter(isSupportedImage);
    if (incoming.length === 0) return;
    setPendingFiles(incoming);
  }

  return (
    <div className="upload-panel" aria-label={labels.add}>
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
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept={accept}
          multiple
          className="hidden-file-input"
          onChange={(event) => {
            addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
        <span className="drop-content">
          <span className="drop-icon"><i className="ti ti-file-upload" aria-hidden="true" /></span>
          <span className="drop-title">{labels.add}</span>
          <span className="primary-button"><i className="ti ti-upload" aria-hidden="true" />{labels.add}</span>
          <span className="drop-note">{note}</span>
        </span>
      </label>

      {pendingFiles ? (
        <ImageToPdfFlowModal
          files={pendingFiles}
          tool={tool}
          onClose={() => setPendingFiles(null)}
          labels={labels}
        />
      ) : null}
    </div>
  );
}
