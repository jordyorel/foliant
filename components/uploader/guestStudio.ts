"use client";

const supportedLocales = new Set(["fr", "en", "es", "pt"]);

export function guestStudioDocumentUrl(jobId: string, pathname = globalThis.location?.pathname ?? "/fr", tool?: string) {
  const localeCandidate = pathname.split("/").filter(Boolean)[0];
  const locale = supportedLocales.has(localeCandidate) ? localeCandidate : "fr";
  const intent = tool === "fill_pdf" || tool === "sign_pdf" ? `&tool=${tool}` : "";
  return `/${locale}/studio/documents/${encodeURIComponent(jobId)}?entry=guest${intent}`;
}

export function redirectToGuestStudio(jobId: string, tool?: string) {
  window.location.assign(guestStudioDocumentUrl(jobId, undefined, tool));
}
