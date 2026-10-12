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
  if (bytes < 1024) return `${Math.max(0, bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Uploads a file with real progress and maps server error codes to localized
 * messages. Shared by all upload flow modals.
 */
export function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  labels: ErrorLabels,
  onProgress: (progress: number) => void,
  signal?: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const aborted = () => { request.abort(); reject(signal?.reason ?? new DOMException("Aborted", "AbortError")); };
    if (signal?.aborted) { aborted(); return; }
    signal?.addEventListener("abort", aborted, {once: true});
    request.onloadend = () => signal?.removeEventListener("abort", aborted);
    request.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    request.timeout = 120_000;
    request.ontimeout = () => reject(new Error(labels.error));

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))));
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
