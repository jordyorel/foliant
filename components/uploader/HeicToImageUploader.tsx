"use client";

import {useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {HeicToImageFlowModal, type HeicFlowLabels} from "./HeicToImageFlowModal";

export function HeicToImageUploader({tool, accept, note, labels}: {
  tool: ToolAction;
  accept: string;
  note: string;
  labels: HeicFlowLabels;
}) {
  const [active, setActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function selectFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;

    const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      setPendingFile(file);
    }
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
          selectFile(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept={accept}
          className="hidden-file-input"
          onChange={(event) => {
            selectFile(event.target.files);
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

      {pendingFile ? (
        <HeicToImageFlowModal
          file={pendingFile}
          tool={tool}
          onClose={() => setPendingFile(null)}
          labels={labels}
        />
      ) : null}
    </div>
  );
}
