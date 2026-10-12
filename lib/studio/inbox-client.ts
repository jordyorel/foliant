import type {InboxList, InboxStatus} from "./inbox-types";

export class InboxClientError extends Error {
  constructor(public code: string) { super(code); }
}

export async function inboxRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {...init, cache: "no-store"});
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new InboxClientError(body?.code ?? (response.status === 401 ? "sign_in_required" : response.status === 429 ? "rate_limit" : "inbox_unavailable"));
  if (!body) throw new InboxClientError("inbox_unavailable");
  return body as T;
}

export function inboxListUrl(status: InboxStatus, offset = 0, search = "", sort = "newest") {
  return `/api/studio/inbox?${new URLSearchParams({status, offset: String(offset), search, sort})}`;
}

export function fetchInboxList(status: InboxStatus, offset = 0, search = "", sort = "newest", signal?: AbortSignal) {
  return inboxRequest<InboxList>(inboxListUrl(status, offset, search, sort), {signal});
}

// Reuse the same key after an uncertain network response; a retry must not
// create a second receipt for the same intended deposit.
export function receiveInboxFile(file: File, key: string, signal?: AbortSignal) {
  return inboxRequest<import("./inbox-types").InboxReceipt>("/api/studio/inbox", {
    method: "POST", signal,
    headers: {"Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(file.name), "Idempotency-Key": key},
    body: file
  });
}

export function inboxErrorKey(error: unknown) {
  const code = error instanceof InboxClientError ? error.code : "";
  const keys: Record<string, string> = {
    sign_in_required: "signIn", file_too_large: "fileTooLarge", invalid_pdf: "invalidPdf",
    invalid_file_name: "invalidName", quota_exceeded: "quota", conflict: "conflict",
    not_found: "notFound", rate_limit: "rate", rate_limited: "rate", pdf_password_required: "protectedText"
  };
  return keys[code] ?? "unavailable";
}
