import {messageFromCode, type ErrorLabels} from "./clientError";

export type JobResponse = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  step: string;
  resultUrl?: string;
  error?: string;
  errorCode?: string;
};

export function formatSize(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return `${mb < 1 ? mb.toFixed(2) : mb.toFixed(1)} MB`;
}

/**
 * Uploads a file with real progress and maps server error codes to localized
 * messages. Shared by all upload flow modals.
 */
export function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  labels: ErrorLabels,
  onProgress: (progress: number) => void
) {
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
