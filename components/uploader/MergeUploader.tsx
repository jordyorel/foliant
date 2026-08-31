"use client";

import {useState} from "react";
import type {ToolAction} from "@/content/tools/actions";
import {MergeFlowModal, type MergeFlowLabels} from "./MergeFlowModal";

type MergeLabels = MergeFlowLabels & {add: string};

export function MergeUploader({tool, accept, note, labels}: {
  tool: ToolAction;
  accept: string;
  note: string;
  labels: MergeLabels;
}) {
  const [active, setActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );
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
        <MergeFlowModal
          files={pendingFiles}
          tool={tool}
          onClose={() => setPendingFiles(null)}
          labels={labels}
        />
      ) : null}
    </div>
  );
}
