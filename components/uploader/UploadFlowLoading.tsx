"use client";

import {useLocale} from "next-intl";

export function UploadFlowLoading() {
  const locale = useLocale();
  const labels: Record<string, string> = {fr: "Préparation de l'import…", en: "Preparing upload…", es: "Preparando la carga…", pt: "Preparando o envio…"};
  return <div className="processing-overlay"><div className="processing-modal flow-loading" role="status" aria-live="polite"><p>{labels[locale] ?? labels.en}</p></div></div>;
}
