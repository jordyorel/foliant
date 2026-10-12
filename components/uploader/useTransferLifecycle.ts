"use client";

import {useEffect, useRef, useState} from "react";
import {useLocale} from "next-intl";

export function useTransferLifecycle(selection: File | File[], tool: string) {
  const locale = useLocale();
  const [retryCount, setRetryCount] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const submission = useRef(false);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    submission.current = false;
    return () => current.abort();
  }, [selection, tool, retryCount]);

  function getSignal() {
    if (!controller.current) controller.current = new AbortController();
    return controller.current.signal;
  }

  async function runSubmission(work: () => Promise<void>) {
    if (submission.current || getSignal().aborted) return;
    const signal = getSignal();
    submission.current = true;
    try { await work(); }
    finally { if (getSignal() === signal) submission.current = false; }
  }

  const messages = {
    fr: {retry: "Réessayer avec ce fichier", expired: "Le transfert a expiré. Réimportez le fichier pour continuer."},
    en: {retry: "Retry with this file", expired: "The upload has expired. Upload the file again to continue."},
    es: {retry: "Reintentar con este archivo", expired: "La carga ha caducado. Vuelve a subir el archivo para continuar."},
    pt: {retry: "Tentar novamente com este arquivo", expired: "O envio expirou. Envie o arquivo novamente para continuar."}
  };
  const copy = messages[locale as keyof typeof messages] ?? messages.en;
  return {getSignal, runSubmission, retryCount, retry: () => setRetryCount((count) => count + 1), retryLabel: copy.retry, errorExpired: copy.expired};
}
