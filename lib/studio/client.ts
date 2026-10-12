import type {StudioDocument} from "@/content/studio";

type StudioDocumentsResponse = {
  documents?: StudioDocument[];
};

type StudioDocumentResponse = {
  document?: StudioDocument;
};

function retryDelay(attempt: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, attempt === 0 ? 250 : 700);
    signal?.addEventListener("abort", abort, {once: true});
    if (signal?.aborted) abort();
  });
}

class HttpError extends Error {
  constructor(readonly status: number) { super(`Request failed: ${status}`); }
}

async function resilientJson<T>(url: string, attempts = 3, missingValue?: T, signal?: AbortSignal): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      signal?.throwIfAborted();
      const response = await fetch(url, {cache: "no-store", signal});

      if (response.status === 404 && missingValue !== undefined) return missingValue;

      if (!response.ok) throw new HttpError(response.status);
      return await response.json() as T;
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      if (error instanceof HttpError && error.status < 500 && error.status !== 408 && error.status !== 429) throw error;
      lastError = error instanceof Error ? error : new Error("Request failed");
      if (attempt < attempts - 1) await retryDelay(attempt, signal);
    }
  }

  throw lastError ?? new Error("Request failed");
}

export async function fetchStudioDocuments(locale: string, signal?: AbortSignal) {
  const body = await resilientJson<StudioDocumentsResponse>(
    `/api/studio/documents?locale=${encodeURIComponent(locale)}`, 3, undefined, signal
  );

  return Array.isArray(body.documents) ? body.documents : [];
}

export async function fetchStudioDocument(documentId: string, locale: string, signal?: AbortSignal) {
  const body = await resilientJson<StudioDocumentResponse>(
    `/api/studio/documents/${encodeURIComponent(documentId)}?locale=${encodeURIComponent(locale)}`,
    3,
    {}, signal
  );

  return body.document ?? null;
}
